// 文件路径: /functions/api/token.js

/**
 * Token验证接口
 * GET: 验证Token并返回用户信息
 * POST: 标记Token为已使用（由bot调用）
 * DELETE: 清理过期Token（定时任务或手动调用）
 */

// Token有效期：24小时
const TOKEN_EXPIRY_HOURS = 24;

// 确保D1表存在
async function ensureTokenTable(env) {
  if (!env || !env.D1_DB) return;
  await env.D1_DB.prepare(
    `CREATE TABLE IF NOT EXISTS card_tokens (
       token TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       guild_id TEXT NOT NULL,
       username TEXT NOT NULL,
       display_name TEXT,
       category TEXT NOT NULL,
       created_at TEXT NOT NULL,
       used INTEGER DEFAULT 0,
       used_at TEXT
     )`
  ).run();
}

// GET: 验证Token并返回用户信息
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "服务器D1未绑定" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!token) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "缺少token参数" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await ensureTokenTable(env);

    // 查询token
    const row = await env.D1_DB.prepare(
      'SELECT * FROM card_tokens WHERE token = ?'
    ).bind(token).first();

    if (!row) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "无效的Token" 
      }), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 检查是否已使用
    if (row.used) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "此Token已被使用",
        used_at: row.used_at
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 检查是否过期
    const createdAt = new Date(row.created_at);
    const now = new Date();
    const diffHours = (now - createdAt) / (1000 * 60 * 60);
    
    if (diffHours > TOKEN_EXPIRY_HOURS) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Token已过期",
        created_at: row.created_at,
        expiry_hours: TOKEN_EXPIRY_HOURS
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 返回用户信息
    return new Response(JSON.stringify({ 
      success: true,
      data: {
        user_id: row.user_id,
        guild_id: row.guild_id,
        username: row.username,
        display_name: row.display_name,
        category: row.category,
        created_at: row.created_at
      }
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Token验证错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// POST: 保存新Token（由Discord Bot调用）
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "服务器D1未绑定" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 验证Bot密钥（可选，用于保护接口）
    const botSecret = env.BOT_SECRET;
    if (botSecret) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${botSecret}`) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "未授权" 
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const data = await request.json();
    const { token, user_id, guild_id, username, display_name, category } = data;

    if (!token || !user_id || !guild_id || !username || !category) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "缺少必要参数" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await ensureTokenTable(env);

    // 插入token
    await env.D1_DB.prepare(
      `INSERT INTO card_tokens (token, user_id, guild_id, username, display_name, category, created_at, used)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(
      token,
      user_id,
      guild_id,
      username,
      display_name || username,
      category,
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: "Token保存成功" 
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('保存Token错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// PUT: 标记Token为已使用
export async function onRequestPut(context) {
  try {
    const { request, env } = context;

    if (!env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "服务器D1未绑定" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await request.json();
    const { token } = data;

    if (!token) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "缺少token参数" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await ensureTokenTable(env);

    // 更新token状态
    const result = await env.D1_DB.prepare(
      'UPDATE card_tokens SET used = 1, used_at = ? WHERE token = ? AND used = 0'
    ).bind(new Date().toISOString(), token).run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Token不存在或已被使用" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Token已标记为已使用" 
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('更新Token错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// DELETE: 清理过期Token
export async function onRequestDelete(context) {
  try {
    const { request, env } = context;

    if (!env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "服务器D1未绑定" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 验证管理员密钥
    const adminToken = env.ADMIN_TOKEN;
    if (adminToken) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "未授权" 
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    await ensureTokenTable(env);

    // 计算过期时间
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() - TOKEN_EXPIRY_HOURS);
    const expiryISO = expiryDate.toISOString();

    // 删除过期token
    const result = await env.D1_DB.prepare(
      'DELETE FROM card_tokens WHERE created_at < ?'
    ).bind(expiryISO).run();

    return new Response(JSON.stringify({ 
      success: true,
      message: `已清理 ${result.changes} 个过期Token` 
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('清理Token错误:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: "服务器内部错误: " + error.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}


























