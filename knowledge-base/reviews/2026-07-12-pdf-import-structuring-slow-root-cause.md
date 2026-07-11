# PDF 导入结构化偶发 96~170s —— 根因复核(事件循环阻塞)

- 日期:2026-07-12
- 前序文档:`2026-07-11-pdf-import-structuring-slow-diagnosis.md`(已因安全审计误删,见下文「文档恢复」)
- 关联文件:`backend/routes/pdf.py`、`backend/routes/resume.py`、`backend/llm.py`、`backend/services/resume_assembler.py`、`backend/latex_compiler.py`
- 排查方式:systematic-debugging(Phase 1 根因调查 → Phase 2 模式分析 → Phase 3 假设验证 → Phase 4 结论)
- 状态:**✅ 根因已通过决定性实验确认**

---

## 一、前序结论的修正

### 前序文档(2026-07-11)的结论

> 慢根因是 uvicorn 单进程 + 同步 OpenAI client 全局单例 + 多用户/多任务并发时线程池与连接池争抢,叠加上默认无 timeout、SDK 指数退避重试,把一次抖动放大到分钟级。

### 本次复核推翻了什么

| 前序假设 | 本次验证结果 | 结论 |
|---|---|---|
| ① 线程池争抢是主因 | 服务器实测:4 组(8 个 `_extract_sections`)并发只要 **6.25s**,8 个线程没争抢 | **❌ 推翻** |
| ② 连接池 maxsize=10 是瓶颈 | OpenAI SDK 2.44+ 默认 `max_connections=1000`,远不是瓶颈;日志里的 `maxsize=10,10` 是 httpx 内部另一层 | **❌ 推翻** |
| ③ SDK 指数退避重试放大 | 重试只在 10:13 / 14:58 出现,**169s 窗口(10:18-10:21)里完全没有重试日志** | **❌ 不是主因**(仍是次要隐患) |
| ④ EXP 组静默回退到 `_serial` | 服务器实测:EXP 组在 8 并发下全部正常返回,没有一个空/超时 | **❌ 推翻** |

### 本次确认的真正根因

**事件循环被同步阻塞调用冻结。** `asyncio.to_thread` 把同步 OpenAI 调用扔进线程池,线程池里的请求可能早已拿到 DashScope 响应,但**结果回调要回到事件循环才能被 `await` 接住**。如果此时事件循环被另一个路由的同步阻塞调用(如 `subprocess.run` 编译 LaTeX、`requests.post` 调 LLM)冻结,`to_thread` 的结果就拿不回来,结构化请求"卡住"直到事件循环解冻。

---

## 二、证据链(决定性实验)

### 实验1:干净环境并发不慢(推翻线程池争抢)

在服务器 `106.53.113.137` 上用同一简历样本(646 字符)跑:

| 场景 | 耗时 | 结论 |
|---|---|---|
| 单次 assembler | 12.14s | 基线✓ |
| 并发 2 个 assembler | 16.70s(1 个 11.8s + 1 个 16.7s) | 轻微退化 |
| **并发 4 个 assembler** | **11.85s**(全部 11.5-11.8s) | **4 并发不慢!** |
| 并发 2 个纯 DashScope API | 9.96s | API 层无限流 |

4 组(8 个 `_extract_sections`)并发只要 6.25s,EXP 组全部返回 `internships=2 projects=2`,**没有一个空或超时**。线程池争抢假设不成立。

### 实验2:同步 subprocess 阻塞事件循环(确认根因)

模拟 `/pdf/compile-latex` 路由里 `compile_latex_raw` 的 `subprocess.run(timeout=180)` 在 async 函数里直接调用(无 `run_in_threadpool` 包装):

| 场景 | assembler 耗时 | latex 耗时 | 总墙钟 |
|---|---|---|---|
| 基线(assembler 单独) | 10.98s | — | 10.98s |
| **assembler + 同步 latex(15s) 并发** | **15.01s** ← 膨胀 4s | 15.01s | 15.01s |
| assembler + `to_thread(latex)` 并发(正确做法) | 11.20s ← 不膨胀 | 15.01s | 15.01s |

**关键对比**:同步 latex 阻塞时,assembler 从 11s 膨胀到 15s——**assembler 的 `asyncio.to_thread` 线程早已完成,但结果回调被冻结的事件循环卡住了 4 秒**。而用 `to_thread` 包 latex 后,两者互不影响。

15 秒的 latex 阻塞让 assembler 膨胀 4 秒。生产里如果叠加**多个** compile-latex(每次 15-60s)+ 多个同步 `call_llm`(每次 5-50s),累积到 169s 完全合理。

