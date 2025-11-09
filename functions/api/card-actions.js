// 文件路径: /functions/api/card-actions.js

/**
 * 角色卡操作记录接口
 * POST: 记录操作（查看简介、下载）
 * GET: 获取统计数据
 */

// POST: 记录操作
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证来自Bot的请求
    const webhookSecret = env.WEBHOOK_SECRET;
    const authHeader = request.headers.get('Authorization') || '';
    const expected = webhookSecret ? `Bearer ${webhookSecret}` : '';
    
    if (!webhookSecret || authHeader !== expected) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未授权' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '请求体需要为 JSON' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { card_id, action_type, user_id, username, display_name } = body;

    // 验证必填字段
    if (!card_id || !action_type || !user_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必填字段：card_id, action_type, user_id' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证 action_type
    if (!['view_intro', 'download'].includes(action_type)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'action_type 必须是 view_intro 或 download' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 插入记录
    await env.D1_DB.prepare(
      `INSERT INTO card_actions (card_id, action_type, user_id, username, display_name) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      card_id,
      action_type,
      user_id,
      username || null,
      display_name || null
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: '操作已记录'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('记录操作失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '记录操作失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET: 获取统计数据
export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const card_id = url.searchParams.get('card_id');

    if (!card_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少 card_id 参数' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 查询统计数据
    const stats = await env.D1_DB.prepare(`
      SELECT 
        action_type,
        COUNT(*) as total_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM card_actions
      WHERE card_id = ?
      GROUP BY action_type
    `).bind(card_id).all();

    // 格式化结果
    const result = {
      card_id,
      view_intro: {
        total_count: 0,
        unique_users: 0
      },
      download: {
        total_count: 0,
        unique_users: 0
      }
    };

    if (stats.results) {
      stats.results.forEach(row => {
        if (row.action_type === 'view_intro') {
          result.view_intro.total_count = row.total_count;
          result.view_intro.unique_users = row.unique_users;
        } else if (row.action_type === 'download') {
          result.download.total_count = row.total_count;
          result.download.unique_users = row.unique_users;
        }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      stats: result
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '获取统计数据失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}




