// 文件路径: /functions/api/upload.js

/**
 * 辅助函数：将文件上传到 R2 并返回 Key
 */
async function uploadFileToR2(bucket, file, folder) {
    if (!file || typeof file.stream !== "function" || file.size === 0) {
      return null; // 不是有效的文件或空文件
    }
    const fileKey = `${folder}/${crypto.randomUUID()}-${file.name}`;
    await bucket.put(fileKey, file.stream(), {
      httpMetadata: { contentType: file.type },
    });
    return fileKey;
  }
  
  export async function onRequestPost(context) {
    try {
      const { request, env } = context;
      
      // 检查绑定
      if (!env.D1_DB || !env.R2_BUCKET) {
        return new Response(JSON.stringify({ success: false, message: "服务器D1或R2未正确绑定" }), { status: 500 });
      }
      
      const formData = await request.formData();
  
      // 1. 处理作者逻辑
      const authorType = formData.get("authorType"); // 'real' 或 'anonymous'
      let isAnonymous = authorType === "anonymous" ? 1 : 0;
      let authorName = formData.get("authorName") || "";
      let authorId = formData.get("authorId") || ""; // Discord bot 传入的作者ID
      if (isAnonymous && authorName.trim() === "") {
        authorName = "匿名"; // 匿名且马甲为空，则默认为"匿名"
      }
  
      // 2. 处理文件上传 (并行)
      const cardFile = formData.get("cardFile");
      if (!cardFile || cardFile.size === 0) {
        return new Response(JSON.stringify({ success: false, message: "必须上传角色卡文件" }), { status: 400 });
      }
  
      // 上传主卡片
      const cardFileKey = await uploadFileToR2(env.R2_BUCKET, cardFile, "cards");
      if (!cardFileKey) {
          return new Response(JSON.stringify({ success: false, message: "主卡片文件上传失败" }), { status: 400 });
      }
  
      // 上传主楼图片 (多图)
      const galleryFiles = formData.getAll("galleryImages");
      const galleryUploadPromises = galleryFiles.map(file => uploadFileToR2(env.R2_BUCKET, file, "gallery"));
      const galleryImageKeys = (await Promise.all(galleryUploadPromises)).filter(Boolean); // 过滤掉 null
  
      // 上传其它附件 (多图)
      const attachmentFiles = formData.getAll("attachments");
      const attachmentUploadPromises = attachmentFiles.map(file => uploadFileToR2(env.R2_BUCKET, file, "attachments"));
      const attachmentKeys = (await Promise.all(attachmentUploadPromises)).filter(Boolean);
  
      // 3. 处理数组/JSON 数据
      const characters = JSON.stringify(formData.getAll("characters").filter(c => c.trim() !== ""));
      const orientation = JSON.stringify(formData.getAll("orientation"));
      const tags = JSON.stringify(formData.getAll("tags"));
      const backgrounds = JSON.stringify(formData.getAll("background"));
  
      // 4. 准备插入 D1 数据库 (使用新表 cards_v2)
      // 注意：如果表中没有 authorId 字段，需要先执行 ALTER TABLE cards_v2 ADD COLUMN authorId TEXT;
      const stmt = env.D1_DB.prepare(
        `INSERT INTO cards_v2 (id, cardName, cardType, characters, category, authorName, authorId, isAnonymous, 
          orientation, background, tags, userLimit, warnings, description, secondaryWarning, 
          galleryImageKeys, cardFileKey, attachmentKeys)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        formData.get("cardName") || "未命名",
        formData.get("cardType"), // 'single' or 'multi'
        characters, // JSON string
        formData.get("category"),
        authorName,
        authorId, // Discord 用户ID
        isAnonymous,
        orientation, // JSON string
        backgrounds, // JSON string
        tags, // JSON string
        JSON.stringify(formData.getAll("userLimit").filter(v => v && v.trim() !== "")) || "[]",
        formData.get("warnings"),
        formData.get("description"),
        formData.get("secondaryWarning"), // 二次排雷
        JSON.stringify(galleryImageKeys), // JSON string
        cardFileKey,
        JSON.stringify(attachmentKeys) // JSON string
      );
  
      await stmt.run();
  
      return new Response(JSON.stringify({ success: true, message: "卡片上传成功！" }), { status: 200, headers: { "Content-Type": "application/json" } });
  
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ success: false, message: "服务器内部错误: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }