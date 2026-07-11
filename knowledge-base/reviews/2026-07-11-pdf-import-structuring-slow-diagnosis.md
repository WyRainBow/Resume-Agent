# PDF 简历导入「结构化」阶段偶发 96~170s 排查复盘

- 日期：2026-07-11
- 关联文件：`backend/services/resume_assembler.py`、`backend/routes/resume.py`
- 线上现象：PDF 导入「步骤2 结构化完成: 169.68s」/「96.65s」/「119.19s」，OCR 仅 3~5s，结构化占 95%+ 耗时
- 结论一句话：**模型和网络都没问题（单跑 12s）；慢根因是 uvicorn 单进程 + 同步 OpenAI client 全局单例 + 多用户/多任务并发时线程池与连接池争抢，叠加上默认无 timeout、SDK 指数退避重试，把一次抖动放大到分钟级。**

---

## 一、慢在哪 —— 现场定位

从生产 `pm2 logs` 抓出多次解析耗时（2026-07-11）：

| 时刻 | OCR | 结构化 | 总耗时 |
|---|---|---|---|
| 07:35 | 3.46s | 32.79s | 36.25s |
| 10:21 | 2.88s | **169.68s** | 172.56s |
| 10:23 | 3.11s | **119.19s** | 122.30s |
| 10:24 | 2.01s | 47.09s | 49.10s |
| 10:27 | 4.79s | **96.65s** | 101.44s |

OCR 稳定 2~5s，全部时间都在「步骤2 结构化」（`assemble_resume_data_fast`）。

## 二、逐层排除（现场实测）

在服务器 `106.53.113.137` 上用同一样本（王谦简历，1693 字符 Markdown）逐项验证：

| # | 测试 | 结果 | 结论 |
|---|---|---|---|
| 1 | 服务器 ping DashScope（curl） | dns 0.8ms / connect 42ms / ttfb 132ms | 网络✓ |
| 2 | 模型 ping（max_tokens=10） | qwen-plus 0.59s / qwen-plus-latest 0.58s | 模型可用✓ |
| 3 | bench 单次路径（`assemble_resume_data`） | qwen-plus 20.35s / qwen-plus-latest 20.25s | 单次✓ |
| 4 | bench 并发路径（`assemble_resume_data_fast`，直接调） | qwen-plus-latest **12.77s** | 并发逻辑✓ |
| 5 | DashScope 并发 4 请求（短 prompt） | 并发 1.54s / 串行 5.69s | 无限流✓ |
| 6 | 两用户并发结构化（脚本模拟） | 用户A 12.85s / 用户B 25.56s | 轻度争抢，但不到分钟级 |

**关键矛盾**：脚本里单跑只要 12.77s，生产里却 96~170s。bench 脚本是「独占进程、无其他负载」，生产是「多用户并发 + agent 对话 + PDF 自动渲染」。

## 三、169s 现场重建（从日志时序还原）

抓 10:18:40 ~ 10:21:30（那次 169s 窗口）的全部日志：

```
10:18:40  请求A OCR完成（从亚申, 2442字符）→ 进入结构化
          同时: 另一用户 glm-ocr 在跑（周口师范, 895字符）
          同时: 又一个 glm-ocr 在跑（从亚申重试?, 2442字符）
          大量「PDF 生成成功」在跑（自动渲染 / agent 预览）
10:21:28  请求B OCR完成（同从亚申 2442字符 — 同一用户等不及重试）
10:21:29  请求A 结构化终于完成: 169.68s
10:23:27  请求B 结构化完成: 119.19s
```

期间还有大段 `[重试] 已达最大重试次数 1，放弃` 和 OpenAI SDK 自带 `Retrying request to /chat/completions in 3.84s`（指数退避）。

## 四、根因 —— 三个放大器叠加

### ① OpenAI client 无 timeout + SDK 指数退避重试
`resume_assembler.py:84` 创建 client 时未传 `timeout`，SDK 默认 600s。一次 DashScope 抖动 → SDK 自动重试（0.8s → 1.6s → 3.8s 指数退避）→ 单次失败被放大到 10s+。日志里可见：
```
Retrying request to /chat/completions in 0.842s
Retrying request to /chat/completions in 1.677s
Retrying request to /chat/completions in 3.880s
[重试] 已达最大重试次数 1，放弃
```

### ② 全局单例 client + uvicorn 单 worker，并发时连接池/GIL 争抢
- `_deepseek_client` 是进程级全局单例，底层 httpx 连接池 maxsize 默认 10
- uvicorn 单进程单 worker（4 核机器只用了 1 核）
- 所有请求（PDF 导入、agent 对话、PDF 渲染、自动保存）共享同一个事件循环 + 同一个默认线程池
- `asyncio.to_thread` 把同步 `client.chat.completions.create` 扔进线程池，但线程池被其他任务占满时，结构化请求排队等待

脚本模拟「2 用户结构化 + 6 个阻塞任务」：用户A 12.85s、用户B 25.56s（2 倍退化）。生产里并发任务更多、争抢更激烈，退化到 96~170s 完全合理。

