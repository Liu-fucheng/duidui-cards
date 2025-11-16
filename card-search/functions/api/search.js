// 卡片搜索 API
// 支持：多条件搜索、标签正选反选、分页

// 验证用户是否已登录且具有"已审核"身份组
async function verifyUser(context) {
  const { request, env } = context;
  
  // 从 Cookie 中获取 session
  const cookies = request.headers.get('Cookie') || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  
  if (!sessionMatch) {
    return { success: false, message: '请先登录', status: 401 };
  }

  try {
    // 从 KV 获取 session 数据（如果使用 KV）
    // 或者从 JWT token 中解析（如果使用 JWT）
    // 这里我们使用简单的 session 验证
    const sessionData = sessionMatch[1];
    
    // 解析 session（这里简化处理，实际应该验证签名）
    let userData;
    try {
      userData = JSON.parse(decodeURIComponent(sessionData));
    } catch (e) {
      return { success: false, message: '无效的会话', status: 401 };
    }

    const guildId = env.DISCORD_GUILD_ID;
    const verifiedRoleName = env.DISCORD_VERIFIED_ROLE_NAME || '已审核';
    const botToken = env.DISCORD_BOT_TOKEN;

    if (!guildId) {
      return { success: false, message: '服务器配置错误', status: 500 };
    }

    // 如果有 Bot Token，验证角色
    if (botToken) {
      // 获取服务器信息
      const guildResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}`,
        {
          headers: {
            'Authorization': `Bot ${botToken}`
          }
        }
      ).catch(() => null);

      // 获取用户成员信息
      const memberResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${userData.id}`,
        {
          headers: {
            'Authorization': `Bot ${botToken}`
          }
        }
      ).catch(() => null);

      if (!memberResponse || !memberResponse.ok) {
        return { success: false, message: '您不在指定的服务器内', status: 403 };
      }

      const member = await memberResponse.json();
      const memberRoles = member.roles || [];

      // 如果有服务器信息，检查角色名称
      if (guildResponse && guildResponse.ok) {
        const guild = await guildResponse.json();
        const roles = guild.roles || [];
        const verifiedRole = roles.find(r => r.name === verifiedRoleName);

        if (verifiedRole && memberRoles.includes(verifiedRole.id)) {
          return { success: true, user: userData };
        }
      } else {
        // 如果无法获取服务器信息，至少验证用户在服务器内
        return { success: true, user: userData };
      }

      return { success: false, message: `您需要拥有"${verifiedRoleName}"身份组才能访问`, status: 403 };
    } else {
      // 没有 Bot Token 时，仅验证 session 有效性
      return { success: true, user: userData };
    }
  } catch (error) {
    console.error('权限验证错误:', error);
    return { success: false, message: '权限验证失败: ' + error.message, status: 500 };
  }
}

// 搜索卡片
async function searchCards(env, params) {
  const db = env.D1_DB;

  if (!db) {
    throw new Error('D1数据库未绑定');
  }

  const {
    q, // 搜索关键词（卡名/角色名/作者）
    cardName,
    characterName,
    authorName,
    tags, // 正选标签（逗号分隔）
    excludeTags, // 反选标签（逗号分隔）
    page = 1,
    pageSize = 20
  } = params;

  let query = `
    SELECT * FROM cards_v2 
    WHERE threadId IS NOT NULL AND threadId != ''
  `;
  const conditions = [];
  const bindings = [];

  // 通用搜索（卡名/角色名/作者）
  if (q) {
    conditions.push(`(
      cardName LIKE ? OR 
      authorName LIKE ? OR
      characters LIKE ?
    )`);
    const searchTerm = `%${q}%`;
    bindings.push(searchTerm, searchTerm, searchTerm);
  }

  // 精确搜索卡名
  if (cardName) {
    conditions.push('cardName LIKE ?');
    bindings.push(`%${cardName}%`);
  }

  // 搜索角色名
  if (characterName) {
    conditions.push('characters LIKE ?');
    bindings.push(`%${characterName}%`);
  }

  // 搜索作者
  if (authorName) {
    conditions.push('authorName LIKE ?');
    bindings.push(`%${authorName}%`);
  }

  // 正选标签（必须包含所有指定标签）
  if (tags) {
    const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
    if (tagList.length > 0) {
      tagList.forEach(tag => {
        conditions.push('tags LIKE ?');
        bindings.push(`%"${tag}"%`);
      });
    }
  }

  // 反选标签（不能包含任何指定标签）
  if (excludeTags) {
    const excludeTagList = excludeTags.split(',').map(t => t.trim()).filter(t => t);
    if (excludeTagList.length > 0) {
      excludeTagList.forEach(tag => {
        conditions.push('tags NOT LIKE ?');
        bindings.push(`%"${tag}"%`);
      });
    }
  }

  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
  }

  // 获取总数
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
  const countStmt = db.prepare(countQuery);
  const countResult = await countStmt.bind(...bindings).first();
  const total = countResult?.count || 0;

  // 分页
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  bindings.push(parseInt(pageSize), offset);

  // 执行查询
  const stmt = db.prepare(query);
  const result = await stmt.bind(...bindings).all();
  const cards = result.results || [];

  // 解析JSON字段
  const processedCards = cards.map(card => {
    // 解析 tags
    if (card.tags) {
      try {
        card.tags = JSON.parse(card.tags);
      } catch (e) {
        card.tags = [];
      }
    } else {
      card.tags = [];
    }

    // 解析 characters
    if (card.characters) {
      try {
        card.characters = JSON.parse(card.characters);
      } catch (e) {
        card.characters = [];
      }
    } else {
      card.characters = [];
    }

    return card;
  });

  return {
    cards: processedCards,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / parseInt(pageSize))
    }
  };
}

// GET: 搜索卡片
export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    // 验证用户
    const authResult = await verifyUser(context);
    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        message: authResult.message
      }), {
        status: authResult.status || 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取查询参数
    const url = new URL(request.url);
    const params = {
      q: url.searchParams.get('q'),
      cardName: url.searchParams.get('cardName'),
      characterName: url.searchParams.get('characterName'),
      authorName: url.searchParams.get('authorName'),
      tags: url.searchParams.get('tags'),
      excludeTags: url.searchParams.get('excludeTags'),
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '20'
    };

    // 执行搜索
    const data = await searchCards(env, params);

    return new Response(JSON.stringify({
      success: true,
      data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('搜索错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '搜索失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

