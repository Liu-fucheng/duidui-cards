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
  
  // 今日新增（UTC时间）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE uploadedAt >= ?'
  ).bind(today.toISOString()).first();
  
  // 本周新增
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);
  const weekResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE uploadedAt >= ?'
  ).bind(weekAgo.toISOString()).first();
  
  // 本月新增
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  monthAgo.setHours(0, 0, 0, 0);
  const monthResult = await db.prepare(
    'SELECT COUNT(*) as count FROM cards_v2 WHERE uploadedAt >= ?'
  ).bind(monthAgo.toISOString()).first();
  
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
  
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    query += whereClause;
    countQuery += whereClause;
  }
  
  // 排序和分页
  query += ' ORDER BY uploadedAt DESC LIMIT ? OFFSET ?';
  
  // 获取总数
  const countResult = await db.prepare(countQuery).bind(...bindings).first();
  const total = countResult.count || 0;
  
  // 获取数据
  const cards = await db.prepare(query).bind(...bindings, pageSize, offset).all();
  
  return {
    cards: cards.results || [],
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
  
  return card;
}

// 获取发卡日志
async function getLogs(env, timeRange = 'week') {
  const db = env.D1_DB;
  
  let query = 'SELECT * FROM cards_v2 WHERE threadId IS NOT NULL';
  const bindings = [];
  
  // 时间范围
  if (timeRange !== 'all') {
    const now = new Date();
    let startDate;
    
    if (timeRange === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (timeRange === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }
    
    if (startDate) {
      query += ' AND uploadedAt >= ?';
      bindings.push(startDate.toISOString());
    }
  }
  
  query += ' ORDER BY uploadedAt DESC LIMIT 500';
  
  const result = await db.prepare(query).bind(...bindings).all();
  
  return result.results || [];
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

export async function onRequest(context) {
  const { request, env } = context;
  
  // 验证管理员权限
  if (!verifyAdminToken(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      message: '未授权：需要有效的管理员Token'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
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
  
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'stats';
    
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
          search: url.searchParams.get('search')
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
