// 角色卡管理API
// 支持：统计、列表、详情、日志查询

// 验证管理员Token
function verifyAdminToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  const adminToken = env.ADMIN_TOKEN || env.DB_ADMIN_TOKEN;
  
  return token === adminToken;
}

// 获取统计数据
async function getStats(env) {
  const db = env.D1_DB;
  
  // 总数
  const totalResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2'
  ).first();
  
  // 获取北京时间（UTC+8）
  // 使用更可靠的方法获取北京时间
  const now = new Date();
  const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const beijingTime = new Date(utcTime + beijingOffset);
  
  // 今日新增（北京时间）
  const today = new Date(beijingTime);
  today.setHours(0, 0, 0, 0);
  // 转换为 UTC 时间用于数据库查询（数据库存储的是 UTC 时间）
  const todayUTC = new Date(today.getTime() - beijingOffset);
  const todayResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE createdAt >= ?'
  ).bind(todayUTC.toISOString()).first();
  
  // 本周新增（北京时间）
  const weekAgo = new Date(beijingTime);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const weekAgoUTC = new Date(weekAgo.getTime() - beijingOffset);
  const weekResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE createdAt >= ?'
  ).bind(weekAgoUTC.toISOString()).first();
  
  // 本月新增（北京时间）
  const monthAgo = new Date(beijingTime);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  monthAgo.setHours(0, 0, 0, 0);
  const monthAgoUTC = new Date(monthAgo.getTime() - beijingOffset);
  const monthResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE createdAt >= ?'
  ).bind(monthAgoUTC.toISOString()).first();
  
  // 按分区统计
  const categoryResult = await db.prepare(
    'SELECT category, COUNT(*) as count FROM cards_v2 GROUP BY category'
  ).all();
  
  const byCategory = {};
  categoryResult.results.forEach(row => {
    byCategory[row.category] = row.count;
  });
  
  return {
    total: totalResult.count || 0,
    today: todayResult.count || 0,
    week: weekResult.count || 0,
    month: monthResult.count || 0,
    byCategory
  };
}

// 获取角色卡列表（分页+筛选）
async function getCardsList(env, params) {
  const db = env.D1_DB;
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 50;
  const offset = (page - 1) * pageSize;
  
  let query = 'SELECT * FROM cards_v2';
  let countQuery = 'SELECT COUNT(*) as count FROM cards_v2';
  const conditions = [];
  const bindings = [];
  
  // 筛选条件
  if (params.category) {
    conditions.push('category = ?');
    bindings.push(params.category);
  }
  
  if (params.search) {
    conditions.push('(cardName LIKE ? OR authorName LIKE ?)');
    bindings.push(`%${params.search}%`);
    bindings.push(`%${params.search}%`);
  }
  
  // 按卡名筛选（精确匹配）
  if (params.cardName) {
    conditions.push('cardName = ?');
    bindings.push(params.cardName);
  }
  
  // 按提交者ID筛选
  if (params.submitterUserId) {
    conditions.push('submitterUserId = ?');
    bindings.push(params.submitterUserId);
  }
  
  // 按threadId筛选（用于查询已发布到指定帖子的卡片）
  if (params.threadId) {
    conditions.push('threadId = ?');
    bindings.push(params.threadId);
  }
  
  // 只查询未发布的卡片（threadId为空）
  if (params.unpublished === 'true') {
    conditions.push('(threadId IS NULL OR threadId = \'\')');
  }
  
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
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
  
  // 解析 JSON 字段（与 card-detail.js 保持一致）
  const processedCards = (cards.results || []).map(card => {
    // 解析 downloadRequirements 字段
    if (card.downloadRequirements) {
      try {
        card.downloadRequirements = JSON.parse(card.downloadRequirements);
      } catch (e) {
        console.warn('解析 downloadRequirements 失败:', e);
        card.downloadRequirements = [];
      }
    } else {
      card.downloadRequirements = [];
    }
    
    return card;
  });
  
  return {
    cards: processedCards,
    pagination: {
      currentPage: page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      offset,
      limit: pageSize
    }
  };
}

