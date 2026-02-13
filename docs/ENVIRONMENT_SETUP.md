# Resume-Agent 双环境切换指南

本项目仅维护两个前端连接环境：
- `local`：本地后端（默认 `http://localhost:9000`）
- `remote-dev`：远程开发后端（默认 `http://106.53.113.137:9000`）

## 1. 配置文件

前端模板文件：`frontend/.env.example`

```env
VITE_ENV_DEFAULT=local
VITE_API_BASE_URL_LOCAL=http://localhost:9000
VITE_API_BASE_URL_REMOTE_DEV=http://106.53.113.137:9000
```

使用时可复制为 `frontend/.env.local` 并按需覆盖。

后端模板文件：`.env.example`

敏感信息（数据库密码、API Key、COS 密钥）只写在本地 `.env.local/.env.remote`，不要提交到 Git。

## 2. 前端如何切换环境

1. 启动前端：`cd frontend && npm run dev`
2. 登录后进入工作区页面
3. 在页面右上角找到环境切换器
4. 选择：`本地环境` 或 `远程开发`
5. 切换后新请求会立即使用新的后端地址（无需重启前端）

可点击“测试连接”调用 `/api/health` 验证连通性。

## 3. 行为说明

- 当前环境会持久化在 `localStorage['resume_agent_env']`
- 刷新页面后会保持上次选择
- 若远程不可达，页面会提示连接失败，不会崩溃

## 4. 常见问题

1. 切换到远程后登录失败
- 检查远程后端是否可访问
- 检查远程库中是否存在对应账号

2. 请求跨域报错
- 确认远程后端 CORS 配置允许当前前端域名

3. 仍在访问旧地址
- 打开浏览器 DevTools Network，确认请求 URL
- 重新选择一次环境，或清除 `resume_agent_env` 后刷新

## 5. 安全约束

- 前端环境变量中仅允许放公开地址（API URL）
- 任何密钥（AI Key、DB 密码、COS Secret）不得放入 `frontend/.env*`
