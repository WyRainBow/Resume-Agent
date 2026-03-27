# CLI-Anything + open-cli 联动落地说明（DashScope 兼容模式）

## 目标
在当前仓库完成两件事：
1. 用 CLI-Anything 作为执行层（让 Agent 生成/完善可执行 CLI harness）
2. 用 open-cli 作为规范层（为生成出来的 CLI 补充标准化接口描述）

## 当前状态
- 本地已克隆：
  - `/Users/wy770/Resume-Agent/tools/CLI-Anything`
  - `/Users/wy770/Resume-Agent/tools/open-cli`
- CLI-Anything 的 Codex skill 已安装：
  - `/Users/wy770/.codex/skills/cli-anything`

## 结论
- 两者可以搭配使用，不冲突。
- 先用 CLI-Anything，再用 open-cli。
- open-cli 本身不是 LLM 运行器，不读取模型 API 配置。
- 模型配置（DeepSeek + DashScope 兼容）只影响 Agent 执行层。

## 你的模型配置（可用）
你给出的配置属于 OpenAI 兼容协议，方向正确：
- `api_type = "openai"`
- `base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"`
- `api_key = "${DASHSCOPE_API_KEY}"`

建议在你实际运行 Agent 的环境中保证：
- `DASHSCOPE_API_KEY` 已导出
- 该 Agent 支持自定义 OpenAI-compatible base_url

## 实操顺序

### 第一步：重启 Codex
安装 skill 后，先重启 Codex，让 `cli-anything` skill 被重新发现。

### 第二步：在 Codex 会话里触发 CLI-Anything
在 Codex 中直接描述目标，例如：
- “用 CLI-Anything 为 `/path/to/target-app` 生成 harness”
- 或“先为 `https://github.com/owner/repo` 生成 CLI，再补测试”

预期产物结构（简化）：
- `<software>/agent-harness/setup.py`
- `<software>/agent-harness/cli_anything/<software>/...`
- 包括 CLI 命令、测试、README

### 第三步：验证生成 CLI
在 harness 根目录执行：
- `pip install -e .`
- `cli-anything-<software> --help`
- 如支持：`cli-anything-<software> --json <subcommand>`

### 第四步：用 open-cli 做规范层（可选但推荐）
目标是给已生成 CLI 产出标准化描述（schema/文档），用于：
- 对接自动化工具
- 版本变更对比
- 统一命令语义文档

open-cli 仓库构建方式（需要 .NET 9）：
- `cd /Users/wy770/Resume-Agent/tools/open-cli`
- `dotnet tool restore`
- `dotnet make`

## 验收标准
1. CLI-Anything 能在你的目标软件上生成可安装 CLI harness。
2. 生成后的命令可本地调用，至少通过 `--help` 和一个最小子命令。
3. open-cli 产物可用于记录该 CLI 的接口结构（规范层）。

## 常见问题
- 问：两者是不是只能选一个？
  - 不是。CLI-Anything 负责“做出来”，open-cli 负责“定义清楚”。
- 问：都必须 OPENAI_API_KEY 吗？
  - 不是。只要执行层支持 OpenAI-compatible endpoint，就可用 DashScope key。
