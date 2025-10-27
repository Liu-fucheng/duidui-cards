# 数据库迁移说明

## 添加 authorId 字段

如果你的 `cards_v2` 表中还没有 `authorId` 字段，需要执行以下 SQL：

```sql
ALTER TABLE cards_v2 ADD COLUMN authorId TEXT;
```

## 完整的表结构（参考）

```sql
CREATE TABLE IF NOT EXISTS cards_v2 (
  id TEXT PRIMARY KEY,
  cardName TEXT NOT NULL,
  cardType TEXT NOT NULL,
  characters TEXT,
  category TEXT,
  authorName TEXT,
  authorId TEXT,
  isAnonymous INTEGER DEFAULT 0,
  orientation TEXT,
  background TEXT,
  tags TEXT,
  userLimit TEXT,
  warnings TEXT,
  description TEXT,
  secondaryWarning TEXT,
  galleryImageKeys TEXT,
  cardFileKey TEXT NOT NULL,
  attachmentKeys TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 如何在 Cloudflare D1 中执行迁移

1. 进入 Cloudflare Dashboard
2. 找到你的 D1 数据库
3. 在 Console 中执行上述 SQL 语句

或者使用 Wrangler CLI：

```bash
wrangler d1 execute YOUR_DATABASE_NAME --command "ALTER TABLE cards_v2 ADD COLUMN authorId TEXT;"
```








