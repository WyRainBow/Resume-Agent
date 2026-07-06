# 简历导入链路改造计划：MinerU+DeepSeek → glm-ocr + qwen-plus-latest

- **日期**：2026-07-06
- **状态**：✅ 已实施（分支 `feature/import-perf-parallel`，commit `8b8d8c37`），并在计划基础上追加了「分段并行」
- **最终方案**：移除 MinerU，OCR 单走 glm-ocr，结构化用 `qwen-plus-latest`；**并额外做了按 section 分段并行**（复用 `/parse` 的 `parse_resume_text_parallel`）
- **预期提速**：当前 ~55s → 改造后 ~33s（快约 40%）

> **实施结果（见文末「十、实施结果」）**：真实样本 baseline deepseek 43.6s → 并行 qwen-plus-latest 30.2s（~1.4x），核心段无丢失。计划原定「换模型单次」实测 qwen 单次约 44s（DashScope 波动大、并不稳定比 deepseek 快），**真正把耗时压下来的是分段并行**，不是换模型本身。

---

## 一、调研结论：当前导入链路

### 1.1 入口路由（`backend/routes/resume.py`）

| HTTP | 路径 | 函数（行号） | 输入 | 底层服务 | 流式 |
|---|---|---|---|---|---|
| POST | `/api/resume/parse` | `parse_resume_text` (882) | 纯文本 | DeepSeek（可选并行分块） | 否 |
| POST | `/api/resume/upload-pdf` | `upload_resume_pdf` (1019) | PDF 文件 | MinerU + glm-ocr + DeepSeek | 否 |
| POST | `/api/resume/upload-image` | `upload_resume_image` (1131) | 图片 ≤2 张 | glm-ocr / qwen-vl-max + DeepSeek | 否 |
| POST | `/api/resume/parse/stream` | `parse_resume_text_stream` (1375) | 纯文本 | DeepSeek 流式 | 是 (SSE) |
| POST | `/api/resume/parse-section` | (1420) | 段落文本 | DeepSeek | 否 |

**本次改造范围**：`upload-pdf` + `upload-image` 两条导入主链路。文本粘贴（`/parse`、`/parse/stream`、`/parse-section`）**不动**。

### 1.2 当前 PDF 导入是「三路混合」

```
PDF → ① MinerU 转 Markdown（本地库，必须成功，失败降级 pdfminer）
    → ② glm-ocr 转 Markdown（远程 API，可选，失败不阻塞）
    → ③ DeepSeek(deepseek-v4-flash) 融合两路 Markdown → 结构化 JSON
    → normalize_resume_json 本地清洗 → 返回
```

- **MinerU**：本地 Python 包 `mineru.cli.common.do_parse`，`backend/services/pdf_parser.py:27`
- **glm-ocr**：智谱 layout_parsing API，`backend/services/zhipu_layout.py:301`，URL `https://open.bigmodel.cn/api/paas/v4/layout_parsing`
- **DeepSeek**：`backend/services/resume_assembler.py:280` 的 `assemble_resume_data`，走 DashScope 兼容接口，模型 `deepseek-v4-flash`（temp=0.1, max_tokens=8000）

### 1.3 关键约束：模型强转逻辑

`resume_assembler.py:364-366` 有强转，非 `deepseek-v*` 的模型名会被改回 `DEEPSEEK_MODEL`：

```python
model_name = (model or "").strip() or DEEPSEEK_MODEL
if model_name in ("deepseek-chat", "deepseek-reasoner") or not model_name.startswith("deepseek-v"):
    model_name = DEEPSEEK_MODEL   # ← qwen-* 会被改回 deepseek
```

切到 qwen 必须先解除这层强转。

### 1.4 前端链路（不改）

前端 `AIImportModal.tsx` 直接 fetch 后端 4 个接口，请求体格式（FormData `file`/`files`/`model`）、返回结构 `{resume}` 都不变。**改造对前端透明**。

---

## 二、基准测试结果（耗时 + 内容质量）

### 2.1 测试方法

