// 文件路径: /functions/api/init-db.js

/**
 * 数据库初始化和迁移接口
 * GET: 检查数据库状态
 * POST: 初始化/更新数据库结构（需要管理员Token）
 */

// 核心表结构
const CORE_TABLES = {
  cards_v2: `
    CREATE TABLE IF NOT EXISTS cards_v2 (
      id TEXT PRIMARY KEY,
      cardName TEXT NOT NULL,
      cardType TEXT NOT NULL,
      characters TEXT,
      category TEXT,
      authorName TEXT,
      authorId TEXT,
      isAnonymous TEXT,
      orientation TEXT,
      background TEXT,
      tags TEXT,
      userLimit TEXT,
      warnings TEXT,
      description TEXT,
      secondaryWarning TEXT,
      threadTitle TEXT,
      otherInfo TEXT,
      avatarImageKey TEXT,
      galleryImageKeys TEXT,
      cardFileKey TEXT,
      cardJsonFileKey TEXT,
      attachmentKeys TEXT,
      threadId TEXT,
      firstMessageId TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `,
  
  app_config: `
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `,
  
  card_tokens: `
    CREATE TABLE IF NOT EXISTS card_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      used_at TEXT
    )
  `,
  
  card_actions: `
    CREATE TABLE IF NOT EXISTS card_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `,
  
  card_likes: `
    CREATE TABLE IF NOT EXISTS card_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      card_id TEXT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id)
    )
  `,
  
  card_comments: `
    CREATE TABLE IF NOT EXISTS card_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id TEXT NOT NULL,
      card_id TEXT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT,
      vest_name TEXT,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `
};

// 迁移：为现有表添加缺失的列
const MIGRATIONS = [
  {
    name: 'add_authorId_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'authorId');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN authorId TEXT').run();
    }
  },
  {
    name: 'add_threadId_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'threadId');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN threadId TEXT').run();
    }
  },
  {
    name: 'add_firstMessageId_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'firstMessageId');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN firstMessageId TEXT').run();
    }
  },
  {
    name: 'add_avatarImageKey_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'avatarImageKey');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN avatarImageKey TEXT').run();
    }
  },
  {
    name: 'add_likes_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'likes');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN likes INTEGER DEFAULT 0').run();
    }
  },
  {
    name: 'add_download_requirements_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'downloadRequirements');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      // 添加下载要求字段（JSON格式存储数组）
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN downloadRequirements TEXT').run();
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN requireReaction INTEGER DEFAULT 0').run();
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN requireComment INTEGER DEFAULT 0').run();
    }
  },
  {
    name: 'add_card_json_file_key_to_cards_v2',
    check: async (db) => {
      try {
        const result = await db.prepare('PRAGMA table_info(cards_v2)').all();
        return result.results && !result.results.some(col => col.name === 'cardJsonFileKey');
      } catch (e) {
        return false;
      }
    },
    run: async (db) => {
      // 添加 JSON 格式角色卡字段
      await db.prepare('ALTER TABLE cards_v2 ADD COLUMN cardJsonFileKey TEXT').run();
    }
  }
];

// 检查数据库状态
async function checkDatabaseStatus(db) {
  const status = {
    tables: {},
    migrations: [],
    needsInit: false
  };

  // 检查核心表
  for (const [tableName, _] of Object.entries(CORE_TABLES)) {
    try {
      const result = await db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).bind(tableName).first();
      if (result) {
        const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
        status.tables[tableName] = {
          exists: true,
          columns: columns.results ? columns.results.map(c => c.name) : []
        };
      } else {
        status.tables[tableName] = { exists: false };
        status.needsInit = true;
      }
    } catch (e) {
      status.tables[tableName] = { exists: false, error: e.message };
      status.needsInit = true;
    }
  }

  // 检查需要的迁移
  for (const migration of MIGRATIONS) {
    try {
      const needsMigration = await migration.check(db);
      if (needsMigration) {
        status.migrations.push(migration.name);
      }
    } catch (e) {
      console.error(`Error checking migration ${migration.name}:`, e);
    }
  }

  return status;
}

// 初始化数据库
async function initializeDatabase(db) {
  const results = {
    tablesCreated: [],
    migrationsRun: [],
    errors: []
  };

  // 创建核心表
  for (const [tableName, createSQL] of Object.entries(CORE_TABLES)) {
    try {
      await db.prepare(createSQL).run();
      results.tablesCreated.push(tableName);
    } catch (e) {
      console.error(`Error creating table ${tableName}:`, e);
      results.errors.push({ table: tableName, error: e.message });
    }
  }

  // 运行迁移
  for (const migration of MIGRATIONS) {
    try {
      const needsMigration = await migration.check(db);
      if (needsMigration) {
        await migration.run(db);
        results.migrationsRun.push(migration.name);
      }
    } catch (e) {
      console.error(`Error running migration ${migration.name}:`, e);
      results.errors.push({ migration: migration.name, error: e.message });
    }
  }

  return results;
}

// GET: 检查数据库状态
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const status = await checkDatabaseStatus(env.D1_DB);

    return new Response(JSON.stringify({ 
      success: true, 
      status 
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('检查数据库状态失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '检查数据库状态失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// POST: 初始化/更新数据库（需要管理员权限）
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!env || !env.D1_DB) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'D1数据库未绑定' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证管理员Token
    const adminToken = env.ADMIN_TOKEN;
    const authHeader = request.headers.get('Authorization') || '';
    const expected = adminToken ? `Bearer ${adminToken}` : '';
    
    if (!adminToken || authHeader !== expected) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: '未授权：需要管理员Token' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 执行初始化
    const results = await initializeDatabase(env.D1_DB);
    
    // 再次检查状态
    const status = await checkDatabaseStatus(env.D1_DB);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      status
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('初始化数据库失败:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: '初始化数据库失败: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}