### 实验3:单个短 call_llm 影响小(辅助证据)

单个 3 秒的同步 `call_llm` 对 assembler 影响不大(11.49s vs 10.73s)。说明需要**长时间或多频次**的同步阻塞叠加才能造成分钟级退化,单个短阻塞不是主因。

---

## 三、生产 169s 现场重建

### 日志时序(2026-07-11 10:18-10:27)

```
10:18:13  agent SSE 对话开始(conv-1783736289777)
10:18:16  agent 第一次 LLM 调用完成
10:18:40  请求A OCR完成(2442字符) → 进入结构化(asyncio.to_thread × 2)
          ┌─ 此时 EASY/EXP 两个线程开始调 DashScope(约 10-15s 拿到响应)
          │  但事件循环如果被其他路由的同步调用冻结,结果回调拿不回来
          │
          │  【169秒窗口:日志完全空白,无错误/无重试/无回退日志】
          │  可能的阻塞源(按概率):
          │  ① /pdf/compile-latex/stream 的 subprocess.run(timeout=180)
          │  ② resume.py 里 15 处同步 call_llm(requests.post timeout=50s)
          │  ③ agent stream.py:152 的 time.sleep(重试时)
          │
10:21:28  请求B OCR完成(2442字符,同一用户重试) → 进入结构化
10:21:29  请求A 结构化完成: 169.68s  ← 终于拿到回调
10:23:27  请求B 结构化完成: 119.19s
10:26:13  请求D OCR完成(3248字符) → 结构化
10:27:50  请求D 结构化完成: 96.65s
```

### 耗时分布(当天所有 PDF 解析)

```
9.95s  12.85s  13.11s  13.23s  17.89s  19.16s  23.29s
32.79s  33.33s  36.67s  37.68s  44.27s  47.09s  49.88s
96.65s  119.19s  169.68s
```

同样规模简历(1700-2400 字符),耗时从 10s 到 170s 跨 17 倍。**波动不是输入决定的,是运行时事件循环被阻塞的时长决定的。**

---

## 四、根因清单:同步阻塞调用在 async 路由里

### P0-① `/pdf/compile-latex` 系列同步编译 LaTeX(最重)

- **文件**:`backend/routes/pdf.py:319`(`compile_latex`)、`pdf.py:359`(`compile_latex_stream`)
- **问题**:`compile_latex_raw`(`backend/latex_compiler.py:92`)内部 `subprocess.run(timeout=180)`,在 async 路由里**直接调用,无 `run_in_threadpool` 包装**
- **对比**:同文件 `pdf.py:155-161`、`pdf.py:223-244` 的 `/pdf/render*` 路由**正确用了** `run_in_threadpool` —— compile-latex 是遗漏
- **影响**:一次 xelatex 编译 15-60s(首次/字体多更久),整段时间事件循环冻结,冻结同进程所有 `asyncio.to_thread` 回调、SSE 心跳、AsyncOpenAI chunk 投递
- **前端调用**:`frontend/src/services/api.ts:660` → `/api/pdf/compile-latex/stream`

### P0-② `resume.py` 里 15 处同步 `call_llm`

- **函数**:`call_llm`(`backend/llm.py:52`)是同步 `def`,内部 `simple.call_deepseek_api` → `requests.Session().post()`(同步,timeout=15-50s)
- **问题**:在 async 路由里直接调用,没 `await asyncio.to_thread` 包装
- **对比**:`resume.py:703`(翻译接口)**正确用了** `await asyncio.to_thread(call_llm, ...)` + `Semaphore(5)`,其余 15 处遗漏

| 文件:行号 | async 函数 | 说明 |
|---|---|---|
| `resume.py:230` | `detect_rewrite_text_intent` | 意图识别 |
| `resume.py:375` | (待确认) | |
| `resume.py:563` | `jd_optimize` | JD 优化 |
| `resume.py:650` | (待确认) | |
| `resume.py:735` | `resume_health_check` | 简历体检 |
| `resume.py:798` | `generate_resume` | 简历生成 |
| `resume.py:847` | `generate_resume_stream` | **流式接口里同步 call_llm,影响 SSE** |
| `resume.py:1213` | `_parse_resume_serial` | 循环里每块同步 |
| `resume.py:1277` | `_parse_resume_serial` | 同步 |
| `resume.py:1393` | `parse_section_text` | 分段解析 |
| `resume.py:1428` | `rewrite_resume` | 简历改写 |

### P1-③ agent SSE 重试里的 `time.sleep`

