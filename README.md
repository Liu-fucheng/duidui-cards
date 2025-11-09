# 堆堆 Demo - 角色卡投递系统

一个完整的 Discord 角色卡投递和管理系统，支持多分区、标签管理、权限控制和自动化发帖。

## ✨ 功能特性

### 🎴 角色卡投递
- ✅ 网页表单投递（支持Token验证）
- ✅ 多文件上传（PNG/JSON卡片、头像、图片、附件）
- ✅ 实时预览（Discord样式）
- ✅ 自动缓存（防止意外丢失）
- ✅ 分区管理（非边限/边限/深渊）
- ✅ 标签系统（可配置、可搜索）
- ✅ 下载限制（反应后/评论后）

### 🤖 Discord Bot
- ✅ 自动发帖到Discord（论坛帖子/讨论串）
- ✅ 交互按钮（点赞、查看简介、下载）
- ✅ 权限验证（深渊分区需要特定身份组）
- ✅ 日志记录（自动发送到日志频道）
- ✅ Token系统（一次性链接）

### 📊 管理后台
1. **数据库管理** (`db-admin.html`)
   - 检查表结构
   - 自动迁移
   - 初始化数据库

2. **标签管理** (`admin.html`)
   - 可视化编辑标签
   - 拖拽排序
   - 分区专属标签
   - 实时预览

3. **角色卡管理** (`cards-admin.html`) ⭐ 新增
   - 📊 统计数据（总数、今日新增、分区统计）
   - 📋 角色卡列表（分页、筛选、搜索）
   - 🔍 详情查看
   - 📝 发卡日志
   - ⚙️ 系统状态

## 🏗️ 系统架构

```
┌─────────────┐
│  用户填表   │
│ index.html  │
└──────┬──────┘
       │ 提交
       ▼
┌─────────────────┐
│ Cloudflare      │
│ Workers         │◄─── R2存储文件
│ (upload.js)     │◄─── D1存储数据
└────────┬────────┘
         │ HTTP POST
         │ /api/post-card
         ▼
┌─────────────────┐
│ Discord Bot     │
│ (app.py)        │
└────────┬────────┘
         │ 发帖
         ▼
┌─────────────────┐
│ Discord频道     │
│ (论坛/讨论串)   │
└─────────────────┘
```

### 为什么由Bot发帖？

**✅ Bot发帖的优势：**
- 支持持久化View（按钮重启后仍可用）
- 完整的权限控制
- 更好的交互体验
- 统一的日志管理

**❌ Webhook发帖的问题：**
- 按钮重启后失效
- 无法绑定Bot的View
- 权限控制有限

## 🚀 快速开始

### 前置条件

- Cloudflare 账号
- Discord Bot Token
- Bot 部署平台（推荐 Render.com）
- Node.js 18+ (本地开发)

### 部署步骤

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

简要流程：

1. **部署 Discord Bot**
   ```bash
   cd duidui
   # 部署到 Render.com
   ```

2. **部署 Cloudflare Workers**
   ```bash
   cd duidui-cards
   npx wrangler deploy
   ```

3. **配置环境变量**
   - Cloudflare: `DISCORD_BOT_URL`, `WEBHOOK_SECRET`
   - Bot: `DISCORD_TOKEN`, `WEBHOOK_SECRET`

4. **初始化数据库**
   - 访问 `/db-admin.html`
   - 点击"初始化数据库"

5. **测试**
   - 生成发卡链接
   - 填写表单
   - 检查Discord是否收到帖子

## 📁 项目结构

```
duidui-cards/                # Cloudflare Workers 前端
├── index.html              # 投递表单
├── admin.html              # 标签管理
├── db-admin.html           # 数据库管理
├── cards-admin.html        # 角色卡管理 ⭐新增
├── functions/
│   └── api/
│       ├── upload.js       # 上传处理 (通知Bot)
│       ├── cards.js        # 管理API ⭐新增
│       ├── config.js       # 配置API
│       ├── token.js        # Token管理
│       └── init-db.js      # 数据库初始化
├── wrangler.toml           # Cloudflare配置
├── DEPLOYMENT.md           # 部署指南 ⭐新增
└── ADMIN_GUIDE.md          # 管理员指南 ⭐新增

duidui/                     # Discord Bot
├── app.py                  # Bot主程序 (新增发帖功能)
├── requirements.txt        # Python依赖
└── Dockerfile             # Docker配置
```

