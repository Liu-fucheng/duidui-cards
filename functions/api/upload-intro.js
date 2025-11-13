// 文件路径: /functions/api/upload-intro.js
// 用途: 接收 Bot 发送的简介图片并上传到 R2

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // 1. 验证来源（与 upload.js 相同的验证机制）
    const authHeader = request.headers.get('Authorization');
    const expectedToken = env.WEBHOOK_SECRET || 'your-secret-token';
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedToken) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未授权访问' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 2. 检查 R2 绑定
    if (!env.R2_BUCKET) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'R2未绑定' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 3. 获取上传的文件
    const formData = await request.formData();
    const imageFile = formData.get('image');
    const filename = formData.get('filename'); // 如 "intros/intro_xxx.png"
    
    if (!imageFile || !filename) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少文件或文件名' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 4. 上传到 R2
    await env.R2_BUCKET.put(filename, imageFile.stream(), {
      httpMetadata: { 
        contentType: 'image/png' 
      }
    });
    
    // 5. 生成公开 URL
    const publicUrl = `${env.R2_PUBLIC_URL}/${filename}`;
    
    console.log(`✅ 简介图片已上传: ${filename}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      url: publicUrl,
      filename: filename
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('上传简介图片失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

















