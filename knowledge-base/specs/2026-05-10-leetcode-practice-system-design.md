# LeetCode 刷题子系统设计文档

**日期：** 2026-05-10
**状态：** 已审批，待实现
**分支：** feature/05-10

---

## 背景

当前仓库已有完整的 React + FastAPI 应用，但没有独立的刷题子系统。用户希望在现有项目中新增一个接近 LeetCode 体验的练题模块，用于：

1. 浏览题库和进入题目详情页
2. 使用 Go 编写和运行题解
3. 运行自定义测试用例
4. 正式提交并用隐藏用例判题
5. 新增和维护自定义题目

用户特别强调需要支持“在 LeetCode 原题基础上做规则变体”的题目定义方式，例如：

- 原题：K 个一组反转链表，尾部不足 `k` 的部分不反转
- 自定义变体：尾部不足 `k` 的部分也反转

第一版仅面向本机单用户使用，不做登录隔离、多租户、排行榜和容器级安全沙箱。

---

## 目标

- 在现有前端新增 `/leetcode` 路由和完整刷题界面
- 整体信息布局、交互结构、操作路径尽量贴近 LeetCode
- 仅支持 Go 语言
- 同时支持“运行自定义测试”和“正式提交判题”
- 支持文件预置题目，也支持在页面新增/编辑题目
- 本地保存代码草稿、提交记录和题目定义

---

## 非目标

第一版不做以下内容：

- 多语言支持
- 用户账号隔离
- 排行榜、题解社区、评论、点赞
- 分布式任务队列
- 容器/虚拟机级代码隔离
- 高并发线上判题基础设施

---

## 方案结论

采用“前端 LeetCode 风格界面 + 后端轻量判题服务”的方案。

### 方案理由

- 比纯前端模拟更符合真实刷题需求
- 比完整在线 OJ 方案更容易在当前仓库内快速交付
- 可以在不破坏现有 Resume-Agent 主功能的前提下，新增一个相对独立的子系统

---

## 总体架构

系统分为四层：

1. **前端页面层**
   - 题库页
   - 做题页
   - 题目管理页/弹窗
2. **前端状态与服务层**
   - 题目列表与详情获取
   - 草稿自动保存
   - 运行/提交请求
3. **后端 API 层**
   - 题目 CRUD
   - 运行自定义测试
   - 正式提交判题
   - 草稿与提交记录读写
4. **本地文件存储层**
   - 题目定义
   - 草稿
   - 提交记录
   - 临时运行目录

---

## 目录规划

在仓库根目录下使用现有 `LeetCode/` 目录承载数据资产。

### 根目录数据结构

```text
LeetCode/
  leetcode-weekly-report.html
  problems/
    reverse-nodes-in-k-group-full-tail.json
  drafts/
    reverse-nodes-in-k-group-full-tail.go
  submissions/
    reverse-nodes-in-k-group-full-tail/
      2026-05-10T15-30-00.000Z.json
  runtime/
    .gitkeep
```

### 前端代码结构

```text
frontend/src/pages/LeetCode/
  index.tsx
  data/
  components/
  hooks/
  types.ts
  utils/
```

### 后端代码结构

```text
backend/routes/leetcode.py
backend/services/leetcode_store.py
backend/services/leetcode_runner.py
backend/tests/test_leetcode_store.py
backend/tests/test_leetcode_runner.py
```

---

## 前端设计

### 路由

新增两类路由：

- `/leetcode`
- `/leetcode/problems/:slug`

### 页面 1：题库页

目标是接近 LeetCode 题库页的使用路径。

包含：

- 顶部导航栏
- 题目搜索框
- 难度筛选
- 标签筛选
- “仅看自定义题”筛选
- 题目表格/列表
- 新增题目按钮

每个题目项显示：

- 标题
- 难度
- 标签
- 是否自定义
- 最近更新时间
- 是否已有本地草稿

### 页面 2：做题页

采用接近 LeetCode 的双栏布局：

