# 图片解析导入简历 — 设计文档

**日期：** 2026-06-19
**状态：** 待审批
**分支：** feature/06-19/03

---

## 背景

用户经常收到别人发来的「简历截图/图片」（如微信转发的简历 PNG/JPG），希望能像粘贴文本、上传 PDF 一样，**上传一张简历图片就自动解析成结构化简历并导入编辑器**。

当前导入入口 `AIImportModal` 支持两种方式：

- **文件上传（PDF）** → `POST /api/resume/upload-pdf`（MinerU + glm-ocr 双路 → DeepSeek 结构化）
- **文本粘贴** → `POST /api/resume/parse/stream`（流式结构化）

图片导入是第三种数据源，技术上可复用现有「文本 → 结构化简历 JSON」链路，只需在前面加一步「图片 → 文本」的视觉识别。

### 可行性实测结论（2026-06-19）

| 模型 | 鉴权 | 余额 | 图片识别 |
|---|---|---|---|
| 智谱 glm-ocr | ✅ | ❌ 余额不足(429/1113) | 不可用 |
| 智谱 glm-4.6v | ✅ | ❌ 余额不足 | 不可用 |
| **千问 qwen-vl-max（DashScope）** | ✅ | ✅ 有余额 | ✅ 实测真实简历图近乎 100% 还原 |

已用真实简历图做**端到端验证**：`图片 → qwen-vl-max 识别 → 现有 /api/resume/parse/stream → 结构化 JSON`，姓名/求职意向/教育/实习/项目/技能/奖项全部正确。

---

## 目标

- 用户在导入弹窗的「文件上传」可以上传 **图片（JPG/PNG）**，解析为结构化简历并导入。
- **视觉模型由用户选择**：千问 qwen-vl（默认，现可用）/ 智谱 glm-ocr / 智谱 glm-4.6v（保留，账户充值后生效）。
- 复用现有结构化链路与导入数据流，PDF 老路径零改动。

## 非目标（YAGNI）

- 支持最多 2 张图片一次上传（适用两页简历分两张图）；超过 2 张后端拒绝。更多张暂不支持。
- 不支持 WEBP/HEIC（glm/qwen 不一定收，需转码，超出本次范围）。
- 不在图片模式暴露「结构化模型」选择，固定用现有 `deepseek-v4-flash`，保持 UI 简单。
- 不做「智谱无余额自动回退千问」的兜底分支（违反 CLAUDE.md「不写 plan-B 回退」纪律）；改为用户显式选择。

---

## 方案总览

```
图片(JPG/PNG)
  │  前端 FileUploadZone 接受图片，按类型调 upload-image
  ▼
POST /api/resume/upload-image  (file + model=视觉模型id)
  │  ① 校验图片类型/大小
  │  ② 按 model 分流：qwen-vl→DashScope / glm-ocr|glm-4.6v→智谱   （图片→文本）
  │  ③ 文本送入现有 normalize + parse 结构化                      （文本→简历JSON）
  ▼
返回简历 JSON（与 upload-pdf 同构）→ 前端 setParsedData → 确认并填充
```

核心思想：**新增「图片→文本」一步，下游结构化完全复用现有代码。**

---

## Section 1：视觉模型选择（前端）

`AIImportModal.tsx` 现有 `AI_MODELS` 常量用于结构化模型下拉。本次新增一组**视觉模型**，仅在「文件上传」选中的是图片时展示：

```ts
const VISION_MODELS = [
  { id: "qwen-vl-max", name: "通义千问 VL", description: "图片识别（推荐，可用）", logoUrl: QWEN_LOGO_URL },
  { id: "glm-ocr",     name: "智谱 GLM-OCR", description: "文档 OCR（需账户充值）", logoUrl: ZHIPU_LOGO_URL, needRecharge: true },
  { id: "glm-4.6v",    name: "智谱 GLM-4.6V", description: "通用视觉（需账户充值）", logoUrl: ZHIPU_LOGO_URL, needRecharge: true },
]
```

- 默认 `selectedVisionModel = "qwen-vl-max"`。
- 智谱两项渲染灰字「需充值」标记（`needRecharge`），用户仍可选；选中后若后端返回余额不足，前端弹提示引导改选千问。
- PDF 与文本模式不受影响，仍用原 `AI_MODELS`（结构化模型）。

## Section 2：上传与分流（前端）

