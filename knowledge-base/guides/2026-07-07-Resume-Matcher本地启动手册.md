# Resume-Matcher 本地启动手册

> 竞品调研项目 Resume-Matcher 的本地启动操作手册。照着做即可跑起来。
> 排查/复盘见同目录 [`reference/projects/Resume-Matcher/docs/本地启动与LLM配置复盘.md`](../../reference/projects/Resume-Matcher/docs/本地启动与LLM配置复盘.md)。

---

## 一、它是什么

- **来源**：github.com/srbhr/Resume-Matcher（已 clone 到 `reference/projects/Resume-Matcher/`，作为竞品调研参考）
- **定位**：AI 简历匹配工具——上传简历 + JD，AI 生成定制化简历 + 匹配度分析
- **架构**：monorepo，`apps/backend`（FastAPI + LiteLLM）+ `apps/frontend`（Next.js 16）
- **端口**：前端 **3000**、后端 **8000**（与主项目 ResumeAgent 的 5173/9000 不冲突）

---

## 二、前置依赖（一次性）

| 工具 | 版本要求 | 检查命令 | 说明 |
|---|---|---|---|
| **uv** | 任意 | `uv --version` | Python 包管理，会自动下载 Python 3.13 |
| **Node.js** | 22+ | `node --version` | 前端 |
| **npm** | 10+ | `npm --version` | 随 Node |

> 本机系统 Python 不需要 3.13（哪怕是 3.9 也行）——`uv sync` 会自动下载项目需要的 Python 版本到隔离环境。

如缺 uv：
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

---

## 三、启动步骤

### 步骤 1：配置后端 LLM（复用主项目 DashScope key）

```bash
# 从 ResumeAgent 主项目读 DashScope key
DASHSCOPE_KEY=$(grep "^DASHSCOPE_API_KEY=" /Users/mac/开源工具/ResumeAgent/.env | cut -d= -f2)

# 写入 RM 后端 .env
cat > /Users/mac/开源工具/ResumeAgent/reference/projects/Resume-Matcher/apps/backend/.env <<EOF
LLM_PROVIDER=openai_compatible
LLM_MODEL=qwen-plus-latest
LLM_API_KEY=$DASHSCOPE_KEY
LLM_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1

HOST=0.0.0.0
PORT=8000
RELOAD=false
LOG_LEVEL=INFO
LOG_LLM=WARNING
FRONTEND_BASE_URL=http://localhost:3000
REQUEST_TIMEOUT_SECONDS=240
CORS_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000"]
EOF
```

> ⚠️ **关键**：provider 必须是 `openai_compatible`（不是 `deepseek`）。RM 用 LiteLLM，`deepseek` provider 会走 DeepSeek 官方鉴权，对不上 DashScope。详见复盘文档第三节。

### 步骤 2：安装依赖（首次或拉取新代码后）

```bash
cd /Users/mac/开源工具/ResumeAgent/reference/projects/Resume-Matcher

# 后端（uv 自动下载 Python 3.13 并建虚拟环境）
cd apps/backend && uv sync && cd ..

# 前端
cd apps/frontend && npm install && cd ..
```

### 步骤 3：启动

**两个终端分别启动**：

```bash
# 终端 1：后端 → http://127.0.0.1:8000
cd /Users/mac/开源工具/ResumeAgent/reference/projects/Resume-Matcher/apps/backend
uv run app

# 终端 2：前端 → http://localhost:3000
cd /Users/mac/开源工具/ResumeAgent/reference/projects/Resume-Matcher/apps/frontend
npm run dev
```

### 步骤 4：验证

浏览器打开 **http://localhost:3000**

启动成功的标志：
- 后端日志：`Uvicorn running on http://0.0.0.0:8000`
- 前端日志：`Next.js ✓ Ready`
- 首页 → LAUNCH APP → SETTINGS → 系统状态显示 **LLM：健康**、**数据库：已连接**

---

## 四、首次进入需在 UI 确认 LLM 配置

`.env` 只是默认值，**实际配置存数据库**（TinyDB），首次启动后建议在 UI 确认一次：

1. 进入 http://localhost:3000 → LAUNCH APP → **SETTINGS**
2. **LLM 配置**区块确认：
   - Provider：`OPENAI-COMPATIBLE`
   - Model：`qwen-plus-latest`
   - Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
   - API Key：填 DashScope key（留空则保留已存）
3. 点 **保存**，再点 **测试连接**——应显示「连接成功」
4. **界面语言**区块点 **中文**（如需中文界面）

> 如果之前用过、数据库里存了错误配置（比如 provider=DeepSeek 导致 LLM 离线），在 UI 改对并保存即可覆盖。详见复盘文档第三节。

---

## 五、常用命令速查

| 操作 | 命令 |
|---|---|
| 启动后端 | `cd apps/backend && uv run app` |
| 启动前端 | `cd apps/frontend && npm run dev` |
| 重装后端依赖 | `cd apps/backend && uv sync` |
| 重装前端依赖 | `cd apps/frontend && npm install` |
| 查看后端日志 | `tail -f /tmp/rm-backend.log`（若后台启动） |
| 停止 | `lsof -ti:3000 -ti:8000 \| xargs kill -9` |

---

## 六、后台启动（可选，不占终端）

如果想用一个命令把两端都拉起：

```bash
cd /Users/mac/开源工具/ResumeAgent/reference/projects/Resume-Matcher
(cd apps/backend && uv run app > /tmp/rm-backend.log 2>&1 &) &&
(cd apps/frontend && npm run dev > /tmp/rm-frontend.log 2>&1 &) &&
sleep 6 &&
curl -s -o /dev/null -w "backend: %{http_code}\n" http://127.0.0.1:8000/ &&
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://127.0.0.1:3000/
```

停止后台服务：
```bash
lsof -ti:3000 -ti:8000 | xargs kill -9 2>/dev/null
```

---

## 七、注意事项

1. **端口冲突**：3000 和 8000 被占用会启动失败。先 `lsof -i:3000 -i:8000` 查，或直接 `kill` 掉。
2. **不要改 RM 仓库的代码提交**：`reference/projects/Resume-Matcher/` 是别人项目的 clone，调研用途。本地改动（如 .env、数据库）已被 `.gitignore` 忽略，不会污染主项目。
3. **数据库位置**：后端用 TinyDB（JSON 文件），存在 `apps/backend/data/` 下。重置数据库在 Settings → Danger Zone → Reset Database。
4. **Playwright**：PDF 导出需要 Playwright Chromium。首次导出 PDF 时后端会自动下载（约 200MB）。如失败，手动跑 `cd apps/backend && uv run playwright install chromium`。
5. **Python 版本**：项目要求 3.13+，但 `uv sync` 会自动下载，无需本机预装。

---

## 八、与主项目 ResumeAgent 的关系

| | Resume-Matcher | ResumeAgent（主项目） |
|---|---|---|
| 路径 | `reference/projects/Resume-Matcher/` | 项目根 |
| 用途 | 竞品调研、模板设计参考 | 我们的产品 |
| 前端端口 | 3000 | 5173 |
| 后端端口 | 8000 | 9000 |
| LLM | 复用主项目 DashScope key | 同一 key |
| 启动 | 本手册 | `AGENTS.md` / `CLAUDE.md` |

两者可同时运行（端口不冲突）。
