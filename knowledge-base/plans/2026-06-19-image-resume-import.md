# 图片解析导入简历 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在导入弹窗上传简历图片(JPG/PNG)，经用户选择的视觉模型识别后结构化为简历并导入编辑器。

**Architecture:** 新增「图片→文本」一步（视觉模型可选：qwen-vl-max 默认 / glm-ocr 智谱），文本下游完全复用现有 `assemble_resume_data + normalize_resume_json` 结构化链路；新增 `POST /api/resume/upload-image`，与 `upload-pdf` 同构返回 `{resume}`；前端 `FileUploadZone` 放开图片类型，`AIImportModal` 图片模式展示视觉模型选择器并按文件类型分流。PDF 老路径零改动。

**Tech Stack:** FastAPI / Python（后端 httpx 调 DashScope qwen-vl & 智谱 layout_parsing）、React + TypeScript + Vite（前端）、pytest（后端测试）。

**对应 spec：** `knowledge-base/specs/2026-06-19-image-resume-import-design.md`

**计划级决定（相对 spec 的微调，附理由）：**
- 前端图片上传**内联 fetch**镜像现有 `handlePdfUpload`，不新增 `api.ts::uploadResumeImage`（现有 PDF 上传就是内联，避免平行实现，遵守 CLAUDE.md「不新增平行实现」）。
- MVP 视觉模型只接 **qwen-vl-max（默认）+ glm-ocr（智谱）** 两项；spec 中 `glm-4.6v` 推迟（YAGNI，和 glm-ocr 同属智谱且账户当前无余额，后续加一个分支即可）。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `backend/services/vision_ocr.py` | 视觉识别：模型→provider 路由 + qwen-vl 调用 | 新建 |
| `backend/services/zhipu_layout.py` | `recognize_with_ocr` 增 `mime` 参数支持图片 | 改 |
| `backend/routes/resume.py` | 新增 `POST /api/resume/upload-image` | 改 |
| `backend/tests/test_vision_ocr.py` | vision_ocr 单元测试 | 新建 |
| `backend/tests/test_upload_image_route.py` | 上传接口测试（离线 monkeypatch） | 新建 |
| `frontend/src/pages/Workspace/v2/shared/FileUploadZone.tsx` | accept/校验/文案支持图片 | 改 |
| `frontend/src/pages/Workspace/v2/shared/AIImportModal.tsx` | 视觉模型选择器 + handleImageUpload + 按类型分流 | 改 |

---

## Task 1: 后端 — 视觉识别模块 vision_ocr.py

**Files:**
- Create: `backend/services/vision_ocr.py`
- Test: `backend/tests/test_vision_ocr.py`

- [ ] **Step 1: 写失败测试（provider 路由）**

```python
# backend/tests/test_vision_ocr.py
import pytest
from backend.services.vision_ocr import resolve_vision_provider


def test_qwen_routes_to_qwen():
    assert resolve_vision_provider("qwen-vl-max") == "qwen"


def test_glm_ocr_routes_to_zhipu_ocr():
    assert resolve_vision_provider("glm-ocr") == "zhipu_ocr"


def test_unknown_model_raises():
    with pytest.raises(ValueError):
        resolve_vision_provider("gpt-4o")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/mac/开源工具/Resume-Agent && python -m pytest backend/tests/test_vision_ocr.py -v`
Expected: FAIL（ModuleNotFoundError: backend.services.vision_ocr）

- [ ] **Step 3: 写最小实现**

