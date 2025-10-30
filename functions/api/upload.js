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

  // Discord发帖函数
  async function postToDiscord(env, cardData) {
    // 分区ID映射
    const CHANNEL_MAPPING = {
      '非边限': env.DISCORD_CHANNEL_FEIBIANXIAN || '1429315799146954762',
      '边限': env.DISCORD_CHANNEL_BIANXIAN || '1429315841903558788', 
      '深渊': env.DISCORD_CHANNEL_SHENYUAN || '1429315883368710264'
    };

    const channelId = CHANNEL_MAPPING[cardData.category];
    if (!channelId) {
      throw new Error(`未知的分区: ${cardData.category}`);
    }

    const botToken = env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      throw new Error('DISCORD_BOT_TOKEN未配置');
    }

    // 获取或创建webhook
    const webhook = await getOrCreateWebhook(channelId, botToken);
    
    // 构建帖子内容（与预览界面一致）
    const postContent = formatDiscordPost(cardData, env);
    
    // 构建头像URL（优先级：上传的头像 > PNG角色卡 > 默认头像）
    let avatarUrl = null;
    if (cardData.avatarImageKey) {
      avatarUrl = `${env.R2_PUBLIC_URL}/${cardData.avatarImageKey}`;
    } else if (cardData.cardFileKey) {
      avatarUrl = `${env.R2_PUBLIC_URL}/${cardData.cardFileKey}`;
    }

    // 发帖
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: postContent.main,
        username: cardData.authorName,
        avatar_url: avatarUrl,
        thread_name: cardData.threadTitle || `${cardData.cardName} - ${cardData.authorName}`,
        wait: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord发帖失败: ${response.status} ${error}`);
    }

    const message = await response.json();
    console.log('Discord发帖成功:', message.id);
    
    let threadId = null;
    let firstMessageId = message.id;

    // 检查是否创建了thread
    if (message.thread) {
      threadId = message.thread.id;
      // 发送附加内容
      await sendAdditionalContent(threadId, cardData, botToken, env);
    } else if (message.channel_id) {
      // 如果是普通频道，message就在主频道中
      threadId = message.channel_id;
    }

    // 保存角色卡数据到KV（包含完整URL）
    try {
      const kvCardData = {
        cardId: cardData.cardId,
        cardName: cardData.cardName,
        authorName: cardData.authorName,
        category: cardData.category,
        orientation: cardData.orientation,
        tags: cardData.tags,
        description: cardData.description,
        warnings: cardData.warnings,
        otherInfo: cardData.otherInfo,
        threadId,
        firstMessageId,
        // 完整的文件URL
        avatarImageUrl: cardData.avatarImageKey ? `${env.R2_PUBLIC_URL}/${cardData.avatarImageKey}` : null,
        cardFileUrl: `${env.R2_PUBLIC_URL}/${cardData.cardFileKey}`,
        galleryImageUrls: cardData.galleryImageKeys.map(key => `${env.R2_PUBLIC_URL}/${key}`),
        uploadTime: new Date().toISOString()
      };
      
      await saveCharacterCardToKV(env, kvCardData);
    } catch (kvError) {
      console.error('保存到KV失败:', kvError);
      // 不影响主流程
    }

    return {
      threadId,
      firstMessageId,
      message
    };
  }

  // 保存角色卡数据到KV
  async function saveCharacterCardToKV(env, cardData) {
    if (!env.CLOUDFLARE_KV_NAMESPACE) {
      console.log('KV namespace未配置，跳过保存');
      return;
    }

    const key = `card_${cardData.cardId}`;
    await env.CLOUDFLARE_KV_NAMESPACE.put(key, JSON.stringify(cardData));
    console.log(`角色卡已保存到KV: ${key}`);
  }

  // 发送发卡日志
  async function sendUploadLog(env, logData) {
    const UPLOAD_LOG_CHANNEL_ID = '1429834614431547553';  // 发卡日志频道
    const botToken = env.DISCORD_BOT_TOKEN;
    
    if (!botToken) {
      console.error('DISCORD_BOT_TOKEN未配置，无法发送日志');
      return;
    }

    // 分区ID映射（用于生成频道链接）
    const CHANNEL_MAPPING = {
      '非边限': env.DISCORD_CHANNEL_FEIBIANXIAN || '1429315799146954762',
      '边限': env.DISCORD_CHANNEL_BIANXIAN || '1429315841903558788', 
      '深渊': env.DISCORD_CHANNEL_SHENYUAN || '1429315883368710264'
    };

    const channelId = CHANNEL_MAPPING[logData.category];
    
    // 生成时间字符串
    const now = new Date();
    const timeStr = now.toLocaleDateString('zh-CN', { 
      month: 'numeric', 
      day: 'numeric' 
    }).replace('/', '月') + '日';

    // 生成帖子URL
    const threadUrl = `https://discord.com/channels/${logData.guildId || '1338365085072101416'}/${logData.threadId}`;
    
    // 构建日志消息：xx（账号：xxx）于时间在分区投递角色卡xxx（名字），标题：xxx - url
    const logMessage = `${logData.displayName}（账号：${logData.username}）于${timeStr}在<#${channelId}>投递角色卡${logData.cardName}，标题：${logData.threadTitle} - ${threadUrl}`;

    try {
      // 使用Bot API发送日志
      const response = await fetch(`https://discord.com/api/v10/channels/${UPLOAD_LOG_CHANNEL_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: logMessage
        })
      });

      if (response.ok) {
        console.log('发卡日志已发送');
      } else {
        const error = await response.text();
        console.error('发送日志失败:', response.status, error);
      }
    } catch (error) {
      console.error('发送日志时出错:', error);
    }
  }

  // 获取或创建webhook
  async function getOrCreateWebhook(channelId, botToken) {
    // 获取现有webhooks
    const webhooksResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!webhooksResponse.ok) {
      throw new Error(`获取webhooks失败: ${webhooksResponse.status}`);
    }

    const webhooks = await webhooksResponse.json();
    const existingWebhook = webhooks.find(wh => wh.name === '角色卡投递');

    if (existingWebhook) {
      return existingWebhook;
    }

    // 创建新webhook
    const createResponse = await fetch(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '角色卡投递',
      })
    });

    if (!createResponse.ok) {
      throw new Error(`创建webhook失败: ${createResponse.status}`);
    }

    return await createResponse.json();
  }

  // 格式化Discord帖子内容
  function formatDiscordPost(cardData, env) {
    let content = '';
    
    // 基本信息
    content += `**卡名：** ${cardData.cardName}\n`;
    content += `**马甲：** ${cardData.authorName}\n`;
    
    // 角色名（仅不同名或多人卡显示）
    if (cardData.cardType === 'multi' || (cardData.cardType === 'single' && cardData.characters.length > 0)) {
      content += `**角色：** ${cardData.characters.join(' / ')}\n`;
    }
    
    // 性向
    if (cardData.orientation && cardData.orientation.length > 0) {
      content += `**性向：** ${cardData.orientation.join(' / ')}\n`;
    }
    
    // Tags
    if (cardData.tags && cardData.tags.length > 0) {
      content += `**Tags：** ${cardData.tags.join(' / ')}\n`;
    }
    
    content += '\n';
    
    // 排雷
    content += `**排雷：**\n${cardData.warnings || '未填写'}\n\n`;
    
    // 简介（非深渊分区显示）
    if (cardData.category !== '深渊' && cardData.description) {
      content += `**简介：**\n${cardData.description}\n\n`;
    }
    
    // 其他信息
    if (cardData.otherInfo) {
      content += `${cardData.otherInfo}\n`;
    }

    return {
      main: content
    };
  }

  // 发送附加内容（简介按钮、下载按钮等）
  async function sendAdditionalContent(threadId, cardData, botToken, env) {
    const baseUrl = `https://discord.com/api/v10/channels/${threadId}/messages`;
    
    try {
      // 如果是深渊分区，发送点赞按钮
      if (cardData.category === '深渊') {
        await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: '',
            components: [{
              type: 1,
              components: [{
                type: 2,
                style: 2,
                label: '❤️',
                custom_id: `like_post_${cardData.cardId}`
              }]
            }]
          })
        });
      }
      
      // 发送查看简介按钮
      await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '点击下方按钮查看角色卡简介：',
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 1,
              label: '查看简介',
              custom_id: `view_intro_${cardData.cardId}`
            }]
          }]
        })
      });
      
      // 发送下载按钮
      await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: '点击下方按钮下载角色卡：',
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 3,
              label: '下载角色卡',
              custom_id: `download_card_${cardData.cardId}`
            }]
          }]
        })
      });
      
    } catch (error) {
      console.error('发送附加内容失败:', error);
      // 不抛出错误，因为主帖已经发送成功
    }
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

      // 上传头像 (单文件，选填)
      let avatarImageKey = null;
      const avatarImage = formData.get("avatarImage");
      if (avatarImage && avatarImage.size > 0) {
        avatarImageKey = await uploadFileToR2(env.R2_BUCKET, avatarImage, "avatars");
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
      
      // 3.5. 自动收集自定义板块数据
      // 读取配置以识别自定义板块字段
      let customSectionsData = {};
      try {
        const configRow = await env.D1_DB.prepare('SELECT value FROM app_config WHERE key = ?')
          .bind('ui_config')
          .first();
        if (configRow && configRow.value) {
          const config = JSON.parse(configRow.value);
          if (config.customSections && Array.isArray(config.customSections)) {
            // 遍历每个自定义板块，收集对应的表单数据
            config.customSections.forEach(section => {
              const sectionKey = `section_${section.title}`;
              const values = formData.getAll(sectionKey);
              if (values.length > 0) {
                customSectionsData[section.title] = values;
              }
            });
          }
        }
      } catch (configError) {
        console.error('读取配置或收集自定义板块数据失败:', configError);
        // 继续执行，不影响主流程
      }
      
      // 将自定义板块数据合并到 otherInfo
      let otherInfoValue = formData.get("otherInfo") || "";
      if (Object.keys(customSectionsData).length > 0) {
        const customDataStr = Object.entries(customSectionsData)
          .map(([key, values]) => `${key}: ${values.join(', ')}`)
          .join('\n');
        otherInfoValue = otherInfoValue ? `${otherInfoValue}\n\n${customDataStr}` : customDataStr;
      }
  
      // 4. 准备插入 D1 数据库 (使用新表 cards_v2)
      // 注意：如果表中没有相关字段，需要先执行:
      // ALTER TABLE cards_v2 ADD COLUMN avatarImageKey TEXT;
      // ALTER TABLE cards_v2 ADD COLUMN threadId TEXT;
      // ALTER TABLE cards_v2 ADD COLUMN firstMessageId TEXT;
      const cardId = crypto.randomUUID();

      // 5. 先发帖到Discord，获取thread信息
      let discordInfo = null;
      try {
        discordInfo = await postToDiscord(env, {
          cardId,
          cardName: formData.get("cardName") || "未命名",
          cardType: formData.get("cardType"),
          characters: JSON.parse(characters),
          category: formData.get("category"),
          authorName,
          isAnonymous,
          orientation: JSON.parse(orientation),
          tags: JSON.parse(tags),
          warnings: formData.get("warnings"),
          description: formData.get("description"),
          threadTitle: formData.get("threadTitle") || "",
          otherInfo: otherInfoValue,
          avatarImageKey,
          galleryImageKeys,
          cardFileKey
        });

        // 发送日志（仅发帖成功时）
        if (discordInfo && discordInfo.threadId) {
          await sendUploadLog(env, {
            displayName: authorName,
            username: formData.get("authorId") || '未知',
            category: formData.get("category"),
            cardName: formData.get("cardName") || "未命名",
            threadTitle: formData.get("threadTitle") || "",
            threadId: discordInfo.threadId,
            guildId: '1338365085072101416'
          });
        }
      } catch (discordError) {
        console.error("Discord发帖失败:", discordError);
        // 继续保存到数据库，但没有Discord信息
      }

      // 6. 插入数据库，包含Discord信息
      const stmt = env.D1_DB.prepare(
        `INSERT INTO cards_v2 (id, cardName, cardType, characters, category, authorName, authorId, isAnonymous, 
          orientation, background, tags, userLimit, warnings, description, secondaryWarning, threadTitle, otherInfo,
          avatarImageKey, galleryImageKeys, cardFileKey, attachmentKeys, threadId, firstMessageId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        cardId,
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
        formData.get("threadTitle") || "",
        otherInfoValue,
        avatarImageKey, // 头像文件 key
        JSON.stringify(galleryImageKeys), // JSON string
        cardFileKey,
        JSON.stringify(attachmentKeys), // JSON string
        discordInfo?.threadId || null, // Discord thread ID
        discordInfo?.firstMessageId || null // Discord首楼消息 ID
      );

      await stmt.run();

      return new Response(JSON.stringify({ success: true, message: "卡片上传成功！" }), { status: 200, headers: { "Content-Type": "application/json" } });
  
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ success: false, message: "服务器内部错误: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }