# Discord Bot 使用指南

## URL 传参说明

你的 Discord bot 可以通过 URL 参数向页面传递用户信息和分区设置。

### 支持的参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `category` | 分区名称 | `category=原神` |
| `authorName` | 作者名称（显示名） | `authorName=小明` |
| `authorId` | 作者ID（Discord用户ID） | `authorId=123456789` |
| `lockCategory` | 锁定分区（设为1时不可修改） | `lockCategory=1` |
| `lockAuthor` | 锁定作者名（设为1时不可修改） | `lockAuthor=1` |

### Discord Bot 示例代码

#### 使用 discord.py

```python
import discord
from discord import app_commands
from urllib.parse import urlencode

@bot.tree.command(name="上传卡片", description="获取上传链接")
@app_commands.describe(分区="选择分区")
@app_commands.choices(分区=[
    app_commands.Choice(name="原神", value="原神"),
    app_commands.Choice(name="崩坏：星穹铁道", value="崩铁"),
    app_commands.Choice(name="其他", value="其他"),
])
async def upload_card(interaction: discord.Interaction, 分区: app_commands.Choice[str]):
    # 构建URL参数
    params = {
        'category': 分区.value,
        'authorName': interaction.user.display_name,
        'authorId': str(interaction.user.id),
        'lockCategory': '1',
        'lockAuthor': '1'
    }
    
    url = f"https://your-domain.com/?{urlencode(params)}"
    
    await interaction.response.send_message(
        f"请点击以下链接上传你的角色卡：\n{url}",
        ephemeral=True  # 仅发送者可见
    )
```

#### 使用 discord.js

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('上传卡片')
    .setDescription('获取上传链接')
    .addStringOption(option =>
      option.setName('分区')
        .setDescription('选择分区')
        .setRequired(true)
        .addChoices(
          { name: '原神', value: '原神' },
          { name: '崩坏：星穹铁道', value: '崩铁' },
          { name: '其他', value: '其他' }
        )),
  
  async execute(interaction) {
    const category = interaction.options.getString('分区');
    const authorName = interaction.user.displayName;
    const authorId = interaction.user.id;
    
    const params = new URLSearchParams({
      category: category,
      authorName: authorName,
      authorId: authorId,
      lockCategory: '1',
      lockAuthor: '1'
    });
    
    const url = `https://your-domain.com/?${params.toString()}`;
    
    await interaction.reply({
      content: `请点击以下链接上传你的角色卡：\n${url}`,
      ephemeral: true
    });
  },
};
```

### 生成的链接示例

```
https://your-domain.com/?category=%E5%8E%9F%E7%A5%9E&authorName=%E5%B0%8F%E6%98%8E&authorId=123456789&lockCategory=1&lockAuthor=1
```

用户点击链接后：
- 分区字段会自动填充为"原神"并锁定（灰色背景，无法修改）
- 作者名会自动填充为"小明"并锁定
- 后端会记录 Discord 用户ID `123456789`

### 字段锁定效果

- `lockCategory=1`：分区字段变为只读，背景变灰
- `lockAuthor=1`：作者名字段变为只读，背景变灰

### 注意事项

1. **URL 编码**：所有中文和特殊字符需要进行 URL 编码
2. **参数可选**：所有参数都是可选的，可以只传递部分参数
3. **安全性**：authorId 会保存到数据库，可用于权限验证和作者追踪
4. **灵活组合**：可以只锁定分区而不锁定作者名，反之亦然

### 高级用法

只预填不锁定：

```python
params = {
    'category': '原神',
    'authorName': interaction.user.display_name,
    'authorId': str(interaction.user.id)
    # 不设置 lockCategory 和 lockAuthor
}
```

用户可以看到预填的值，但仍然可以修改。



