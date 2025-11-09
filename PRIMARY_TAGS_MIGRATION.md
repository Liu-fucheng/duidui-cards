# 主要Tag和发卡人信息数据库迁移指南

## 新增字段

需要在 `cards_v2` 表中添加以下字段：

```sql
-- 添加主要tag字段
ALTER TABLE cards_v2 ADD COLUMN primaryOrientation TEXT;
ALTER TABLE cards_v2 ADD COLUMN primaryBackground TEXT;

-- 添加发卡人信息字段
ALTER TABLE cards_v2 ADD COLUMN submitterUserId TEXT;
ALTER TABLE cards_v2 ADD COLUMN submitterUsername TEXT;

-- 添加nameRelation字段（如果还没有）
ALTER TABLE cards_v2 ADD COLUMN nameRelation TEXT DEFAULT 'same';
```

## 功能说明

### 1. 主要Tag选择
- 当用户选择了多个性向或背景tag时，会显示主要tag选择界面
- 主要tag用于在首页展示
- 如果没有选择主要tag，默认使用第一个选中的tag

### 2. 发卡人信息
- 从token中获取发卡人的用户ID和用户名
- 记录在数据库中，用于追踪谁提交了角色卡
- 与作者信息（authorName/authorId）不同，发卡人是实际提交表单的人

### 3. 单人同名角色卡
- 当cardType为'single'且nameRelation为'same'时，角色名显示为卡名
- 在cards-admin.html中正确显示

## 执行迁移

在 Cloudflare D1 数据库中执行：

```bash
wrangler d1 execute YOUR_DATABASE_NAME --command="ALTER TABLE cards_v2 ADD COLUMN primaryOrientation TEXT;"
wrangler d1 execute YOUR_DATABASE_NAME --command="ALTER TABLE cards_v2 ADD COLUMN primaryBackground TEXT;"
wrangler d1 execute YOUR_DATABASE_NAME --command="ALTER TABLE cards_v2 ADD COLUMN submitterUserId TEXT;"
wrangler d1 execute YOUR_DATABASE_NAME --command="ALTER TABLE cards_v2 ADD COLUMN submitterUsername TEXT;"
wrangler d1 execute YOUR_DATABASE_NAME --command="ALTER TABLE cards_v2 ADD COLUMN nameRelation TEXT DEFAULT 'same';"
```

或者通过 Cloudflare Dashboard 的 D1 控制台执行上述 SQL 语句。

