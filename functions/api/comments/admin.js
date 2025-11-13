// 评论管理后台 API
// 仅供管理员使用，需要 Token 验证

// 验证管理员 Token
function verifyAdminToken(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7); // 移除 "Bearer " 前缀
  const adminToken = env.ADMIN_TOKEN;
  
  if (!adminToken) {
    console.error('ADMIN_TOKEN 未配置');
    return false;
  }
  
  return token === adminToken;
}

// GET: 管理员查询评论
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    // 验证管理员 Token
    if (!verifyAdminToken(request, env)) {
      return new Response(JSON.stringify({
        success: false,
        message: '未授权：需要有效的管理员Token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
    const thread_id = url.searchParams.get('thread_id');
    const user_id = url.searchParams.get('user_id');
    const vest_name = url.searchParams.get('vest_name');
    const card_id = url.searchParams.get('card_id');
    const limit = parseInt(url.searchParams.get('limit')) || 1000;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    // 构建动态查询
    let query = 'SELECT * FROM card_comments WHERE 1=1';
    const params = [];
    
    if (thread_id) {
      query += ' AND thread_id = ?';
      params.push(thread_id);
    }
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    
    if (vest_name) {
      query += ' AND vest_name LIKE ?';
      params.push(`%${vest_name}%`);
    }
    
    if (card_id) {
      query += ' AND card_id = ?';
      params.push(card_id);
    }
    
    // 排序和分页
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await env.D1_DB.prepare(query).bind(...params).all();
    
    // 获取总数（用于分页）
    let countQuery = 'SELECT COUNT(*) as total FROM card_comments WHERE 1=1';
    const countParams = [];
    
    if (thread_id) {
      countQuery += ' AND thread_id = ?';
      countParams.push(thread_id);
    }
    
    if (user_id) {
      countQuery += ' AND user_id = ?';
      countParams.push(user_id);
    }
    
    if (vest_name) {
      countQuery += ' AND vest_name LIKE ?';
      countParams.push(`%${vest_name}%`);
    }
    
    if (card_id) {
      countQuery += ' AND card_id = ?';
      countParams.push(card_id);
    }
    
    const countResult = await env.D1_DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult ? countResult.total : 0;
    
    return new Response(JSON.stringify({
      success: true,
      comments: result.results || [],
      count: result.results ? result.results.length : 0,
      total: total,
      limit: limit,
      offset: offset
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('查询评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '服务器内部错误: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE: 删除评论（管理员功能）
export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    
    // 验证管理员 Token
    if (!verifyAdminToken(request, env)) {
      return new Response(JSON.stringify({
        success: false,
        message: '未授权：需要有效的管理员Token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
    const comment_id = url.searchParams.get('id');
    
    if (!comment_id) {
      return new Response(JSON.stringify({
        success: false,
        message: '缺少评论 ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 删除评论
    await env.D1_DB.prepare(
      'DELETE FROM card_comments WHERE id = ?'
    ).bind(comment_id).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: '评论已删除'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('删除评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '服务器内部错误: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// OPTIONS: 处理 CORS 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}










