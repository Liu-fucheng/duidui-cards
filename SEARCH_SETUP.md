# 搜索功能配置指南

本文档说明如何配置和启用角色卡搜索功能。

## 功能概述

搜索功能允许已审核的用户通过Discord登录后，搜索已发布的角色卡。支持：
- 关键词搜索（卡名、角色名、作者）
- 分区筛选（非边限/边限/深渊）
- 标签筛选（正选/反选）

## 前置条件

1. ✅ 已部署 Cloudflare Workers
2. ✅ 已部署 Discord Bot
3. ✅ 已配置 D1 数据库
4. ✅ 已配置 R2 存储

## 配置步骤

### 1. 创建 Discord OAuth 应用

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用或选择现有应用
3. 进入 **OAuth2** 页面
4. 记录以下信息：
   - **Client ID**
   - **Client Secret**（点击"Reset Secret"生成，必须保密）
5. 在 **Redirects** 中添加回调URL：
   ```
   https://your-cards-site.pages.dev/api/auth/discord/callback
   ```
   **重要：** 将 `your-cards-site.pages.dev` 替换为你的实际域名
   
   **如何找到你的域名？**
   - 如果已部署：在 Cloudflare Dashboard → Workers & Pages → 你的项目 → 查看域名
   - 如果未部署：先部署，Cloudflare 会自动生成一个 `.pages.dev` 域名
   - 示例：`https://duidui-cards-abc123.pages.dev/api/auth/discord/callback`

### 2. 配置 Cloudflare Workers 环境变量

在 Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Variables 中添加：

```bash
# Discord OAuth 配置
DISCORD_CLIENT_ID=你的Client ID
DISCORD_CLIENT_SECRET=你的Client Secret
DISCORD_REDIRECT_URI=https://your-cards-site.pages.dev/api/auth/discord/callback

# JWT密钥（用于生成和验证登录Token）
# ⚠️ 重要：这个密钥应该固定一个，不要每次随机生成
# 生成方法（任选一种）：
#   方法1：openssl rand -hex 32
#   方法2：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   方法3：在线生成器（https://randomkeygen.com/）
# 示例：JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
# 注意：一旦设置，不要轻易更改，否则所有已登录用户都会失效
JWT_SECRET=你的JWT密钥（至少32位随机字符串）

# 确保以下变量已配置
DISCORD_BOT_URL=https://your-bot.onrender.com
WEBHOOK_SECRET=你的Webhook密钥
CARD_WEBSITE_URL=https://your-cards-site.pages.dev
```

### 3. 配置 Discord Bot 环境变量

在 Bot 部署平台（如 Render）的环境变量中添加：

```bash
# 确保以下变量已配置
DISCORD_TOKEN=你的Bot Token
WEBHOOK_SECRET=你的Webhook密钥（与Workers相同）

# Discord服务器ID（可选，代码中有默认值）
DISCORD_GUILD_ID=1338365085072101416
```

### 4. 部署代码

#### Cloudflare Workers

```bash
cd duidui-cards
npx wrangler deploy
```

#### Discord Bot

如果使用 Render，代码会自动部署。如果手动部署：

```bash
cd duidui
# 确保 app.py 已更新（包含 /api/verify-user 端点）
# 重启Bot服务
```

### 5. 测试

1. 访问搜索页面：`https://your-cards-site.pages.dev/search.html`
2. 点击 "Discord 登录"
3. 授权应用
4. 如果用户有"已审核"身份组，将自动登录并显示搜索界面
5. 测试搜索功能

## 使用说明

### 用户流程

1. **登录**
   - 访问搜索页面
   - 点击 "Discord 登录"
   - 在Discord授权页面点击"授权"
   - 系统验证用户是否在服务器且有"已审核"身份组
   - 验证通过后自动登录

2. **搜索**
   - 在搜索框输入关键词（卡名、角色名或作者）
   - 选择分区（可选）
   - 选择标签进行筛选：
     - 第一次点击：正选（必须包含此标签）
     - 第二次点击：反选（排除此标签）
     - 第三次点击：取消选择
   - 点击"搜索"按钮

3. **查看结果**
   - 搜索结果以卡片形式展示
   - 点击卡片可查看详情（需要实现详情页）
   - 使用分页浏览更多结果

### 标签筛选说明

- **正选（绿色）**：搜索结果必须包含此标签
- **反选（红色）**：搜索结果必须不包含此标签
- 可以同时使用多个正选和反选标签

## 故障排查

### 问题：登录后提示"您不在服务器中或没有'已审核'身份组"

**可能原因：**
1. 用户不在Discord服务器中
2. 用户没有"已审核"身份组
3. Bot无法访问服务器成员信息

**解决方法：**
1. 确认用户在服务器中
2. 确认用户有"已审核"身份组
3. 检查Bot是否有"查看成员"权限
4. 检查 `DISCORD_GUILD_ID` 环境变量是否正确

### 问题：OAuth回调失败

**可能原因：**
1. `DISCORD_REDIRECT_URI` 配置错误
2. Discord应用中的回调URL未添加
3. `DISCORD_CLIENT_ID` 或 `DISCORD_CLIENT_SECRET` 错误

**解决方法：**
1. 检查 `DISCORD_REDIRECT_URI` 是否与Discord开发者门户中的配置一致
2. 确保回调URL已添加到Discord应用的OAuth2设置中
3. 重新检查Client ID和Secret

### 问题：搜索无结果

**可能原因：**
1. 数据库中没有已发布的卡片（threadId不为空）
2. 搜索条件太严格
3. 标签筛选逻辑问题

**解决方法：**
1. 检查数据库中是否有 `threadId IS NOT NULL` 的卡片
2. 尝试放宽搜索条件
3. 检查标签配置是否正确

### 问题：JWT Token无效

**可能原因：**
1. `JWT_SECRET` 未配置或配置错误
2. Token已过期（默认7天）

**解决方法：**
1. 检查 `JWT_SECRET` 环境变量
2. 重新登录获取新Token

## API端点说明

### 认证相关

- `GET /api/auth/discord` - 开始OAuth登录流程
- `GET /api/auth/discord/callback` - OAuth回调处理
- `GET /api/auth/discord/me` - 获取当前用户信息
- `POST /api/auth/discord/logout` - 登出

### 搜索相关

- `GET /api/search` - 搜索卡片（需要登录）
  - 参数：
    - `q` / `keyword` - 搜索关键词
    - `category` - 分区筛选
    - `tags` - 正选标签（逗号分隔）
    - `excludeTags` - 反选标签（逗号分隔）
    - `page` - 页码
    - `pageSize` - 每页数量

### Bot API

- `POST /api/verify-user` - 验证用户身份组（Workers调用）
  - 需要 `Authorization: Bearer <WEBHOOK_SECRET>`
  - 请求体：`{ "userId": "123456789" }`

## 安全注意事项

1. **JWT_SECRET** 必须使用强随机字符串，不要使用默认值
2. **DISCORD_CLIENT_SECRET** 必须保密，只能存在于服务器端
3. **WEBHOOK_SECRET** 用于验证Workers和Bot之间的通信
4. 所有API端点都有适当的认证和授权检查

## 更新日志

### v1.0 (2025-01-30)
- ✨ 初始版本
- ✅ Discord OAuth登录
- ✅ 用户身份组验证
- ✅ 关键词搜索
- ✅ 分区筛选
- ✅ 标签正选/反选



