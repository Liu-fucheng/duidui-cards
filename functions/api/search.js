// 搜索API
// GET /api/search - 搜索已发布的卡片（需要登录）

// 从请求中获取Token（从Authorization头或Cookie）
function getTokenFromRequest(request) {
  // 优先从Authorization头获取（因为它是原始Token，没有被URL编码）
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  
  // 如果Authorization头没有，再从Cookie获取
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    // 更健壮的Cookie解析
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        try {
          cookies[key] = decodeURIComponent(value);
        } catch (e) {
          cookies[key] = value; // 如果解码失败，使用原始值
        }
      }
    });
    
    if (cookies['auth_token']) {
      return cookies['auth_token'].trim();
    }
  }
  
  return null;
}

// 验证JWT Token（使用 Web Crypto API）
async function verifyToken(token, env) {
  try {
    const secret = env.JWT_SECRET || 'your-secret-key-change-in-production';
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Base64URL解码（支持UTF-8）
    const base64UrlDecode = (str) => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) {
        str += '=';
      }
      const binary = atob(str);
      // 转换为UTF-8字符串
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    };

    // 验证签名
    const data = `${encodedHeader}.${encodedPayload}`;
    // Base64URL解码签名
    let signatureStr = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    while (signatureStr.length % 4) {
      signatureStr += '=';
    }
    const signatureBytes = atob(signatureStr);
    const signature = Uint8Array.from(signatureBytes, c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      new TextEncoder().encode(data)
    );

    if (!isValid) {
      return null;
    }

    // 解析payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token验证失败:', error);
    return null;
  }
}

// 检查用户是否已登录
async function checkAuth(request, env) {
  const token = getTokenFromRequest(request);
  if (!token) {
    return { authenticated: false, error: '未登录' };
  }
  
  const payload = await verifyToken(token, env);
  if (!payload) {
    return { authenticated: false, error: 'Token无效或已过期' };
  }
  
  return { authenticated: true, userId: payload.userId };
}

// 解析tags参数（支持正选和反选）
// 格式: tags=tag1,tag2&excludeTags=tag3,tag4
function parseTags(params) {
  const includeTags = params.get('tags') 
    ? params.get('tags').split(',').filter(t => t.trim())
    : [];
  const excludeTags = params.get('excludeTags')
    ? params.get('excludeTags').split(',').filter(t => t.trim())
    : [];
  
  return { includeTags, excludeTags };
}

// 检查卡片是否包含指定tags（正选）
function cardHasTags(cardTags, requiredTags) {
  if (!cardTags || requiredTags.length === 0) return true;
  
  try {
    const tags = typeof cardTags === 'string' ? JSON.parse(cardTags) : cardTags;
    if (!Array.isArray(tags)) return false;
    
    // 检查是否包含所有必需的tags
    return requiredTags.every(requiredTag => 
      tags.some(tag => {
        const tagValue = typeof tag === 'string' ? tag : tag.value;
        return tagValue === requiredTag || tagValue.includes(requiredTag);
      })
    );
  } catch (e) {
    return false;
  }
}

// 检查卡片是否不包含指定tags（反选）
function cardExcludesTags(cardTags, excludedTags) {
  if (!cardTags || excludedTags.length === 0) return true;
  
  try {
    const tags = typeof cardTags === 'string' ? JSON.parse(cardTags) : cardTags;
    if (!Array.isArray(tags)) return true;
    
    // 检查是否不包含任何被排除的tags
    return !excludedTags.some(excludedTag =>
      tags.some(tag => {
        const tagValue = typeof tag === 'string' ? tag : tag.value;
        return tagValue === excludedTag || tagValue.includes(excludedTag);
      })
    );
  } catch (e) {
    return true;
  }
}

// 搜索卡片
async function searchCards(env, params) {
  const db = env.D1_DB;
  const page = parseInt(params.get('page')) || 1;
  const pageSize = Math.min(parseInt(params.get('pageSize')) || 20, 100); // 最多100条
  const offset = (page - 1) * pageSize;
  
  // 只搜索已发布的卡片（threadId不为空）
  let query = 'SELECT * FROM cards_v2 WHERE threadId IS NOT NULL AND threadId != \'\'';
  let countQuery = 'SELECT COUNT(*) as count FROM cards_v2 WHERE threadId IS NOT NULL AND threadId != \'\'';
  const conditions = [];
  const bindings = [];
  
  // 搜索关键词（卡名/角色名/作者）
  const keyword = params.get('q') || params.get('keyword');
  if (keyword) {
    conditions.push('(cardName LIKE ? OR authorName LIKE ? OR characters LIKE ?)');
    const keywordPattern = `%${keyword}%`;
    bindings.push(keywordPattern);
    bindings.push(keywordPattern);
    bindings.push(keywordPattern);
  }
  
  // 按分区筛选
  const category = params.get('category');
  if (category) {
    conditions.push('category = ?');
    bindings.push(category);
  }
  
  // 构建查询
  if (conditions.length > 0) {
    const whereClause = ' AND ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }
  
  // 排序和分页
  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  
  // 获取总数
  const countResult = await db.prepare(countQuery).bind(...bindings).first();
  const total = countResult.count || 0;
  
  // 获取数据
  const cards = await db.prepare(query).bind(...bindings, pageSize, offset).all();
  
  // 解析tags参数
  const { includeTags, excludeTags } = parseTags(params);
  
  // 处理结果：解析JSON字段并过滤tags
  const processedCards = (cards.results || [])
    .map(card => {
      // 解析JSON字段
      if (card.tags) {
        try {
          card.tags = JSON.parse(card.tags);
        } catch (e) {
          card.tags = [];
        }
      } else {
        card.tags = [];
      }
      
      if (card.characters) {
        try {
          card.characters = JSON.parse(card.characters);
        } catch (e) {
          // 保持原样
        }
      }
      
      if (card.downloadRequirements) {
        try {
          card.downloadRequirements = JSON.parse(card.downloadRequirements);
        } catch (e) {
          card.downloadRequirements = [];
        }
      } else {
        card.downloadRequirements = [];
      }
      
      // 生成公开URL
      const r2PublicUrl = env.R2_PUBLIC_URL || '';
      
      // 简介图URL（Discord帖子图片）
      card.introImageUrl = `${r2PublicUrl}/intros/intro_${card.id}.png`;
      
      // 头像URL
      if (card.avatarImageKey) {
        card.avatarImageUrl = `${r2PublicUrl}/${card.avatarImageKey}`;
        card.avatarUrl = card.avatarImageUrl; // 保持向后兼容
      }
      
      return card;
    })
    .filter(card => {
      // 应用tags过滤（正选）
      if (includeTags.length > 0 && !cardHasTags(card.tags, includeTags)) {
        return false;
      }
      
      // 应用tags过滤（反选）
      if (excludeTags.length > 0 && !cardExcludesTags(card.tags, excludeTags)) {
        return false;
      }
      
      return true;
    });
  
  return {
    cards: processedCards,
    pagination: {
      currentPage: page,
      pageSize,
      total: processedCards.length, // 注意：这是过滤后的数量，实际总数可能不同
      totalPages: Math.ceil(processedCards.length / pageSize),
    }
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // 检查数据库绑定
  if (!env.D1_DB) {
    return new Response(JSON.stringify({
      success: false,
      message: '数据库未绑定'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 检查认证
  const auth = await checkAuth(request, env);
  if (!auth.authenticated) {
    return new Response(JSON.stringify({
      success: false,
      message: auth.error || '未授权'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const url = new URL(request.url);
    const result = await searchCards(env, url.searchParams);
    
    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('搜索失败:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '搜索失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}



