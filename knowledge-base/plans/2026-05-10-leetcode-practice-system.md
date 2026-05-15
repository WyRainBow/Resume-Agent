# LeetCode Practice System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Resume-Agent 仓库中新增一个接近 LeetCode 体验的本地刷题子系统，支持 Go 做题、题目管理、自定义测试运行和正式提交判题。

**Architecture:** 前端新增 `/leetcode` 页面模块，拆分为题库页、做题页、题目管理表单和基础状态 hook；后端新增 LeetCode 路由、题目存储服务和 Go 判题执行服务；题目、草稿、提交记录存储在仓库根目录 `LeetCode/` 下。第一版仅支持函数型 Go 题目。

**Tech Stack:** React 18 + TypeScript + React Router + Tailwind CSS + FastAPI + Pydantic + Python file storage + local `go run`

---

### Task 1: 建立 LeetCode 数据目录和首题样例

**Files:**
- Create: `LeetCode/problems/reverse-nodes-in-k-group-full-tail.json`
- Create: `LeetCode/runtime/.gitkeep`
- Create: `LeetCode/submissions/.gitkeep`
- Modify: `LeetCode/leetcode-weekly-report.html`（不修改内容，只保留）

- [ ] **Step 1: 写题目结构失败测试**

在 `backend/tests/test_leetcode_store.py` 新增测试，断言题目目录中至少能读取到 `reverse-nodes-in-k-group-full-tail`，且包含 `slug`、`starterCode`、`visibleTestCases`。

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: 因为 store 服务和样例题尚不存在而失败

- [ ] **Step 3: 创建目录和首题 JSON**

写入首题“尾组也反转”的完整题目定义，包含公开用例和隐藏用例。

- [ ] **Step 4: 运行测试，确认基础数据可被发现**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: 至少该样例题读取测试通过

---

### Task 2: 后端题目存储服务

**Files:**
- Create: `backend/services/leetcode_store.py`
- Create: `backend/tests/test_leetcode_store.py`

- [ ] **Step 1: 写失败测试**

覆盖以下行为：
- 列出全部题目
- 读取指定题目
- 新增题目写入 JSON
- 更新题目覆盖 JSON
- 读取不存在题目时报错

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: `ModuleNotFoundError` 或未实现失败

- [ ] **Step 3: 写最小实现**

实现 `LeetCodeStore`：
- `list_problems()`
- `get_problem(slug)`
- `save_problem(problem)`
- `problem_exists(slug)`

只处理 JSON 文件，不引入数据库。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: 全部 PASS

---

### Task 3: 后端草稿与提交记录持久化

**Files:**
- Modify: `backend/services/leetcode_store.py`
- Modify: `backend/tests/test_leetcode_store.py`

- [ ] **Step 1: 写失败测试**

覆盖：
- 保存草稿
- 读取草稿
- 保存提交记录
- 按题目查询提交记录

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: 新增测试失败

- [ ] **Step 3: 写最小实现**

新增：
- `get_draft(slug)`
- `save_draft(slug, code)`
- `save_submission(record)`
- `list_submissions(slug=None)`

- [ ] **Step 4: 运行测试，确认通过**

Run: `pytest backend/tests/test_leetcode_store.py -q`
Expected: 全部 PASS

---

### Task 4: 后端 Go 运行器基础能力

**Files:**
- Create: `backend/services/leetcode_runner.py`
- Create: `backend/tests/test_leetcode_runner.py`

- [ ] **Step 1: 写失败测试**

先覆盖最小行为：
- 能把用户 Go 代码和单个测试用例拼接运行
- 返回 stdout、stderr、exitCode、durationMs
- 超时会返回 timeout 状态

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_runner.py -q`
Expected: 模块不存在或行为失败

- [ ] **Step 3: 写最小实现**

实现：
- 临时目录创建
- `main.go` 组装
- `go run` 调用
- 超时控制
- 临时文件清理

- [ ] **Step 4: 运行测试，确认通过**

Run: `pytest backend/tests/test_leetcode_runner.py -q`
Expected: 全部 PASS

---

### Task 5: 后端判题逻辑

**Files:**
- Modify: `backend/services/leetcode_runner.py`
- Modify: `backend/tests/test_leetcode_runner.py`

- [ ] **Step 1: 写失败测试**

覆盖：
- 运行公开/自定义测试
- 正式提交时包含隐藏用例
- 正确返回 `accepted`、`wrong_answer`、`runtime_error`、`timeout`

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_runner.py -q`
Expected: 新增测试失败

- [ ] **Step 3: 写最小实现**

实现：
- `run_cases(problem, code, cases)`
- `submit_problem(problem, code)`
- 比对 expected 与 actual
- 汇总通过数/总数/最终状态

- [ ] **Step 4: 运行测试，确认通过**

Run: `pytest backend/tests/test_leetcode_runner.py -q`
Expected: 全部 PASS

---

### Task 6: 后端 LeetCode API

**Files:**
- Create: `backend/routes/leetcode.py`
- Modify: `backend/routes/__init__.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_leetcode_store.py`
- Modify: `backend/tests/test_leetcode_runner.py`

- [ ] **Step 1: 写失败 API 测试**

至少覆盖：
- `GET /api/leetcode/problems`
- `GET /api/leetcode/problems/{slug}`
- `POST /api/leetcode/problems`
- `PUT /api/leetcode/problems/{slug}`
- `GET/PUT /api/leetcode/drafts/{slug}`
- `POST /api/leetcode/run`
- `POST /api/leetcode/submit`

- [ ] **Step 2: 运行测试，确认失败**

Run: `pytest backend/tests/test_leetcode_store.py backend/tests/test_leetcode_runner.py -q`
Expected: 路由不存在或响应不符合预期