// 获取单个角色卡详情
async function getCardDetail(env, cardId) {
  const db = env.D1_DB;
  
  const card = await db.prepare(
    'SELECT * FROM cards_v2 WHERE id = ?'
  ).bind(cardId).first();
  
  if (!card) {
    throw new Error('角色卡不存在');
  }
  
  // 解析 downloadRequirements 字段（与 card-detail.js 保持一致）
  if (card.downloadRequirements) {
    try {
      card.downloadRequirements = JSON.parse(card.downloadRequirements);
    } catch (e) {
      console.warn('解析 downloadRequirements 失败:', e);
      card.downloadRequirements = [];
    }
  } else {
    card.downloadRequirements = [];
  }
  
  return card;
}

// 获取发卡日志
async function getLogs(env, timeRange = 'week') {
  const db = env.D1_DB;
  
  let query = 'SELECT * FROM cards_v2 WHERE threadId IS NOT NULL';
  const bindings = [];
  
  // 时间范围（使用北京时间）
  if (timeRange !== 'all') {
    // 获取北京时间（UTC+8）
    const now = new Date();
    const beijingOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const beijingTime = new Date(utcTime + beijingOffset);
    
    let startDate;
    
    if (timeRange === 'today') {
      startDate = new Date(beijingTime);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'week') {
      startDate = new Date(beijingTime);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'month') {
      startDate = new Date(beijingTime);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
    }
    
    if (startDate) {
      // 转换为 UTC 时间用于数据库查询（数据库存储的是 UTC 时间）
      const startDateUTC = new Date(startDate.getTime() - beijingOffset);
      query += ' AND createdAt >= ?';
      bindings.push(startDateUTC.toISOString());
    }
  }
  
  query += ' ORDER BY createdAt DESC LIMIT 500';
  
  const result = await db.prepare(query).bind(...bindings).all();
  
  // 解析 JSON 字段（与 card-detail.js 保持一致）
  const processedLogs = (result.results || []).map(card => {
    // 解析 downloadRequirements 字段
    if (card.downloadRequirements) {
      try {
        card.downloadRequirements = JSON.parse(card.downloadRequirements);
      } catch (e) {
        console.warn('解析 downloadRequirements 失败:', e);
        card.downloadRequirements = [];
      }
    } else {
      card.downloadRequirements = [];
    }
    
    return card;
  });
  
  return processedLogs;
}

// 获取系统状态
async function getSystemStatus(env) {
  const status = {
    dbOk: false,
    r2Ok: false,
    kvOk: false
  };
  
  try {
    // 检查数据库
    if (env.D1_DB) {
      await env.D1_DB.prepare('SELECT 1').first();
      status.dbOk = true;
    }
    
    // 检查R2
    if (env.R2_BUCKET) {
      // 简单检查bucket是否可访问（不执行实际操作）
      status.r2Ok = true;
    }
    
    // 检查KV
    if (env.CLOUDFLARE_KV_NAMESPACE) {
      status.kvOk = true;
    }
  } catch (error) {
    console.error('系统状态检查失败:', error);
  }
  
  return status;
}

