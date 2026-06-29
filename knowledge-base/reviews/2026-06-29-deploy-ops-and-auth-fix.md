# 2026-06-29 部署运维与登录修复操作记录

> 日期：2026-06-29　分支：main

## 1. 自动部署上线（服务器 cron 拉取式）

- **方案**：服务器侧 `auto-deploy.sh` + cron `*/2`，检测 `main` 更新就 `git reset --hard` → 装依赖 → 前端/web build → `pm2 restart all`。日志 `/var/log/auto-deploy.log`。
- **为何不用 GitHub Actions**：服务器 SSH 不对公网开放（runner 动态 IP 连不上 22/2222），改用 cron 拉取式，避免暴露 SSH。曾建的 `.github/workflows/deploy.yml` 已删（`b71fa97`）。
- **脚本带 `set -e` 安全阀**：build 失败即中止、不重启坏版本。

## 2. 登录页 bug 修复（邮箱 → 账号 + Google）

- **现象**：线上登录页显示「邮箱 + 8 位密码」（旧版），而非期望的「账号密码 + Google」。
- **根因**：登录页 `auth.resumegenkk.xyz` 部署在 **Vercel**（`76.76.21.21`），**不在腾讯云服务器**；Vercel 上是 `674c52e`（混合认证改造）之前的旧版本。改服务器 `resume-web` 无效。
- **修复**：`cd web && vercel --prod` 重新部署最新代码（账号版 + Google），已 Alias 到 `auth.resumegenkk.xyz`。
- **教训**：web 登录 shell 是 Vercel 独立部署，与服务器 pm2 的 `resume-web` 无关；更新登录页必须单独 `vercel --prod`，cron 自动部署只覆盖服务器侧。

## 3. 分支清理（只留 main）

- 保留：`main` + `gh-pages`（223 提交，Pages 站）+ `feature/latex-template-gallery-dev`（13 未合并提交）。
- 删除：`dev` / `develop` / `feature/06-18~06-23` 等已并入 main 的分支（零代码丢失）。

## 4. COS 公司 logo 诊断

- **现象**：线上公司 logo 大量缺失（只剩 4 个，含 hash 名文件）。
- **根因**：`prefer_local_assets()` 在非 production 优先本地 `images/logo`，而 `images/` 不入 git，线上缓存不全；COS bucket（`resumecos-1327706280`）的 25 个 logo 实际完好。
- **修复**：线上 `.env` 设 `PREFER_LOCAL_LOGOS=0`，让后端直接走 COS。

## 5. SSH 安全确认

- `sshd -T` 实测：`passwordauthentication no` + `kbdinteractiveauthentication no` → 密码登录已禁，仅密钥（端口 2222）。`permitrootlogin yes` 但仅密钥可登，无爆破风险。

> 服务器连接细节见本地文档 `部署运维手册.local.md`（被 `.gitignore` 忽略，不入库）。
