import express from 'express';
import session from 'express-session';
import passport from 'passport';
import DiscordStrategy from 'passport-discord';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import axios from 'axios';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session 配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24小时
  }
}));

// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());

// Discord OAuth 策略配置
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/discord/callback',
  scope: ['identify', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // 保存用户信息到session
    // 注意：实际的服务器和角色验证在 requireAuth 中间件中完成
    const user = {
      id: profile.id,
      username: profile.username,
      discriminator: profile.discriminator,
      avatar: profile.avatar,
      accessToken: accessToken,
      refreshToken: refreshToken
    };

    return done(null, user);
  } catch (error) {
    console.error('Discord OAuth 错误:', error);
    return done(error, null);
  }
}));

// Passport 序列化
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// 数据库初始化
let db;
try {
  db = new Database(process.env.DATABASE_PATH || './database.db');
  console.log('✅ 数据库连接成功');
} catch (error) {
  console.error('❌ 数据库连接失败:', error);
  process.exit(1);
}

// 验证用户是否已登录且具有"已审核"身份组的中间件
async function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: '请先登录' 
    });
  }

  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const verifiedRoleName = process.env.DISCORD_VERIFIED_ROLE_NAME || '已审核';
    const botToken = process.env.DISCORD_BOT_TOKEN;
    
    if (!guildId) {
      return res.status(500).json({ 
        success: false, 
        message: '服务器配置错误' 
      });
    }

    // 如果有Bot Token，使用Bot Token验证（推荐方式）
    if (botToken) {
      // 获取服务器信息以获取角色列表
      const guildResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${guildId}`,
        {
          headers: {
            'Authorization': `Bot ${botToken}`
          }
        }
      ).catch(() => null);

      // 获取用户成员信息
      const memberResponse = await axios.get(
        `https://discord.com/api/v10/guilds/${guildId}/members/${req.user.id}`,
        {
          headers: {
            'Authorization': `Bot ${botToken}`
          }
        }
      ).catch(() => null);

      if (!memberResponse || !memberResponse.data) {
        return res.status(403).json({ 
          success: false, 
          message: '您不在指定的服务器内' 
        });
      }

      const member = memberResponse.data;
      const memberRoles = member.roles || [];
      
      // 如果有服务器信息，检查角色名称
      if (guildResponse && guildResponse.data) {
        const roles = guildResponse.data.roles || [];
        // 查找"已审核"角色的ID
        const verifiedRole = roles.find(r => r.name === verifiedRoleName);
        
        if (verifiedRole && memberRoles.includes(verifiedRole.id)) {
          return next();
        }
      } else {
        // 如果无法获取服务器信息，至少验证用户在服务器内
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        message: `您需要拥有"${verifiedRoleName}"身份组才能访问` 
      });
    } else {
      // 如果没有Bot Token，使用用户Token验证（功能受限）
      // 获取用户加入的服务器列表
      const userGuildsResponse = await axios.get(
        'https://discord.com/api/v10/users/@me/guilds',
        {
          headers: {
            'Authorization': `Bearer ${req.user.accessToken}`
          }
        }
      ).catch(() => null);

      if (!userGuildsResponse || !userGuildsResponse.data) {
        return res.status(403).json({ 
          success: false, 
          message: '无法验证服务器成员身份' 
        });
      }

      const userGuilds = userGuildsResponse.data;
      const isInGuild = userGuilds.some(guild => guild.id === guildId);

      if (!isInGuild) {
        return res.status(403).json({ 
          success: false, 
          message: '您不在指定的服务器内' 
        });
      }

      // 注意：没有Bot Token时无法验证角色，仅验证服务器成员身份
      console.warn('⚠️ 未配置DISCORD_BOT_TOKEN，无法验证角色，仅验证服务器成员身份');
      return next();
    }
  } catch (error) {
    console.error('权限验证错误:', error);
    return res.status(500).json({ 
      success: false, 
      message: '权限验证失败: ' + error.message 
    });
  }
}

// 路由：Discord 登录
app.get('/auth/discord', passport.authenticate('discord'));

