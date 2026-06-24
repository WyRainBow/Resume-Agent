# BetterAuth 模式下管理员功能门控修复

- 日期：2026-06-24
- 分支：feature/06-23/01
- 提交：92bdfe2

## 现象

DB 中 `coco-yu`（weiyu9484@gmail.com）`role=admin`，`/api/auth/me` 经代理也正确返回
`role:"admin"`，但前端「后台管理系统」侧边栏入口、「JSON 编辑（仅管理员）」编辑模式、
管理员远程渲染等仅管理员功能全部消失。

## 根因

仅管理员 UI 的两类门控都依赖 `getStoredAuthRole()`（`frontend/src/lib/runtimeEnv.ts`）：

- `canUseAdminFeature()` → `App.tsx` / `WorkspaceLayout` / `AdminDashboard`
- `getStoredAuthRole() === 'admin'` → `ExportButton` / `Header` / `usePDFOperations`

`getStoredAuthRole()` 只从两处取角色：① `localStorage.auth_token` 当作 JWT 解 payload.role；
② `localStorage.auth_user` 的 `role`。而 **BetterAuth 模式下两处都拿不到角色**：

1. `auth_token` 为空（BetterAuth 用 cookie 鉴权，`setToken('better-auth-session')` 只进 React
   state，不写 localStorage），不是 JWT。
2. `mapBetterAuthUser()`（`AuthContext.tsx`）映射出的 user 不含 `role`，且 BetterAuth 分支
   不把 `auth_user` 写进 localStorage。

→ `getStoredAuthRole()` 恒为 `''`；`canUseAdminFeature()` 还先被 `if (!token) return false`
拦死。结果与 DB 角色无关，管理员功能一律隐藏。

> 注：此前 622b001 只修了「设置页角色展示」（直接拉 `/api/auth/me` 进 `liveRole`），
> 没有触达 `getStoredAuthRole()` / `canUseAdminFeature()`，所以功能门控仍坏。

## 修复（3 处外科改动）

- `betterAuthSession.ts`：`fetchLegacyUserId` → `fetchLegacyUserInfo`，经代理 `/api/auth/me`
  回填 `id` 的同时取 `role`。
- `AuthContext.tsx`：把 `role` 写入 user 状态，并持久化到 `localStorage.auth_user`，
  供 `getStoredAuthRole()` 同步读取（首次回填后生效，后续刷新即时命中缓存）。
- `runtimeEnv.ts`：`canUseAdminFeature()` 改为纯角色判定，去掉会误杀 BetterAuth 管理员的
  `token` 守卫（角色本身即鉴权信号，未登录时角色为空仍返回 false）。

## 安全说明

后端 `require_admin_only` / `require_admin_or_member`（`backend/middleware/auth.py`）仍按
**DB 角色**校验（代理注入 trusted headers，后端 resolve 真实记录）。本次仅恢复前端 UI 门控，
篡改 localStorage 无法获得真实管理员接口权限，鉴权强度不变。

## 验证

- 运行时：`getStoredAuthRole()` → `"admin"`，`canUseAdminFeature()` → `true`。
- 视觉：侧边栏「后台管理系统」、顶栏「JSON 编辑（仅管理员）」重新出现。
- `cd frontend && npm run build` 通过（仅既有 chunk 体积告警）。

## 复用要点

后续任何「按角色显示」的前端功能，角色一律走 `getStoredAuthRole()`，不要再依赖
`localStorage.auth_token` 的存在性；BetterAuth 模式的角色来源是 `auth_user.role`。

---

## 同源问题：历史会话列表消失（2026-06-24 续，提交 59c0de7）

### 现象

BetterAuth 登录态下，工作台左侧边栏「历史会话」列表整体消失，连入口都不渲染。

### 根因（同一 bug 类的第 3 次）

三层都把 `localStorage.auth_token` 的存在性当登录态判断，BetterAuth 下 token 恒为空：

1. `WorkspaceLayout` 用 `canUseAgentFeature()` 门控整个 `RecentSessions`，而
   `canUseAgentFeature()` 返回 `Boolean(localStorage.auth_token)` → false → 组件根本不挂载。
2. `RecentSessions.fetchPage()` 开头 `if (!token) { setSessions([]); return }`，
   即便挂载也会先把列表清空。
3. 三处 agent-history fetch（list / delete-all / clear-active）未带 `credentials: 'include'`，
   经 Next 代理时不携带 BetterAuth cookie。

### 修复（2 处外科改动）

- `runtimeEnv.ts`：`canUseAgentFeature()` 只判定 Agent 开关（`return isAgentEnabled()`）。
  登录态交给唯一调用方 `WorkspaceLayout` 的 `isAuthenticated`（React 鉴权状态，是即时且
  模式无关的唯一可信来源）。原本 `isAuthenticated && canUseAgentFeature()` 里的二次
  localStorage 取值既冗余又脆弱——正是这条冗余推导造成了本 bug 类反复出现。
- `RecentSessions.tsx`：删掉 `fetchPage` 里会清空列表的 token 守卫；list / delete-all /
  clear-active 三处 fetch 补 `credentials: 'include'`。

### 验证

- 运行时（BetterAuth coco yu）：侧边栏「历史会话 (3/3)」三条会话即时恢复，无空态闪烁。
- `cd frontend && npm run build` 通过。

### 复用要点补充

「是否登录」的唯一可信来源是 React 的 `useAuth().isAuthenticated`，不是 localStorage。
非 React 的工具函数若被 `isAuthenticated && fn()` 形式调用，`fn()` 内不要再自行从
localStorage 推导登录态——只判定它真正独占的关注点（如功能开关）。