- 左侧：题面、示例、约束、提示、相关信息
- 右侧上半：Go 编辑器
- 右侧下半：测试用例/运行结果/提交结果

交互：

- 运行
- 提交
- 重置代码
- 切换公开测试用例
- 新增自定义测试用例

### 页面 3：题目管理界面

第一版优先做一个表单页或抽屉，不追求复杂 CMS。

支持编辑：

- 标题
- slug
- 难度
- 标签
- 题目描述
- 示例
- 约束
- 提示
- Go 函数签名
- 默认模板代码
- 可见测试用例
- 隐藏测试用例
- 判题函数配置

---

## 视觉与交互原则

整体布局和交互路径尽量贴近 LeetCode，但不做像素级复制。

必须保留的体验特征：

- 左题面右代码的主工作区
- 深色代码编辑区
- 底部测试/结果面板
- 明确区分“运行”和“提交”
- 公开测试与隐藏测试的概念分离

第一版可以简化的部分：

- 不做复杂动画
- 不做完整题解/讨论 tab
- 不做排名和提交统计图

---

## 数据模型

### Problem

```json
{
  "id": "problem_reverse_k_tail",
  "slug": "reverse-nodes-in-k-group-full-tail",
  "title": "K 个一组反转链表（尾组也反转）",
  "difficulty": "Hard",
  "tags": ["Linked List", "Recursion"],
  "source": "custom",
  "description": "给你一个链表，每 k 个节点一组进行反转。若最后剩余节点数不足 k，也需要整体反转。",
  "examples": [
    {
      "input": "head = [1,2,3,4,5,6,7,8], k = 3",
      "output": "[3,2,1,6,5,4,8,7]",
      "explanation": "前两组正常反转，最后的 [7,8] 也反转成 [8,7]。"
    }
  ],
  "constraints": [
    "链表节点数 n >= 1",
    "1 <= k <= n"
  ],
  "hints": [
    "可先按组切片，再决定是否反转最后一组。"
  ],
  "functionName": "solve",
  "signature": "func solve(nums []int, k int) []int",
  "starterCode": "package main\n\nfunc solve(nums []int, k int) []int {\n\treturn nums\n}\n",
  "visibleTestCases": [
    {
      "id": "case-1",
      "input": {
        "nums": [1,2,3,4,5,6,7,8],
        "k": 3
      },
      "expected": [3,2,1,6,5,4,8,7]
    }
  ],
  "hiddenTestCases": [
    {
      "id": "hidden-1",
      "input": {
        "nums": [1,2],
        "k": 3
      },
      "expected": [2,1]
    }
  ],
  "judge": {
    "type": "function",
    "entry": "solve"
  },
  "createdAt": "2026-05-10T00:00:00.000Z",
  "updatedAt": "2026-05-10T00:00:00.000Z"
}
```

### Draft

```json
{
  "slug": "reverse-nodes-in-k-group-full-tail",
  "language": "go",
  "code": "package main\n\nfunc solve(nums []int, k int) []int {\n\treturn nums\n}\n",
  "updatedAt": "2026-05-10T00:00:00.000Z"
}
```

### Submission

```json
{
  "id": "sub_2026_05_10_001",
  "slug": "reverse-nodes-in-k-group-full-tail",
  "language": "go",
  "code": "...",
  "mode": "submit",
  "status": "accepted",
  "summary": {
    "passed": 8,
    "total": 8
  },
  "results": [
    {
      "caseId": "hidden-1",
      "passed": true,
      "stdout": "",
      "stderr": "",
      "durationMs": 12
    }
  ],
  "createdAt": "2026-05-10T00:00:00.000Z"
}
```

---

## 判题与运行模型

### 运行（Run）

“运行”只针对用户当前选择的公开用例和自定义用例。

特点：

- 用户立即看到输入、输出、期望输出
- 不写入正式通过状态
- 可以频繁执行
- 结果保存在最近运行记录中

### 提交（Submit）

“提交”使用题目的正式测试集：