// 路由：Discord 回调
app.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/?error=auth_failed' }),
  (req, res) => {
    res.redirect('/');
  }
);

// 路由：登出
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: '登出失败' });
    }
    res.json({ success: true, message: '已登出' });
  });
});

// 路由：获取当前用户信息
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ 
      success: true, 
      user: {
        id: req.user.id,
        username: req.user.username,
        discriminator: req.user.discriminator,
        avatar: req.user.avatar
      }
    });
  } else {
    res.json({ success: false, user: null });
  }
});

// 路由：搜索卡片
app.get('/api/search', requireAuth, (req, res) => {
  try {
    const {
      q, // 搜索关键词（卡名/角色名/作者）
      cardName,
      characterName,
      authorName,
      tags, // 正选标签（逗号分隔）
      excludeTags, // 反选标签（逗号分隔）
      page = 1,
      pageSize = 20
    } = req.query;

    let query = `
      SELECT * FROM cards_v2 
      WHERE threadId IS NOT NULL AND threadId != ''
    `;
    const conditions = [];
    const params = [];

    // 通用搜索（卡名/角色名/作者）
    if (q) {
      conditions.push(`(
        cardName LIKE ? OR 
        authorName LIKE ? OR
        characters LIKE ?
      )`);
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 精确搜索卡名
    if (cardName) {
      conditions.push('cardName LIKE ?');
      params.push(`%${cardName}%`);
    }

    // 搜索角色名
    if (characterName) {
      conditions.push('characters LIKE ?');
      params.push(`%${characterName}%`);
    }

    // 搜索作者
    if (authorName) {
      conditions.push('authorName LIKE ?');
      params.push(`%${authorName}%`);
    }

    // 正选标签（必须包含所有指定标签）
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagList.length > 0) {
        tagList.forEach(tag => {
          conditions.push('tags LIKE ?');
          params.push(`%"${tag}"%`);
        });
      }
    }

    // 反选标签（不能包含任何指定标签）
    if (excludeTags) {
      const excludeTagList = excludeTags.split(',').map(t => t.trim()).filter(t => t);
      if (excludeTagList.length > 0) {
        excludeTagList.forEach(tag => {
          conditions.push('tags NOT LIKE ?');
          params.push(`%"${tag}"%`);
        });
      }
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult.count || 0;

    // 分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    // 执行查询
    const cards = db.prepare(query).all(...params);

    // 解析JSON字段
    const processedCards = cards.map(card => {
      // 解析 tags
      if (card.tags) {
        try {
          card.tags = JSON.parse(card.tags);
        } catch (e) {
          card.tags = [];
        }
      } else {
        card.tags = [];
      }

      // 解析 characters
      if (card.characters) {
        try {
          card.characters = JSON.parse(card.characters);
        } catch (e) {
          card.characters = [];
        }
      } else {
        card.characters = [];
      }

      return card;
    });

    res.json({
      success: true,
      data: {
        cards: processedCards,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / parseInt(pageSize))
        }
      }
    });
  } catch (error) {
    console.error('搜索错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败: ' + error.message
    });
  }
});

// 路由：获取所有可用标签（用于前端显示）
app.get('/api/tags', requireAuth, (req, res) => {
  try {
    const result = db.prepare(`
      SELECT DISTINCT tags 
      FROM cards_v2 
      WHERE threadId IS NOT NULL AND threadId != '' AND tags IS NOT NULL AND tags != ''
    `).all();

    const allTags = new Set();
    result.forEach(row => {
      try {
        const tags = JSON.parse(row.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => allTags.add(tag));
        }
      } catch (e) {
        // 忽略解析错误
      }
    });

    res.json({
      success: true,
      data: {
        tags: Array.from(allTags).sort()
      }
    });
  } catch (error) {
    console.error('获取标签错误:', error);
    res.status(500).json({
      success: false,
      message: '获取标签失败: ' + error.message
    });
  }
});

// 静态文件服务（前端）
app.use(express.static(join(__dirname, 'public')));

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 请确保已配置 .env 文件`);
});

