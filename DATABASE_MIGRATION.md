# 数据库迁移说明

## 🚀 自动化迁移（推荐）

我们提供了自动化的数据库管理工具，**无需手动执行SQL**！

### 使用方法：

1. **访问数据库管理页面**
   ```
   https://your-domain.pages.dev/db-admin.html
   ```

2. **输入管理员Token**
   - 使用你在环境变量中设置的 `ADMIN_TOKEN`
   - 点击"保存"保存到本地

3. **检查数据库状态**
   - 点击"检查状态"按钮
   - 查看哪些表存在，哪些列缺失
   - 查看需要运行的迁移

4. **初始化/更新数据库**
   - 点击"初始化数据库"按钮
   - 系统会自动：
     - 创建缺失的表
     - 添加缺失的列
     - 运行必要的迁移

### 自动处理的内容：

✅ 创建 `cards_v2` 表（包含所有必要的列）  
✅ 创建 `app_config` 表（存储admin配置）  
✅ 创建 `card_tokens` 表（存储发卡Token）  
✅ 自动添加 `authorId` 列  
✅ 自动添加 `threadId` 列  
✅ 自动添加 `firstMessageId` 列  
✅ 自动添加 `avatarImageKey` 列  
✅ 根据代码自动更新表结构  

### 优势：

- 🎯 **零配置**：无需手动编写SQL
- 🔄 **自动同步**：代码更新后自动检测并添加新字段
- 🛡️ **安全**：需要管理员Token才能操作
- 📊 **可视化**：清晰显示数据库状态和迁移历史

---

## 🔧 手动迁移（不推荐）

如果你更喜欢手动操作，可以使用以下SQL：

### 1. 创建完整的 cards_v2 表

```sql
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
  attachmentKeys TEXT,
  threadId TEXT,
  firstMessageId TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);
```

### 2. 添加缺失的列（如果表已存在）

```sql
-- 添加 authorId
ALTER TABLE cards_v2 ADD COLUMN authorId TEXT;

-- 添加 threadId
ALTER TABLE cards_v2 ADD COLUMN threadId TEXT;

-- 添加 firstMessageId
ALTER TABLE cards_v2 ADD COLUMN firstMessageId TEXT;

-- 添加 avatarImageKey
ALTER TABLE cards_v2 ADD COLUMN avatarImageKey TEXT;
```

### 3. 创建其他必要的表

```sql
-- 应用配置表
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- 发卡Token表
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
);
```

### 在 Cloudflare D1 中执行

**方法1：通过 Dashboard**
1. 进入 Cloudflare Dashboard
2. 找到你的 D1 数据库
3. 在 Console 中粘贴并执行 SQL

**方法2：使用 Wrangler CLI**
```bash
wrangler d1 execute YOUR_DATABASE_NAME --file=schema.sql
```

---

## 🎨 自定义板块支持

系统支持在admin后台自定义板块，所有自定义数据都会自动保存到 `app_config` 表中，**无需修改数据库结构**！

### 自定义板块的工作原理：

1. 在 `admin.html` 中创建自定义板块
2. 数据以JSON格式存储在 `app_config` 表的 `value` 字段
3. 前端读取配置并动态渲染表单
4. 提交时数据保存在 `cards_v2` 表的对应字段中（如 `otherInfo`）

### 示例配置：

```json
{
  "customSections": [
    {
      "title": "题材",
      "multiple": true,
      "items": [
        { "label": "原创", "value": "原创" },
        { "label": "同人", "value": "同人" }
      ]
    }
  ]
}
```

---

## ❓ 常见问题

### Q: 上传时提示 "table cards_v2 has no column named authorId"

**A:** 访问 `db-admin.html`，点击"初始化数据库"即可自动修复。

### Q: 新增了自定义板块，需要更改数据库吗？

**A:** 不需要！自定义板块数据以JSON格式存储，无需修改表结构。

### Q: 如何备份数据库？

**A:** 使用 Wrangler CLI：
```bash
wrangler d1 export YOUR_DATABASE_NAME --output=backup.sql
```

### Q: 如何恢复数据库？

**A:** 
```bash
wrangler d1 execute YOUR_DATABASE_NAME --file=backup.sql
```

---

## 📋 更新日志

### 2025-10-30
- ✨ 新增自动化数据库管理工具（`db-admin.html`）
- ✨ 新增自动迁移脚本（`/api/init-db`）
- ✨ 支持自动检测和添加缺失的列
- ✨ 支持自定义板块配置
- 🔧 添加 `authorId`、`threadId`、`firstMessageId`、`avatarImageKey` 字段

### 之前的版本
- 初始数据库结构
- 基础的 `cards_v2` 表