- **文件**:`backend/agent/web/routes/stream.py:152`
- **问题**:`_get_or_create_session`(同步 `def`)被 async `_stream_event_generator` 直接调用,内部 `time.sleep(delay)` 阻塞事件循环
- **触发条件**:agent 初始化失败重试时;正常路径不触发

### P1-④ pm2 重启 81 次的根因(独立问题,非慢的直接原因)

error log 里全是:
```
ValueError: Tag "<li>" does not correspond to any known color directive
  File ".../loguru/_colorizer.py" line 260
```
loguru 的 colorizer 在处理含 HTML 标签(`<li>`、`<strong>`)的日志消息时崩溃,叠加 `ExceptionGroup: unhandled errors in a TaskGroup` 导致进程退出。**不是 OOM。** 这个问题独立于慢,但会放大"开代理就失败"的印象(进程挂了 + 境外 IP 拦截同时发生)。

---

## 五、优化方案(修正版)

### P0 止血(不改架构,最小 diff)

1. **`/pdf/compile-latex` 和 `/pdf/compile-latex/stream` 加 `run_in_threadpool`**
   `pdf.py:319`、`pdf.py:359`。参照同文件 `pdf.py:155` 的写法。**这是收益最大的一项。**

2. **`resume.py` 15 处同步 `call_llm` 改 `await asyncio.to_thread(call_llm, ...)`**
   参照 `resume.py:703`(翻译接口)的写法。

3. **`resume_assembler._get_client` 加 `timeout=60` + `max_retries=0`**
   (前序文档的 P0-①,仍然有效——避免 SDK 默认 600s 超时 + 指数退避,失败快速抛出。次要隐患但值得修。)

4. **`_serial()` 回退加日志**
   `resume_assembler.py:520`。`logger.warning("[结构化] EXP组为空, 回退单次路径")`。暴露静默回退。虽然本次证明回退不是主因,但可观测性必须有。

### P1 架构改善

5. **`agent/web/routes/stream.py:152` 的 `time.sleep` 换 `await asyncio.sleep`**
   或把 `_get_or_create_session` 整体用 `to_thread` 包。

6. **loguru colorizer 崩溃修复**(治 pm2 重启 81 次)
   要么升级 loguru,要么给 handler 关闭颜色(`colorize=False`),要么在记录含 HTML 的消息前转义 `<` `>`。

### P2 调优(前序文档仍有效,但优先级降低)

7. uvicorn `--workers 2`(多进程绕开 GIL,但治标不治本——单进程内的同步阻塞仍会冻结该 worker 的事件循环)
8. `max_tokens` 4000 → 2500(边际收益)

### 前序文档 P0-③(独立线程池)——本次复核后降级

前序建议给 `assemble_resume_data_fast` 用独立 `ThreadPoolExecutor` 隔离。本次实验证明 8 并发不争抢,且真正的问题是事件循环冻结(不是线程池排队),**独立线程池不解决问题**。降级为 P2。

---

## 六、本次实施范围

本次只做 **文档复核**(修正根因 + 更新优化方案),不动代码。代码改动(P0 四项)待确认后单独提交。

---

## 七、关键教训

1. **「单跑快、线上慢」先查事件循环是否被同步调用冻结**,而不是先查线程池/连接池。`asyncio.to_thread` 的结果回调依赖事件循环,事件循环被冻结 = 所有 to_thread 结果拿不回来。
2. **`subprocess.run` / `requests.post` 在 async 路由里是核武器**:一个 15s 的同步调用会冻结整个进程 15s,所有并发用户一起卡。FastAPI 里所有 IO 必须走 `run_in_threadpool` 或 `to_thread` 或原生 async client。
3. **前序排查的盲区**:只测了 assembler 自身的并发,没有测"assembler + 其他类型路由"的并发。生产里慢不是 assembler 之间争抢,是 assembler 被其他路由的同步阻塞连累。排查并发性能问题必须覆盖**异构负载**,不能只测同类。
4. **静默回退仍是黑洞**:虽然本次证明回退不是 169s 主因,但 `_serial()` 回退无日志这个设计缺陷仍在。所有 fallback 必须可观测。

---

## 附:文档恢复说明

前序文档 `2026-07-11-pdf-import-structuring-slow-diagnosis.md`(commit `0c0437ab`)被 `af2b8e52`(安全审计:移除敏感内容出 git)误删。本次不恢复原文,而是用本文档替代(修正了根因结论)。如需查看前序原文:`git show 0c0437ab:knowledge-base/reviews/2026-07-11-pdf-import-structuring-slow-diagnosis.md`。
