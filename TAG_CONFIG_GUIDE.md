# Tags 配置指南

## 如何修改 Tags

Tags 配置在 `functions/api/config.js` 文件中。

### 文件位置
```
functions/api/config.js
```

### 配置结构

Tags 按**大类**分组，每个大类包含多个小标签：

```javascript
tagCategories: [
  {
    category: '大类名称',
    tags: [
      { value: '英文标识', label: '中文显示名' },
      { value: '英文标识2', label: '中文显示名2' }
    ]
  },
  // 更多大类...
]
```

### 当前配置示例

```javascript
tagCategories: [
  {
    category: '场景',
    tags: [
      { value: 'campus', label: '校园' },
      { value: 'city', label: '都市' },
      { value: 'workplace', label: '职场' },
      { value: 'fantasy', label: '幻想世界' }
    ]
  },
  {
    category: '关系',
    tags: [
      { value: 'older', label: '年上' },
      { value: 'younger', label: '年下' },
      { value: 'childhood', label: '青梅竹马' },
      { value: 'enemy', label: '敌对关系' }
    ]
  },
  {
    category: '风格',
    tags: [
      { value: 'sweet', label: '甜文' },
      { value: 'angst', label: '虐文' },
      { value: 'comedy', label: '轻松' },
      { value: 'mystery', label: '悬疑' },
      { value: 'thriller', label: '惊悚' }
    ]
  }
]
```

## 如何添加新的大类

在 `tagCategories` 数组中添加新对象：

```javascript
{
  category: '新大类名',
  tags: [
    { value: 'tag1', label: '标签1' },
    { value: 'tag2', label: '标签2' }
  ]
}
```

## 如何添加新的标签

在对应大类的 `tags` 数组中添加：

```javascript
{ value: 'newtag', label: '新标签' }
```

**注意：**
- `value` 是英文标识，用于数据库存储，添加后不要轻易修改
- `label` 是显示名称，可以随时修改中文文案

## 完整示例

```javascript
export async function onRequestGet(context) {
  try {
    const config = {
      orientations: [...],
      backgrounds: [...],
      tagCategories: [
        {
          category: '场景',
          tags: [
            { value: 'campus', label: '校园' },
            { value: 'city', label: '都市' }
          ]
        },
        {
          category: '关系',
          tags: [
            { value: 'older', label: '年上' },
            { value: 'younger', label: '年下' }
          ]
        },
        {
          category: '风格',
          tags: [
            { value: 'sweet', label: '甜文' },
            { value: 'angst', label: '虐文' }
          ]
        }
      ],
      limits: [...]
    };

    return new Response(JSON.stringify({ success: true, config }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      },
    });
  } catch (error) {
    // ...
  }
}
```

## 修改后生效

1. 修改 `functions/api/config.js` 文件
2. 重新部署（如果使用 Cloudflare Pages，提交代码即可）
3. 清除浏览器缓存或等待1小时（配置有1小时缓存）
4. 刷新页面即可看到新的 tags

## 搜索功能

用户可以在 Tags 右侧的搜索框中输入关键词，系统会：
- 实时过滤匹配的标签
- 隐藏不匹配的大类
- 支持中文搜索

## 前端显示效果

```
Tags (可多选):                [搜索 tag...]

场景
  [校园] [都市] [职场] [幻想世界]

关系
  [年上] [年下] [青梅竹马] [敌对关系]

风格
  [甜文] [虐文] [轻松] [悬疑] [惊悚]
```

选中的标签会变深色，有内阴影效果。


