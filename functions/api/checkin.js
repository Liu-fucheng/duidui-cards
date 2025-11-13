// 文件路径: /functions/api/checkin.js

/**
 * 签到系统接口
 * POST: 用户签到
 * GET: 查询用户签到记录
 */

// 确保签到表存在
async function ensureCheckinTable(env) {
  await env.D1_DB.exec(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      checkin_date TEXT NOT NULL,
      checkin_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, guild_id, checkin_date)
    )
  `);
}

// POST: 用户签到
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

    const { user_id, guild_id, beijing_date } = body;

    // 验证必填字段
    if (!user_id || !guild_id || !beijing_date) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必填字段：user_id, guild_id, beijing_date' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureCheckinTable(env);

    // 检查今天是否已经签到
    const todayCheckin = await env.D1_DB.prepare(
      `SELECT * FROM checkins WHERE user_id = ? AND guild_id = ? AND checkin_date = ?`
    ).bind(user_id, guild_id, beijing_date).first();

    if (todayCheckin) {
      return new Response(JSON.stringify({ 
        success: false,
        message: '今天已经签到过了',
        checkin_count: todayCheckin.checkin_count
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 查询用户总签到次数
    const totalCheckins = await env.D1_DB.prepare(
      `SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND guild_id = ?`
    ).bind(user_id, guild_id).first();

    const current_count = (totalCheckins?.count || 0) + 1;

    // 插入今天的签到记录
    await env.D1_DB.prepare(
      `INSERT INTO checkins (user_id, guild_id, checkin_date, checkin_count) 
       VALUES (?, ?, ?, ?)`
    ).bind(
      user_id,
      guild_id,
      beijing_date,
      current_count
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: '签到成功',
      checkin_count: current_count,
      is_fifth: current_count === 5
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('签到失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '签到失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET: 查询用户签到记录
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
    const user_id = url.searchParams.get('user_id');
    const guild_id = url.searchParams.get('guild_id');

    if (!user_id || !guild_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少参数：user_id, guild_id' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureCheckinTable(env);

    // 查询用户总签到次数
    const totalCheckins = await env.D1_DB.prepare(
      `SELECT COUNT(*) as count FROM checkins WHERE user_id = ? AND guild_id = ?`
    ).bind(user_id, guild_id).first();

    const checkin_count = totalCheckins?.count || 0;

    // 查询今天的签到记录
    const beijing_date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const todayCheckin = await env.D1_DB.prepare(
      `SELECT * FROM checkins WHERE user_id = ? AND guild_id = ? AND checkin_date = ?`
    ).bind(user_id, guild_id, beijing_date).first();

    return new Response(JSON.stringify({ 
      success: true,
      checkin_count: checkin_count,
      checked_in_today: !!todayCheckin
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('查询签到记录失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '查询失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

