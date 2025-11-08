// 文件路径: /functions/api/card-detail.js
// 用途: 查询单个角色卡的详细信息（供Bot使用）

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    // 从URL获取cardId: /api/card-detail?id=xxx
    const url = new URL(request.url);
    const cardId = url.searchParams.get('id');
    
    if (!cardId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少cardId参数' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 检查D1绑定
    if (!env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 从D1查询
    const result = await env.D1_DB.prepare(
      `SELECT id, cardName, category, description, avatarImageKey, cardFileKey, 
              threadId, firstMessageId, createdAt
       FROM cards_v2 
       WHERE id = ?`
    ).bind(cardId).first();
    
    if (!result) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '角色卡不存在' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 生成公开URL
    const r2PublicUrl = env.R2_PUBLIC_URL || 'http://r2.liuyaocheng.org';
    
    const cardData = {
      cardId: result.id,
      cardName: result.cardName,
      category: result.category,
      description: result.description,
      introImageUrl: `${r2PublicUrl}/intros/intro_${result.id}.png`, // 简介图URL
      avatarImageUrl: result.avatarImageKey ? `${r2PublicUrl}/${result.avatarImageKey}` : null,
      cardFileUrl: result.cardFileKey ? `${r2PublicUrl}/${result.cardFileKey}` : null,
      threadId: result.threadId,
      firstMessageId: result.firstMessageId,
      createdAt: result.createdAt
    };
    
    return new Response(JSON.stringify({ 
      success: true, 
      data: cardData 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('查询角色卡失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

