// Discord OAuth 认证
// GET /api/auth/discord - 开始登录流程（重定向到Discord）
// GET /api/auth/discord/callback - OAuth回调处理
// GET /api/auth/me - 获取当前用户信息
// POST /api/auth/logout - 登出

// JWT密钥（从环境变量获取，如果没有则使用默认值，生产环境必须设置）
function getJWTSecret(env) {
  return env.JWT_SECRET || 'your-secret-key-change-in-production';
}

// 使用 Web Crypto API 生成 JWT Token
async function generateToken(user, env) {
  const secret = getJWTSecret(env);
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    globalName: user.global_name,
    iat: now,
    exp: now + (7 * 24 * 60 * 60) // 7天有效期
  };

  // Base64URL编码
  const base64UrlEncode = (str) => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    new TextEncoder().encode(data)
  );

  const encodedSignature = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${data}.${encodedSignature}`;
}

// 使用 Web Crypto API 验证 JWT Token
async function verifyToken(token, env) {
  try {
    const secret = getJWTSecret(env);
    const secretKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Base64URL解码
    const base64UrlDecode = (str) => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) {
        str += '=';
      }
      return atob(str);
    };

    // 验证签名
    const data = `${encodedHeader}.${encodedPayload}`;
    // Base64URL解码签名
    let signatureStr = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    while (signatureStr.length % 4) {
      signatureStr += '=';
    }
    const signatureBytes = atob(signatureStr);
    const signature = Uint8Array.from(signatureBytes, c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      new TextEncoder().encode(data)
    );

    if (!isValid) {
      return null;
    }

    // 解析payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Token验证失败:', error);
    return null;
  }
}

// 从请求中获取Token（从Cookie或Authorization头）
function getTokenFromRequest(request) {
  // 优先从Cookie获取
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('='))
    );
    if (cookies['auth_token']) {
      return cookies['auth_token'];
    }
  }
  
  // 从Authorization头获取
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

// 检查用户是否在服务器且有"已审核"身份组
async function verifyUserRole(userId, env) {
  const botUrl = env.DISCORD_BOT_URL;
  if (!botUrl) {
    console.error('DISCORD_BOT_URL 未配置');
    return { verified: false, error: 'Bot URL未配置' };
  }
  
  try {
    // 调用Bot的API检查用户身份组
    const response = await fetch(`${botUrl}/api/verify-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.WEBHOOK_SECRET || ''}`,
      },
      body: JSON.stringify({ userId }),
    });
    
    if (!response.ok) {
      console.error('Bot API返回错误:', response.status);
      return { verified: false, error: '验证失败' };
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('验证用户身份组失败:', error);
    return { verified: false, error: error.message };
  }
}

// 开始登录流程
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 检查是否是回调
  if (url.pathname.includes('/callback')) {
    return handleCallback(context);
  }
  
  // 检查是否是获取用户信息
  if (url.pathname.includes('/me')) {
    return handleMe(context);
  }
  
  // 开始OAuth流程
  const clientId = env.DISCORD_CLIENT_ID;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/discord/callback`;
  const scope = 'identify guilds';
  
  if (!clientId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Discord Client ID未配置'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 生成state参数（用于防止CSRF攻击）
  const state = crypto.randomUUID();
  
  // 保存state到KV（可选，如果使用KV的话）
  // 或者使用更简单的方法：将state编码到URL中
  
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${state}`;
  
  // 重定向到Discord授权页面
  return Response.redirect(discordAuthUrl, 302);
}

// 处理OAuth回调
async function handleCallback(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  if (error) {
    return new Response(JSON.stringify({
      success: false,
      message: `Discord授权失败: ${error}`
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!code) {
    return new Response(JSON.stringify({
      success: false,
      message: '缺少授权码'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/discord/callback`;
  
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Discord OAuth配置不完整'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // 1. 用code换取access_token
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
      const errorText = await tokenResponse.text();
      console.error('Discord Token交换失败:', errorText);
      return new Response(JSON.stringify({
        success: false,
        message: '获取访问令牌失败'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // 2. 使用access_token获取用户信息
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!userResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: '获取用户信息失败'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = await userResponse.json();
    
    // 3. 验证用户是否在服务器且有"已审核"身份组
    const roleVerification = await verifyUserRole(user.id, env);
    
    if (!roleVerification.verified) {
      // 重定向到错误页面或显示错误信息
      const errorMessage = roleVerification.error || '您不在服务器中或没有"已审核"身份组';
      const frontendUrl = env.CARD_WEBSITE_URL || new URL(request.url).origin;
      return Response.redirect(
        `${frontendUrl}/search.html?error=${encodeURIComponent(errorMessage)}`,
        302
      );
    }
    
    // 4. 生成JWT Token
    const token = await generateToken(user, env);
    
    // 5. 重定向到前端，并设置Cookie
    const frontendUrl = env.CARD_WEBSITE_URL || new URL(request.url).origin;
    const redirectUrl = `${frontendUrl}/search.html`;
    
    // 创建响应并设置Cookie
    const response = Response.redirect(redirectUrl, 302);
    response.headers.set(
      'Set-Cookie',
      `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}; ${env.CARD_WEBSITE_URL?.includes('https') ? 'Secure;' : ''}`
    );
    
    return response;
    
  } catch (error) {
    console.error('OAuth回调处理失败:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '登录处理失败: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取当前用户信息
async function handleMe(context) {
  const { request, env } = context;
  
  const token = getTokenFromRequest(request);
  if (!token) {
    return new Response(JSON.stringify({
      success: false,
      message: '未登录'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const payload = await verifyToken(token, env);
  if (!payload) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Token无效或已过期'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 再次验证用户身份组（可选，用于确保用户仍然有权限）
  const roleVerification = await verifyUserRole(payload.userId, env);
  
  return new Response(JSON.stringify({
    success: true,
    user: {
      id: payload.userId,
      username: payload.username,
      discriminator: payload.discriminator,
      avatar: payload.avatar,
      globalName: payload.globalName,
      verified: roleVerification.verified,
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// 处理POST请求（登出）
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  if (url.pathname.includes('/logout')) {
    // 清除Cookie
    const response = new Response(JSON.stringify({
      success: true,
      message: '已登出'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
    response.headers.set(
      'Set-Cookie',
      'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );
    
    return response;
  }
  
  return new Response(JSON.stringify({
    success: false,
    message: '未知的操作'
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}
