// 获取当前用户信息
// 重定向到 /api/auth/discord/me

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // 重定向到discord.js的me端点
  const newUrl = new URL('/api/auth/discord/me', url.origin);
  newUrl.search = url.search;
  
  return Response.redirect(newUrl.toString(), 302);
}

