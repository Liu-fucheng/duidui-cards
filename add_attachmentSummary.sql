-- 添加 attachmentSummary 字段到 cards_v2 表

-- 检查字段是否已存在（如果已存在会报错，但不会影响）
-- 如果字段不存在，执行以下 SQL 添加字段

ALTER TABLE cards_v2 ADD COLUMN attachmentSummary TEXT;

-- 验证字段是否添加成功
SELECT name, type 
FROM pragma_table_info('cards_v2') 
WHERE name = 'attachmentSummary';

-- 如果需要，也可以同时添加其他可能缺失的附件相关字段
-- 检查 attachmentOriginalNames 和 attachmentDescriptions 是否存在
SELECT name 
FROM pragma_table_info('cards_v2') 
WHERE name IN ('attachmentOriginalNames', 'attachmentDescriptions', 'attachmentSummary');