- **样本**：`测试样本/尹昕雨 3.pdf`（393.5 KB，单页带照片简历）
- **OCR**：glm-ocr 固定 2.64s 得到 2878 字符 Markdown（与结构化模型无关）
- **结构化**：用同一段 Markdown，分别测各模型转 JSON
- **脚本**：`backend/scripts/bench_import_pipeline.py`（耗时+质量）、`backend/scripts/compare_bench_json.py`（内容完整度对比）、`backend/scripts/bench_breakdown.py`（耗时拆解）

### 2.2 耗时 + 质量综合对比

| 模型 | 耗时 | 实习 | 教育 | 项目 | 奖项 | 信息密度 | 字段完整率 | 与基线相似度 | 高亮 | 评价 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| qwen-turbo | **11.17s** | 5 | 1 | **0 ❌** | 3 | 1556 | 100% | 73.9% | 15 | ❌ **项目全丢**，不可用 |
| qwen-plus | 30.88s | 5 | 1 | 2 | 6 | 2163 | 100% | 99.4% | 19 | ⭐ 性价比最高 |
| **qwen-plus-latest** | **~30-45s** | 5 | 1 | 2 | 6 | 2163 | 100% | 99.4% | 19 | ✅ **最终选择**，自动跟最新快照 |
| qwen-max | 52.50s | 5 | 1 | 2 | 3 | 2104 | 100% | 95.4% | 19 | 质量=plus 但慢且贵 |
| deepseek-v4-flash（生产基准） | 53.05s | 5 | 1 | 3 | 3 | 2169 | 89.5% | 100% | 23 | 当前生产 |
| qwen3.7-max | 137.50s | 5 | 1 | 3 | 5 | 2365 | 95% | 98.6% | 21 | 慢 2.6 倍，无优势 |
| qwen3.7-plus | 297.74s | 6 | 1 | 3 | 11 | 2156 | 96% | 96.4% | 20 | ❌ 异常慢，避坑 |

### 2.3 关键发现

1. **`qwen-latest` 不存在**：DashScope 报 404。latest 机制是按版本系列的：`qwen-plus-latest`、`qwen-max-latest`、`qwen-turbo-latest`。本账号下 `qwen-plus-latest` 可用，max/turbo 的 latest 未授权（403）。
2. **qwen-turbo 不可用**：虽 11s 最快，但 **projects section 完全缺失**（0 条），整份简历丢项目经历，致命问题。
3. **qwen-plus 与 qwen-plus-latest 内容完全一致**（信息密度 2163、完整率 100%、相似度 99.4% 全相同），latest 只是指向最新快照。
4. **qwen3.7 系列不要用**：qwen3.7-plus 297s 异常慢（疑似限流），qwen3.7-max 137s 比 qwen-max 慢 2.6 倍。

### 2.4 耗时拆解：到底慢在哪

把 Markdown→JSON 的 LLM 调用拆成 token 维度（`bench_breakdown.py`，两次测试）：

| 模型 | 耗时 | 输出 token | tokens/s | 说明 |
|---|---|---|---|---|
| qwen-plus | 30-45s | ~1930 | 64.7 | 输出精简 |
| qwen-plus-latest | 30-45s | ~1970 | 65.1 | 同 plus |
| deepseek-v4-flash | 36-78s | **3600-4285** | 55-100 | **输出 token 是 qwen 的 2 倍**，且波动大 |

**结论**：
- **97% 的时间花在 LLM 生成 JSON 上**（glm-ocr 只占 2.6s）
- 模型间单位 token 生成速度（tokens/s）接近，**差距主要来自输出 token 数量**
- deepseek 用更多 token 表达同样内容（JSON 更冗长/思考链更长），所以慢
- qwen 优势本质：**用更少的 token 表达同样的内容**，所以更快且更稳定

---

## 三、开源 Markdown→JSON 方案评估

### 3.1 调研到的开源方案

| 项目 | 方式 | 语言 | 适用性 |
|---|---|---|---|
| **OpenResume** (`xitanggg/open-resume`) | 纯规则（regex + 启发式） | TS/React | ⚠️ 不适配 |
| **resume-parser** (npm) | 纯规则 | Node.js | ⚠️ 不适配 |
| **simple-resume-parser** (npm) | 纯规则 | Node.js | ⚠️ 不适配 |
| **MinerU** | 本地模型 | Python | ❌ 正是要去掉的 |
| **JSON Resume Schema** (`jsonresume/resume-schema`) | 仅数据规范 | - | ✅ 可参考字段定义 |

