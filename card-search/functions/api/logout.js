// 登出 API

// GET: 登出
export async function onRequestGet(context) {
  try {
    // 清除 session cookie
    const clearCookie = 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';

    return new Response(JSON.stringify({
      success: true,
      message: '已登出'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookie
      }
    });
  } catch (error) {
    console.error('登出错误:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '登出失败'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

