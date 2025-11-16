# 搜索功能快速开始

## 一键部署步骤

### 1. 部署 Cloudflare Workers

```bash
cd duidui-cards
npx wrangler deploy
```

部署完成后，记下生成的域名（例如：`duidui-cards-abc123.pages.dev`）

### 2. 配置 Discord OAuth

1. 访问 https://discord.com/developers/applications
2. 选择你的应用 → OAuth2
3. 在 Redirects 中添加：`https://你的域名.pages.dev/api/auth/discord/callback`
4. 复制 Client ID 和 Client Secret

### 3. 生成 JWT 密钥

```bash
openssl rand -hex 32
```

### 4. 在 Cloudflare 设置环境变量

Cloudflare Dashboard → Workers & Pages → 你的项目 → Settings → Variables

添加：
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`（使用步骤1的域名）
- `JWT_SECRET`（使用步骤3生成的密钥）

### 5. 重启 Bot（如果使用 Render）

在 Render Dashboard 点击 "Manual Deploy" 或等待自动部署

### 6. 测试

访问：`https://你的域名.pages.dev/search.html`

## 常见问题

### 问题：登录后提示"您不在服务器中或没有'已审核'身份组"

**解决：**
1. 确认用户在 Discord 服务器中
2. 确认用户有"已审核"身份组
3. 检查 Bot 是否有"查看成员"权限

### 问题：OAuth 回调失败

**解决：**
1. 检查 `DISCORD_REDIRECT_URI` 是否与 Discord 开发者门户中的配置完全一致
2. 确保 URL 使用 HTTPS
3. 检查 Client ID 和 Secret 是否正确