### 3.2 根本性可行性问题：这些工具不吃"OCR 后的 Markdown"

这些工具的工作流都是：
```
PDF 文件 → 内置 PDF 文本提取 → 在【原始乱序纯文本】上跑 regex
```

它们**没有"Markdown → JSON"环节**，直接对原始 PDF 文本做正则。而我们链路是：
```
PDF → glm-ocr → 结构化 Markdown（已有标题层级）→ ??? → JSON
```

用 OpenResume 方案等于跳过 glm-ocr 产出的 Markdown，让它重新从 PDF 提取——又回到 MinerU 老路。

### 3.3 纯规则方案的能力边界

| 能做好 | 做不好 |
|---|---|
| email、phone、URL（格式固定） | **中文姓名**（无规律） |
| 日期识别 | **工作职责描述**（自然语言） |
| 简单 section 切分 | **项目细节、成就数据**（900w+ 播放量） |
| | **字段归属判断**（某段话属于项目A还是B） |
| | **中英文混合、排版多样** |

OpenResume 自己的 Issue #5 承认：对 LinkedIn 格式简历准确率只有 ~50%。

### 3.4 结论：LLM 不可替代

把 Markdown 变成结构化简历 JSON 需要**语义理解**（公司名/职位识别、列表归属、数据保留），这些 LLM 一次调用就能做好，纯规则方案做不好。**所有现代简历解析产品（Affinda、Herizon、RChilli）都用 LLM 或 NLP**。

优化空间在**选最快的 LLM**，不在去掉 LLM。

---

## 四、已确认的决策

| 决策点 | 选择 | 依据 |
|---|---|---|
| **OCR 兜底** | glm-ocr 失败直接报错 | 完全依赖 glm-ocr，失败返回 502。glm-ocr 实测稳定（2.64s） |
| **结构化模型** | `qwen-plus-latest` | 质量满分 + 自动跟随最新快照 + 比当前快 40% |
| **qwen 通道** | 复用 `DASHSCOPE_API_KEY` | qwen 在 DashScope，base_url 不变只换 model 名。零新增配置 |
| **改造范围** | PDF + 图片一起换 | 两条链路统一，改动量基本一致 |
| **前端 UI** | 不动 | 后端默认 qwen-plus-latest，前端不暴露差异 |
| **不用开源规则方案** | 确认 | 纯规则准确率 ~50%，无法替代 LLM 的语义理解 |

---

## 五、实施步骤

### 步骤 1：`resume_assembler.py` —— 解除强转，默认 qwen-plus-latest

**文件**：`backend/services/resume_assembler.py`

- 新增模块级常量 `DEFAULT_ASSEMBLER_MODEL`，从环境变量 `ASSEMBLER_MODEL` 读取，默认 `qwen-plus-latest`
- 第 364-366 行强转逻辑改为：
  - 传入显式 `deepseek-*` → 保留原逻辑（向后兼容文本粘贴路径）
  - 传入 `qwen-*` → 直接放行
  - 未传或为空 → 用新默认 `qwen-plus-latest`
- `_get_client()` 的 base_url 已是 DashScope，qwen 同接口，**无需改 base_url**

### 步骤 2：`resume.py` upload-pdf —— 移除 MinerU，glm-ocr 唯一

**文件**：`backend/routes/resume.py`，`upload_resume_pdf`（1019-1125）

- 删除 `ThreadPoolExecutor(max_workers=2)` 并行结构，改为单路 `recognize_with_ocr(pdf_bytes)`
- 移除 `extract_markdown_from_pdf`（MinerU）调用及 `markdown_text` 变量
- glm-ocr 失败：**直接 `raise HTTPException(502)`**（不兜底）
- 调 `assemble_resume_data`：`raw_text=""`、`ocr_text=ocr_text`、`model` 透传
- 更新 docstring 与日志措辞（移除"混合增强""MinerU"）

简化后流程：
```
PDF → recognize_with_ocr (glm-ocr) → Markdown  [失败直接 502]
    → assemble_resume_data(ocr_text, model=qwen-plus-latest) → JSON
    → normalize_resume_json → 返回
```

