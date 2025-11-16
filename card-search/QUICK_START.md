# 快速开始指南

## 第一步：安装依赖

```bash
cd card-search
npm install
```

## 第二步：配置 Discord OAuth

### 1. 创建 Discord 应用

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 点击右上角 "New Application"，输入应用名称
3. 在左侧菜单选择 "OAuth2"
4. 复制 **Client ID** 和 **Client Secret**（点击 "Reset Secret" 可以生成新的）

### 2. 设置 Redirect URI

在 OAuth2 页面的 "Redirects" 部分，添加：
- 开发环境：`http://localhost:3000/auth/discord/callback`
- 生产环境：`https://your-domain.com/auth/discord/callback`

### 3. 创建 Bot（推荐，用于角色验证）

1. 在左侧菜单选择 "Bot"
2. 点击 "Add Bot"
3. 复制 **Bot Token**（点击 "Reset Token" 可以生成新的）
4. 在 "Privileged Gateway Intents" 中启用：
   - ✅ Server Members Intent（必须，用于获取成员信息）

### 4. 邀请 Bot 到服务器

1. 在左侧菜单选择 "OAuth2" > "URL Generator"
2. 在 "Scopes" 中选择：
   - ✅ `bot`
   - ✅ `identify`
3. 在 "Bot Permissions" 中选择：
   - ✅ View Channels
   - ✅ Read Messages/View Channels
4. 复制生成的 URL，在浏览器中打开，选择你的服务器并授权

## 第三步：获取服务器 ID 和角色名称

### 获取服务器 ID

1. 在 Discord 中启用开发者模式（设置 > 高级 > 开发者模式）
2. 右键点击你的服务器，选择 "复制服务器 ID"

### 确认角色名称

1. 在服务器设置中找到 "已审核" 角色
2. 确认角色名称完全一致（区分大小写）

## 第四步：配置环境变量

1. 复制 `ENV_EXAMPLE.txt` 为 `.env`
2. 填写以下配置：

```env
# Discord OAuth 配置
DISCORD_CLIENT_ID=你的Client_ID
DISCORD_CLIENT_SECRET=你的Client_Secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Discord 服务器配置
DISCORD_GUILD_ID=你的服务器ID
DISCORD_VERIFIED_ROLE_NAME=已审核

# Bot Token（推荐配置）
DISCORD_BOT_TOKEN=你的Bot_Token

# 会话密钥（生成随机字符串，例如：openssl rand -hex 32）
SESSION_SECRET=你的随机密钥

# 服务器端口
PORT=3000

# 数据库配置（SQLite文件路径）
DATABASE_PATH=./database.db

# 前端URL（用于CORS）
FRONTEND_URL=http://localhost:3000
```

## 第五步：准备数据库

### 如果使用 SQLite（本地开发）

确保你的数据库文件包含 `cards_v2` 表。如果数据库文件不存在，程序会自动创建（但不会创建表结构）。

你可以从现有的 Cloudflare D1 数据库导出数据，或使用以下 SQL 创建表：

```sql
CREATE TABLE IF NOT EXISTS cards_v2 (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  cardType TEXT NOT NULL,
  characters TEXT,
  category TEXT,
  authorName TEXT,
  authorId TEXT,
  tags TEXT,
  threadId TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
```

### 如果使用 Cloudflare D1

需要修改 `server.js` 中的数据库连接部分，使用 Cloudflare D1 的 API。

## 第六步：启动服务器

```bash
npm start
```

或开发模式（自动重启）：

```bash
npm run dev
```

## 第七步：访问网站

打开浏览器访问：`http://localhost:3000`

## 常见问题

### 1. 登录后提示"您不在指定的服务器内"

- 检查 `DISCORD_GUILD_ID` 是否正确
- 确保用户确实在服务器内
- 如果使用 Bot Token，确保 Bot 已加入服务器

### 2. 登录后提示"需要已审核身份组"

- 检查 `DISCORD_VERIFIED_ROLE_NAME` 是否与服务器中的角色名称完全一致（区分大小写）
- 确保用户确实拥有该角色
- 如果未配置 `DISCORD_BOT_TOKEN`，系统无法验证角色，建议配置

### 3. 搜索无结果

- 检查数据库文件路径是否正确
- 确认 `cards_v2` 表中有数据
- 确认搜索的卡片有 `threadId`（已发布的卡片）

### 4. 数据库连接失败

- 检查 `DATABASE_PATH` 是否正确
- 确保有读写权限
- 如果使用 SQLite，确保已安装 `better-sqlite3` 的编译依赖

### 5. Discord API 错误

- 检查所有 Discord 配置是否正确
- 确保 Bot Token 有效且未过期
- 确保 Bot 有必要的权限（Server Members Intent）

## 生产环境部署

### 使用 PM2

```bash
npm install -g pm2
pm2 start server.js --name card-search
pm2 save
pm2 startup
```

### 使用 Docker

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

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 安全建议

1. **使用 HTTPS**：在生产环境中必须使用 HTTPS
2. **保护 SESSION_SECRET**：使用足够长的随机字符串，不要泄露
3. **保护环境变量**：不要将 `.env` 文件提交到版本控制
4. **配置 CORS**：在生产环境中正确配置 `FRONTEND_URL`
5. **定期更新依赖**：使用 `npm audit` 检查安全漏洞

