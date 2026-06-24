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