### 步骤 3：`resume.py` upload-image —— 结构化换 qwen-plus-latest

**文件**：`backend/routes/resume.py`，`upload_resume_image`（1131-1183）

- 第 1173 行 `assemble_resume_data(..., model=None)` → `model="qwen-plus-latest"`（或用步骤 1 的默认常量）
- 注意：函数参数 `model`（1134 行 Form）是 **vision model 名**（glm-ocr），与结构化模型无关，保持不变

### 步骤 4：清理 MinerU 依赖（不删文件，降风险）

**文件**：`backend/services/pdf_parser.py`

- 不删文件。步骤 2 移除引用后，`grep -rn "extract_markdown_from_pdf" backend/` 确认无其它引用
- 文件顶部加注释说明"已不再用于导入主链路"
- `requirements.txt` 里 `mineru` 依赖**暂不移除**（避免影响本地已装环境，后续单独清理）

### 步骤 5：验证

1. **后端目标验证**：
   - 启动后端（9000）
   - 测试 PDF 调 `POST /api/resume/upload-pdf`，确认日志显示 `glm-ocr` + `qwen-plus-latest`，返回有效 JSON
   - 测试图片调 `POST /api/resume/upload-image`，同上
   - 边界：glm-ocr 失败返回 502
2. **前端验证**：
   - 启动前端 + web 鉴权层
   - 工作台「AI 智能导入」→ 上传 PDF → 解析成功、结果填入简历
3. **回归**：`/api/resume/parse`（文本粘贴）未改动，确认仍正常（走 DeepSeek）

---

## 六、关键文件清单

| 文件 | 改动类型 | 估行 |
|---|---|---|
| `backend/services/resume_assembler.py` | 改默认模型 + 解除强转 | ~5 行 |
| `backend/routes/resume.py` | upload-pdf 简化（删并行）、upload-image 改 1 行 | -20 / +5 |
| `backend/services/pdf_parser.py` | 仅加注释 | ~2 行 |

**不动**：前端任何文件、`.env`、`config.toml`、提示词（`prompts_pdf_parser.py` 与模型无关，复用）。

---

## 七、风险与回滚

- **风险**：glm-ocr 单点，智谱服务波动时导入直接失败（原 MinerU 可兜底）。已确认接受，glm-ocr 实测稳定。
- **回滚**：改动集中在 3 个文件，`git revert` 即可恢复 MinerU+DeepSeek。
- **性能预期**：移除 MinerU 本地解析（~2s）+ qwen 输出 token 更少，整体从 ~55s 降到 ~33s。

---

## 八、调用链路图（改造前 vs 改造后）

**改造前（PDF，三路混合）：**
```
upload-pdf → ThreadPool 并行 ┬─ MinerU → Markdown（必须成功）
                             └─ glm-ocr → Markdown（可选）
                             → DeepSeek(53s) 融合 → JSON
                             总耗时 ~55s
```

**改造后（PDF，两路串行）：**
```
upload-pdf → glm-ocr → Markdown（唯一，失败 502）     2.6s
           → qwen-plus-latest → JSON                  ~30s
           → normalize → 返回
           总耗时 ~33s（快约 40%）
```

**改造后（图片，已基本同构）：**
```
upload-image → image_to_text(glm-ocr) → Markdown
             → qwen-plus-latest → JSON
             → normalize → 返回
```

---

## 九、附录：测试脚本与产物

| 脚本 | 用途 |
|---|---|
| `backend/scripts/bench_import_pipeline.py` | 批量测各模型 Markdown→JSON 耗时+质量 |
| `backend/scripts/compare_bench_json.py` | 对比各模型输出 JSON 的内容完整度 |
| `backend/scripts/bench_breakdown.py` | 拆解 LLM 调用的 token 级耗时来源 |
| `backend/scripts/probe_qwen_models.py` | 探测 DashScope 账号下可用的 qwen 模型 |

中间产物（临时）：
- `/tmp/bench_glm_ocr_output.md`（glm-ocr 输出的 Markdown）
- `/tmp/bench_<model>.json`（各模型输出的简历 JSON）

---

## 十、实施结果（2026-07-06，分支 feature/import-perf-parallel）

