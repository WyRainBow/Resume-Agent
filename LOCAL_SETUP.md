# Resume-Agent 本地启动说明

本文档记录当前仓库在 Windows PowerShell 下的本地启动方式，以及“基础可运行”和“完整功能可用”分别还需要哪些配置。

## 1. 当前已验证可用的启动方式

### 后端

推荐直接使用虚拟环境里的 Python，避免 `Activate.ps1` 被系统错误关联到记事本：

```powershell
cd F:\PycharmProjects\Resume-Agent
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

如果你希望先激活虚拟环境，请使用 PowerShell 的调用语法：

```powershell
cd F:\PycharmProjects\Resume-Agent
& .\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

后端健康检查：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9000/api/health
```

### 前端

新开一个终端：

```powershell
cd F:\PycharmProjects\Resume-Agent\frontend
npm run dev
```

默认访问地址：

- 前端: `http://localhost:5173`
- 后端: `http://127.0.0.1:9000`
- OpenAPI: `http://127.0.0.1:9000/docs`

## 2. 当前这台机器已经验证过的内容

- 后端进程可以正常启动。
- `GET /api/health` 返回 `{"status":"ok"}`。
- 前端 `npm run build` 已通过。
- 前端缺失依赖 `@floating-ui/dom` 已补齐。

## 3. 最低配置要求

### 必需软件

- Python `3.12+`
- Node.js `16+`
- npm

### 基础运行所需环境变量

根目录还没有现成 `.env`，可参考 [`.env.example`](/F:/PycharmProjects/Resume-Agent/.env.example) 创建。

如果你只是想先把页面和基础 API 跑起来：

- 数据库配置可以先不写
  说明: 后端默认回退到 `SQLite`，数据库文件在 `backend/resume.db`
- `DASHSCOPE_API_KEY` 建议配置
  说明: 默认 LLM 走 DeepSeek/DashScope，很多 AI 能力依赖它
- `JWT_SECRET_KEY` 建议配置
  说明: 不配也能跑，但登录鉴权不适合长期使用默认值

## 4. 想“完整运行”这个项目，还需要什么

这里的“完整运行”指不仅前后端能启动，还包括 PDF 导出、AI 解析、语义检索、上传能力和 `/api/agent` 能力。

### 4.1 AI 能力

- `DASHSCOPE_API_KEY`
  作用: 默认 DeepSeek 文本生成、简历生成、改写
- `ZHIPU_API_KEY`
  作用: 智谱视觉/OCR 相关能力，PDF 解析增强会用到
- `DOUBAO_API_KEY`
  作用: 备用模型提供方，可选

说明: 当前 `config.toml` 已经写好了模型配置，实际只需要把对应 Key 放进 `.env`。

### 4.2 PDF 导出

- 需要安装 `XeLaTeX`
- 需要可用的中文字体

当前这台机器还没有安装 `xelatex`，所以虽然服务能起来，但 PDF 导出相关接口还不能算完整可用。

### 4.3 数据库

基础运行:

- 可直接使用默认 `SQLite`

如果你要启用更完整的持久化或向量检索：

- MySQL: 配置 `DATABASE_URL`
- PostgreSQL: 配置 `USE_POSTGRESQL=true` 和 `POSTGRESQL_URL`
- 语义检索/向量检索: 推荐 `PostgreSQL + pgvector`

### 4.4 语义检索 / Embedding

- `OPENAI_API_KEY`
- 可选 `OPENAI_BASE_URL`
- `PostgreSQL + pgvector`

说明: 仅启动页面和普通简历功能不需要它；要启用 `/api/search/semantic` 相关能力才需要。

### 4.5 COS 文件上传与图片资源

如果你要使用头像上传、Logo 上传、COS 同步：

- `COS_SECRET_ID`
- `COS_SECRET_KEY`
- `COS_REGION`
- `COS_BUCKET`

不配置这些变量时，相关上传接口无法完整工作。

### 4.6 分享链接

- `FRONTEND_URL`

说明: 分享链接默认会使用生产地址；如果你在本地联调分享功能，建议改成：

```env
FRONTEND_URL=http://localhost:5173
```

### 4.7 Agent 功能

当前主后端已经能启动，但 `/api/agent` 还不算完整可用。

要跑通这部分，通常还需要：

- 完整安装 `requirements.txt` 里的剩余依赖
- 至少补齐当前缺失的 Python 包
  说明: 目前导入日志里已经出现过缺少 `baidusearch`
- 安装 Playwright 浏览器运行时
  说明: 一般需要执行 `playwright install chromium`
- 如果要启用 Docker 沙箱能力，还需要本机 Docker Desktop 正常运行

说明: Agent 相关代码里确实直接依赖 `docker`，不是纯前端开关。

## 5. 推荐的本地配置组合

### 只想开发主站前后端

- Python 3.12
- Node.js
- `.venv`
- `npm install`
- `.env` 中至少配置 `DASHSCOPE_API_KEY`

### 想把 PDF 导出也跑通

在上面的基础上再加：

- `XeLaTeX`
- 中文字体

### 想把 Agent / 搜索 / 上传也跑通

在上面的基础上再加：

- 完整 `requirements.txt`
- `playwright install chromium`
- Docker Desktop
- `OPENAI_API_KEY`
- COS 相关变量
- PostgreSQL + pgvector

## 6. 常见问题

### `.\.venv\Scripts\Activate.ps1` 会打开记事本

请改用：

```powershell
& .\.venv\Scripts\Activate.ps1
```

或者直接绕过激活：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

### `npm install` 或 `git fetch` 因代理失败

如果你的 PowerShell 会话里带了错误的代理环境变量，可以临时清掉再执行：

```powershell
Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue
Remove-Item Env:ALL_PROXY -ErrorAction SilentlyContinue
```

### 子模块初始化失败

当前仓库里的 `tools/CLI-Anything` 子模块指向了一个远端拿不到的提交。它不影响当前已验证的主前后端启动，但如果后面你确实要用到这个子模块，需要单独修正子模块指针。