```python
# backend/services/vision_ocr.py
"""简历图片视觉识别：图片 bytes → 文本（Markdown）。

支持的视觉模型：
- qwen-vl-max（默认，DashScope，OpenAI 兼容 chat/completions）
- glm-ocr（智谱 layout_parsing，复用 zhipu_layout.recognize_with_ocr）
"""
from __future__ import annotations

import base64
import os

import httpx

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_BASE_URL = os.getenv(
    "DEEPSEEK_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
)

VISION_OCR_PROMPT = (
    "你是简历OCR助手。请逐字、忠实地提取这张简历图片中的全部文字内容，"
    "保持原有层级结构（姓名、求职意向、专业概况、教育经历、实习经历、项目经历、"
    "竞赛科研、技能等），用 Markdown 输出。"
    "严禁编造、推测或修改任何信息；看不清的地方原样标注[?]，不要脑补。"
)

# 支持的图片 MIME
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png"}


def resolve_vision_provider(model: str) -> str:
    """把视觉模型 id 映射到 provider 标识。未知模型抛 ValueError。"""
    if model.startswith("qwen"):
        return "qwen"
    if model == "glm-ocr":
        return "zhipu_ocr"
    raise ValueError(f"不支持的视觉模型: {model}")


def _qwen_vl_ocr(image_bytes: bytes, content_type: str, model: str) -> str:
    """用 DashScope qwen-vl 把图片识别成文本。"""
    if not DASHSCOPE_API_KEY:
        raise ValueError("DASHSCOPE_API_KEY 未配置")
    data_uri = f"data:{content_type};base64,{base64.b64encode(image_bytes).decode()}"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            }
        ],
    }
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            f"{DASHSCOPE_BASE_URL}/chat/completions", json=payload, headers=headers
        )
    if resp.status_code != 200:
        raise ValueError(f"qwen-vl 识别失败 (HTTP {resp.status_code}): {resp.text}")
    return resp.json()["choices"][0]["message"]["content"]


def image_to_text(image_bytes: bytes, content_type: str, model: str) -> str:
    """图片 → 文本。按 model 分流到对应视觉 provider。"""
    provider = resolve_vision_provider(model)
    if provider == "qwen":
        return _qwen_vl_ocr(image_bytes, content_type, model)
    if provider == "zhipu_ocr":
        try:
            from backend.services.zhipu_layout import recognize_with_ocr
        except ImportError:
            from services.zhipu_layout import recognize_with_ocr
        return recognize_with_ocr(image_bytes, mime=content_type)
    raise ValueError(f"未知 provider: {provider}")
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m pytest backend/tests/test_vision_ocr.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: 加 qwen-vl HTTP 调用测试（monkeypatch，离线）**

```python
# 追加到 backend/tests/test_vision_ocr.py
from backend.services import vision_ocr


