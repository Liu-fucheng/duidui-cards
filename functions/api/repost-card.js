// 新文件: functions/api/repost-card.js

// --- 验证管理员Token (从 cards.js 复制) ---
function verifyAdminToken(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    const token = authHeader.substring(7);
    const adminToken = env.ADMIN_TOKEN || env.DB_ADMIN_TOKEN;
    return token === adminToken;
  }
  
  // --- 从 upload.js 复制 notifyDiscordBot 函数 ---
  // 注意：这个函数必须被复制过来，因为它在 upload.js 中没有被导出
  async function notifyDiscordBot(env, cardData) {
    const botUrl = env.DISCORD_BOT_URL || 'https://your-bot-url.onrender.com';
    const webhookSecret = env.WEBHOOK_SECRET || 'your-secret-token';
    
    console.log(`📤 [REPOST] 通知Bot发帖: ${botUrl}/api/post-card`);
    
    const payload = {
      cardId: cardData.cardId,
      cardName: cardData.cardName,
      cardType: cardData.cardType,
      characters: cardData.characters,
      category: cardData.category,
      authorName: cardData.authorName,
      isAnonymous: cardData.isAnonymous,
      orientation: cardData.orientation,
      background: cardData.background,
      tags: cardData.tags,
      warnings: cardData.warnings,
      description: cardData.description,
      threadTitle: cardData.threadTitle,
      otherInfo: cardData.otherInfo,
      avatarImageUrl: cardData.avatarImageKey ? `${env.R2_PUBLIC_URL}/${cardData.avatarImageKey}` : null,
      cardFileUrl: `${env.R2_PUBLIC_URL}/${cardData.cardFileKey}`,
      galleryImageUrls: cardData.galleryImageKeys.map(key => `${env.R2_PUBLIC_URL}/${key}`),
      downloadRequirements: cardData.downloadRequirements || [],
      requireReaction: cardData.requireReaction || false,
      requireComment: cardData.requireComment || false,
      // 提交者信息
      submitterUserId: cardData.submitterUserId,
      submitterUsername: cardData.submitterUsername,
      submitterDisplayName: cardData.submitterDisplayName,
      // 主要标签
      primaryTags: cardData.primaryTags || []
    };
    
    try {
      const response = await fetch(`${botUrl}/api/post-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${webhookSecret}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });
      
      if (response.ok) {
        const result = await response.json(); // result 应该包含 { threadId, firstMessageId }
        console.log('✅ [REPOST] Bot已接收发卡请求:', result);
        return { success: true, ...result }; // 返回完整结果
      } else {
        const errorText = await response.text();
        console.error('❌ [REPOST] Bot响应错误:', response.status, errorText);
        throw new Error(`Bot响应错误: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ [REPOST] 通知Bot失败:', error);
      return { success: false, error: error.message };
    }
  }

  // --- 保存角色卡数据到KV（供Bot交互下载使用） ---
  async function saveCharacterCardToKV(env, cardData) {
    if (!env.CLOUDFLARE_KV_NAMESPACE) return;
    const key = `card_${cardData.cardId}`;
    const persist = {
      cardId: cardData.cardId,
      cardName: cardData.cardName,
      authorName: cardData.authorName,
      category: cardData.category,
      orientation: cardData.orientation || [],
      background: cardData.background || [],
      tags: cardData.tags || [],
      description: cardData.description,
      warnings: cardData.warnings,
      otherInfo: cardData.otherInfo,
      avatarImageUrl: cardData.avatarImageUrl || null,
      cardFileUrl: cardData.cardFileUrl,
      galleryImageUrls: cardData.galleryImageUrls || [],
      uploadTime: new Date().toISOString()
    };
    await env.CLOUDFLARE_KV_NAMESPACE.put(key, JSON.stringify(persist));
  }
  
  // --- POST 请求处理器 ---
  export async function onRequestPost(context) {
    const { request, env } = context;
    
    // 1. 验证权限
    if (!verifyAdminToken(request, env)) {
      return new Response(JSON.stringify({ success: false, message: '未授权' }), { status: 401 });
    }
    
    if (!env.D1_DB || !env.R2_BUCKET || !env.DISCORD_BOT_URL) {
      return new Response(JSON.stringify({ success: false, message: '服务器D1, R2或Bot URL未配置' }), { status: 500 });
    }
  
    try {
      const url = new URL(request.url);
      const cardId = url.searchParams.get('id');
      if (!cardId) {
        return new Response(JSON.stringify({ success: false, message: '缺少卡片ID' }), { status: 400 });
      }
  
      // 2. 从数据库获取卡片数据
      const card = await env.D1_DB.prepare(
        'SELECT * FROM cards_v2 WHERE id = ?'
      ).bind(cardId).first();
  
      if (!card) {
        return new Response(JSON.stringify({ success: false, message: '卡片不存在' }), { status: 404 });
      }
  
      // 3. 从 otherInfo 中解析下载要求
      let downloadRequirements = [];
      if (card.otherInfo) {
        // 查找 "下载要求: xxx, yyy" 格式
        const match = card.otherInfo.match(/下载要求:\s*([^\n]+)/);
        if (match) {
          downloadRequirements = match[1].split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      const requireLike = downloadRequirements.includes('点赞') || downloadRequirements.includes('like');
      const requireComment = downloadRequirements.includes('评论') || downloadRequirements.includes('comment');
  
      // 3. 准备数据并通知Bot
      const payload = {
        cardId: card.id,
        cardName: card.cardName,
        cardType: card.cardType,
        characters: JSON.parse(card.characters || '[]'),
        category: card.category,
        authorName: card.authorName,
        isAnonymous: card.isAnonymous,
        orientation: JSON.parse(card.orientation || '[]'),
        background: JSON.parse(card.background || '[]'),
        tags: JSON.parse(card.tags || '[]'),
        warnings: card.warnings,
        description: card.description,
        threadTitle: card.threadTitle,
        otherInfo: card.otherInfo,
        avatarImageKey: card.avatarImageKey,
        galleryImageKeys: JSON.parse(card.galleryImageKeys || '[]'),
        cardFileKey: card.cardFileKey,
        downloadRequirements: downloadRequirements,
        requireReaction: requireLike,
        requireComment: requireComment,
        // 提交者信息
        submitterUserId: card.submitterUserId,
        submitterUsername: card.submitterUsername,
        submitterDisplayName: card.submitterDisplayName,
        // 主要标签
        primaryTags: JSON.parse(card.primaryTags || '[]')
      };

      const makeUrl = (key) => (env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${key}` : null);
      const notifyResult = await notifyDiscordBot(env, {
        ...payload,
        avatarImageUrl: payload.avatarImageKey ? makeUrl(payload.avatarImageKey) : null,
        cardFileUrl: makeUrl(payload.cardFileKey),
        galleryImageUrls: payload.galleryImageKeys.map(key => makeUrl(key)).filter(Boolean),
        forceRegenerate: true  // 重发时强制重新生成简介图片
      });
  
      if (notifyResult.success && notifyResult.threadId) {
        // 保存到KV，供下载按钮使用
        try {
          await saveCharacterCardToKV(env, {
            cardId: payload.cardId,
            cardName: payload.cardName,
            authorName: payload.authorName,
            category: payload.category,
            orientation: JSON.parse(card.orientation || '[]'),
            background: JSON.parse(card.background || '[]'),
            tags: JSON.parse(card.tags || '[]'),
            description: payload.description,
            warnings: payload.warnings,
            otherInfo: payload.otherInfo,
            avatarImageUrl: payload.avatarImageKey ? `${env.R2_PUBLIC_URL}/${payload.avatarImageKey}` : null,
            cardFileUrl: `${env.R2_PUBLIC_URL}/${payload.cardFileKey}`,
            galleryImageUrls: JSON.parse(card.galleryImageKeys || '[]').map(key => `${env.R2_PUBLIC_URL}/${key}`)
          });
        } catch (kvErr) {
          console.error('保存到KV失败:', kvErr);
        }
        // 4. 成功后，更新数据库中的 threadId
        await env.D1_DB.prepare(
          'UPDATE cards_v2 SET threadId = ?, firstMessageId = ? WHERE id = ?'
        ).bind(
          notifyResult.threadId,
          notifyResult.firstMessageId || null,
          cardId
        ).run();
        
        return new Response(JSON.stringify({ success: true, message: '重发成功', threadId: notifyResult.threadId }));
      } else {
        throw new Error(notifyResult.error || 'Bot未能返回threadId');
      }
    
    } catch (error) {
      console.error('重发失败:', error);
      return new Response(JSON.stringify({ success: false, message: '重发失败: ' + error.message }), { status: 500 });
    }
  }
  
  // (可选) 为 /api/repost-card 添加 OPTIONS 处理器（如果遇到CORS问题）
  export async function onRequestOptions(context) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*', // 限制为你自己的域名
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }