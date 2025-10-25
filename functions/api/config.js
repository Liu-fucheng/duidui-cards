// 文件路径: /functions/api/config.js

/**
 * 配置接口
 * GET:  从 D1 读取表单配置（含 tagCategories）
 * POST: 管理员更新配置（需 Authorization: Bearer <ADMIN_TOKEN>）
 */

const DEFAULT_CONFIG = {
  orientations: [
    { value: 'GB', label: 'GB' },
    { value: 'BG', label: 'BG' },
    { value: 'GL', label: 'GL' },
    { value: 'BL', label: 'BL' },
    { value: 'none', label: '无CP' }
  ],
  backgrounds: [
    { value: 'modern', label: '现代' },
    { value: 'ancient', label: '古代' },
    { value: 'future', label: '未来' },
    { value: 'fantasy', label: '幻想' }
  ],
  tagCategories: [
    {
      category: '场景',
      tags: [
        { value: 'campus', label: '校园' },
        { value: 'city', label: '都市' },
        { value: 'workplace', label: '职场' },
        { value: 'fantasy', label: '幻想世界' }
      ]
    },
    {
      category: '关系',
      tags: [
        { value: 'older', label: '年上' },
        { value: 'younger', label: '年下' },
        { value: 'childhood', label: '青梅竹马' },
        { value: 'enemy', label: '敌对关系' }
      ]
    },
    {
      category: '风格',
      tags: [
        { value: 'sweet', label: '甜文' },
        { value: 'angst', label: '虐文' },
        { value: 'comedy', label: '轻松' },
        { value: 'mystery', label: '悬疑' },
        { value: 'thriller', label: '惊悚' }
      ]
    }
  ],
  limits: [
    { value: 'none', label: '无' },
    { value: 'female', label: '限女User' },
    { value: 'male', label: '限男User' }
  ]
};

async function ensureConfigTable(env) {
  if (!env || !env.D1_DB) return;
  await env.D1_DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_config (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       updatedAt TEXT NOT NULL
     )`
  ).run();
}

async function readConfigFromDb(env) {
  await ensureConfigTable(env);
  const row = await env.D1_DB.prepare('SELECT value FROM app_config WHERE key = ?')
    .bind('ui_config')
    .first();
  if (!row || !row.value) {
    // 初始化默认配置
    const now = new Date().toISOString();
    await env.D1_DB.prepare(
      `INSERT OR REPLACE INTO app_config (key, value, updatedAt) VALUES (?, ?, ?)`
    ).bind('ui_config', JSON.stringify(DEFAULT_CONFIG), now).run();
    return DEFAULT_CONFIG;
  }
  try {
    return JSON.parse(row.value);
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

function sanitizeConfig(input) {
  const output = {};
  if (input && Array.isArray(input.orientations)) output.orientations = input.orientations;
  if (input && Array.isArray(input.backgrounds)) output.backgrounds = input.backgrounds;
  if (input && Array.isArray(input.limits)) output.limits = input.limits;
  const sanitizeCategories = (arr) => (Array.isArray(arr) ? arr : [])
    .filter(c => c && typeof c.category === 'string' && Array.isArray(c.tags))
    .map(c => ({
      category: c.category,
      asPill: Boolean(c.asPill),
      pillLabel: typeof c.pillLabel === 'string' ? c.pillLabel : undefined,
      pillValue: typeof c.pillValue === 'string' ? c.pillValue : undefined,
      tags: (Array.isArray(c.tags) ? c.tags : [])
        .filter(t => t && typeof t.value === 'string' && typeof t.label === 'string')
        .map(t => ({ value: t.value, label: t.label }))
    }));
  if (input && Array.isArray(input.tagCategories)) {
    output.tagCategories = sanitizeCategories(input.tagCategories);
  }
  // 自定义板块
  if (input && Array.isArray(input.customSections)) {
    output.customSections = (input.customSections || [])
      .filter(s => s && typeof s.title === 'string')
      .map(s => ({
        title: s.title,
        items: (Array.isArray(s.items) ? s.items : [])
          .filter(it => it && (typeof it.label === 'string' || typeof it.value === 'string'))
          .map(it => ({ label: it.label || it.value, value: it.value || it.label }))
      }));
  }
  // 板块顺序（字符串数组，如：['partition','orientations','backgrounds','limits','custom:题材']）
  if (input && Array.isArray(input.sections)) {
    output.sections = (input.sections || [])
      .filter(x => typeof x === 'string')
      .slice(0, 100);
  }
  if (input && input.tagPartitions && typeof input.tagPartitions === 'object') {
    const p = input.tagPartitions;
    output.tagPartitions = {
      common: sanitizeCategories(p.common),
      feibianxian: sanitizeCategories(p.feibianxian),
      bianxian: sanitizeCategories(p.bianxian),
      shenyuan: sanitizeCategories(p.shenyuan)
    };
  }
  return output;
}

export async function onRequestGet(context) {
  try {
    const { env } = context;
    const config = env && env.D1_DB
      ? await readConfigFromDb(env)
      : DEFAULT_CONFIG;

    return new Response(JSON.stringify({ success: true, config }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: "获取配置失败: " + error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ success: false, message: '服务器D1未绑定' }), { status: 500 });
    }

    const adminToken = env.ADMIN_TOKEN;
    const authHeader = request.headers.get('Authorization') || '';
    const expected = adminToken ? `Bearer ${adminToken}` : '';
    if (!adminToken || authHeader !== expected) {
      return new Response(JSON.stringify({ success: false, message: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return new Response(JSON.stringify({ success: false, message: '请求体需要为 JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const current = await readConfigFromDb(env);
    const sanitized = sanitizeConfig(body || {});
    const nextConfig = { ...current, ...sanitized };

    await ensureConfigTable(env);
    await env.D1_DB.prepare(
      `INSERT OR REPLACE INTO app_config (key, value, updatedAt) VALUES (?, ?, ?)`
    ).bind('ui_config', JSON.stringify(nextConfig), new Date().toISOString()).run();

    return new Response(JSON.stringify({ success: true, config: nextConfig }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ success: false, message: '更新配置失败: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
