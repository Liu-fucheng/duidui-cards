# 如何查看 Cloudflare Pages/Workers 日志

> **重要**：如果你的项目是 **Cloudflare Pages**（使用 `functions/` 目录），请使用 **方法 1（Dashboard）** 查看日志。`wrangler tail` 只适用于 Workers，不适用于 Pages。

## 方法 1：通过 Cloudflare Dashboard（推荐，适用于 Pages 和 Workers）

### 步骤：

1. **登录 Cloudflare Dashboard**
   - 访问：https://dash.cloudflare.com/
   - 使用你的 Cloudflare 账号登录

2. **进入 Workers & Pages**
   - 在左侧菜单找到 **Workers & Pages**
   - 点击进入

3. **选择你的项目**
   - 找到 `duidui-cards` 项目（或你的项目名称）
   - 点击项目名称进入详情页

4. **查看日志**
   - **对于 Pages**：在项目详情页，点击顶部的 **Logs** 标签
   - **对于 Workers**：在项目详情页，点击左侧菜单的 **Logs**
   - 如果看不到 Logs 标签，可能需要：
     - 确保项目已部署
     - 检查是否有权限查看日志
     - 尝试刷新页面

5. **实时查看日志**
   - 日志会实时显示所有 Workers 函数的输出
   - 包括 `console.log()`、`console.error()` 等
   - 可以筛选、搜索日志

### 日志示例：

当你访问 `/api/auth/discord/me` 时，应该能看到类似这样的日志：

```
🔍 [me] Cookie头: auth_token=eyJhbGc...
🔍 [me] 提取的Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
🔍 [me] 清理后的Token长度: 319
🔍 [me] 验证时使用的JWT_SECRET长度: 64
🔍 [me] 验证时使用的JWT_SECRET前10个字符: c13cf60faa
🔍 [me] 验证时使用的JWT_SECRET是否使用默认值: false
❌ [verifyToken] 签名验证失败
❌ [me] Token验证失败
```

## 方法 2：使用 Wrangler CLI（仅适用于 Workers，不适用于 Pages）

⚠️ **注意**：`wrangler tail` 只适用于 **Workers**，不适用于 **Pages**。

如果你的项目是 **Cloudflare Pages**（使用 `functions/` 目录），请使用 **方法 1（Dashboard）** 查看日志。

如果你确实在使用 Workers（而不是 Pages），可以使用：

```bash
# 实时查看日志
npx wrangler tail

# 查看最近的日志
npx wrangler tail --format pretty

# 只查看特定环境的日志
npx wrangler tail --env production
```

**如何区分 Workers 和 Pages？**
- **Pages**：使用 `functions/` 目录存放 API 函数，通过 `npx wrangler pages deploy` 部署
- **Workers**：使用 `src/index.js` 等文件，通过 `npx wrangler deploy` 部署

## 方法 3：通过 API 查看（高级）

Cloudflare 也提供了 API 来查看日志，但通常 Dashboard 更方便。

## 常见问题

### Q: 看不到日志？
- **检查项目是否正确部署**：确保代码已部署到 Cloudflare
- **检查日志级别**：确保代码中有 `console.log()` 输出
- **等待几秒**：日志可能有延迟
- **刷新页面**：尝试刷新 Dashboard

### Q: 日志太多，如何筛选？
- 在 Dashboard 的日志页面，可以使用搜索框
- 搜索关键词，例如：`[me]` 或 `JWT_SECRET`

### Q: 如何查看特定时间的日志？
- Dashboard 日志页面通常有时间筛选器
- 可以选择查看最近 1 小时、24 小时等的日志

## 调试技巧

1. **添加唯一标识**：在日志中添加时间戳或请求ID
2. **使用 emoji**：已经添加了 🔍 ✅ ❌ 等标识，方便快速定位
3. **查看完整上下文**：点击日志条目可以查看详细信息
4. **对比生成和验证**：同时查看 `callback.js` 和 `me.js` 的日志，对比 JWT_SECRET

## 示例：查看 JWT_SECRET 相关日志

在日志搜索框中输入：
```
JWT_SECRET
```

这会显示所有与 JWT_SECRET 相关的日志，包括：
- 生成 Token 时使用的密钥
- 验证 Token 时使用的密钥
- 是否使用默认值

如果看到 `usingDefaultSecret: true`，说明环境变量未正确设置。

