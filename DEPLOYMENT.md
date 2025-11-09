# 部署配置指南

## 架构说明

```
用户 → 网页(index.html) → Cloudflare Workers → 通知 → Discord Bot → 发帖到Discord
                              ↓                              ↓
                         保存到 D1/R2                    保存 threadId
```

## 必需的环境变量配置

### Cloudflare Workers 环境变量

在 Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Variables 中设置：

```bash
# Discord Bot URL（Bot部署的地址）
DISCORD_BOT_URL=https://your-bot.onrender.com

# Webhook密钥（用于验证来自Workers的请求）
WEBHOOK_SECRET=你的随机密钥（至少32位）

# R2公开访问URL
R2_PUBLIC_URL=https://your-r2-bucket.r2.dev

# 管理员Token
ADMIN_TOKEN=你的管理员token

# Discord频道ID（可选，代码中有默认值）
DISCORD_CHANNEL_FEIBIANXIAN=1432350162365190184
DISCORD_CHANNEL_BIANXIAN=1432350179314372692
DISCORD_CHANNEL_SHENYUAN=1432350193696641135

# 角色卡网站URL（用于生成token链接）
CARD_WEBSITE_URL=https://your-cards-site.pages.dev
```

### Discord Bot 环境变量

在你的 Bot 部署平台（如 Render）设置：

```bash
# Discord Bot Token
DISCORD_TOKEN=你的bot_token

# Webhook密钥（与Workers中的WEBHOOK_SECRET相同）
WEBHOOK_SECRET=你的随机密钥（至少32位）

# 端口（Render会自动提供）
PORT=10000
```

### 绑定配置 (wrangler.toml)

```toml
name = "duidui-cards"
main = "functions/api/[[path]].js"
compatibility_date = "2024-01-01"

# D1数据库绑定
[[d1_databases]]
binding = "D1_DB"
database_name = "duidui-cards-db"
database_id = "你的数据库ID"

# R2存储绑定
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "duidui-cards"

# KV命名空间绑定（可选，用于存储角色卡数据供bot查询）
[[kv_namespaces]]
binding = "CLOUDFLARE_KV_NAMESPACE"
id = "你的KV命名空间ID"
```

## 部署步骤

### 1. 部署 Discord Bot (app.py)

**使用 Render.com 部署：**

1. 登录 [Render](https://render.com)
2. 创建新 Web Service
3. 连接 GitHub 仓库
4. 配置：
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python app.py`
   - **Environment Variables:** 添加上面列出的环境变量

5. 部署后获取 URL（类似：`https://your-bot.onrender.com`）

### 2. 部署 Cloudflare Workers

```bash
cd duidui-cards

# 登录 Cloudflare
npx wrangler login

# 创建 D1 数据库
npx wrangler d1 create duidui-cards-db

# 创建 R2 Bucket
npx wrangler r2 bucket create duidui-cards

# 创建 KV Namespace（可选）
npx wrangler kv:namespace create "CLOUDFLARE_KV_NAMESPACE"

# 更新 wrangler.toml 中的 database_id 和其他 ID

# 部署
npx wrangler deploy
```

### 3. 初始化数据库

1. 部署成功后，访问 `https://your-site.pages.dev/db-admin.html`
2. 输入 ADMIN_TOKEN
3. 点击"初始化数据库"

### 4. 配置环境变量

在 Cloudflare Dashboard 中设置：

1. **DISCORD_BOT_URL**: 你的 Bot URL（步骤1获取的）
2. **WEBHOOK_SECRET**: 生成一个随机密钥
   ```bash
   # 使用这个命令生成
   openssl rand -hex 32
   ```
3. **R2_PUBLIC_URL**: 配置 R2 的公开访问
   ```bash
   # 在 Cloudflare Dashboard → R2 → 你的bucket → Settings → Public Access
   # 或使用自定义域名
   ```

### 5. 在 Discord Bot 中设置相同的 WEBHOOK_SECRET

在 Render 的环境变量中添加与 Cloudflare 相同的 `WEBHOOK_SECRET`

## 测试流程

### 1. 测试 Bot 是否运行

访问：`https://your-bot.onrender.com/`

应该看到：`I'm alive!`

### 2. 测试数据库

访问：`https://your-cards-site.pages.dev/db-admin.html`

检查数据库状态

### 3. 测试发卡流程

1. 在 Discord 中使用 `/发送发卡按钮`
2. 点击按钮生成链接
3. 打开链接填写表单
4. 提交
5. 检查：
   - Discord 频道是否有新帖子
   - 管理后台是否有记录
   - 日志频道是否有日志

## 查看日志

### Cloudflare Workers 日志

```bash
cd duidui-cards
npx wrangler tail
```

### Discord Bot 日志

在 Render Dashboard → Logs 查看

## 常见问题

### Q: 上传成功但没有发帖

**检查：**
1. Cloudflare 日志中是否有 "✅ 已通知Bot发帖"
2. Bot 日志中是否有 "📝 准备发帖到频道"
3. `DISCORD_BOT_URL` 是否正确
4. `WEBHOOK_SECRET` 是否匹配

### Q: Bot 收不到通知

**检查：**
1. Bot 是否在运行（访问 Bot URL 查看）
2. `WEBHOOK_SECRET` 是否在两边都设置了
3. Bot URL 是否正确（注意 http vs https）

### Q: 发帖失败

**检查 Bot 日志：**
1. 频道ID是否正确
2. Bot 是否有权限
3. 是否是论坛频道（需要特殊处理）

### Q: 图片无法显示

**检查：**
1. R2_PUBLIC_URL 是否正确
2. R2 Bucket 是否开启公开访问
3. 图片URL是否可以在浏览器打开

## 升级指南

### 从 Webhook 方式升级

如果之前使用 Webhook 发帖，现在改用 Bot 发帖：

1. 更新 `app.py`（已包含新代码）
2. 更新 `upload.js`（已包含新代码）
3. 设置环境变量：
   - `DISCORD_BOT_URL`
   - `WEBHOOK_SECRET`
4. 重启 Bot
5. 重新部署 Workers

### 回滚到 Webhook 方式

如果 Bot 方式有问题，可以临时回滚：

在 `upload.js` 中，将 `notifyDiscordBot` 改回 `postToDiscord` 即可。

## 监控

### 定期检查

1. **每天检查管理后台**
   - 访问 `cards-admin.html`
   - 查看今日新增是否正常

2. **每周检查日志**
   - Bot 日志是否有错误
   - Workers 日志是否有异常

### 告警设置

在 Render 中可以设置告警：
- Bot 停止运行
- 内存使用过高
- 错误日志过多

## 安全建议

1. **妥善保管密钥**
   - 不要将 `.env` 提交到 Git
   - 定期更换 `WEBHOOK_SECRET`

2. **限制访问**
   - 管理后台使用强密码
   - Bot Token 不要泄露

3. **监控日志**
   - 定期查看异常请求
   - 检查是否有恶意上传

## 备份

### 备份数据库

```bash
npx wrangler d1 export duidui-cards-db --output=backup-$(date +%Y%m%d).sql
```

### 备份 R2 文件

```bash
# 使用 rclone 或 AWS CLI
rclone sync cloudflare:duidui-cards ./backup/r2/
```

## 成本估算

### Cloudflare

- Workers: 免费 (100,000 请求/天)
- R2: $0.015/GB/月存储
- D1: 免费 (5GB)

### Render

- Free Tier: 750小时/月
- Starter: $7/月 (推荐)

**预估总成本：** $7-15/月（取决于使用量）























