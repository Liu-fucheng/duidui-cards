// Discord OAuth 认证 API

// 生成随机字符串
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET: 开始 Discord OAuth 登录
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  if (!clientId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Discord OAuth 未配置'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (action === 'login') {
    // 生成 state 用于防止 CSRF 攻击
    const state = generateRandomString(32);
    
    // 将 state 存储到 Cookie（也可以存储到 KV）
    const stateCookie = `oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`;

    // 构建 Discord OAuth URL
    const discordAuthUrl = new URL('https://discord.com/api/oauth2/authorize');
    discordAuthUrl.searchParams.set('client_id', clientId);
    discordAuthUrl.searchParams.set('redirect_uri', redirectUri);
    discordAuthUrl.searchParams.set('response_type', 'code');
    discordAuthUrl.searchParams.set('scope', 'identify guilds');
    discordAuthUrl.searchParams.set('state', state);

    // 重定向到 Discord
    return new Response(null, {
      status: 302,
      headers: {
        'Location': discordAuthUrl.toString(),
        'Set-Cookie': stateCookie
      }
    });
  }

  // 默认返回登录 URL
  return new Response(JSON.stringify({
    success: true,
    loginUrl: `${url.origin}/api/auth?action=login`
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

