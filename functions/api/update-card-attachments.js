// 更新角色卡附件接口
// 允许用户更新已上传卡片的附件文件

// 验证来源（与 update-card-files.js 相同的验证机制）
function verifyToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  const expectedToken = env.WEBHOOK_SECRET || 'your-secret-token';
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedToken) {
    return false;
  }
  
  return true;
}

async function uploadFileToR2(bucket, file, folder) {
  const fileKey = `${folder}/${crypto.randomUUID()}-${file.name}`;
  await bucket.put(fileKey, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  return fileKey;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // 验证Token
    if (!verifyToken(request, env)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "未授权：需要有效的管理员Token" 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 检查绑定
    if (!env.D1_DB || !env.R2_BUCKET) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "服务器D1或R2未正确绑定" 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const formData = await request.formData();
    const cardId = formData.get("cardId");
    
    if (!cardId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "缺少卡片ID" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 查询卡片是否存在
    const card = await env.D1_DB.prepare(
      'SELECT * FROM cards_v2 WHERE id = ?'
    ).bind(cardId).first();
    
    if (!card) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "卡片不存在" 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 收集所有附件
    const attachments = formData.getAll("attachments");
    
    if (!attachments || attachments.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "没有附件" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`收到 ${attachments.length} 个附件`);
    
    // 上传所有附件到R2
    const attachmentKeys = [];
    for (const attachment of attachments) {
      if (attachment && attachment.size > 0) {
        const attachmentKey = await uploadFileToR2(env.R2_BUCKET, attachment, "attachments");
        if (attachmentKey) {
          attachmentKeys.push(attachmentKey);
          console.log(`✅ 附件上传成功: ${attachmentKey}`);
        }
      }
    }
    
    if (attachmentKeys.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "附件上传失败" 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 删除旧附件（如果有）
    if (card.attachmentKeys) {
      try {
        const oldKeys = JSON.parse(card.attachmentKeys);
        const deletePromises = oldKeys.map(key => 
          env.R2_BUCKET.delete(key).catch(err => {
            console.warn(`删除旧附件失败 ${key}:`, err);
          })
        );
        await Promise.all(deletePromises);
        console.log(`已删除 ${oldKeys.length} 个旧附件`);
      } catch (e) {
        console.warn('解析或删除旧附件失败:', e);
      }
    }
    
    // 更新数据库
    const attachmentKeysJson = JSON.stringify(attachmentKeys);
    await env.D1_DB.prepare(
      `UPDATE cards_v2 SET attachmentKeys = ?, updatedAt = datetime('now') WHERE id = ?`
    ).bind(attachmentKeysJson, cardId).run();
    
    console.log(`✅ 已更新附件: cardId=${cardId}, 附件数=${attachmentKeys.length}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "附件更新成功",
      attachmentCount: attachmentKeys.length
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('更新附件失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}