## 🔧 配置说明

### 环境变量

#### Cloudflare Workers

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DISCORD_BOT_URL` | Bot部署URL | ✅ |
| `WEBHOOK_SECRET` | 验证密钥 | ✅ |
| `R2_PUBLIC_URL` | R2公开访问URL | ✅ |
| `ADMIN_TOKEN` | 管理员Token | ✅ |
| `CARD_WEBSITE_URL` | 网站URL | ✅ |

#### Discord Bot

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `DISCORD_TOKEN` | Bot Token | ✅ |
| `WEBHOOK_SECRET` | 验证密钥（与Workers相同） | ✅ |
| `PORT` | 端口号 | ❌ (默认10000) |

### 频道ID配置

在 `app.py` 中配置：

```python
CARD_CHANNEL_IDS = [
    1432350162365190184,  # 非边限
    1432350179314372692,  # 边限
    1432350193696641135   # 深渊
]

CARD_ARCHIVE_CHANNEL_ID = 1429834614431547553  # 日志频道
```

## 📊 管理后台使用

### 1. 角色卡管理 (cards-admin.html)

**访问：** `https://your-site.pages.dev/cards-admin.html`

功能：
- **概览**：统计数据、分区分布
- **角色卡列表**：查看所有卡片、筛选、搜索
- **详情**：查看完整的卡片信息
- **日志**：查看发卡历史
- **系统状态**：检查服务健康度

### 2. 标签管理 (admin.html)

配置标签分类、专属标签、条件显示、互斥关系等

### 3. 数据库管理 (db-admin.html)

检查和维护数据库结构

## 🐛 故障排查

### 问题：上传成功但没有发帖

**解决步骤：**

1. 查看 Cloudflare Workers 日志
   ```bash
   npx wrangler tail
   ```

2. 查看 Bot 日志（Render Dashboard）

3. 检查环境变量：
   - `DISCORD_BOT_URL` 是否正确
   - `WEBHOOK_SECRET` 是否匹配

4. 测试 Bot 是否运行：
   ```bash
   curl https://your-bot.onrender.com/
   # 应返回：I'm alive!
   ```

5. 测试 Bot 端点：
   ```bash
   curl -X POST https://your-bot.onrender.com/api/post-card \
     -H "Authorization: Bearer your-webhook-secret" \
     -H "Content-Type: application/json" \
     -d '{"cardName":"测试","category":"非边限"}'
   ```

详见 [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)

## 🔐 安全

- ✅ Token一次性使用（24小时有效）
- ✅ 管理员Token验证
- ✅ Webhook密钥验证
- ✅ 分区权限控制
- ✅ 文件类型验证
- ✅ 大小限制

## 📝 待办事项

- [ ] 支持批量上传
- [ ] 导出功能（CSV/JSON）
- [ ] 高级搜索（按标签、日期范围）
- [ ] 统计图表（echarts）
- [ ] 用户系统（多管理员）
- [ ] 审核工作流
- [ ] API文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🆘 支持

遇到问题？

1. 查看 [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
2. 查看 [DEPLOYMENT.md](./DEPLOYMENT.md)
3. 提交 Issue
4. 查看日志（Cloudflare + Bot）

## 🎉 更新日志

### v2.0 (2025-01-30)

- ✨ **重大更新：** 改为由Discord Bot发帖（之前是Webhook）
- ✨ 新增角色卡管理后台 (`cards-admin.html`)
- ✨ 新增管理员API (`/api/cards`)
- ✨ 新增部署指南和管理员指南
- ✨ 支持论坛帖子和讨论串
- ✨ 完善的日志系统
- 🐛 修复按钮重启后失效的问题
- 🐛 修复权限验证问题

### v1.0 (2025-01-20)

- 🎉 初始版本
- ✅ 基础投递功能
- ✅ 标签管理
- ✅ 数据库管理

---

**Made with ❤️ for 堆堆Demo**

















