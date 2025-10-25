# Tags 配置与后台管理

现在 Tags 支持通过后台在线管理，配置持久化在 Cloudflare D1 中。

如果你仍然想直接改代码，也可以编辑 `functions/api/config.js` 里的默认配置（仅作兜底），但线上实际使用的是数据库中的配置。

### 文件位置
```
functions/api/config.js
```

## 配置结构

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

### 默认配置示例（仅兜底）

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

## 后台管理使用方法

1. 打开 `admin.html`（部署后访问 `/admin.html`）。
2. 输入管理员 Token 并进入管理。
3. 在“Tag 分类”里新增/删除分类和标签，点击“保存更改”。
4. 前台页面会从 `/api/config` 读取最新配置并展示。

管理员 Token 仅保存在浏览器本地（localStorage），通过 `Authorization: Bearer <Token>` 请求头发送，不会上传到服务器存储。

## Cloudflare 配置步骤

1. 绑定 D1 实例（名称示例 `D1_DB`）
   - 在 Pages/Workers 项目里绑定 D1 数据库到环境变量 `D1_DB`。
   - 首次访问会自动创建表 `app_config` 并写入默认配置。
2. 配置环境变量 `ADMIN_TOKEN`
   - 在 Pages/Workers 的环境变量里添加 `ADMIN_TOKEN`，并填入一串高强度随机串。
   - 后台保存时需要携带 `Authorization: Bearer <ADMIN_TOKEN>`。
3. 部署
   - 提交代码或点击重新部署。
4. 验证
   - 访问 `/admin.html`，输入 `ADMIN_TOKEN`，新增或修改一个标签，保存成功后刷新前台页面验证。

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



