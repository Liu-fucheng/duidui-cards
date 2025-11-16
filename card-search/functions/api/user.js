// 获取当前用户信息 API

// GET: 获取当前登录用户信息
export async function onRequestGet(context) {
  try {
    const { request } = context;

    // 从 Cookie 中获取 session
    const cookies = request.headers.get('Cookie') || '';
    const sessionMatch = cookies.match(/session=([^;]+)/);

    if (!sessionMatch) {
      return new Response(JSON.stringify({
        success: false,
        user: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const sessionData = sessionMatch[1];
      const userData = JSON.parse(decodeURIComponent(sessionData));

      return new Response(JSON.stringify({
        success: true,
        user: {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        user: null
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '获取用户信息失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

