// 文件路径: /functions/api/cards.js

export async function onRequestGet(context) {
    try {
      const { env } = context;
  
      if (!env.D1_DB) {
        return new Response(JSON.stringify({ success: false, message: "服务器D1未绑定" }), { status: 500 });
      }
  
      // 1. 从 D1 查询，按创建时间倒序排列
      // 我们只选择列表页需要的基础信息
      const { results } = await env.D1_DB.prepare(
        "SELECT id, cardName, authorName, description, tags FROM cards_v2 ORDER BY createdAt DESC LIMIT 20"
      ).all();
  
      // 2. 以 JSON 格式返回查询结果
      return new Response(JSON.stringify({ success: true, cards: results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error(error);
      return new Response(
        JSON.stringify({ success: false, message: "获取卡片失败: " + error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }