// Discord OAuth 回调处理

// GET: Discord OAuth 回调
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // 验证 state
  const cookies = request.headers.get('Cookie') || '';
  const stateMatch = cookies.match(/oauth_state=([^;]+)/);
  
  if (!stateMatch || stateMatch[1] !== state) {
    return new Response('无效的 state 参数', {
      status: 400
    });
  }

  if (!code) {
    return new Response('缺少 code 参数', {
      status: 400
    });
  }

  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${url.origin}/api/auth/callback`;

  try {
    // 交换 access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Discord token 交换失败:', error);
      return new Response('Discord 认证失败', {
        status: 500
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 获取用户信息
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      return new Response('获取用户信息失败', {
        status: 500
      });
    }

    const userData = await userResponse.json();

    // 创建 session（简化版，实际应该使用 JWT 或 KV 存储）
    const sessionData = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      accessToken: accessToken
    };

    // 设置 session cookie
    const sessionCookie = `session=${encodeURIComponent(JSON.stringify(sessionData))}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`;

    // 清除 state cookie
    const clearStateCookie = 'oauth_state=; HttpOnly; Path=/; Max-Age=0';

    // 重定向到前端
    const frontendUrl = env.FRONTEND_URL || url.origin;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': frontendUrl,
        'Set-Cookie': [sessionCookie, clearStateCookie]
      }
    });
  } catch (error) {
    console.error('OAuth 回调错误:', error);
    return new Response('认证过程出错: ' + error.message, {
      status: 500
    });
  }
}

