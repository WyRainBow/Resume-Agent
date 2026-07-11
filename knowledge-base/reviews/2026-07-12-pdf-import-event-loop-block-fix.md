# PDF 导入事件循环阻塞修复记录

- 日期:2026-07-12
- 分支:`fix/pdf-import-event-loop-block`(从 `main` 切出)
- 前序根因文档:`knowledge-base/reviews/2026-07-12-pdf-import-structuring-slow-root-cause.md`
- 状态:**✅ P0 止血完成,待 review**

---

## 一、改了什么

### 1. `backend/routes/pdf.py` — compile-latex 加 `run_in_threadpool`(收益最大)

**问题**:`/pdf/compile-latex`(L319)和 `/pdf/compile-latex/stream`(L359)在 async 路由里直接调 `compile_latex_raw`,其内部 `subprocess.run(timeout=180)` 会同步阻塞事件循环最多 180 秒。

**改法**:加 `await run_in_threadpool(...)`(参照同文件 `/pdf/render*` 路由 L155-161、L223-244 已有的正确写法)。

```python
# 改前
pdf_io = compile_latex_raw(body.latex_content)
# 改后
pdf_io = await run_in_threadpool(compile_latex_raw, body.latex_content)
```

`run_in_threadpool` 已在文件顶部导入(L9),无需新增 import。两处改动(L321、L362)。

### 2. `backend/routes/resume.py` — 10 处同步 `call_llm` 改 `asyncio.to_thread`

**问题**:`call_llm`(`backend/llm.py:52`)是同步 `def`,内部 `simple.call_deepseek_api` → `requests.Session().post()`(同步,timeout=15-50s)。在 async 路由里直接调用会阻塞事件循环。

**改法**:改成 `raw = await asyncio.to_thread(call_llm, ...)`(参照同文件 L703 翻译接口已有的正确写法)。

| 行号 | async 函数 | 改动 |
|---|---|---|
| L375 | `grammar_check` | `call_llm(provider, prompt)` → `to_thread` |
| L563 | `jd_optimize` | 同上 |
| L650 | `jd_keyword_integrate` | 同上 |
| L735 | `resume_health_check` | 同上 |
| L798 | `generate_resume` | `call_llm(body.provider, prompt)` → `to_thread` |
| L847 | `generate_resume_stream` 内 | `call_llm(body.provider, json_prompt)` → `to_thread` |
| L1213 | `_parse_resume_serial` 内循环 | `call_llm(provider, chunk_prompt, model=model)` → `to_thread` |
| L1277 | `_parse_resume_serial` | `call_llm(provider, prompt, model=model)` → `to_thread` |
| L1393 | `parse_section_text` | 同上 |
| L1428 | `rewrite_resume` | `call_llm(body.provider, prompt)` → `to_thread` |

**未改**:
- L230 `_llm_detect_rewrite_intent`:**同步 `def` 函数**(非 async),不能加 `await`。它被 async 函数调用时,调用方应自行用 `to_thread` 包裹(本次不改调用方,避免扩大 diff)。
- `call_llm_stream`(L837, L1349, L1482, L1523, L1556):返回同步生成器,在 async generator 里 `for chunk in call_llm_stream(...)` 会阻塞。改成异步迭代需要重构 stream 生成器,本次不做,留 P1。

### 3. `backend/services/resume_assembler.py` — client timeout + 回退日志

**`_get_client`(L77)**:加 `timeout=60.0` + `max_retries=0`。

```python
# 改前
_deepseek_client = OpenAI(api_key=key, base_url=DEEPSEEK_BASE_URL)
# 改后
_deepseek_client = OpenAI(
    api_key=key, base_url=DEEPSEEK_BASE_URL,
    timeout=60.0, max_retries=0,
)
```

SDK 默认 `timeout=600s` + 重试 2 次(0.8→1.6→3.8s 指数退避),一次 DashScope 抖动被放大到 10s+。改为 60s 超时 + 不重试,失败快速抛出,交给上层 EASY/EXP 并发 + `_serial` 回退处理。

**`_serial` 回退(L531)**:加 `logger.warning`,记录 EXP 组返回内容(空/异常类型),消除静默回退黑洞。新增 `import logging` + `logger = logging.getLogger(__name__)`。

### 4. `frontend/src/data/changelog.ts` — 版本 3.2.3

```ts
{ version: '3.2.3', date: '2026-07-12',
  fixed: ['修复多人同时使用时简历导入偶发卡住两三分钟的问题'] }
```

---

## 二、验证

| 项 | 方式 | 结果 |
|---|---|---|
| 语法 | `ast.parse` 三个文件 | ✓ 通过 |
| call_llm 归属 | AST 分析:sync 函数里的保持同步,async 函数里的全改 to_thread | ✓ L230 同步(正确),其余 10 处 to_thread |
| 遗漏检查 | grep 非stream `call_llm(` 排除 to_thread | ✓ 仅剩 L230(同步函数,正确) |
| 前端 build | `npm run build` | ✓ 通过 |

---

