// 更新角色卡文件接口
// 允许用户更新已上传卡片的 PNG 和/或 JSON 文件

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
    
    // 处理文件上传
    const cardFile = formData.get("cardFile");  // PNG文件
    const cardJsonFile = formData.get("cardJsonFile");  // JSON文件
    
    if (!cardFile && !cardJsonFile) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "至少需要提供一个文件" 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 准备更新数据
    let updateFields = [];
    let updateValues = [];
    
    // 上传PNG文件（如果有）
    if (cardFile && cardFile.size > 0) {
      const cardFileKey = await uploadFileToR2(env.R2_BUCKET, cardFile, "cards");
      if (!cardFileKey) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "PNG文件上传失败" 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 删除旧文件（如果有）
      if (card.cardFileKey) {
        try {
          await env.R2_BUCKET.delete(card.cardFileKey);
        } catch (e) {
          console.error('删除旧PNG文件失败:', e);
        }
      }
      
      updateFields.push('cardFileKey = ?');
      updateValues.push(cardFileKey);
    }
    
    // 上传JSON文件（如果有）
    if (cardJsonFile && cardJsonFile.size > 0) {
      const cardJsonFileKey = await uploadFileToR2(env.R2_BUCKET, cardJsonFile, "cards");
      if (!cardJsonFileKey) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "JSON文件上传失败" 
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 删除旧JSON文件（如果有）
      if (card.cardJsonFileKey) {
        try {
          await env.R2_BUCKET.delete(card.cardJsonFileKey);
        } catch (e) {
          console.error('删除旧JSON文件失败:', e);
        }
      }
      
      updateFields.push('cardJsonFileKey = ?');
      updateValues.push(cardJsonFileKey);
    }
    
    // 更新数据库
    if (updateFields.length > 0) {
      updateFields.push('updatedAt = datetime(\'now\')');
      updateValues.push(cardId);
      
      const updateQuery = `UPDATE cards_v2 SET ${updateFields.join(', ')} WHERE id = ?`;
      await env.D1_DB.prepare(updateQuery).bind(...updateValues).run();
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "文件更新成功" 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('更新文件失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

