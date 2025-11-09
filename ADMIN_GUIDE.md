# 管理员指南 - 角色卡系统

## 📌 系统架构

这是一个分离式架构的角色卡投递系统：

```
用户 → index.html (网页) → Cloudflare Workers (upload.js) → Discord API (发帖) → D1数据库
                                                              ↓
                                                           Discord频道
```

### 核心组件

1. **前端网页** (`index.html`)
   - 用户填写角色卡信息
   - 提交到 `/api/upload` 端点

2. **上传API** (`functions/api/upload.js`)
   - ✅ **已实现发帖功能**
   - 上传文件到 R2
   - 调用 Discord Webhook 发帖
   - 保存数据到 D1 数据库
   - 保存到 Cloudflare KV（用于按钮交互）

3. **Discord Bot** (`duidui/app.py`)
   - 处理审核流程
   - 响应按钮交互（点赞、下载、查看简介）
   - **不发卡** - 发卡由 Cloudflare Workers 直接完成

## 🎯 发卡流程

### 正常流程（已实现）

1. 用户通过 Discord bot 命令 `/发送发卡按钮` 生成 Token
2. Bot 生成唯一链接发给用户（包含 Token）
3. 用户打开链接 → `index.html?token=xxx`
4. 用户填写表单并上传
5. **Cloudflare Workers** 处理上传：
   ```javascript
   // upload.js 中的流程
   上传文件到 R2
   ↓
   调用 postToDiscord() 
   ↓
   使用 Discord Webhook 创建帖子
   ↓
   发送附加按钮（简介、下载）
   ↓
   保存到 D1 数据库
   ↓
   保存到 KV（供按钮查询）
   ↓
   发送日志到 Discord
   ```

### 如果发帖失败

检查以下配置：

1. **环境变量是否正确设置**
   ```bash
   DISCORD_BOT_TOKEN          # Discord Bot Token
   DISCORD_CHANNEL_FEIBIANXIAN # 非边限频道ID
   DISCORD_CHANNEL_BIANXIAN    # 边限频道ID
   DISCORD_CHANNEL_SHENYUAN    # 深渊频道ID
   R2_PUBLIC_URL              # R2公开访问URL
   ```

2. **R2 Bucket 绑定**
   - 变量名：`R2_BUCKET`
   - 用于存储上传的文件

3. **D1 数据库绑定**
   - 变量名：`D1_DB`
   - 用于存储角色卡元数据

4. **KV Namespace 绑定**（可选）
   - 变量名：`CLOUDFLARE_KV_NAMESPACE`
   - 用于存储角色卡数据供Discord bot查询

## 🔍 查看日志和调试

### 1. Cloudflare Workers 日志

**方式1：实时日志（推荐）**
```bash
# 在 duidui-cards 目录下运行
npx wrangler tail

# 或查看特定时间的日志
npx wrangler tail --format pretty
```

**方式2：Cloudflare Dashboard**
1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages
3. 选择你的项目
4. 点击 "Logs" 或 "Tail"

### 2. 数据库管理后台

访问：`https://你的域名/db-admin.html`

功能：
- ✅ 检查数据库表结构
- ✅ 初始化/更新数据库
- ✅ 查看缺失的列和迁移状态

### 3. 角色卡管理后台（新）

访问：`https://你的域名/cards-admin.html`

功能：
- 📊 查看统计数据（总数、今日新增、分区统计）
- 📋 角色卡列表（分页、筛选、搜索）
- 🔍 查看详情（完整的角色卡信息）
- 📝 发卡日志（谁在什么时候发了什么卡）
- ⚙️ 系统状态（数据库、R2、KV状态）

**使用方法：**
1. 打开 `cards-admin.html`
2. 输入管理员Token（在Cloudflare环境变量中设置的 `ADMIN_TOKEN` 或 `DB_ADMIN_TOKEN`）
3. 点击"进入管理"

## 🐛 常见问题排查

### 问题1：上传成功但没有发帖

**检查步骤：**

1. **查看 Cloudflare Workers 日志**
   ```bash
   npx wrangler tail
   ```
   然后尝试上传一张卡，查看日志输出

2. **检查 Discord Bot Token**
   ```bash
   # 在 Cloudflare Dashboard 中检查
   Environment Variables → DISCORD_BOT_TOKEN
   ```

3. **检查频道ID是否正确**
   - 右键点击Discord频道 → 复制ID
   - 确保环境变量中的ID与实际频道ID一致

