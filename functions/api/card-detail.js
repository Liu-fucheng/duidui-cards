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
    
    // --- (开始) 附件解析逻辑修改 ---

    // 1. 解析 Keys (作为附件数量的基准)
    let attachmentKeys = [];
    if (result.attachmentKeys) {
      try {
        const parsed = JSON.parse(result.attachmentKeys);
        if (Array.isArray(parsed)) {
          attachmentKeys = parsed;
        }
      } catch (e) {
        console.error('解析附件Keys失败:', e, '原始值:', result.attachmentKeys);
      }
    }
    const attachmentCount = attachmentKeys.length;
    console.log(`  - attachmentKeys 解析后: ${attachmentCount} 个附件`);

    // 2. 解析 OriginalNames
    let attachmentOriginalNames = [];
    if (result.attachmentOriginalNames) {
      try {
        const parsed = JSON.parse(result.attachmentOriginalNames);
        if (Array.isArray(parsed)) {
          attachmentOriginalNames = parsed;
        }
        console.log('  - attachmentOriginalNames 解析后 (原始):', attachmentOriginalNames);
      } catch (e) {
        console.error('解析附件原始名称失败:', e, '原始值:', result.attachmentOriginalNames);
      }
    }

    // 3. 解析 Descriptions
    let attachmentDescriptions = [];
    if (result.attachmentDescriptions && result.attachmentDescriptions !== 'null') { // 增加 'null' 字符串检查
      try {
        const parsed = JSON.parse(result.attachmentDescriptions);
        if (Array.isArray(parsed)) {
          attachmentDescriptions = parsed;
        }
        console.log('  - attachmentDescriptions 解析后 (原始):', attachmentDescriptions);
      } catch (e) {
        console.error('解析附件描述失败:', e, '原始值:', result.attachmentDescriptions);
      }
    } else {
      console.log('  - attachmentDescriptions 为空或null');
    }

    // 4. [修复] 确保 Names 和 Descriptions 数组长度与 Keys 数组长度一致，用空字符串填充缺失项
    if (attachmentCount > 0) {
      const correctedNames = [];
      const correctedDescriptions = [];
      
      for (let i = 0; i < attachmentCount; i++) {
        correctedNames.push(attachmentOriginalNames[i] || ""); // 如果 Names 数组对应位置没有值，填空字符串
        correctedDescriptions.push(attachmentDescriptions[i] || ""); // 如果 Descriptions 数组对应位置没有值，填空字符串
      }
      
      if (attachmentOriginalNames.length !== attachmentCount) {
        console.warn(`[!] 附件原始名称数量 (${attachmentOriginalNames.length}) 与 Keys 数量 (${attachmentCount}) 不匹配。已填充。`);
        attachmentOriginalNames = correctedNames;
      }
      
      if (attachmentDescriptions.length !== attachmentCount) {
        console.warn(`[!] 附件描述数量 (${attachmentDescriptions.length}) 与 Keys 数量 (${attachmentCount}) 不匹配。已填充。`);
        attachmentDescriptions = correctedDescriptions;
      }
    }
    
    // --- (结束) 附件解析逻辑修改 ---

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
      attachmentKeys: attachmentKeys, // <-- 使用修复后的
      attachmentOriginalNames, // <-- 使用修复后的
      attachmentDescriptions, // <-- 使用修复后的
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
    
    // 验证管理员权限
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未授权：需要管理员Token' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const token = authHeader.substring(7);
    const adminToken = env.ADMIN_TOKEN || env.DB_ADMIN_TOKEN;
    if (token !== adminToken) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未授权：Token无效' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
    
    // 检查卡片是否存在
    const existingCard = await env.D1_DB.prepare(
      'SELECT * FROM cards_v2 WHERE id = ?'
    ).bind(cardId).first();
    
    if (!existingCard) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '卡片不存在' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 获取表结构，确定哪些字段可以更新
    const tableInfo = await env.D1_DB.prepare('PRAGMA table_info(cards_v2)').all();
    const allowedColumns = tableInfo.results ? tableInfo.results.map(col => col.name) : [];
    
    // 不允许更新的字段（主键、自动生成的字段等）
    const restrictedFields = ['id', 'createdAt'];
    
    // 解析请求体
    const body = await request.json();
    
    // 构建UPDATE语句
    const updates = [];
    const values = [];
    
    // 定义需要JSON序列化的字段
    const jsonFields = [
      'characters', 'orientation', 'background', 'tags', 
      'galleryImageKeys', 'attachmentKeys', 'attachmentOriginalNames', 
      'attachmentDescriptions', 'downloadRequirements', 'primaryTags'
    ];
    
    // 定义需要整数转换的字段
    const integerFields = ['requireReaction', 'requireComment', 'likes'];
    
    // 遍历请求体中的所有字段
    for (const [key, value] of Object.entries(body)) {
      // 跳过不允许更新的字段
      if (restrictedFields.includes(key)) {
        continue;
      }
      
      // 检查字段是否存在
      if (!allowedColumns.includes(key)) {
        console.warn(`字段 ${key} 不存在于表中，跳过`);
        continue;
      }
      
      // 处理不同类型的字段
      let processedValue = value;
      
      if (value === null || value === undefined) {
        // null 值直接传递
        processedValue = null;
      } else if (jsonFields.includes(key)) {
        // JSON 字段需要序列化
        if (Array.isArray(value) || typeof value === 'object') {
          processedValue = JSON.stringify(value);
        } else if (typeof value === 'string') {
          // 如果已经是字符串，尝试解析验证
          try {
            JSON.parse(value);
            processedValue = value; // 已经是有效的JSON字符串
          } catch (e) {
            // 不是有效的JSON，尝试作为普通字符串处理
            processedValue = JSON.stringify(value);
          }
        }
      } else if (integerFields.includes(key)) {
        // 整数字段转换
        processedValue = value === true ? 1 : (value === false ? 0 : parseInt(value) || 0);
      } else if (typeof value === 'boolean') {
        // 其他布尔值转换为整数
        processedValue = value ? 1 : 0;
      } else {
        // 其他字段直接使用
        processedValue = value;
      }
      
      updates.push(`${key} = ?`);
      values.push(processedValue);
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
    
    // 添加 updatedAt 时间戳
    updates.push('updatedAt = datetime(\'now\')');
    
    // 添加cardId到values
    values.push(cardId);
    
    // 执行更新
    const sql = `UPDATE cards_v2 SET ${updates.join(', ')} WHERE id = ?`;
    await env.D1_DB.prepare(sql).bind(...values).run();
    
    console.log(`✅ 已更新卡片 ${cardId}，更新了 ${updates.length - 1} 个字段`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: '更新成功',
      updatedFields: updates.length - 1
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