- `FileUploadZone.tsx`：
  - `accept` 由写死的 `'application/pdf'` 改为支持集合：`['application/pdf','image/jpeg','image/png']`（通过 props 传入，保持组件通用）。
  - `validateFile` 由严格相等改为「在允许集合内」校验；提示文案相应更新为「支持 PDF / JPG / PNG」。
- `AIImportModal.tsx` 的 `handleUpload`：按 `selectedFile.type` 分流——
  - `application/pdf` → 现有 `handlePdfUpload`（不变）
  - `image/*` → 新 `handleImageUpload`：调 `/api/resume/upload-image`，带 `model = selectedVisionModel`。
- 返回消费逻辑与 PDF 完全一致：`setParsedData(result.resume || result.data || result)` → `setCurrentStep("results")`。

## Section 3：后端接口

新增 `POST /api/resume/upload-image`（`backend/routes/resume.py`），与 `upload-pdf` 同构：

```
入参: file: UploadFile, model: str = Form(...)
流程:
  1. 校验 file.content_type ∈ {image/jpeg, image/png}，否则 400
  2. 校验大小 ≤ 10MB，否则 413
  3. image_to_text(bytes, content_type, model):
       - model 以 "qwen" 开头 → DashScope qwen-vl（OpenAI 兼容 chat/completions，image_url=data uri）
       - model in {glm-ocr} → 智谱 layout_parsing（复用 recognize_with_ocr，加 mime 参数）
       - model in {glm-4.6v} → 智谱 chat/completions 视觉
  4. 复用现有 normalize_pasted_resume_text + 结构化解析 → 简历 JSON
  5. 返回 {resume: <ResumeData>}（与 upload-pdf 一致）
```

涉及的现有函数小改：

- `backend/services/zhipu_layout.py::recognize_with_ocr`：当前 MIME 写死 `application/pdf`，**加 `mime: str = "application/pdf"` 参数**，使其同时支持 `image/png`、`image/jpeg`。
- `image_to_text` 的 qwen-vl 分支为新增逻辑，封装在 resume 服务层（参考 `simple.py` 的 DashScope 调用方式，复用 `DASHSCOPE_API_KEY` / base url）。

**不改动** `upload-pdf`，PDF 链路零回归。

## Section 4：错误处理（遵守「不兜底」纪律）

- 系统边界校验保留：非图片类型 400、超 10MB 413、视觉接口非 200 → 原样抛错带 detail。
- **不做自动回退**：用户选智谱但账户无余额 → 后端返回「余额不足」detail，前端 `alert` 提示「该模型余额不足，请改用通义千问 VL」。这是显式选择下的真实错误反馈，不是 plan-B 分支。
- 与现有 `handlePdfUpload` 一致：异常走 `catch` → `alert(err.message)` → 停在输入态。

## Section 5：影响范围对照（CLAUDE.md 强制清单）

| 文件 | 改动 |
|---|---|
| `frontend/src/pages/Workspace/v2/shared/AIImportModal.tsx` | 新增 VISION_MODELS、图片模式选择器、handleImageUpload、按类型分流 |
| `frontend/src/pages/Workspace/v2/shared/FileUploadZone.tsx` | accept/validateFile 支持图片集合，提示文案更新 |
| `frontend/src/services/api.ts` | 新增 `uploadResumeImage(file, model)` 封装 |
| `backend/routes/resume.py` | 新增 `POST /api/resume/upload-image` |
| `backend/services/zhipu_layout.py` | `recognize_with_ocr` 增 `mime` 参数 |
| `backend/services/`（resume 相关）| 新增 `image_to_text` 视觉识别（qwen-vl / glm 分流）|

无需改动：App.tsx 路由、工作台布局、resumeStorage、runtimeEnv（沿用现有导入数据流）。

---

## 验证计划（CLAUDE.md 阶段三）

**后端三路：**
- golden：李嘉真实简历图 + qwen-vl-max → 结构化 JSON 正确。
- 边界：非图片文件 → 400；>10MB → 413。
- 错误：model=glm-ocr（无余额）→ 返回余额不足 detail。

**前端浏览器实测：**
- 「我的简历 → 导入 → 文件上传」上传图片 → 选千问 → 解析成功出「确认并填充」→ 点击后编辑器各模块数据正确。
- 选智谱 → 弹「余额不足，请改用千问」提示。
- PDF、文本两种老方式回归正常。

---

## 后续可选（非本次）

- 智谱账户充值后，glm-ocr 自动可用，无需改代码。
- 多图/多页合并、WEBP/HEIC 转码、图片模式也可选结构化模型。
