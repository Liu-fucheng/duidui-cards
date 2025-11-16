// OAuth回调处理
// 这个文件专门处理 /api/auth/discord/callback 路径

// JWT密钥（从环境变量获取）
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  console.log('🔄 [OAuth] 收到回调请求:', url.toString());
  
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  // 构建前端URL（提前构建，确保所有错误情况都能重定向）
  const frontendUrl = env.CARD_WEBSITE_URL || new URL(request.url).origin;
  console.log('🌐 [OAuth] 前端URL:', frontendUrl);
  
  if (error) {
    console.log('❌ [OAuth] Discord授权失败:', error);
    const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent(`Discord授权失败: ${error}`)}`;
    return Response.redirect(errorUrl, 302);
  }
  
  if (!code) {
    console.log('❌ [OAuth] 缺少授权码');
    const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent('缺少授权码')}`;
    return Response.redirect(errorUrl, 302);
  }
  
  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/discord/callback`;
  
  if (!clientId || !clientSecret) {
    console.log('❌ [OAuth] Discord OAuth配置不完整');
    const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent('Discord OAuth配置不完整')}`;
    return Response.redirect(errorUrl, 302);
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
      console.error('❌ [OAuth] Discord Token交换失败:', errorText);
      const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent('获取访问令牌失败')}`;
      return Response.redirect(errorUrl, 302);
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
      console.error('❌ [OAuth] 获取用户信息失败:', userResponse.status);
      const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent('获取用户信息失败')}`;
      return Response.redirect(errorUrl, 302);
    }
    
    const user = await userResponse.json();
    console.log('✅ [OAuth] 获取到用户信息:', user.id, user.username);
    
    // 3. 验证用户是否在服务器且有"已审核"身份组
    console.log('🔍 [OAuth] 开始验证用户身份组...');
    const roleVerification = await verifyUserRole(user.id, env);
    console.log('🔍 [OAuth] 验证结果:', JSON.stringify(roleVerification));
    
    if (!roleVerification || !roleVerification.verified) {
      // 重定向到错误页面或显示错误信息
      const errorMessage = roleVerification?.error || '您不在服务器中或没有"已审核"身份组';
      console.log('❌ [OAuth] 验证失败:', errorMessage);
      const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent(errorMessage)}`;
      console.log('🔄 [OAuth] 重定向到错误页面:', errorUrl);
      return Response.redirect(errorUrl, 302);
    }
    
    // 4. 生成JWT Token
    console.log('🔑 [OAuth] 生成JWT Token...');
    const token = await generateToken(user, env);
    console.log('✅ [OAuth] Token生成成功');
    
    // 5. 重定向到前端，并设置Cookie
    const redirectUrl = `${frontendUrl}/search.html`;
    console.log('🔄 [OAuth] 重定向到搜索页面:', redirectUrl);
    
    // 创建响应并设置Cookie
    const response = Response.redirect(redirectUrl, 302);
    const isSecure = frontendUrl.includes('https') || frontendUrl.includes('pages.dev');
    const cookieValue = `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${isSecure ? '; Secure' : ''}`;
    response.headers.set('Set-Cookie', cookieValue);
    console.log('✅ [OAuth] Cookie已设置');
    
    return response;
    
  } catch (error) {
    console.error('❌ [OAuth] 回调处理失败:', error);
    // 即使出错也重定向到搜索页面，显示错误信息
    const errorUrl = `${frontendUrl}/search.html?error=${encodeURIComponent('登录处理失败: ' + error.message)}`;
    console.log('🔄 [OAuth] 错误重定向到:', errorUrl);
    return Response.redirect(errorUrl, 302);
  }
}