- [ ] **Step 3: 写最小实现**

用 FastAPI 增加上述接口，依赖 `LeetCodeStore` 和 `LeetCodeRunner`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `pytest backend/tests/test_leetcode_store.py backend/tests/test_leetcode_runner.py -q`
Expected: 全部 PASS

---

### Task 7: 前端类型和 API 服务

**Files:**
- Create: `frontend/src/pages/LeetCode/types.ts`
- Create: `frontend/src/pages/LeetCode/api.ts`

- [ ] **Step 1: 写失败前端类型/服务测试或至少先写调用样例**

若当前仓库没有前端测试基础设施，则先通过 TypeScript 可编译性驱动，编写最小使用代码并以 `npm run build` 作为失败验证。

- [ ] **Step 2: 运行构建，确认失败**

Run: `cd frontend && npm run build`
Expected: 新模块缺失或类型不满足

- [ ] **Step 3: 写最小实现**

定义：
- `LeetCodeProblem`
- `LeetCodeDraft`
- `LeetCodeSubmission`
- `RunRequest`
- `RunResponse`

以及 API 封装函数。

- [ ] **Step 4: 运行构建，确认通过**

Run: `cd frontend && npm run build`
Expected: 相关模块通过类型检查

---

### Task 8: 前端题库页

**Files:**
- Create: `frontend/src/pages/LeetCode/index.tsx`
- Create: `frontend/src/pages/LeetCode/components/ProblemListPage.tsx`
- Create: `frontend/src/pages/LeetCode/hooks/useProblemList.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 先做失败验证**

新增 `/leetcode` 路由引用但页面未实现，确认构建失败。

- [ ] **Step 2: 运行构建，确认失败**

Run: `cd frontend && npm run build`
Expected: 找不到模块或组件

- [ ] **Step 3: 写最小实现**

实现：
- 题目列表加载
- 搜索和基础筛选
- 自定义题标记
- 跳转到详情页

- [ ] **Step 4: 运行构建，确认通过**

Run: `cd frontend && npm run build`
Expected: PASS

---

### Task 9: 前端做题页骨架

**Files:**
- Create: `frontend/src/pages/LeetCode/components/ProblemWorkspacePage.tsx`
- Create: `frontend/src/pages/LeetCode/components/ProblemDescriptionPanel.tsx`
- Create: `frontend/src/pages/LeetCode/components/CodeEditorPanel.tsx`
- Create: `frontend/src/pages/LeetCode/components/TestcasePanel.tsx`

- [ ] **Step 1: 先做失败验证**

让 `/leetcode/problems/:slug` 路由指向新页面但组件未完整实现，确认构建失败。

- [ ] **Step 2: 运行构建，确认失败**

Run: `cd frontend && npm run build`
Expected: 组件缺失

- [ ] **Step 3: 写最小实现**

实现：
- 左题面右代码的布局
- 深色代码编辑区域
- 底部测试面板
- 运行/提交/重置按钮

- [ ] **Step 4: 运行构建，确认通过**

Run: `cd frontend && npm run build`
Expected: PASS

---

### Task 10: 前端草稿保存和运行/提交联调

**Files:**
- Modify: `frontend/src/pages/LeetCode/components/ProblemWorkspacePage.tsx`
- Create: `frontend/src/pages/LeetCode/hooks/useProblemWorkspace.ts`

- [ ] **Step 1: 先做失败验证**

引入草稿读取、保存、运行和提交调用但不实现，确认构建失败或交互缺失。

- [ ] **Step 2: 运行构建，确认失败**

Run: `cd frontend && npm run build`
Expected: 类型错误或调用缺失

- [ ] **Step 3: 写最小实现**

实现：
- 首次加载草稿
- 输入后节流保存
- 运行自定义测试
- 提交正式判题
- 展示每个 case 结果和汇总状态

- [ ] **Step 4: 运行构建，确认通过**

Run: `cd frontend && npm run build`
Expected: PASS

---

### Task 11: 前端题目管理界面

**Files:**
- Create: `frontend/src/pages/LeetCode/components/ProblemEditorPage.tsx`
- Create: `frontend/src/pages/LeetCode/components/ProblemEditorForm.tsx`
- Modify: `frontend/src/pages/LeetCode/index.tsx`

- [ ] **Step 1: 先做失败验证**

给题库页加“新建题目”入口，先引用未实现组件，确认构建失败。

- [ ] **Step 2: 运行构建，确认失败**

Run: `cd frontend && npm run build`
Expected: 模块缺失

- [ ] **Step 3: 写最小实现**

实现题目新增/编辑表单，至少支持：
- 标题/slug/难度/标签
- 描述/示例/约束/提示
- starter code
- visible/hidden test cases

- [ ] **Step 4: 运行构建，确认通过**

Run: `cd frontend && npm run build`
Expected: PASS

---

### Task 12: 视觉对齐与验收

**Files:**
- Modify: `frontend/src/pages/LeetCode/components/*.tsx`
- Optionally Create: `frontend/src/pages/LeetCode/styles.css`

- [ ] **Step 1: 做题界面视觉对齐**

调优：
- 主布局比例
- 深色编辑器区域
- 顶部按钮排布
- 测试面板层次

- [ ] **Step 2: 构建验证**

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 3: 后端测试验证**

Run: `pytest backend/tests/test_leetcode_store.py backend/tests/test_leetcode_runner.py -q`
Expected: PASS

- [ ] **Step 4: 手工联调**

Run backend: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000`

Run frontend:
`cd frontend && npm run dev`

手工检查：
- `/leetcode` 可进入题库
- 样例题可打开
- Go 代码可运行
- 提交可返回结果
- 页面可新增新题

