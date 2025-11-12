// 卡片评论API
// 支持：添加评论、查询评论

// POST: 添加评论
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    if (!env.D1_DB) {
      return new Response(JSON.stringify({
        success: false,
        message: '数据库未绑定'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const data = await request.json();
    const { thread_id, card_id, user_id, username, display_name, vest_name, content } = data;
    
    if (!thread_id || !user_id || !username || !content) {
      return new Response(JSON.stringify({
        success: false,
        message: '缺少必要参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 插入评论
    await env.D1_DB.prepare(
      `INSERT INTO card_comments (thread_id, card_id, user_id, username, display_name, vest_name, content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      thread_id,
      card_id || null,
      user_id,
      username,
      display_name || null,
      vest_name || '匿名',
      content
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      message: '评论已添加'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('添加评论失败:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '服务器内部错误: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET: 查询评论
export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    
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
    
    if (!thread_id) {
      return new Response(JSON.stringify({
        success: false,
        message: '缺少 thread_id 参数'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let query;
    let params;
    
    if (user_id) {
      // 查询特定用户在该帖子的评论
      query = `SELECT * FROM card_comments WHERE thread_id = ? AND user_id = ? ORDER BY created_at DESC`;
      params = [thread_id, user_id];
    } else {
      // 查询该帖子的所有评论
      query = `SELECT * FROM card_comments WHERE thread_id = ? ORDER BY created_at DESC`;
      params = [thread_id];
    }
    
    const result = await env.D1_DB.prepare(query).bind(...params).all();
    
    return new Response(JSON.stringify({
      success: true,
      comments: result.results || [],
      count: result.results ? result.results.length : 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
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








