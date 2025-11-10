# 🚀 快速开始指南

## 📋 首次部署清单

### 1. 部署到 Cloudflare Pages

```bash
# 使用 Wrangler 部署
wrangler pages deploy duidui-cards --project-name=your-project-name
```

### 2. 配置环境变量

在 Cloudflare Dashboard 中设置以下环境变量：

#### 必需变量：
- `D1_DB` - D1 数据库绑定
- `R2_BUCKET` - R2 存储桶绑定
- `ADMIN_TOKEN` - 管理员Token（用于访问admin后台）
- `DISCORD_BOT_TOKEN` - Discord机器人Token
- `DISCORD_CHANNEL_FEIBIANXIAN` - 非边限频道ID
- `DISCORD_CHANNEL_BIANXIAN` - 边限频道ID
- `DISCORD_CHANNEL_SHENYUAN` - 深渊频道ID

#### 可选变量：
- `CLOUDFLARE_KV_NAMESPACE` - KV命名空间绑定（用于Discord交互）
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare账户ID
- `CLOUDFLARE_NAMESPACE_ID` - KV命名空间ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API Token

### 3. 初始化数据库 ⚠️ **重要！**

访问：`https://your-domain.pages.dev/db-admin.html`

1. 输入 `ADMIN_TOKEN`
2. 点击"保存Token"
3. 点击"初始化数据库"

等待完成后，你会看到：
- ✅ 创建的表：cards_v2, app_config, card_tokens
- ✅ 数据库状态正常

### 4. 配置表单选项（可选）

访问：`https://your-domain.pages.dev/admin.html`

1. 输入 `ADMIN_TOKEN`
2. 点击"进入管理"
3. 自定义标签分类、性向选项、背景等
4. 添加自定义板块（如：题材、类型等）
5. 点击"保存更改"

### 5. 配置 Discord 机器人

在 `duidui/app.py` 中配置：

```python
# 更新频道ID
CARD_CHANNEL_IDS = [
    1432350162365190184,  # 非边限
    1432350179314372692,  # 边限
    1432350193696641135   # 深渊
]

# 设置网站URL
CARD_WEBSITE_URL = os.environ.get('CARD_WEBSITE_URL', 'https://your-domain.pages.dev')
```

启动机器人：
```bash
python duidui/app.py
```

使用命令 `/发送发卡按钮` 在指定频道发送投递按钮。

---

## 🎨 自定义板块功能

### 什么是自定义板块？

自定义板块允许你添加任意的表单选项，无需修改代码或数据库！

### 使用示例：

1. **添加"题材"板块**
   - 在 admin.html 点击"+ 新增板块"
   - 板块名称：题材
   - 添加选项：原创、同人、AU

2. **添加"内容标签"板块**
   - 板块名称：内容标签
   - 添加选项：日常向、剧情向、短篇、长篇

3. **条件显示**
   - 设置 `showIf`: `性向:BL` - 只在选择BL时显示
   - 设置 `enableIf`: `!性向:无CP` - 除了无CP都启用

### 自定义板块数据如何保存？

- 配置保存在：`app_config` 表（JSON格式）
- 用户数据保存在：`cards_v2.otherInfo` 字段（自动合并）
- **无需修改数据库结构！**

---

## 🔧 常见问题

### Q: 上传失败，提示"table cards_v2 has no column named XXX"

**A:** 访问 `/db-admin.html`，点击"初始化数据库"即可自动修复。

### Q: 如何查看当前数据库状态？

**A:** 访问 `/db-admin.html`，点击"检查状态"。

### Q: 新增自定义板块后，需要更新数据库吗？

**A:** 不需要！自定义板块的数据以JSON格式存储在配置表中，表单数据会自动保存到 `otherInfo` 字段。

### Q: 如何备份数据？

**A:** 使用 Wrangler CLI：
```bash
# 备份数据库
wrangler d1 export YOUR_DATABASE_NAME --output=backup.sql

# 备份R2（使用rclone或其他工具）
```

### Q: Discord机器人没反应？

**A:** 检查：
1. `DISCORD_BOT_TOKEN` 是否正确
2. 机器人是否有频道权限
3. `CARD_CHANNEL_IDS` 是否匹配实际频道ID
4. 机器人是否在运行 (`python duidui/app.py`)

### Q: 如何更新代码？

1. 拉取最新代码
2. 重新部署：`wrangler pages deploy duidui-cards`
3. 访问 `/db-admin.html` 检查数据库状态
4. 如有需要，点击"初始化数据库"运行迁移

---

## 📁 文件结构说明

```
duidui-cards/
├── index.html              # 主投递表单
├── admin.html              # 配置管理后台
├── db-admin.html           # 数据库管理后台（新增）
├── functions/
│   └── api/
│       ├── upload.js       # 处理表单上传
│       ├── config.js       # 读写admin配置
│       ├── token.js        # Token验证
│       ├── cards.js        # 查询角色卡列表
│       └── init-db.js      # 数据库初始化（新增）
└── 默认头像.png
```

---

## 🎯 推荐工作流

### 首次部署：
1. 部署代码 → 2. 配置环境变量 → 3. 初始化数据库 → 4. 配置表单 → 5. 配置Discord机器人

### 日常使用：
- 用户点击Discord按钮 → 获取临时链接 → 填写表单 → 自动发帖到对应分区

### 更新配置：
- 访问 `admin.html` → 修改标签/板块 → 保存 → 立即生效（无需重启）

### 数据库维护：
- 访问 `db-admin.html` → 检查状态 → 如有警告，点击初始化

---

## 📞 技术支持

遇到问题？检查以下顺序：

1. **数据库问题** → `/db-admin.html` 检查并修复
2. **表单配置** → `/admin.html` 检查配置是否保存
3. **Discord问题** → 检查机器人日志和权限
4. **上传问题** → 检查 R2 绑定和文件大小限制

---

## 🎉 功能亮点

✨ **零SQL操作** - 所有数据库操作自动化  
✨ **动态表单** - 通过admin后台自定义任意选项  
✨ **Discord集成** - 自动发帖、交互按钮、Token验证  
✨ **文件存储** - 支持PNG、JSON、图片、附件  
✨ **权限控制** - Token一次性使用、深渊身份组限制  
✨ **美观预览** - 实时预览Discord帖子效果  

---

**祝使用愉快！** 🎊

