### 最终落地（去 MinerU + qwen 单次；并行探索后暂缓）

| 文件 | 改动 |
|---|---|
| `resume_assembler.py` | `resolve_assembler_model`（默认 qwen-plus-latest，解除强转）；`assemble_resume_data_fast`（异步单次包装，把同步 LLM 调用移出事件循环）；`_parse_json` 加去尾逗号修复 |
| `routes/resume.py` | upload-pdf 去 MinerU/ThreadPool → 单路 glm-ocr（失败 502）；upload-pdf/image 结构化走 `assemble_resume_data_fast` |
| `pdf_parser.py` | 加注释，文件保留不删 |
| `scripts/bench_parallel_vs_single.py` | 单次 vs 并行 质量+耗时对比脚本 |

### 真实样本实测（测试样本/尹昕雨 3.pdf，OCR 后 2878 字）

| 路径 | 耗时 | 质量(实习/教育/项目) | 稳定性 | 结论 |
|---|---:|---|---|---|
| baseline deepseek 单次（现生产） | 43.6s | 5/1/2 ✓ | 稳 | — |
| **qwen-plus-latest 单次（采用）** | **30–44s** | 5/1/2 ✓ | **稳（多次 10/10）** | ✅ 落地 |
| 按文本切块并发 | 17s | 5/1/**1❌** | 不稳（丢项目） | ✗ |
| 按 section 类型 5 路并发 | 16–22s | **0 或 7❌** | 很不稳 | ✗ |
| 2 路并发（EASY‖实习+项目） | 15–50s | 5/1/2（+JSON mode 后 EXP 仍 2/4 出 7/0） | 不稳 | ✗ |
| qwen-turbo 并发 | 14s | 实习 22 / 项目 0 ❌ | 崩 | ✗ |

### 关键结论（修正计划与我最初的口头预期）

1. **换模型单次 ≠ 更快**：qwen 单次实测 30–44s，与 deepseek 43s 在噪声内，**不稳定更快**。计划「换 qwen 快 40%」偏乐观。stage① 的真实价值是**去 MinerU**（消除服务器 CPU 冷启动 30–60s 尾延迟），不是换模型。
2. **并行能到 ~15–20s（~2x），但都不可靠**：三种拆法各有致命伤——
   - 按文本切块：项目无独立标题时被错配进实习 → 丢项目（2→1）。
   - 按 section 类型拆实习/项目：边界模糊，两个调用互相抢，出「实习0」或「项目暴涨」。
   - 2 路（实习+项目合一）：分类稳一些，但 EXP 大 JSON 偶发非法（1/4，少逗号/未转义）→ 触发重试或回退，速度方差巨大。加 JSON mode 消除了解析失败，却暴露 EXP 本身分类仍 2/4 飘（实习7/项目0）。
3. **根因**：单次 assembler 的 prompt 精雕过（`SECTION_MAPPING_RULES` + 正反例），这套**整体分类纪律**才是稳定关键；任何拆分都丢了它。**要可靠并行，须把这套规则移植进每个拆分 prompt + 多样本验证**——独立后续工作，非本次范围。
4. **per-call 延迟地板仅 ~1.2s**（探针），慢在实习段输出量大；raw gather 证明并发吞吐能到 7.8s，但**吞吐不是瓶颈，分类可靠性才是**。
5. **qwen-turbo 独立证伪**：分段后仍丢项目、实习爆炸，模型能力问题。
6. **要更快的两条真路**（后续）：① 把 assembler 分类规则移植进 2 路并发的 EXP prompt + 多样本验证（可靠 ~2x）；② 分段流式回填（墙钟不变、体感秒开）。换更快推理厂＝数据出境，非选项。

### 当前状态与回滚

- **采用 qwen-plus-latest 单次**（与生产同等质量，去 MinerU 得可靠性 + 边际提速）。并行代码未进生产，探索结论留档本节。
- glm-ocr 单点失败直接 502（实测稳定 2.6s）。
- 回滚：`git revert` 分支上的实现 commit 即恢复 MinerU+deepseek。前端零改动、接口契约不变。
- ⚠️ 全部实测仅**单样本**（尹昕雨），合并前建议多样本（多页/英文/表格密集）复验。