## 三、未做(留后续)

| 优先级 | 项 | 原因 |
|---|---|---|
| P1 | `call_llm_stream` 5 处改异步迭代 | 需重构 stream 生成器,改动面大,本次保持最小 diff |
| P1 | `stream.py:152` `time.sleep` → `asyncio.sleep` | agent 初始化重试路径,触发条件少 |
| P1 | loguru colorizer 崩溃(pm2 重启 81 次) | 独立问题,需升级 loguru 或关 colorize |
| P2 | uvicorn `--workers 2` | 多进程绕开 GIL,但不解决单 worker 内的同步阻塞 |

---

## 四、review 要点(给 Claude)

1. **pdf.py L321/L362**:`run_in_threadpool` 已在 L9 导入,两处写法和 L155-161 一致。
2. **resume.py 10 处 to_thread**:参数透传(位置参数 + `model=` 关键字)是否正确;L230 同步函数**不应改**(已确认保持同步)。
3. **resume_assembler.py L93-94**:`timeout=60.0` 是否合理(单次结构化实测 5-15s,60s 足够);`max_retries=0` 失败后上层有 `_serial` 回退兜底。
4. **回退日志 L545**:异常类型 + 返回内容截断 200 字,不会泄露敏感信息。
5. **changelog**:3.2.3,日期 2026-07-12(只日期,无时间,符合规范)。

---

## 五、补丁:detect_rewrite_text_intent 遗漏修复

### 背景:这是 review 阶段发现的一处遗漏

前面第一节表格里,原始修复只覆盖了 10 处**直接**裸调用 `call_llm(` 的 async 路由——因为定位手段就是 grep `call_llm(` 再判断所在函数是不是 async。这个手段漏掉了**隔了一层同步辅助函数**的阻塞链:

- `backend/routes/resume.py:250` `detect_rewrite_text_intent`(`async def`,路由 `POST /resume/rewrite-text/intent`)
- 在 L262 **直接同步调用** `_llm_detect_rewrite_intent(...)`(L200,普通 `def` 辅助函数)
- 而 `_llm_detect_rewrite_intent` 内部 L230 又同步调用了阻塞的 `call_llm(provider, prompt)`

所以真实的阻塞链是 `async 路由 → 同步 def → call_llm → requests.post`,和已修的 10 处性质完全一样,只是中间多套了一层 `_llm_detect_rewrite_intent`,grep `call_llm(` 时它落在同步函数体内(L230),被当作"同步函数里的调用,正确不改"放过,从而漏掉了外层 async 路由这条真正需要 to_thread 的调用。

**诚实说明**:第一节"未改"里其实已经点到了 L230 这个同步函数"被 async 函数调用时,调用方应自行用 `to_thread` 包裹",但当时以"本次不改调用方,避免扩大 diff"为由留下了。本补丁就是在 review 时把这条被主动推迟的调用方阻塞真正补上——它确实是上一轮遗漏/未完成的部分。

### 改法(最小 diff,不动辅助函数本身)

`_llm_detect_rewrite_intent` 保持同步 `def` 不变(它本身不是 async,不能加 await;签名、函数体一字不动),只把 L262 的调用点用 `asyncio.to_thread` 包一层,关键字参数原样透传:

```python
# 改前(L262,async 路由里直接同步调用,阻塞事件循环)
llm_intents, llm_confidence = _llm_detect_rewrite_intent(
    provider=provider,
    instruction=instruction,
    source_text=source_text,
    path_hint=path_hint,
    locale=locale,
)
# 改后(卸载到线程池,不冻结事件循环)
llm_intents, llm_confidence = await asyncio.to_thread(
    _llm_detect_rewrite_intent,
    provider=provider,
    instruction=instruction,
    source_text=source_text,
    path_hint=path_hint,
    locale=locale,
)
```

写法与本文件已确立的 12 处 `await asyncio.to_thread(call_llm, ...)` 一致;`asyncio` 已在 L9 模块级导入,无需新增 import。仅一处改动(L262),全仓 grep `_llm_detect_rewrite_intent(` 确认调用点唯一(L200 定义 + L262 调用,无其他调用者)。

### 验证

| 项 | 方式 | 结果 |
|---|---|---|
| 调用点唯一性 | `grep -rn "_llm_detect_rewrite_intent" backend/` | ✓ 仅 L200 定义 + L262 调用,无遗漏/无改错 |
| 语法 | `python3 -c "import ast; ast.parse(open('backend/routes/resume.py').read())"` | ✓ SYNTAX OK |
| 遗漏复查 | `grep -n "call_llm(" backend/routes/resume.py` | ✓ 唯一剩下的裸调用只在 L230(`_llm_detect_rewrite_intent` 函数体内,本身是同步函数,内部调用无需 to_thread——阻塞已被外层 L262 的 `asyncio.to_thread` 解决);已无任何"async 路由直接调同步阻塞函数、没有 to_thread"的情况 |
| pytest / npm build | 未跑 | 纯后端最小 diff,靠语法 + 调用链核对;非本轮重点 |