### ③ EXP 组为空 → 静默回退到最重的单次路径（`_serial`）
`resume_assembler.py:519-521`：
```python
exp_ok = isinstance(exp_r, dict) and (exp_r.get("internships") or exp_r.get("projects"))
if not exp_ok:
    return await _serial()   # ← 回退! max_tokens=8000 + 8段规则prompt
```
EXP 组（实习+项目）如果因超时/限流返回空，就回退到 `assemble_resume_data`（单次、prompt 更大、max_tokens=8000）。这条路径本就 30~40s，再叠加 ①② 就是 100s+。**且这个回退完全静默，日志里看不到，排查时一度以为是模型本身慢。**

## 五、模型选型数据（本地 + 服务器 bench）

> 目的：排除「是不是换模型就好」。结论：换模型只能边际改善，不解决根因。

样本1 王虞嫣（1381 字，商科，无正经实习）—— 并发路径：

| 模型 | 耗时 | 实习 | 项目 | 备注 |
|---|---|---|---|---|
| qwen-turbo | 7.02s | 0 | 0 | 漏提取，不可用 |
| qwen-plus | 9.70s | 0 | 4 | 分类正确（实训/竞赛→项目） |
| qwen-plus-latest | 9.83s | 0 | 3 | 同上 |
| deepseek-v4-flash | 24.45s | 0 | 3 | 最慢 |

样本2 王谦（1698 字，腾讯实习，技术简历）—— 并发路径：

| 模型 | 耗时 | 实习 | 项目 | 奖项 |
|---|---|---|---|---|
| qwen-turbo | 4.42s | 4 | 0 | 0（漏奖项） |
| qwen-plus-latest | 12.42s | 3 | 1 | 4 |
| qwen-plus | 12.56s | 3 | 1 | 4 |
| deepseek-v4-flash | 30.64s | 3 | 1 | 4 |

结论：
- `qwen-turbo` 最快但质量明显差（漏奖项、王虞嫣样本并发实习项目全空）
- `qwen-plus` 与 `qwen-plus-latest` 质量几乎一致，plus 略快 → **建议默认换 `qwen-plus`**（边际收益，非治本）
- `deepseek-v4-flash` 最慢且无质量优势，不推荐

## 六、优化方案（按优先级）

### P0：止血（不改架构，最小 diff）

1. **`_get_client` 加 `timeout=60` + `max_retries=0`**
   `resume_assembler.py:84`。避免 SDK 默认 600s 超时 + 指数退避，一次抖动不再被放大到 10s+。失败快速抛出，交给上层（EASY/EXP 并发 + 回退）处理。

2. **`_serial()` 回退前加日志**
   `resume_assembler.py:520`。`logger.warning("[结构化] EXP组为空, 回退单次路径 easy=%s exp=%s", ...)`。暴露静默回退事件，后续可观测。

3. **`assemble_resume_data_fast` 用独立线程池**
   `resume_assembler.py:512`。把 `asyncio.to_thread` 换成 `loop.run_in_executor(_STRUCT_POOL, ...)`，`_STRUCT_POOL = ThreadPoolExecutor(max_workers=4)` 模块级单例。结构化与 PDF渲染/OCR/agent 的默认线程池隔离，互不阻塞。

### P1：架构改善

4. **uvicorn 多 worker**
   pm2 启动命令加 `--workers 2`（4 核机器跑 2 进程）。多进程绕开 GIL + 单 client 连接池瓶颈。注意：需确认 DB 连接、agent 状态等是否 worker 间安全（目前是无状态 API，应该 OK）。

5. **默认模型 `qwen-plus-latest` → `qwen-plus`**
   `resume_assembler.py:57`。bench 显示两者质量一致、plus 略快（边际改善，非治本）。

### P2：进一步调优

6. **两路 `max_tokens` 4000 → 2500**：简历单分组输出 token 实测 < 2000，减少解码时间。
7. **OpenAI client 显式 `http_client=httpx.Client(...)` 配置连接池 maxsize**：与 worker 数匹配。

## 七、本次实施范围

本次只做 **P0 三项**（止血），P1/P2 留待观察：

| 文件 | 改动 |
|---|---|
| `backend/services/resume_assembler.py` | `_get_client` 加 timeout/max_retries；`assemble_resume_data_fast` 用独立线程池；`_serial` 回退加 warning 日志 |

验证方式：部署后观察 pm2 日志 `[PDF解析] 步骤2 结构化完成` 耗时分布；若出现 `[结构化] EXP组为空` 说明 EXP 组在超时，需进一步查 DashScope 侧。

## 八、关键教训

1. **「单跑快、线上慢」先查并发资源争抢**，而不是模型/网络。bench 脚本是独占进程，生产是多任务共享单进程。
2. **SDK 默认行为是性能陷阱**：OpenAI Python SDK 默认 timeout=600s + 指数退避重试，任何抖动都会被放大。生产环境务必显式设 timeout + max_retries。
3. **静默回退是排查黑洞**：`_serial()` 回退没有任何日志，导致一开始以为是模型慢，实际是「并发失败 → 回退到更慢的单次路径」的二次退化。所有 fallback 路径必须有可观测性。
4. **uvicorn 单 worker 是 4 核机器的浪费**：`--workers 2` 是几乎零成本的多进程并发提升。
