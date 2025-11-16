# 卡片搜索网站

一个支持 Discord OAuth 登录的卡片搜索网站，只有拥有"已审核"身份组的用户才能访问。

**本项目支持 Cloudflare Pages + D1 部署。** 查看 [README_CLOUDFLARE.md](./README_CLOUDFLARE.md) 了解 Cloudflare 部署详情。

## 功能特性

- ✅ Discord OAuth 2.0 登录
- ✅ 服务器成员验证
- ✅ 身份组权限检查（"已审核"）
- ✅ 多条件搜索：
  - 通用搜索（卡名/角色名/作者）
  - 精确搜索卡名
  - 搜索角色名
  - 搜索作者
  - 标签正选（必须包含）
  - 标签反选（排除）
- ✅ 分页显示
- ✅ 现代化 UI 设计

## 快速开始

### 1. 安装依赖

```bash
cd card-search
npm install
```

### 2. 配置 Discord OAuth

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用（Application）
3. 在 OAuth2 页面：
   - 复制 **Client ID** 和 **Client Secret**
   - 添加 Redirect URI: `http://localhost:3000/auth/discord/callback`
4. 在 Bot 页面（可选，但推荐）：
   - 创建 Bot
   - 复制 Bot Token（用于验证角色）

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填写：

```env
# Discord OAuth 配置
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord 服务器配置
DISCORD_GUILD_ID=your_guild_id
DISCORD_VERIFIED_ROLE_NAME=已审核

# Bot Token（可选，但推荐用于角色验证）
DISCORD_BOT_TOKEN=your_bot_token

# 会话密钥（随机字符串）
SESSION_SECRET=your_random_session_secret_here

# 服务器端口
PORT=3000

# 数据库配置（SQLite文件路径）
DATABASE_PATH=./database.db

# 前端URL（用于CORS）
FRONTEND_URL=http://localhost:3000
```

### 4. 准备数据库

确保你的数据库文件包含 `cards_v2` 表，并且有以下字段：
- `id` - 卡片ID
- `cardName` - 卡名
- `characters` - 角色名（JSON格式）
- `authorName` - 作者名
- `tags` - 标签（JSON格式）
- `threadId` - 帖子ID（用于筛选已发布的卡片）

如果使用 Cloudflare D1，需要修改 `server.js` 中的数据库连接部分。

### 5. 启动服务器

```bash
npm start
```

或开发模式（自动重启）：

```bash
npm run dev
```

### 6. 访问网站

打开浏览器访问：`http://localhost:3000`

## 部署

### 使用 Node.js 服务器部署

1. 确保服务器已安装 Node.js 18+
2. 上传项目文件
3. 安装依赖：`npm install --production`
4. 配置 `.env` 文件
5. 使用 PM2 或其他进程管理器运行：
   ```bash
   pm2 start server.js --name card-search
   ```

### 使用 Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

构建和运行：

```bash
docker build -t card-search .
docker run -d -p 3000:3000 --env-file .env card-search
```

## API 接口

### GET /api/user
获取当前登录用户信息

### GET /api/search
搜索卡片（需要登录）

**查询参数：**
- `q` - 通用搜索关键词
- `cardName` - 卡名
- `characterName` - 角色名
- `authorName` - 作者名
- `tags` - 正选标签（逗号分隔）
- `excludeTags` - 反选标签（逗号分隔）
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

### GET /api/tags
获取所有可用标签（需要登录）

### GET /auth/discord
开始 Discord OAuth 登录

### GET /auth/discord/callback
Discord OAuth 回调

### GET /auth/logout
登出

## 注意事项

1. **Bot Token 配置**：虽然可选，但强烈建议配置 `DISCORD_BOT_TOKEN`，这样才能准确验证用户的身份组。如果没有配置，系统只能验证用户是否在服务器内，无法验证角色。

2. **数据库连接**：当前代码使用 SQLite（better-sqlite3）。如果使用 Cloudflare D1 或其他数据库，需要修改 `server.js` 中的数据库连接部分。

3. **HTTPS**：在生产环境中，请使用 HTTPS，并确保 Discord OAuth 的 Redirect URI 也使用 HTTPS。

4. **会话安全**：确保 `SESSION_SECRET` 是一个足够长的随机字符串，不要泄露。

## 故障排除

### 登录后提示"您不在指定的服务器内"
- 检查 `DISCORD_GUILD_ID` 是否正确
- 确保用户确实在服务器内

### 登录后提示"需要已审核身份组"
- 检查 `DISCORD_VERIFIED_ROLE_NAME` 是否与服务器中的角色名称完全一致
- 如果未配置 `DISCORD_BOT_TOKEN`，系统无法验证角色，建议配置 Bot Token

### 搜索无结果
- 检查数据库文件路径是否正确
- 确认 `cards_v2` 表中有数据
- 确认搜索的卡片有 `threadId`（已发布）

## 许可证

MIT

