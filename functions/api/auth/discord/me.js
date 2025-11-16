// 获取当前用户信息
// GET /api/auth/discord/me

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

// JWT密钥（从环境变量获取）
function getJWTSecret(env) {
  return env.JWT_SECRET || 'your-secret-key-change-in-production';
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
      const binary = atob(str);
      // 转换为UTF-8字符串
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
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
  
  // 调试：打印请求头
  const cookieHeader = request.headers.get('Cookie');
  console.log('🔍 [me] Cookie头:', cookieHeader ? cookieHeader.substring(0, 100) + '...' : '无');
  
  const token = getTokenFromRequest(request);
  console.log('🔍 [me] 提取的Token:', token ? token.substring(0, 50) + '...' : '无');
  
  if (!token) {
    console.log('❌ [me] 未找到Token');
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
    console.log('❌ [me] Token验证失败');
    return new Response(JSON.stringify({
      success: false,
      message: 'Token无效或已过期'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('✅ [me] Token验证成功，用户ID:', payload.userId);
  
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

