// 获取所有可用标签 API

// 验证用户（复用搜索API的验证逻辑）
async function verifyUser(context) {
  const { request } = context;
  
  const cookies = request.headers.get('Cookie') || '';
  const sessionMatch = cookies.match(/session=([^;]+)/);
  
  if (!sessionMatch) {
    return { success: false, message: '请先登录', status: 401 };
  }

  try {
    const sessionData = sessionMatch[1];
    let userData;
    try {
      userData = JSON.parse(decodeURIComponent(sessionData));
    } catch (e) {
      return { success: false, message: '无效的会话', status: 401 };
    }

    return { success: true, user: userData };
  } catch (error) {
    return { success: false, message: '权限验证失败', status: 500 };
  }
}

// GET: 获取所有可用标签
export async function onRequestGet(context) {
  try {
    const { env } = context;

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

    if (!env.D1_DB) {
      return new Response(JSON.stringify({
        success: false,
        message: 'D1数据库未绑定'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 查询所有已发布卡片的标签
    const result = await env.D1_DB.prepare(`
      SELECT DISTINCT tags 
      FROM cards_v2 
      WHERE threadId IS NOT NULL AND threadId != '' AND tags IS NOT NULL AND tags != ''
    `).all();

    const allTags = new Set();
    (result.results || []).forEach(row => {
      try {
        const tags = JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => allTags.add(tag));
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        tags: Array.from(allTags).sort()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('获取标签错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '获取标签失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

