# Cloudflare Pages 部署指南

这个项目已配置为使用 **Cloudflare Pages Functions** 和 **Cloudflare D1** 数据库。

## 项目结构

```
card-search/
├── functions/
│   └── api/
│       ├── auth.js              # Discord OAuth 登录
│       ├── auth/
│       │   └── callback.js      # OAuth 回调处理
│       ├── user.js              # 获取用户信息
│       ├── logout.js            # 登出
│       ├── search.js            # 搜索卡片
│       └── tags.js              # 获取所有标签
├── public/
│   └── index.html               # 前端搜索界面
├── wrangler.toml                # Cloudflare 配置
└── package.json
```

## 部署步骤

### 1. 准备 Cloudflare 资源

#### 创建 D1 数据库

```bash
# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库（如果还没有）
npx wrangler d1 create duidui-cards-db
```

记录返回的 `database_id`，更新到 `wrangler.toml` 中。

#### 绑定现有 D1 数据库

如果你已经有 D1 数据库（比如从 `duidui-cards` 项目），可以直接使用：

1. 在 Cloudflare Dashboard 中找到你的 D1 数据库
2. 复制 `database_id`
3. 更新 `wrangler.toml` 中的 `database_id`

### 2. 配置 Discord OAuth

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用或使用现有应用
3. 在 OAuth2 页面：
   - 复制 **Client ID** 和 **Client Secret**
   - 添加 Redirect URI: `https://your-site.pages.dev/api/auth/callback`
4. 在 Bot 页面（推荐）：
   - 创建 Bot
   - 复制 Bot Token
   - 启用 **Server Members Intent**

### 3. 部署到 Cloudflare Pages

#### 方法 1：使用 Wrangler CLI

```bash
cd card-search

# 部署
npx wrangler pages deploy public --project-name=card-search
```

#### 方法 2：使用 Git 集成

1. 将代码推送到 GitHub
2. 在 Cloudflare Dashboard 中：
   - 进入 Workers & Pages
   - 创建新 Pages 项目
   - 连接 GitHub 仓库
   - 设置构建配置：
     - **Build command**: （留空）
     - **Build output directory**: `public`

### 4. 配置环境变量

在 Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Variables 中设置：

```bash
# Discord OAuth 配置
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=https://your-site.pages.dev/api/auth/callback

# Discord 服务器配置
DISCORD_GUILD_ID=your_guild_id
DISCORD_VERIFIED_ROLE_NAME=已审核

# Bot Token（推荐，用于角色验证）
DISCORD_BOT_TOKEN=your_bot_token

# 前端URL（用于重定向）
FRONTEND_URL=https://your-site.pages.dev
```

### 5. 绑定 D1 数据库

在 Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → D1 Database Bindings 中：

1. 点击 "Add binding"
2. Variable name: `D1_DB`
3. Database: 选择你的 D1 数据库

## 本地开发

### 使用 Wrangler 本地开发

```bash
# 安装依赖（如果需要）
npm install

# 启动本地开发服务器
npx wrangler pages dev public --d1=D1_DB=duidui-cards-db
```

### 配置本地环境变量

创建 `.dev.vars` 文件（不会被提交到 Git）：

```bash
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:8788/api/auth/callback
DISCORD_GUILD_ID=your_guild_id
DISCORD_VERIFIED_ROLE_NAME=已审核
DISCORD_BOT_TOKEN=your_bot_token
FRONTEND_URL=http://localhost:8788
```

## API 路由

所有 API 路由都在 `functions/api/` 目录下：

- `GET /api/auth?action=login` - 开始 Discord OAuth 登录
- `GET /api/auth/callback` - Discord OAuth 回调
- `GET /api/user` - 获取当前用户信息
- `GET /api/logout` - 登出
- `GET /api/search` - 搜索卡片（需要登录）
- `GET /api/tags` - 获取所有可用标签（需要登录）

## 注意事项

1. **Session 存储**：当前使用 Cookie 存储 session，在生产环境中建议使用 JWT 或 KV 存储以提高安全性。

2. **HTTPS**：Cloudflare Pages 自动提供 HTTPS，确保 Discord OAuth 的 Redirect URI 使用 HTTPS。

3. **CORS**：如果需要跨域访问，在 Functions 中添加 CORS 头。

4. **Bot Token**：强烈建议配置 `DISCORD_BOT_TOKEN`，这样才能准确验证用户的身份组。

5. **数据库权限**：确保 D1 数据库已正确绑定，并且有读取权限。

## 故障排除

### 登录后提示"您不在指定的服务器内"

- 检查 `DISCORD_GUILD_ID` 是否正确
- 确保用户确实在服务器内
- 如果使用 Bot Token，确保 Bot 已加入服务器并启用了 Server Members Intent

### 登录后提示"需要已审核身份组"

- 检查 `DISCORD_VERIFIED_ROLE_NAME` 是否与服务器中的角色名称完全一致
- 确保用户确实拥有该角色
- 确保 Bot Token 已配置且有效

### 搜索无结果

- 检查 D1 数据库绑定是否正确
- 确认 `cards_v2` 表中有数据
- 确认搜索的卡片有 `threadId`（已发布的卡片）

### Session 无效

- 检查 Cookie 是否被正确设置
- 确保前端请求包含 `credentials: 'include'`
- 检查 Cookie 的 SameSite 设置是否合适

## 与现有项目集成

如果你已经有 `duidui-cards` 项目，可以：

1. **共享 D1 数据库**：在 `wrangler.toml` 中使用相同的 `database_id`
2. **共享环境变量**：在 Cloudflare Dashboard 中配置相同的环境变量
3. **部署到同一 Pages 项目**：将搜索功能添加到现有的 Pages 项目中