4. **检查 Bot 权限**
   - Bot 需要在目标频道有以下权限：
     - 查看频道
     - 发送消息
     - 管理 Webhooks
     - 创建公开帖子（如果是论坛频道）

### 问题2：数据库错误

**解决方法：**
1. 访问 `db-admin.html`
2. 点击"检查状态"查看缺失的表和列
3. 点击"初始化数据库"创建缺失的结构

### 问题3：Token验证失败

**检查：**
1. Token是否过期（默认24小时有效）
2. Token是否已被使用
3. 环境变量 `CARD_WEBSITE_URL` 是否正确

### 问题4：文件上传失败

**检查：**
1. R2 Bucket 是否正确绑定
2. 文件大小是否超过限制（Workers限制100MB）
3. R2_PUBLIC_URL 是否配置正确

## 📊 查看发卡日志

### 方法1：管理后台

1. 访问 `cards-admin.html`
2. 切换到"发卡日志"选项卡
3. 选择时间范围查看

### 方法2：Discord 日志频道

所有发卡操作会自动发送到日志频道（ID: `1429834614431547553`）

日志格式：
```
xx（账号：xxx）于X月X日在<#频道ID>投递角色卡xxx，标题：xxx - Discord链接
```

### 方法3：数据库查询

如果配置了 D1 数据库，可以直接查询：

```sql
-- 查看最近50条发卡记录
SELECT 
  cardName, 
  authorName, 
  category, 
  uploadedAt,
  threadId
FROM cards_v2 
WHERE threadId IS NOT NULL
ORDER BY uploadedAt DESC 
LIMIT 50;

-- 按分区统计
SELECT 
  category, 
  COUNT(*) as count 
FROM cards_v2 
GROUP BY category;

-- 查看今日发卡
SELECT 
  cardName, 
  authorName, 
  uploadedAt 
FROM cards_v2 
WHERE DATE(uploadedAt) = DATE('now')
ORDER BY uploadedAt DESC;
```

## 🔧 测试发帖功能

### 手动测试

1. **生成测试Token**
   ```javascript
   // 在浏览器控制台运行
   fetch('/api/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       token: 'test-token-' + Date.now(),
       user_id: 'test-user',
       guild_id: '1338365085072101416',
       username: 'test',
       display_name: 'Test User',
       category: '非边限'
     })
   });
   ```

2. **访问测试链接**
   ```
   https://你的域名/?token=test-token-xxx
   ```

3. **上传测试卡片**
   - 填写简单信息
   - 上传一张图片
   - 提交

4. **查看结果**
   - 检查 Discord 频道是否有新帖子
   - 查看 Cloudflare Workers 日志
   - 访问 `cards-admin.html` 查看数据库记录

### 使用 curl 测试

```bash
# 测试发帖API（需要实际的token和文件）
curl -X POST https://你的域名/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "token=your-token" \
  -F "cardName=测试卡片" \
  -F "category=非边限" \
  -F "authorName=测试作者" \
  -F "cardFile=@test-card.png"
```

## 📈 监控和维护

### 每日检查

1. 访问 `cards-admin.html` → 概览
2. 查看今日新增是否正常
3. 检查系统状态

### 每周检查

1. 查看发卡日志，确认所有卡片都成功发布到Discord
2. 检查数据库状态
3. 清理过期的Token（可选）

### 定期备份

```bash
# 导出D1数据库（Cloudflare CLI）
npx wrangler d1 export <database-name> --output=backup.sql

# 备份R2文件（使用rclone或AWS CLI）
rclone sync cloudflare:your-bucket ./backup/r2/
```

## 🔐 安全建议

1. **妥善保管 Token**
   - `ADMIN_TOKEN` - 管理后台访问
   - `DISCORD_BOT_TOKEN` - Discord Bot
   - 不要提交到公开仓库

2. **限制管理后台访问**
   - 可以在 Cloudflare Workers 中添加 IP 白名单
   - 使用强密码作为 ADMIN_TOKEN

3. **定期轮换 Token**
   - 每月更换一次管理员Token
   - Discord Bot Token 泄露时立即重置

## 📞 获取帮助

如果遇到问题：

1. **查看日志**
   - Cloudflare Workers 日志
   - Discord Bot 日志（app.py输出）

2. **查看管理后台**
   - 系统状态
   - 最近错误

3. **检查配置**
   - 环境变量
   - 数据库绑定
   - R2 Bucket 绑定

4. **联系开发者**
   - 提供详细的错误信息
   - 提供时间戳和用户ID
   - 截图相关日志





















