-- 删除旧的下载要求字段
-- 执行此 SQL 前请先备份数据库！

-- 删除 requireReaction 字段
ALTER TABLE cards_v2 DROP COLUMN requireReaction;

-- 删除 requireComment 字段
ALTER TABLE cards_v2 DROP COLUMN requireComment;

-- 注意：如果某些数据库不支持直接删除列，可能需要：
-- 1. 创建新表（不包含这些列）
-- 2. 复制数据
-- 3. 删除旧表
-- 4. 重命名新表

-- Cloudflare D1 支持 ALTER TABLE DROP COLUMN，可以直接执行上面的语句