def test_qwen_vl_ocr_builds_image_payload(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200
        text = ""

        def json(self):
            return {"choices": [{"message": {"content": "识别文本"}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json, headers):
            captured["url"] = url
            captured["json"] = json
            return FakeResp()

    monkeypatch.setattr(vision_ocr, "DASHSCOPE_API_KEY", "test-key")
    monkeypatch.setattr(vision_ocr.httpx, "Client", FakeClient)

    out = vision_ocr.image_to_text(b"\x89PNG", "image/png", "qwen-vl-max")

    assert out == "识别文本"
    content = captured["json"]["messages"][0]["content"]
    assert content[1]["image_url"]["url"].startswith("data:image/png;base64,")
    assert captured["url"].endswith("/chat/completions")
```

- [ ] **Step 6: 运行测试确认通过**

Run: `python -m pytest backend/tests/test_vision_ocr.py -v`
Expected: PASS（4 passed）

- [ ] **Step 7: 提交**

```bash
git add backend/services/vision_ocr.py backend/tests/test_vision_ocr.py
git commit -m "feat(backend): 新增 vision_ocr 视觉识别模块(qwen-vl/glm-ocr 路由)"
```

---

## Task 2: 后端 — recognize_with_ocr 支持图片 MIME

**Files:**
- Modify: `backend/services/zhipu_layout.py:301-321`
- Test: `backend/tests/test_zhipu_ocr_mime.py`（Create）

- [ ] **Step 1: 写失败测试（mime 透传到 data URI）**

```python
# backend/tests/test_zhipu_ocr_mime.py
from backend.services import zhipu_layout


def test_recognize_with_ocr_uses_image_mime(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200

        def json(self):
            return {"md_results": "OCR文本"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, json, headers):
            captured["file"] = json["file"]
            return FakeResp()

    monkeypatch.setattr(zhipu_layout, "ZHIPU_API_KEY", "test-key")
    monkeypatch.setattr(zhipu_layout.httpx, "Client", FakeClient)

    out = zhipu_layout.recognize_with_ocr(b"\x89PNG", mime="image/png")

    assert out == "OCR文本"
    assert captured["file"].startswith("data:image/png;base64,")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m pytest backend/tests/test_zhipu_ocr_mime.py -v`
Expected: FAIL（TypeError: recognize_with_ocr() got unexpected keyword argument 'mime'）

- [ ] **Step 3: 改实现（加 mime 参数）**

在 `backend/services/zhipu_layout.py` 修改函数签名与 data URI 构造：

```python
# 原签名（约 301 行）
def recognize_with_ocr(
    pdf_bytes: bytes,
    api_key: Optional[str] = None,
) -> str:
```

改为：

```python
def recognize_with_ocr(
    pdf_bytes: bytes,
    api_key: Optional[str] = None,
    mime: str = "application/pdf",
) -> str:
```

原 data URI 构造（约 319-321 行）：

```python
    # 将 PDF 转为 base64 data URI
    pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
    file_data = f"data:application/pdf;base64,{pdf_base64}"
```

改为：

```python
    # 将文件转为 base64 data URI（支持 PDF 与图片）
    pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
    file_data = f"data:{mime};base64,{pdf_base64}"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `python -m pytest backend/tests/test_zhipu_ocr_mime.py -v`
Expected: PASS

- [ ] **Step 5: 回归——确认默认仍是 PDF**

Run: `python -m pytest backend/tests/test_zhipu_ocr_mime.py backend/tests/test_vision_ocr.py -v`
Expected: 全部 PASS（mime 默认 `application/pdf`，PDF 调用方无需改动）

- [ ] **Step 6: 提交**

```bash
git add backend/services/zhipu_layout.py backend/tests/test_zhipu_ocr_mime.py
git commit -m "feat(backend): recognize_with_ocr 支持图片 mime 参数"
```

---

## Task 3: 后端 — POST /api/resume/upload-image

**Files:**
- Modify: `backend/routes/resume.py`（在 `upload-pdf` 路由之后新增）
- Test: `backend/tests/test_upload_image_route.py`（Create）

- [ ] **Step 1: 写失败测试（离线，monkeypatch 视觉与组装）**

```python
# backend/tests/test_upload_image_route.py
import io

from fastapi.testclient import TestClient

from backend.main import app
import backend.routes.resume as resume_routes

client = TestClient(app)


def _patch(monkeypatch):
    monkeypatch.setattr(
        resume_routes, "image_to_text", lambda b, ct, m: "王宇 后端开发工程师"
    )
    monkeypatch.setattr(
        resume_routes,
        "assemble_resume_data",
        lambda raw_text, layout, ocr_text, model: {"name": "王宇"},
    )
    monkeypatch.setattr(
        resume_routes, "normalize_resume_json", lambda d: {"name": "王宇", "skills": []}
    )


def test_upload_image_golden(monkeypatch):
    _patch(monkeypatch)
    files = {"file": ("r.png", io.BytesIO(b"\x89PNG"), "image/png")}
    resp = client.post(
        "/api/resume/upload-image", files=files, data={"model": "qwen-vl-max"}
    )
    assert resp.status_code == 200
    assert resp.json()["resume"]["name"] == "王宇"


def test_upload_image_rejects_non_image(monkeypatch):
    _patch(monkeypatch)
    files = {"file": ("r.pdf", io.BytesIO(b"%PDF"), "application/pdf")}
    resp = client.post(
        "/api/resume/upload-image", files=files, data={"model": "qwen-vl-max"}
    )
    assert resp.status_code == 400
```

- [ ] **Step 2: 运行测试确认失败**

Run: `python -m pytest backend/tests/test_upload_image_route.py -v`
Expected: FAIL（404 Not Found，路由未定义）

- [ ] **Step 3: 在 routes/resume.py 顶部补导入**

确认/补充以下导入（`assemble_resume_data` 已被 upload-pdf 使用，确认 import 存在；新增 `image_to_text`）：

```python
try:
    from backend.services.vision_ocr import image_to_text, SUPPORTED_IMAGE_TYPES
except ImportError:
    from services.vision_ocr import image_to_text, SUPPORTED_IMAGE_TYPES
```

> 注：`assemble_resume_data` 与 `normalize_resume_json` 在 `upload-pdf` 中已有导入路径（`normalize_resume_json` 为函数内 import）。测试用 monkeypatch 在 `resume_routes` 模块名下替换，故实现里需把 `normalize_resume_json` 提到模块顶层 import，便于打桩：

```python
try:
    from backend.json_normalizer import normalize_resume_json
except ImportError:
    from json_normalizer import normalize_resume_json
```

- [ ] **Step 4: 新增路由实现（紧跟 upload-pdf 之后）**

```python
@router.post("/resume/upload-image")
async def upload_resume_image(
    file: UploadFile = File(...),
    model: str = Form(default="qwen-vl-max"),
):
    """上传简历图片(JPG/PNG)，经视觉模型识别 + 结构化为简历 JSON。

    与 /resume/upload-pdf 同构返回 {"resume": ...}。
    视觉模型由前端传入：qwen-vl-max（默认）/ glm-ocr。
    """
    if file.content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 JPG / PNG 图片")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="文件为空")
    if len(image_bytes) > MAX_PDF_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413, detail=f"文件过大，最大支持 {MAX_PDF_SIZE_MB}MB"
        )

    # 步骤1：图片 → 文本（视觉识别）
    try:
        ocr_text = image_to_text(image_bytes, file.content_type, model)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"图片识别失败: {e}")
    if not ocr_text.strip():
        raise HTTPException(status_code=422, detail="未识别到文字，请换清晰的图片")

    # 步骤2：文本 → 结构化简历（复用 PDF 同款组装）
    try:
        resume_data = assemble_resume_data(
            raw_text=ocr_text, layout={}, ocr_text=ocr_text, model=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"简历结构化失败: {e}")

    try:
        normalized = normalize_resume_json(resume_data)
        return {"resume": normalized, "provider": model}
    except Exception as e:
        logger.warning(f"JSON 标准化失败: {e}")
        return {"resume": resume_data, "provider": model}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `python -m pytest backend/tests/test_upload_image_route.py -v`
Expected: PASS（2 passed）

- [ ] **Step 6: 提交**

```bash
git add backend/routes/resume.py backend/tests/test_upload_image_route.py
git commit -m "feat(backend): 新增 /api/resume/upload-image 图片解析导入接口"
```

---

## Task 4: 前端 — FileUploadZone 支持图片

**Files:**
- Modify: `frontend/src/pages/Workspace/v2/shared/FileUploadZone.tsx`

- [ ] **Step 1: 改 accept 默认值与多类型校验**

把 props 默认 `accept` 从单值改为支持集合。修改 `FileUploadZoneProps` 与函数默认值（约 4-22 行）：

```tsx
interface FileUploadZoneProps {
  file: File | null
  onFileSelect: (file: File | null) => void
  maxSizeMb?: number
  /** 允许的 MIME 列表 */
  acceptTypes?: string[]
  /** input accept 属性字符串 */
  acceptAttr?: string
  /** 提示文案，如「PDF / JPG / PNG」 */
  hintLabel?: string
}

export function FileUploadZone({
  file,
  onFileSelect,
  maxSizeMb = 10,
  acceptTypes = ['application/pdf'],
  acceptAttr = '.pdf',
  hintLabel = 'PDF',
}: FileUploadZoneProps) {
```

- [ ] **Step 2: 改 validateFile 为集合校验**

把严格相等改为包含校验（约 27-37 行）：

```tsx
  const validateFile = (nextFile: File) => {
    if (!acceptTypes.includes(nextFile.type)) {
      alert(`仅支持 ${hintLabel} 文件`)
      return false
    }
    if (nextFile.size > maxBytes) {
      alert(`文件过大，最大支持 ${maxSizeMb}MB`)
      return false
    }
    return true
  }
```

- [ ] **Step 3: input accept 与提示文案用 props**

把写死的 `<input accept=".pdf">`（约 78 行）改为：

```tsx
        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
```

把提示文案（约 122 行「点击或拖拽 PDF 文件到此处上传」）改为：

```tsx
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                点击或拖拽 {hintLabel} 文件到此处上传
              </p>
```

- [ ] **Step 4: 构建验证**

Run: `cd frontend && npm run build`
Expected: 构建成功（无 TS 报错）。注意：现有调用方 `AIImportModal` 未传新 props，使用默认值仍为 PDF，行为不变。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/pages/Workspace/v2/shared/FileUploadZone.tsx
git commit -m "feat(frontend): FileUploadZone 支持自定义文件类型(为图片导入铺垫)"
```

---

## Task 5: 前端 — AIImportModal 图片模式与视觉模型选择

**Files:**
- Modify: `frontend/src/pages/Workspace/v2/shared/AIImportModal.tsx`

- [ ] **Step 1: 新增视觉模型常量与状态**

在 `AI_MODELS`（约 39 行后）补充视觉模型列表与 logo 常量（沿用 `DEEPSEEK_LOGO_URL` 同款定义方式，新增千问/智谱 logo URL，取官方公开 logo 或现有 assets）：

```tsx
const QWEN_LOGO_URL =
  "https://img.alicdn.com/imgextra/i1/O1CN01Qwen.png"; // 占位：替换为项目可用的千问 logo（见 Step 1 备注）
const ZHIPU_LOGO_URL =
  "https://www.zhipuai.cn/favicon.ico"; // 占位：替换为项目可用的智谱 logo

const VISION_MODELS = [
  {
    id: "qwen-vl-max",
    name: "通义千问 VL",
    description: "图片识别（推荐，可用）",
    logoUrl: QWEN_LOGO_URL,
    needRecharge: false,
  },
  {
    id: "glm-ocr",
    name: "智谱 GLM-OCR",
    description: "文档 OCR（需账户充值）",
    logoUrl: ZHIPU_LOGO_URL,
    needRecharge: true,
  },
];
```

> 备注：logo URL 若无现成可用资源，可先用 `Wand2` 兜底（组件已有 `logoUrl ? <img> : <Wand2/>` 分支），把 `logoUrl` 设为空字符串即可，不阻塞功能。

在组件 state 区（`selectedModel` 附近，约 96 行）新增：

```tsx
  const [selectedVisionModel, setSelectedVisionModel] = useState("qwen-vl-max");
```

- [ ] **Step 2: 新增 handleImageUpload（内联 fetch，镜像 handlePdfUpload）**

在 `handlePdfUpload` 之后新增（约 285 行后）。结构与 `handlePdfUpload` 完全一致，仅接口与 model 字段不同：

```tsx
  const handleImageUpload = async () => {
    if (!selectedFile) return;
    setParsing(true);
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("model", selectedVisionModel);

      const response = await fetch(
        `${getApiBaseUrl()}/api/resume/upload-image`,
        { method: "POST", body: formData },
      );

      if (!response.ok) {
        let errMsg = "解析失败";
        try {
          const err = await response.json();
          errMsg = err.detail || errMsg;
        } catch {
          errMsg = `HTTP ${response.status}`;
        }
        throw new Error(errMsg);
      }

      const result = await response.json();
      setParsedData(result.resume || result.data || result);
      setCurrentStep("results");
    } catch (err: any) {
      console.error("图片解析失败:", err);
      alert("解析失败: " + err.message);
    } finally {
      setParsing(false);
    }
  };
```

- [ ] **Step 3: 上传区按文件类型分流 + 传图片 accept 给 FileUploadZone**

定位文件上传分支 `{importMode === "file" && (...)}`（约 627 行）。把 `FileUploadZone` 调用改为接受图片，并把底部按钮按文件类型分流：

```tsx
                          <FileUploadZone
                            file={selectedFile}
                            onFileSelect={setSelectedFile}
                            acceptTypes={[
                              "application/pdf",
                              "image/jpeg",
                              "image/png",
                            ]}
                            acceptAttr=".pdf,.jpg,.jpeg,.png"
                            hintLabel="PDF / JPG / PNG"
                          />
```

底部「上传解析 PDF」按钮（约 643-651 行）改为按类型分流：

```tsx
                        <button
                          type="button"
                          onClick={
                            selectedFile && selectedFile.type.startsWith("image/")
                              ? handleImageUpload
                              : handlePdfUpload
                          }
                          disabled={!selectedFile || parsing}
                          className={cn(
                            "w-full rounded-lg px-4 py-2.5 text-sm font-semibold flex-shrink-0",
                            "bg-slate-900 text-white shadow-lg shadow-slate-200",
                            "hover:bg-slate-800",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "transition-all",
                          )}
                        >
                          {parsing
                            ? "解析中..."
                            : selectedFile && selectedFile.type.startsWith("image/")
                              ? "识别图片并解析"
                              : "上传解析 PDF"}
                        </button>
```

- [ ] **Step 4: 图片选中时展示视觉模型选择器**

在文件上传区内、`FileUploadZone` 上方插入「仅当选中图片时显示」的视觉模型下拉。复用现有模型选择器的样式结构（参考 490-585 行的 `AI_MODELS` 选择器），但绑定 `selectedVisionModel`/`setSelectedVisionModel` 和 `VISION_MODELS`，并对 `needRecharge` 显示灰字标记：

```tsx
                        {selectedFile?.type.startsWith("image/") && (
                          <div className="flex-shrink-0 space-y-2">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              选择识别模型
                            </div>
                            <div className="flex gap-2">
                              {VISION_MODELS.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setSelectedVisionModel(m.id)}
                                  className={cn(
                                    "flex-1 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                                    selectedVisionModel === m.id
                                      ? "border-slate-900 bg-purple-50 dark:bg-purple-900/20"
                                      : "border-slate-200 dark:border-slate-700",
                                  )}
                                >
                                  <div className="font-semibold text-slate-800 dark:text-slate-100">
                                    {m.name}
                                  </div>
                                  <div
                                    className={cn(
                                      "mt-0.5",
                                      m.needRecharge
                                        ? "text-amber-500"
                                        : "text-slate-500 dark:text-slate-400",
                                    )}
                                  >
                                    {m.description}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
```

- [ ] **Step 5: 构建验证**

Run: `cd frontend && npm run build`
Expected: 构建成功，无 TS 报错。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/Workspace/v2/shared/AIImportModal.tsx
git commit -m "feat(frontend): 导入弹窗支持图片上传与视觉模型选择"
```

---

## Task 6: 端到端验证（CLAUDE.md 阶段三）

**Files:** 无（验证任务）

- [ ] **Step 1: 确保后端 9000 / 前端 5173 在跑**

```bash
lsof -nP -iTCP:9000 -sTCP:LISTEN | tail -n +2   # 应为本项目 uvicorn
lsof -nP -iTCP:5173 -sTCP:LISTEN | tail -n +2   # 应为 vite
```
（若 9000 被占，先释放再 `python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000`）

- [ ] **Step 2: 后端真实 key 端到端（golden）**

用真实简历图（如 `/tmp/lijia_resume.png`）打接口：

```bash
curl -s -X POST http://127.0.0.1:9000/api/resume/upload-image \
  -F "file=@/tmp/lijia_resume.png;type=image/png" \
  -F "model=qwen-vl-max" | python3 -c "import sys,json;d=json.load(sys.stdin);r=d['resume'];print('name:',r.get('name'));print('edu:',[e.get('title') for e in r.get('education',[])])"
```
Expected: 打印出正确的 name 与教育经历。

- [ ] **Step 3: 后端错误路径**

```bash
# 非图片 → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:9000/api/resume/upload-image -F "file=@/tmp/lijia_resume.png;type=application/pdf" -F "model=qwen-vl-max"
# 智谱无余额 → 502 + 余额不足
curl -s -X POST http://127.0.0.1:9000/api/resume/upload-image -F "file=@/tmp/lijia_resume.png;type=image/png" -F "model=glm-ocr" | head -c 200
```
Expected: 第一条 400；第二条返回含「余额不足」的 502 detail。

- [ ] **Step 4: 前端浏览器实测**

用 playwright/手动：我的简历 → 导入 → 文件上传 → 选图片 → 出现「选择识别模型」(默认通义千问) → 点「识别图片并解析」→ 解析成功出「确认并填充」→ 点击 → 编辑器各模块数据正确。再选「智谱 GLM-OCR」→ 解析报「余额不足」提示。最后回归 PDF、文本两种老方式正常。

- [ ] **Step 5: 跑全部后端新测试**

Run: `python -m pytest backend/tests/test_vision_ocr.py backend/tests/test_zhipu_ocr_mime.py backend/tests/test_upload_image_route.py -v`
Expected: 全部 PASS。

- [ ] **Step 6: 调用 verification-before-completion 并收尾**

确认验证闭环后，按 CLAUDE.md 阶段四：必要时更新 `knowledge-base/`，保持文档一致；不 push。

---

## Self-Review

**Spec 覆盖：**
- 视觉识别图片→文本 → Task 1 ✅
- 智谱 OCR 支持图片 → Task 2 ✅
- upload-image 接口 + 复用结构化 → Task 3 ✅
- 前端图片上传 → Task 4 ✅
- 视觉模型用户可选 + 智谱「需充值」标记 + 按类型分流 → Task 5 ✅
- 不兜底（错误显式反馈）→ Task 3 Step 4（502 抛错）+ Task 5（alert）✅
- 三路验证 → Task 6 ✅
- **偏差记录**：spec 的 `glm-4.6v` 推迟（计划顶部已注明，YAGNI）；spec 的 `api.ts::uploadResumeImage` 改为内联 fetch（计划顶部已注明，遵循现有 handlePdfUpload 模式）。两处均为有意微调，非遗漏。

**占位扫描：** 仅 logo URL 为占位，Step 1 已给出兜底方案（置空走 Wand2 图标），不阻塞。

**类型一致性：** `image_to_text(image_bytes, content_type, model)`、`resolve_vision_provider(model)`、`recognize_with_ocr(pdf_bytes, api_key, mime)`、前端 `selectedVisionModel` / `handleImageUpload` 在各任务间签名一致。后端路由 monkeypatch 的 `image_to_text`/`assemble_resume_data`/`normalize_resume_json` 均在 `resume_routes` 模块顶层可见（Task 3 Step 3 已要求顶层 import）。
