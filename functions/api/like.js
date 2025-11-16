// 文件路径: /functions/api/like.js

/**
 * 点赞系统 API
 * POST: 添加点赞（防重复）
 * GET: 查询点赞状态和数量
 */

// POST: 添加点赞
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 解析请求数据
    const data = await request.json();
    const { message_id, user_id, username, display_name, card_id } = data;

    // 验证必要字段
    if (!message_id || !user_id || !username) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少必要参数: message_id, user_id, username' 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 检查是否已经点赞过
    const existingLike = await env.D1_DB
      .prepare('SELECT id FROM card_likes WHERE message_id = ? AND user_id = ?')
      .bind(message_id, user_id)
      .first();

    if (existingLike) {
      // 已经点赞过，返回当前点赞数
      const likeCount = await env.D1_DB
        .prepare('SELECT COUNT(*) as count FROM card_likes WHERE message_id = ?')
        .bind(message_id)
        .first();

      return new Response(JSON.stringify({ 
        success: false, 
        message: '您已经点过赞了',
        already_liked: true,
        like_count: likeCount.count
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 插入点赞记录
    await env.D1_DB
      .prepare(`
        INSERT INTO card_likes (message_id, card_id, user_id, username, display_name)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(message_id, card_id || null, user_id, username, display_name || username)
      .run();

    // 获取当前点赞数
    const likeCount = await env.D1_DB
      .prepare('SELECT COUNT(*) as count FROM card_likes WHERE message_id = ?')
      .bind(message_id)
      .first();

    // 如果有 card_id，更新角色卡的 likes 字段
    if (card_id) {
      await env.D1_DB
        .prepare('UPDATE cards_v2 SET likes = ? WHERE firstMessageId = ?')
        .bind(likeCount.count, message_id)
        .run();
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '点赞成功',
      like_count: likeCount.count
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('点赞失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '点赞失败: ' + error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// GET: 查询点赞状态和数量
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 从 URL 参数获取 message_id 和 user_id
    const url = new URL(request.url);
    const message_id = url.searchParams.get('message_id');
    const user_id = url.searchParams.get('user_id');

    if (!message_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '缺少参数: message_id' 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 获取点赞总数
    const likeCount = await env.D1_DB
      .prepare('SELECT COUNT(*) as count FROM card_likes WHERE message_id = ?')
      .bind(message_id)
      .first();

    // 如果提供了 user_id，检查该用户是否已点赞
    let hasLiked = false;
    if (user_id) {
      const userLike = await env.D1_DB
        .prepare('SELECT id FROM card_likes WHERE message_id = ? AND user_id = ?')
        .bind(message_id, user_id)
        .first();
      hasLiked = !!userLike;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      like_count: likeCount.count,
      has_liked: hasLiked
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('查询点赞状态失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '查询失败: ' + error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// OPTIONS: 处理 CORS 预检请求
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}



















