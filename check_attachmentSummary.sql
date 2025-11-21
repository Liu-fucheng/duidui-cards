-- 检查 attachmentSummary 字段是否存在于 cards_v2 表中

-- 方法1: 查看表结构
PRAGMA table_info(cards_v2);

-- 方法2: 检查特定字段是否存在
SELECT name, type 
FROM pragma_table_info('cards_v2') 
WHERE name = 'attachmentSummary';

-- 方法3: 查看所有字段名（更易读）
SELECT name as column_name, type, notnull, dflt_value, pk
FROM pragma_table_info('cards_v2')
ORDER BY cid;

-- 方法4: 如果字段存在，查看一些示例数据
SELECT id, cardName, attachmentSummary 
FROM cards_v2 
WHERE attachmentSummary IS NOT NULL 
  AND attachmentSummary != '' 
LIMIT 10;

-- 方法5: 统计有多少条记录有 attachmentSummary
SELECT 
  COUNT(*) as total_records,
  COUNT(attachmentSummary) as records_with_attachmentSummary,
  COUNT(CASE WHEN attachmentSummary IS NOT NULL AND attachmentSummary != '' THEN 1 END) as records_with_non_empty_attachmentSummary
FROM cards_v2;








