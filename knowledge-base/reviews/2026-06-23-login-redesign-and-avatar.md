# 登录页重设计 + 用户头像功能

> 日期：2026-06-23 ｜ 分支：feature/06-20/01
> 提交：`4fd984b`（头像）、`cc5702b`（登录页重设计）

## 1. 用户头像（frontend）

### 问题
登录后侧栏头像显示浏览器破图标。根因：`<img>` 直接加载 Google
（`lh3.googleusercontent.com`）头像，缺两样东西：
- `referrerPolicy="no-referrer"`：Google CDN 会校验 Referer，跨域加载被拦截
- `onError` 兜底：图片失败时没有降级，直接露出破图

### 方案
新增可复用组件 `frontend/src/components/Avatar.tsx`：
- 优先 `<img referrerPolicy="no-referrer" onError={...}>`
- 失败回退到首字母（name/email 首字母），再回退到 lucide `User` 图标
- 统一接入三处：`WorkspaceLayout` 侧栏、`Account` 页、`Settings`「账号与权限」卡片

> 注：这是**系统边界**（外部图片可能失效）的合理降级，不是绕过主流逻辑。

## 2. 登录页重设计（web，:3000）

### 问题
未登录态 `account/page.tsx` 的表单卡片横向铺满整个视口（~1900px），
Google 按钮纯黑无 logo，配色是暖米色 + 绿色，与主产品（5173 蓝色
Resume.AI）品牌割裂。

### 方案（用户确认对齐 Resume.AI 蓝）
- `page.tsx`：未登录时走独立 `.auth-screen` 居中布局；已登录态（账户面板）保持原样
- `auth-panel.tsx`：加 RA logo + 字标、官方 Google 四色 G 图标、重排表单
- `globals.css`：新增样式**全部作用域限定在 `.auth-screen` 之下**，避免影响账户面板与首页
- 居中 420px 白卡、蓝色主按钮 / 聚焦环、规范圆角间距、入场动画、加载态、reduced-motion 支持

## 3. 环境前提

- `frontend/.env.local` 需有 `VITE_AUTH_WEB_URL=http://localhost:3000`，否则前端登录入口退化成旧密码弹窗（见 [2026-06-23-google-oauth-env-checklist.md]）
- `web/.env.local` 需有 `AUTH_GOOGLE_ID/SECRET`，否则 Google 按钮无反应

## 4. 踩坑：Turbopack 不更新 CSS（重要）

Next.js 16 + Turbopack 下，改 `web/src/app/globals.css` 后：
- 浏览器硬刷新 **无效**
- `touch` 文件 **无效**
- `pkill next && npm run dev` 重启 **仍无效**（`.next/` 构建缓存存活）

诊断：CDP 查 `document.styleSheets` 发现新规则 0 条；Lightning CSS 单独
解析 globals.css 正常（排除语法错误）→ 确认是 Turbopack CSS 缓存陈旧。
JSX 改动能热更新，但 CSS pipeline 缓存独立、不失效。

**解法：`rm -rf web/.next` 后重启 dev server**，强制全量重建。
改 web 的全局 CSS 没生效时，第一时间清 `.next`。

## 5. 验证

- 登录页：CDP（:9222 已登录 Chrome）截图确认未登录态居中白卡、Google 四色 G、
  禁用态 + 启用态（填入邮箱密码后主按钮变实心蓝）均正确
- 头像：`npm run build` 通过；设置页兜底图标正确渲染；真实 Google 头像需用户
  登录态刷新自验（破图问题由 referrerPolicy 修复）
- CDP 截图脚本留存于本会话 scratchpad（`cdp_shot.py` / `cdp_check.py` / `cdp_fill.py`），
  关键技巧：`websocket.create_connection(..., suppress_origin=True)` 绕过 9222 的 Origin 校验