// 删除角色卡
async function deleteCard(env, cardId) {
  const db = env.D1_DB;
  const r2Bucket = env.R2_BUCKET;
  
  try {
    // 1. 先获取卡片信息，以便删除相关文件
    const card = await db.prepare(
      'SELECT * FROM cards_v2 WHERE id = ?'
    ).bind(cardId).first();
    
    if (!card) {
      return { success: false, message: '角色卡不存在' };
    }
    
    // 2. 删除R2中的文件
    const filesToDelete = [];
    
    if (card.avatarImageKey) filesToDelete.push(card.avatarImageKey);
    if (card.cardFileKey) filesToDelete.push(card.cardFileKey);
    if (card.galleryImageKeys) {
      try {
        const galleryKeys = JSON.parse(card.galleryImageKeys);
        filesToDelete.push(...galleryKeys);
      } catch (e) {
        console.warn('解析galleryImageKeys失败:', e);
      }
    }
    if (card.attachmentKeys) {
      try {
        const attachmentKeys = JSON.parse(card.attachmentKeys);
        filesToDelete.push(...attachmentKeys);
      } catch (e) {
        console.warn('解析attachmentKeys失败:', e);
      }
    }
    // 删除简介图
    filesToDelete.push(`intros/intro_${cardId}.png`);
    
    // 批量删除R2文件
    if (r2Bucket && filesToDelete.length > 0) {
      const deletePromises = filesToDelete
        .filter(key => key) // 过滤空值
        .map(key => r2Bucket.delete(key).catch(err => {
          console.warn(`删除R2文件失败 ${key}:`, err);
          // 继续执行，不因单个文件删除失败而中断
        }));
      
      await Promise.all(deletePromises);
      console.log(`已删除 ${filesToDelete.length} 个R2文件`);
    }
    
    // 3. 删除数据库记录
    await db.prepare(
      'DELETE FROM cards_v2 WHERE id = ?'
    ).bind(cardId).run();
    
    console.log(`✅ 已删除角色卡: ${cardId}`);
    
    return { 
      success: true, 
      message: '删除成功',
      deletedFiles: filesToDelete.length
    };
    
  } catch (error) {
    console.error('删除角色卡失败:', error);
    return { 
      success: false, 
      message: error.message || '删除失败' 
    };
  }
}

export async function onRequest(context) {
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
  
    const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';
  
  // 特殊情况：查询特定用户的卡片不需要管理员权限（供Bot使用）
  const isUserQuery = (
    action === 'list' && 
    url.searchParams.get('submitterUserId')
  );
  
  // 验证管理员权限（查询用户卡片除外）
  if (!isUserQuery && !verifyAdminToken(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      message: '未授权：需要有效的管理员Token'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    
    let result;
    
    switch (action) {
      case 'stats':
        // 获取统计数据
        const stats = await getStats(env);
        result = { success: true, stats };
        break;
        
      case 'list':
        // 获取列表
        const params = {
          page: url.searchParams.get('page'),
          pageSize: url.searchParams.get('pageSize'),
          category: url.searchParams.get('category'),
          search: url.searchParams.get('search'),
          cardName: url.searchParams.get('cardName'),
          submitterUserId: url.searchParams.get('submitterUserId'),
          threadId: url.searchParams.get('threadId'),
          unpublished: url.searchParams.get('unpublished')
        };
        const listData = await getCardsList(env, params);
        result = { success: true, ...listData };
        break;
        
      case 'detail':
        // 获取详情
        const cardId = url.searchParams.get('id');
        if (!cardId) {
          throw new Error('缺少卡片ID');
        }
        const card = await getCardDetail(env, cardId);
        result = { success: true, card };
        break;
        
      case 'logs':
        // 获取日志
        const timeRange = url.searchParams.get('timeRange') || 'week';
        const logs = await getLogs(env, timeRange);
        result = { success: true, logs };
        break;
        
      case 'system':
        // 系统状态
        const system = await getSystemStatus(env);
        result = { success: true, system };
        break;
        
      case 'delete':
        // 删除角色卡
        if (request.method !== 'DELETE') {
          result = { success: false, message: '请使用DELETE方法' };
          break;
        }
        const deleteCardId = url.searchParams.get('id');
        if (!deleteCardId) {
          result = { success: false, message: '缺少卡片ID' };
          break;
        }
        const deleteResult = await deleteCard(env, deleteCardId);
        result = deleteResult;
        break;
        
      default:
        result = { success: false, message: '未知的操作类型' };
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('API错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message || '服务器内部错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
