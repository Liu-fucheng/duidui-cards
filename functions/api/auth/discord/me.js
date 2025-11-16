// 获取当前用户信息
// GET /api/auth/discord/me

// 从请求中获取Token（从Authorization头或Cookie）
function getTokenFromRequest(request) {
  // 优先从Authorization头获取（因为它是原始Token，没有被URL编码）
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    console.log('✅ [getTokenFromRequest] 从Authorization头找到Token，长度:', token.length);
    return token;
  }
  
  // 如果Authorization头没有，再从Cookie获取
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    // 更健壮的Cookie解析（处理URL编码等）
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
      const trimmed = cookie.trim();
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        try {
          // 尝试解码，如果失败则使用原始值
          cookies[key] = decodeURIComponent(value);
        } catch (e) {
          // 如果解码失败，可能是已经被解码过了，直接使用
          cookies[key] = value;
        }
      }
    });
    
    console.log('🔍 [getTokenFromRequest] 解析的Cookies:', Object.keys(cookies));
    
    if (cookies['auth_token']) {
      const token = cookies['auth_token'].trim();
      console.log('✅ [getTokenFromRequest] 从Cookie找到Token，长度:', token.length);
      return token;
    }
  }
  
  console.log('❌ [getTokenFromRequest] 未找到Token');
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
    console.log('🔍 [verifyToken] JWT_SECRET长度:', secret.length);
    console.log('🔍 [verifyToken] JWT_SECRET前10个字符:', secret.substring(0, 10));
    
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
    const signature = new Uint8Array(signatureBytes.length);
    for (let i = 0; i < signatureBytes.length; i++) {
      signature[i] = signatureBytes.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      new TextEncoder().encode(data)
    );

    if (!isValid) {
      console.log('❌ [verifyToken] 签名验证失败');
      return null;
    }
    
    console.log('✅ [verifyToken] 签名验证成功');

    // 解析payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log('❌ [verifyToken] Token已过期，当前时间:', now, '过期时间:', payload.exp);
      return null;
    }
    
    console.log('✅ [verifyToken] Token未过期，剩余时间:', payload.exp - now, '秒');

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
  console.log('🔍 [me] Cookie头:', cookieHeader ? cookieHeader.substring(0, 200) + '...' : '无');
  console.log('🔍 [me] 所有请求头:', JSON.stringify(Object.fromEntries(request.headers.entries())));
  
  const token = getTokenFromRequest(request);
  console.log('🔍 [me] 提取的Token:', token ? token.substring(0, 50) + '...' : '无');
  console.log('🔍 [me] Token长度:', token ? token.length : 0);
  console.log('🔍 [me] Token来源:', request.headers.get('Authorization') ? 'Authorization头' : 'Cookie');
  
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
  
  // 清理 Token（去除可能的引号和空格）
  const cleanToken = token.trim().replace(/^["']|["']$/g, '');
  console.log('🔍 [me] 清理后的Token长度:', cleanToken.length);
  console.log('🔍 [me] 清理后的Token前50个字符:', cleanToken.substring(0, 50));
  
  // 先尝试解析 Token 看看内容（用于调试）
  let decodedPayloadForDebug = null;
  try {
    const parts = cleanToken.split('.');
    if (parts.length === 3) {
      const [header, payloadPart, signature] = parts;
      // Base64URL解码payload看看内容
      let payloadStr = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      while (payloadStr.length % 4) {
        payloadStr += '=';
      }
      const binary = atob(payloadStr);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      decodedPayloadForDebug = JSON.parse(new TextDecoder().decode(bytes));
      console.log('🔍 [me] Token payload内容:', JSON.stringify(decodedPayloadForDebug));
      const now = Math.floor(Date.now() / 1000);
      console.log('🔍 [me] 当前时间:', now, 'Token过期时间:', decodedPayloadForDebug.exp);
      if (decodedPayloadForDebug.exp && decodedPayloadForDebug.exp < now) {
        console.log('❌ [me] Token已过期，相差:', now - decodedPayloadForDebug.exp, '秒');
      } else if (decodedPayloadForDebug.exp) {
        console.log('✅ [me] Token未过期，剩余时间:', decodedPayloadForDebug.exp - now, '秒');
      }
    }
  } catch (e) {
    console.log('🔍 [me] 解析Token payload失败:', e.message);
  }
  
  // 在验证前记录 JWT_SECRET 信息（用于调试）
  const secret = getJWTSecret(env);
  console.log('🔍 [me] 验证时使用的JWT_SECRET长度:', secret.length);
  console.log('🔍 [me] 验证时使用的JWT_SECRET前10个字符:', secret.substring(0, 10));
  console.log('🔍 [me] 验证时使用的JWT_SECRET是否使用默认值:', secret === 'your-secret-key-change-in-production');
  
  // 准备调试信息（用于前端显示）
  const debugInfo = {
    tokenLength: cleanToken.length,
    tokenParts: cleanToken.split('.').length,
    secretLength: secret.length,
    secretPrefix: secret.substring(0, 10) + '...',
    usingDefaultSecret: secret === 'your-secret-key-change-in-production',
    timestamp: Math.floor(Date.now() / 1000)
  };
  
  if (decodedPayloadForDebug) {
    debugInfo.payload = {
      userId: decodedPayloadForDebug.userId,
      username: decodedPayloadForDebug.username,
      exp: decodedPayloadForDebug.exp,
      iat: decodedPayloadForDebug.iat,
      now: Math.floor(Date.now() / 1000),
      isExpired: decodedPayloadForDebug.exp && decodedPayloadForDebug.exp < Math.floor(Date.now() / 1000)
    };
  }
  
  const payload = await verifyToken(cleanToken, env);
  if (!payload) {
    console.log('❌ [me] Token验证失败');
    // 返回更详细的错误信息（包含所有调试信息）
    let errorMessage = 'Token无效或已过期';
    if (decodedPayloadForDebug) {
      const now = Math.floor(Date.now() / 1000);
      if (decodedPayloadForDebug.exp && decodedPayloadForDebug.exp < now) {
        errorMessage = 'Token已过期';
      } else {
        errorMessage = 'Token签名验证失败（可能是JWT_SECRET不匹配）';
      }
    }
    
    // 添加验证过程的详细信息
    debugInfo.verificationFailed = true;
    debugInfo.errorMessage = errorMessage;
    
    return new Response(JSON.stringify({
      success: false,
      message: errorMessage,
      debug: debugInfo,
      logs: [
        '🔍 [me] 收到Token验证请求',
        `🔍 [me] Token长度: ${cleanToken.length}`,
        `🔍 [me] Token部分数量: ${cleanToken.split('.').length}`,
        `🔍 [me] 验证时使用的JWT_SECRET长度: ${secret.length}`,
        `🔍 [me] 验证时使用的JWT_SECRET前10个字符: ${secret.substring(0, 10)}`,
        `🔍 [me] 验证时使用的JWT_SECRET是否使用默认值: ${secret === 'your-secret-key-change-in-production'}`,
        decodedPayloadForDebug ? `🔍 [me] Token payload解析成功，用户ID: ${decodedPayloadForDebug.userId}` : '❌ [me] Token payload解析失败',
        decodedPayloadForDebug && decodedPayloadForDebug.exp ? `🔍 [me] Token过期时间: ${decodedPayloadForDebug.exp}, 当前时间: ${Math.floor(Date.now() / 1000)}` : '',
        decodedPayloadForDebug && decodedPayloadForDebug.exp && decodedPayloadForDebug.exp < Math.floor(Date.now() / 1000) ? '❌ [me] Token已过期' : decodedPayloadForDebug ? '✅ [me] Token未过期' : '',
        '❌ [verifyToken] 签名验证失败',
        '❌ [me] Token验证失败'
      ].filter(Boolean)
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('✅ [me] Token验证成功，用户ID:', payload.userId);
  
  // 再次验证用户身份组（可选，用于确保用户仍然有权限）
  const roleVerification = await verifyUserRole(payload.userId, env);
  
  // 添加成功日志到响应中
  debugInfo.verificationSuccess = true;
  debugInfo.payload = {
    userId: payload.userId,
    username: payload.username,
    exp: payload.exp,
    iat: payload.iat
  };
  
  return new Response(JSON.stringify({
    success: true,
    user: {
      id: payload.userId,
      username: payload.username,
      discriminator: payload.discriminator,
      avatar: payload.avatar,
      globalName: payload.globalName,
      verified: roleVerification.verified,
    },
    debug: debugInfo,
    logs: [
      '✅ [me] Token验证成功',
      `✅ [me] 用户ID: ${payload.userId}`,
      `✅ [me] 用户名: ${payload.username}`,
      `✅ [me] Token未过期，剩余时间: ${payload.exp - Math.floor(Date.now() / 1000)} 秒`
    ]
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}