- 可包含公开用例
- 必须包含隐藏用例
- 返回通过/失败汇总
- 写入提交记录

### Go 执行方式

后端在临时目录生成组合文件：

1. 用户代码
2. 运行器包装代码
3. 当前测试用例数据

随后使用 `go run` 执行。

输出内容至少包括：

- stdout
- stderr
- 退出码
- 执行时长
- 判题结果

### 安全边界

第一版是本机单用户工具，不做容器隔离，但仍做以下最小限制：

- 执行超时
- 限制工作目录到 `LeetCode/runtime/`
- 每次运行使用独立临时子目录
- 执行后清理临时文件

---

## 题目来源与管理模式

### 模式 1：文件预置

开发者可直接在 `LeetCode/problems/*.json` 中维护题目。

适合：

- 预置题库
- 批量导入自定义题
- 用 Git 跟踪题面变更

### 模式 2：页面新增/编辑

用户在页面中新增题目后，后端负责把题目写入 `LeetCode/problems/`。

适合：

- 快速创建变体题
- 在浏览器里维护测试用例

### 统一规则

- 两种来源最终都落在同一种题目 JSON 结构上
- 前端不关心题目来自文件还是页面
- 题目唯一标识使用 `slug`

---

## API 设计

### 题目接口

- `GET /api/leetcode/problems`
  - 返回题目列表
- `GET /api/leetcode/problems/{slug}`
  - 返回题目详情
- `POST /api/leetcode/problems`
  - 创建新题
- `PUT /api/leetcode/problems/{slug}`
  - 更新题目

### 草稿接口

- `GET /api/leetcode/drafts/{slug}`
  - 获取代码草稿
- `PUT /api/leetcode/drafts/{slug}`
  - 保存代码草稿

### 运行与提交接口

- `POST /api/leetcode/run`
  - body 包含 `slug`、`code`、`testCases`
- `POST /api/leetcode/submit`
  - body 包含 `slug`、`code`

### 记录接口

- `GET /api/leetcode/submissions`
  - 查询全部提交记录
- `GET /api/leetcode/submissions/{slug}`
  - 查询某题提交记录

---

## 前后端边界

### 前端负责

- 题库浏览和筛选
- 题面渲染
- Go 代码编辑器状态
- 自定义测试用例编辑
- 运行/提交结果展示
- 本地自动触发草稿保存请求

### 后端负责

- 题目文件读写
- 草稿和提交记录持久化
- Go 代码执行
- 用例比对和结果汇总
- 输入输出序列化

---

## 第一版交付范围

### 必做

- `/leetcode` 路由
- 题库页
- 做题页
- Go 编辑器
- 可见测试用例切换
- 自定义测试用例运行
- 提交正式判题
- 新增/编辑题目
- 本地保存草稿和提交记录
- 预置至少 1 道自定义题

### 首题样例

预置题：

- 标题：`K 个一组反转链表（尾组也反转）`
- slug：`reverse-nodes-in-k-group-full-tail`

用于验证“基于 LeetCode 原题做规则变体”的核心场景。

---

## 风险与取舍

### 风险 1：Go 代码执行安全性有限

取舍：

- 第一版接受本机单用户前提
- 通过超时、独立目录、清理临时文件降低风险

### 风险 2：题目输入输出格式差异大

取舍：

- 第一版只支持函数型题目
- 输入输出以 JSON 结构传递
- 暂不处理交互式题目和复杂类定义题目

### 风险 3：LeetCode 视觉复杂度高

取舍：

- 优先保证信息结构和交互顺序接近
- 视觉细节逐步迭代，不阻塞功能落地

---

## 成功标准

当满足以下条件时，第一版可视为成功：

1. 能从 `/leetcode` 进入题库
2. 能打开题目并看到接近 LeetCode 的做题工作区
3. 能用 Go 写代码并运行自定义测试
4. 能提交并使用隐藏用例判题
5. 能在页面新增一道自定义题并立即开始刷
6. 题目、草稿、提交记录都能本地持久化

