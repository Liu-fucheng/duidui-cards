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
    
    // 从D1查询（返回所有字段）
    const result = await env.D1_DB.prepare(
      `SELECT * FROM cards_v2 WHERE id = ?`
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
    
    // 解析附件元数据
    console.log('🔍 [card-detail] 数据库原始数据 (cardId=' + cardId + '):');
    console.log('  - attachmentOriginalNames 原始值:', result.attachmentOriginalNames, '类型:', typeof result.attachmentOriginalNames, '是否为null:', result.attachmentOriginalNames === null, '是否为空字符串:', result.attachmentOriginalNames === '');
    console.log('  - attachmentDescriptions 原始值:', result.attachmentDescriptions, '类型:', typeof result.attachmentDescriptions, '是否为null:', result.attachmentDescriptions === null, '是否为空字符串:', result.attachmentDescriptions === '');
    console.log('  - attachmentSummary 原始值:', result.attachmentSummary, '类型:', typeof result.attachmentSummary, '是否为null:', result.attachmentSummary === null, '是否为空字符串:', result.attachmentSummary === '');
    console.log('  - attachmentKeys 原始值:', result.attachmentKeys, '类型:', typeof result.attachmentKeys);
    
    let attachmentOriginalNames = [];
    if (result.attachmentOriginalNames) {
      try {
        const parsed = JSON.parse(result.attachmentOriginalNames);
        if (Array.isArray(parsed)) {
          attachmentOriginalNames = parsed;
        }
        console.log('  - attachmentOriginalNames 解析后:', attachmentOriginalNames);
      } catch (e) {
        console.error('解析附件原始名称失败:', e);
      }
    }
    
    let attachmentDescriptions = [];
    if (result.attachmentDescriptions) {
      try {
        const parsed = JSON.parse(result.attachmentDescriptions);
        if (Array.isArray(parsed)) {
          attachmentDescriptions = parsed;
        }
        console.log('  - attachmentDescriptions 解析后:', attachmentDescriptions);
      } catch (e) {
        console.error('解析附件描述失败:', e, '原始值:', result.attachmentDescriptions);
      }
    } else {
      console.log('  - attachmentDescriptions 为空或null');
    }
    
    // 解析JSON字段
    const cardData = {
      cardId: result.id,
      cardName: result.cardName,
      cardType: result.cardType,
      characters: result.characters ? JSON.parse(result.characters) : [],
      category: result.category,
      authorName: result.authorName,
      isAnonymous: result.isAnonymous,
      orientation: result.orientation ? JSON.parse(result.orientation) : [],
      background: result.background ? JSON.parse(result.background) : [],
      tags: result.tags ? JSON.parse(result.tags) : [],
      warnings: result.warnings,
      secondaryWarning: result.secondaryWarning,
      description: result.description,
      threadTitle: result.threadTitle,
      otherInfo: result.otherInfo,
      introImageUrl: `${r2PublicUrl}/intros/intro_${result.id}.png`, // 简介图URL
      avatarImageUrl: result.avatarImageKey ? `${r2PublicUrl}/${result.avatarImageKey}` : null,
      cardFileUrl: result.cardFileKey ? `${r2PublicUrl}/${result.cardFileKey}` : null,
      cardFileKey: result.cardFileKey,
      cardJsonFileKey: result.cardJsonFileKey,
      attachmentKeys: result.attachmentKeys ? JSON.parse(result.attachmentKeys) : [],
      attachmentOriginalNames,
      attachmentDescriptions,
      attachmentSummary: result.attachmentSummary || '',
      galleryImageUrls: result.galleryImageKeys ? JSON.parse(result.galleryImageKeys).map(key => `${r2PublicUrl}/${key}`) : [],
      threadId: result.threadId,
      firstMessageId: result.firstMessageId,
      createdAt: result.createdAt,
      // 下载要求
      downloadRequirements: result.downloadRequirements ? JSON.parse(result.downloadRequirements) : [],
      requireReaction: result.requireReaction || false,
      requireComment: result.requireComment || false,
      // 提交者信息
      submitterUserId: result.submitterUserId,
      submitterUsername: result.submitterUsername,
      submitterDisplayName: result.submitterDisplayName,
      nameRelation: result.nameRelation
    };
    
    return new Response(JSON.stringify({ 
      success: true, 
      card: cardData 
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

export async function onRequestPatch(context) {
  try {
    const { request, env } = context;
    
    // 从URL获取cardId
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
    
    // 解析请求体
    const body = await request.json();
    
    // 构建UPDATE语句
    const updates = [];
    const values = [];
    
    if (body.threadId !== undefined) {
      updates.push('threadId = ?');
      values.push(body.threadId);
    }
    
    if (body.firstMessageId !== undefined) {
      updates.push('firstMessageId = ?');
      values.push(body.firstMessageId);
    }
    
    if (updates.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '没有要更新的字段' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 添加cardId到values
    values.push(cardId);
    
    // 执行更新
    const sql = `UPDATE cards_v2 SET ${updates.join(', ')} WHERE id = ?`;
    await env.D1_DB.prepare(sql).bind(...values).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '更新成功' 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('更新角色卡失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

