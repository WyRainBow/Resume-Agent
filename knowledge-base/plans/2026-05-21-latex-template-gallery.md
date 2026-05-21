# LaTeX Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LaTeX-only resume template gallery where each template owns an independent backend renderer and users can create or switch resumes by template.

**Architecture:** Backend introduces a LaTeX template registry and renderer contract. PDF routes resolve `template_id` to a registered renderer and template asset directory. Frontend adds a `/templates` gallery, sends template IDs through PDF render requests, and preserves `templateId` in saved `ResumeData`.

**Tech Stack:** FastAPI, Pydantic, XeLaTeX, React 18, TypeScript, Vite, Tailwind CSS, lucide-react.

**Spec:** `knowledge-base/specs/2026-05-21-latex-template-gallery-design.md`

---

## Hard Gate

- Code implementation must happen on a new branch.
- Do not include unrelated staged or untracked files in commits.
- If Git reports the repository has no baseline commit or unrelated staged files block clean commits, stop and ask the user before continuing.

---

## File Structure

### Create

| Path | Responsibility |
|---|---|
| `backend/resume_templates/__init__.py` | Template package marker. |
| `backend/resume_templates/latex/__init__.py` | LaTeX template package marker and public exports. |
| `backend/resume_templates/latex/base.py` | Renderer and metadata contracts. |
| `backend/resume_templates/latex/registry.py` | Registered template lookup, manifest loading, preview path resolution. |
| `backend/resume_templates/latex/classic/manifest.json` | Manifest for the current LaTeX template. |
| `backend/resume_templates/latex/classic/renderer.py` | Compatibility renderer for current `json_to_latex()` behavior. |
| `backend/resume_templates/latex/compact/manifest.json` | Manifest for a compact demonstration template. |
| `backend/resume_templates/latex/compact/renderer.py` | Compact renderer using tighter default LaTeX settings. |
| `backend/routes/resume_templates.py` | Template list and preview API routes. |
| `backend/tests/test_latex_template_registry.py` | Registry unit tests. |
| `backend/tests/test_pdf_template_selection.py` | PDF route template selection tests. |
| `frontend/src/services/resumeTemplates.ts` | Frontend API client for template metadata. |
| `frontend/src/pages/Templates/index.tsx` | LaTeX template gallery page. |
| `frontend/src/pages/Workspace/v2/components/TemplateSwitcherModal.tsx` | In-workspace LaTeX template switcher. |

### Modify

| Path | Responsibility |
|---|---|
| `backend/models.py` | Add optional `template_id` to `RenderPDFRequest`. |
| `backend/routes/__init__.py` | Export template route. |
| `backend/main.py` | Register template route. |
| `backend/routes/pdf.py` | Resolve template renderer and template directory during PDF render. |
| `backend/latex_generator.py` | Keep existing functions intact; only call from `classic` and `compact` renderers. |
| `frontend/src/App.tsx` | Register `/templates` route. |
| `frontend/src/pages/CreateNew/index.tsx` | Route LaTeX creation into template gallery. |
| `frontend/src/pages/WorkspaceLayout/index.tsx` | Add sidebar button for template gallery. |
| `frontend/src/pages/Workspace/v2/types/index.ts` | Keep `templateId` as persistent data; add no new duplicated resume model. |
| `frontend/src/pages/Workspace/v2/utils/convertToBackend.ts` | Include `templateId` in backend render data. |
| `frontend/src/services/api.ts` | Add template ID to PDF render request body. |
| `frontend/src/pages/Workspace/v2/hooks/usePDFOperations.ts` | Pass the current template ID into render calls. |
| `frontend/src/pages/Workspace/v2/latex/index.tsx` | Add template switcher state and handler. |
| `frontend/src/pages/Workspace/v2/components/Header.tsx` | Add optional “更换模板” action. |

---

## Task 0: Branch And Worktree Guard

**Files:**
- No file changes.

- [ ] **Step 1: Inspect current Git state**

Run:

```powershell
git status --short --branch
git branch --show-current
```

Expected: working tree may contain existing unrelated changes. Do not modify or stage those files.

- [ ] **Step 2: Create implementation branch**

Run:

```powershell
git switch -c feature/latex-template-gallery
```

Expected: current branch becomes `feature/latex-template-gallery`.

- [ ] **Step 3: Verify branch**

Run:

```powershell
git branch --show-current
```

Expected: `feature/latex-template-gallery`.

If `git switch -c` fails because the repository has no baseline commit or because Git needs remote objects, stop and ask the user how to proceed. Do not run `git reset --hard` or `git checkout --`.

---

## Task 1: Backend Template Registry

**Files:**
- Create: `backend/resume_templates/__init__.py`
- Create: `backend/resume_templates/latex/__init__.py`
- Create: `backend/resume_templates/latex/base.py`
- Create: `backend/resume_templates/latex/registry.py`
- Create: `backend/resume_templates/latex/classic/manifest.json`
- Create: `backend/resume_templates/latex/classic/renderer.py`
- Create: `backend/resume_templates/latex/compact/manifest.json`
- Create: `backend/resume_templates/latex/compact/renderer.py`
- Create: `backend/tests/test_latex_template_registry.py`
- Copy assets from: `latex-resume-template/`

- [ ] **Step 1: Write registry tests first**

Create `backend/tests/test_latex_template_registry.py`:

```python
from pathlib import Path

import pytest

from backend.resume_templates.latex.registry import (
    DEFAULT_TEMPLATE_ID,
    list_latex_templates,
    resolve_latex_template,
)


def test_list_latex_templates_contains_classic_and_compact():
    templates = list_latex_templates()
    ids = {item.id for item in templates}

    assert DEFAULT_TEMPLATE_ID == "classic"
    assert {"classic", "compact"}.issubset(ids)


def test_resolve_missing_template_uses_classic():
    resolved = resolve_latex_template(None)

    assert resolved.meta.id == "classic"
    assert resolved.template_dir.name == "classic"


def test_resolve_invalid_template_raises_value_error():
    with pytest.raises(ValueError, match="Unknown LaTeX template"):
        resolve_latex_template("not-registered")


def test_manifest_preview_path_stays_inside_template_dir():
    resolved = resolve_latex_template("classic")
    preview = resolved.preview_path

    assert preview is not None
    assert Path(preview).resolve().is_relative_to(resolved.template_dir.resolve())
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py -v
```

Expected: FAIL because `backend.resume_templates.latex.registry` does not exist.

- [ ] **Step 3: Create package marker files**

Create `backend/resume_templates/__init__.py`:

```python
"""Resume template packages."""
```

Create `backend/resume_templates/latex/__init__.py`:

```python
"""LaTeX resume template registry."""

from .registry import DEFAULT_TEMPLATE_ID, list_latex_templates, resolve_latex_template

__all__ = ["DEFAULT_TEMPLATE_ID", "list_latex_templates", "resolve_latex_template"]
```

- [ ] **Step 4: Define renderer contract**

Create `backend/resume_templates/latex/base.py`:

```python
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol


@dataclass(frozen=True)
class LatexTemplateMeta:
    id: str
    name: str
    description: str
    type: str
    category: str
    tags: list[str]
    preview: str | None = None


class LatexTemplateRenderer(Protocol):
    template_id: str

    def render(
        self,
        resume_data: dict[str, Any],
        section_order: list[str] | None = None,
    ) -> str:
        raise NotImplementedError


@dataclass(frozen=True)
class ResolvedLatexTemplate:
    meta: LatexTemplateMeta
    renderer: LatexTemplateRenderer
    template_dir: Path
    preview_path: Path | None
```

- [ ] **Step 5: Add template manifests**

Create `backend/resume_templates/latex/classic/manifest.json`:

```json
{
  "id": "classic",
  "name": "经典 LaTeX",
  "description": "适合程序员通用投递的单栏经典模板",
  "type": "latex",
  "category": "通用",
  "tags": ["经典", "单栏", "ATS友好"],
  "preview": "resume.preview.png"
}
```

Create `backend/resume_templates/latex/compact/manifest.json`:

```json
{
  "id": "compact",
  "name": "紧凑 LaTeX",
  "description": "适合内容较多且希望压缩到一页的紧凑模板",
  "type": "latex",
  "category": "通用",
  "tags": ["紧凑", "单栏", "一页优先"],
  "preview": "resume.preview.png"
}
```

- [ ] **Step 6: Copy current template assets into both template directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path backend\resume_templates\latex\classic
New-Item -ItemType Directory -Force -Path backend\resume_templates\latex\compact
Copy-Item latex-resume-template\resume.cls backend\resume_templates\latex\classic\resume.cls
Copy-Item latex-resume-template\fontawesome.sty backend\resume_templates\latex\classic\fontawesome.sty
Copy-Item latex-resume-template\linespacing_fix.sty backend\resume_templates\latex\classic\linespacing_fix.sty
Copy-Item latex-resume-template\zh_CN-Adobefonts_external.sty backend\resume_templates\latex\classic\zh_CN-Adobefonts_external.sty
Copy-Item latex-resume-template\zh_CN-Adobefonts_internal.sty backend\resume_templates\latex\classic\zh_CN-Adobefonts_internal.sty
Copy-Item latex-resume-template\resume.preview.png backend\resume_templates\latex\classic\resume.preview.png
Copy-Item latex-resume-template\fonts backend\resume_templates\latex\classic\fonts -Recurse
Copy-Item backend\resume_templates\latex\classic\resume.cls backend\resume_templates\latex\compact\resume.cls
Copy-Item backend\resume_templates\latex\classic\fontawesome.sty backend\resume_templates\latex\compact\fontawesome.sty
Copy-Item backend\resume_templates\latex\classic\linespacing_fix.sty backend\resume_templates\latex\compact\linespacing_fix.sty
Copy-Item backend\resume_templates\latex\classic\zh_CN-Adobefonts_external.sty backend\resume_templates\latex\compact\zh_CN-Adobefonts_external.sty
Copy-Item backend\resume_templates\latex\classic\zh_CN-Adobefonts_internal.sty backend\resume_templates\latex\compact\zh_CN-Adobefonts_internal.sty
Copy-Item backend\resume_templates\latex\classic\resume.preview.png backend\resume_templates\latex\compact\resume.preview.png
Copy-Item backend\resume_templates\latex\classic\fonts backend\resume_templates\latex\compact\fonts -Recurse
```

Expected: both template directories contain LaTeX support files and fonts.

- [ ] **Step 7: Add classic renderer**

Create `backend/resume_templates/latex/classic/renderer.py`:

```python
from typing import Any

try:
    from backend.latex_generator import json_to_latex
except ImportError:
    from latex_generator import json_to_latex


class ClassicLatexRenderer:
    template_id = "classic"

    def render(
        self,
        resume_data: dict[str, Any],
        section_order: list[str] | None = None,
    ) -> str:
        return json_to_latex(resume_data, section_order)


renderer = ClassicLatexRenderer()
```

- [ ] **Step 8: Add compact renderer**

Create `backend/resume_templates/latex/compact/renderer.py`:

```python
import copy
from typing import Any

try:
    from backend.latex_generator import json_to_latex
except ImportError:
    from latex_generator import json_to_latex


class CompactLatexRenderer:
    template_id = "compact"

    def render(
        self,
        resume_data: dict[str, Any],
        section_order: list[str] | None = None,
    ) -> str:
        compact_resume = copy.deepcopy(resume_data)
        settings = dict(compact_resume.get("globalSettings") or {})
        settings["latexFontSize"] = settings.get("latexFontSize") or 10
        settings["latexMargin"] = "tight"
        settings["latexLineSpacing"] = 1.0
        settings["latexHeaderTopGapPx"] = settings.get("latexHeaderTopGapPx", -8)
        settings["latexHeaderBottomGapPx"] = settings.get("latexHeaderBottomGapPx", -6)
        compact_resume["globalSettings"] = settings
        return json_to_latex(compact_resume, section_order)


renderer = CompactLatexRenderer()
```

- [ ] **Step 9: Implement registry**

Create `backend/resume_templates/latex/registry.py`:

```python
import importlib
import json
from pathlib import Path

from .base import LatexTemplateMeta, ResolvedLatexTemplate

DEFAULT_TEMPLATE_ID = "classic"
TEMPLATE_PACKAGE = "backend.resume_templates.latex"
TEMPLATE_IDS = ("classic", "compact")
TEMPLATES_ROOT = Path(__file__).resolve().parent


def _load_manifest(template_id: str) -> LatexTemplateMeta:
    template_dir = TEMPLATES_ROOT / template_id
    manifest_path = template_dir / "manifest.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if payload.get("id") != template_id:
        raise ValueError(f"Template manifest id mismatch: {template_id}")
    if payload.get("type") != "latex":
        raise ValueError(f"Template type must be latex: {template_id}")
    tags = payload.get("tags")
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        raise ValueError(f"Template tags must be a string list: {template_id}")
    return LatexTemplateMeta(
        id=payload["id"],
        name=payload["name"],
        description=payload["description"],
        type=payload["type"],
        category=payload["category"],
        tags=tags,
        preview=payload.get("preview"),
    )


def _resolve_preview_path(template_dir: Path, meta: LatexTemplateMeta) -> Path | None:
    if not meta.preview:
        return None
    preview_path = (template_dir / meta.preview).resolve()
    if not preview_path.is_relative_to(template_dir.resolve()):
        raise ValueError(f"Template preview escapes template directory: {meta.id}")
    if not preview_path.exists():
        return None
    return preview_path


def list_latex_templates() -> list[LatexTemplateMeta]:
    return [_load_manifest(template_id) for template_id in TEMPLATE_IDS]


def resolve_latex_template(template_id: str | None) -> ResolvedLatexTemplate:
    resolved_id = template_id or DEFAULT_TEMPLATE_ID
    if resolved_id not in TEMPLATE_IDS:
        raise ValueError(f"Unknown LaTeX template: {resolved_id}")

    template_dir = TEMPLATES_ROOT / resolved_id
    meta = _load_manifest(resolved_id)
    module = importlib.import_module(f"{TEMPLATE_PACKAGE}.{resolved_id}.renderer")
    renderer = getattr(module, "renderer")
    if getattr(renderer, "template_id", None) != resolved_id:
        raise ValueError(f"Renderer template_id mismatch: {resolved_id}")

    return ResolvedLatexTemplate(
        meta=meta,
        renderer=renderer,
        template_dir=template_dir,
        preview_path=_resolve_preview_path(template_dir, meta),
    )
```

- [ ] **Step 10: Run registry test**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py -v
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```powershell
git add backend/resume_templates backend/tests/test_latex_template_registry.py
git commit -m "feat: add latex template registry"
```

---

## Task 2: Backend Template API

**Files:**
- Create: `backend/routes/resume_templates.py`
- Modify: `backend/routes/__init__.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add route tests**

Append to `backend/tests/test_latex_template_registry.py`:

```python
from fastapi.testclient import TestClient

from backend.main import app


def test_list_resume_templates_api_returns_latex_templates():
    client = TestClient(app)

    response = client.get("/api/resume-templates?type=latex")

    assert response.status_code == 200
    payload = response.json()
    ids = {item["id"] for item in payload["data"]}
    assert {"classic", "compact"}.issubset(ids)
    assert all(item["type"] == "latex" for item in payload["data"])


def test_template_preview_api_returns_png():
    client = TestClient(app)

    response = client.get("/api/resume-templates/classic/preview")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content.startswith(b"\x89PNG")
```

- [ ] **Step 2: Run tests to verify route is missing**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py -v
```

Expected: FAIL for `/api/resume-templates` because route is not registered.

- [ ] **Step 3: Implement template route**

Create `backend/routes/resume_templates.py`:

```python
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.resume_templates.latex.registry import list_latex_templates, resolve_latex_template

router = APIRouter(prefix="/api/resume-templates", tags=["Resume Templates"])


class ResumeTemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    type: str
    category: str
    tags: list[str]
    previewUrl: str | None = None


class ResumeTemplateListResponse(BaseModel):
    data: list[ResumeTemplateResponse]


@router.get("", response_model=ResumeTemplateListResponse)
def list_resume_templates(type: str = Query(default="latex")):
    if type != "latex":
        return ResumeTemplateListResponse(data=[])
    return ResumeTemplateListResponse(
        data=[
            ResumeTemplateResponse(
                id=meta.id,
                name=meta.name,
                description=meta.description,
                type=meta.type,
                category=meta.category,
                tags=meta.tags,
                previewUrl=f"/api/resume-templates/{meta.id}/preview",
            )
            for meta in list_latex_templates()
        ]
    )


@router.get("/{template_id}/preview")
def get_resume_template_preview(template_id: str):
    try:
        resolved = resolve_latex_template(template_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="模板不存在")
    if not resolved.preview_path:
        raise HTTPException(status_code=404, detail="模板预览图不存在")
    return FileResponse(resolved.preview_path, media_type="image/png")
```

- [ ] **Step 4: Export route**

Modify `backend/routes/__init__.py`:

```python
from .resume_templates import router as resume_templates_router
```

Add `resume_templates_router` to `__all__`.

- [ ] **Step 5: Register route in app**

Modify `backend/main.py` near other route variables:

```python
resume_templates_router = routes_module.resume_templates_router
```

Register after `resumes_router`:

```python
app.include_router(resume_templates_router)
```

- [ ] **Step 6: Run route tests**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add backend/routes/resume_templates.py backend/routes/__init__.py backend/main.py backend/tests/test_latex_template_registry.py
git commit -m "feat: expose latex template metadata API"
```

---

## Task 3: Backend PDF Template Selection

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routes/pdf.py`
- Create: `backend/tests/test_pdf_template_selection.py`

- [ ] **Step 1: Add PDF selection tests**

Create `backend/tests/test_pdf_template_selection.py`:

```python
from io import BytesIO

from fastapi.testclient import TestClient

import backend.routes.pdf as pdf_route
from backend.main import app


def test_render_pdf_uses_template_id_from_body(monkeypatch):
    captured = {}

    def fake_compile(latex_content, template_dir, resume_data=None):
        captured["latex"] = latex_content
        captured["template_dir"] = template_dir
        return BytesIO(b"%PDF-1.4\n%fake\n")

    monkeypatch.setattr(pdf_route, "compile_latex_to_pdf", fake_compile, raising=False)
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "template_id": "compact",
            "resume": {"name": "张三", "contact": {}, "globalSettings": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 200
    assert captured["template_dir"].name == "compact"
    assert "\\geometry{a4paper,left=0.25in" in captured["latex"]


def test_render_pdf_rejects_unknown_template():
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "template_id": "missing-template",
            "resume": {"name": "张三", "contact": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 422
    assert "模板不存在" in response.json()["detail"]


def test_render_pdf_uses_resume_template_id_when_body_omits_it(monkeypatch):
    captured = {}

    def fake_compile(latex_content, template_dir, resume_data=None):
        captured["template_dir"] = template_dir
        return BytesIO(b"%PDF-1.4\n%fake\n")

    monkeypatch.setattr(pdf_route, "compile_latex_to_pdf", fake_compile, raising=False)
    client = TestClient(app)

    response = client.post(
        "/api/pdf/render",
        json={
            "resume": {"templateId": "compact", "name": "张三", "contact": {}},
            "section_order": [],
        },
    )

    assert response.status_code == 200
    assert captured["template_dir"].name == "compact"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
pytest backend/tests/test_pdf_template_selection.py -v
```

Expected: FAIL because `RenderPDFRequest` and `pdf.py` do not resolve templates yet.

- [ ] **Step 3: Extend request model**

Modify `backend/models.py`:

```python
class RenderPDFRequest(BaseModel):
    """PDF 渲染请求"""
    resume: Dict[str, Any]
    demo: Optional[bool] = False
    section_order: Optional[List[str]] = None
    engine: Optional[str] = "latex"
    template_id: Optional[str] = None
```

- [ ] **Step 4: Update PDF route imports and helpers**

Modify `backend/routes/pdf.py` near imports:

```python
try:
    from backend.latex_generator import compile_latex_to_pdf
    from backend.resume_templates.latex.registry import DEFAULT_TEMPLATE_ID, resolve_latex_template
except ImportError:
    from latex_generator import compile_latex_to_pdf
    from resume_templates.latex.registry import DEFAULT_TEMPLATE_ID, resolve_latex_template
```

Replace `_resolve_template_dir()` and `_prepare_latex_content()` with:

```python
def _resolve_request_template_id(resume_data, body_template_id):
    if body_template_id:
        return body_template_id
    if isinstance(resume_data, dict) and resume_data.get("templateId"):
        return resume_data["templateId"]
    return DEFAULT_TEMPLATE_ID


def _resolve_request_template(resume_data, body_template_id):
    template_id = _resolve_request_template_id(resume_data, body_template_id)
    try:
        return resolve_latex_template(template_id)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"模板不存在: {template_id}")
```

Keep `_compile_pdf_bytes()` but change it to call imported `compile_latex_to_pdf`:

```python
def _compile_pdf_bytes(latex_content: str, template_dir: Path, resume_data):
    return compile_latex_to_pdf(latex_content, template_dir, resume_data=resume_data).getvalue()
```

- [ ] **Step 5: Update non-stream render endpoint**

Inside `render_pdf`, before rendering:

```python
template = _resolve_request_template(resume_data, body.template_id)
latex_content = await run_in_threadpool(template.renderer.render, resume_data, body.section_order)
pdf_bytes = await run_in_threadpool(
    _compile_pdf_bytes,
    latex_content,
    template.template_dir,
    resume_data,
)
```

Add `template_id={template.meta.id}` to existing PDF trace log.

- [ ] **Step 6: Update stream render endpoint**

Inside `render_pdf_stream`, resolve template before `generate_pdf()`:

```python
resume_data = body.resume
template = _resolve_request_template(resume_data, body.template_id)
```

Inside `generate_pdf()`, remove the old local `resume_data = body.resume` assignment and render with:

```python
latex_content = await run_in_threadpool(
    template.renderer.render,
    resume_data,
    body.section_order,
)
```

Compile with:

```python
pdf_bytes = await run_in_threadpool(
    _compile_pdf_bytes,
    latex_content,
    template.template_dir,
    resume_data,
)
```

Add `template_id={template.meta.id}` to existing stream trace logs.

- [ ] **Step 7: Run targeted tests**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py backend/tests/test_pdf_template_selection.py backend/tests/test_pdf_stream_threadpool.py -v
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
git add backend/models.py backend/routes/pdf.py backend/tests/test_pdf_template_selection.py
git commit -m "feat: render pdf with selected latex template"
```

---

## Task 4: Frontend Template Metadata And PDF Request Plumbing

**Files:**
- Create: `frontend/src/services/resumeTemplates.ts`
- Modify: `frontend/src/pages/Workspace/v2/utils/convertToBackend.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/Workspace/v2/hooks/usePDFOperations.ts`

- [ ] **Step 1: Create template metadata service**

Create `frontend/src/services/resumeTemplates.ts`:

```typescript
import { getApiBaseUrl } from '@/lib/runtimeEnv'

export interface ResumeTemplateMetadata {
  id: string
  name: string
  description: string
  type: 'latex'
  category: string
  tags: string[]
  previewUrl?: string | null
}

interface ResumeTemplateListResponse {
  data: ResumeTemplateMetadata[]
}

export async function getLatexTemplates(): Promise<ResumeTemplateMetadata[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/resume-templates?type=latex`)
  if (!response.ok) {
    throw new Error(`模板列表加载失败: ${response.status}`)
  }
  const payload = (await response.json()) as ResumeTemplateListResponse
  return payload.data
}

export function resolveTemplatePreviewUrl(template: ResumeTemplateMetadata): string | undefined {
  if (!template.previewUrl) return undefined
  if (template.previewUrl.startsWith('http://') || template.previewUrl.startsWith('https://')) {
    return template.previewUrl
  }
  return `${getApiBaseUrl()}${template.previewUrl}`
}
```

- [ ] **Step 2: Include templateId in backend render data**

Modify `BackendResumeData` in `convertToBackend.ts`:

```typescript
  templateId?: string | null
```

Add to the returned object:

```typescript
    templateId: data.templateId || 'classic',
```

- [ ] **Step 3: Add templateId to render API context**

Modify `renderPDF()` in `frontend/src/services/api.ts` by adding the optional final parameter:

```typescript
  templateId?: string | null,
```

Inside `renderPDF()`:

```typescript
  const resolvedTemplateId = templateId || (resume as any)?.templateId || 'classic'
```

Change request body:

```typescript
        { resume, section_order: mappedOrder, template_id: resolvedTemplateId },
```

Modify `renderPDFStream()` context type:

```typescript
      templateId?: string | null
```

Inside `renderPDFStream()`:

```typescript
  const resolvedTemplateId = context?.templateId || (resume as any)?.templateId || 'classic'
```

Change request body:

```typescript
    body: JSON.stringify({ resume, section_order: mappedOrder, template_id: resolvedTemplateId })
```

Add `templateId: resolvedTemplateId` to PDF trace logs.

- [ ] **Step 4: Pass templateId from workspace PDF hook**

Modify `usePDFOperations.ts` in the stream render context:

```typescript
            templateId: data.templateId || 'classic',
```

Modify fallback `renderPDF()` call:

```typescript
            backendData as any,
            false,
            backendData.sectionOrder,
            abortController.signal,
            renderModeRef.current,
            data.templateId || 'classic',
```

- [ ] **Step 5: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add frontend/src/services/resumeTemplates.ts frontend/src/pages/Workspace/v2/utils/convertToBackend.ts frontend/src/services/api.ts frontend/src/pages/Workspace/v2/hooks/usePDFOperations.ts
git commit -m "feat: send latex template id during pdf render"
```

---

## Task 5: Template Gallery Page And Navigation

**Files:**
- Create: `frontend/src/pages/Templates/index.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/CreateNew/index.tsx`
- Modify: `frontend/src/pages/WorkspaceLayout/index.tsx`

- [ ] **Step 1: Create template gallery page**

Create `frontend/src/pages/Templates/index.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, RefreshCw } from 'lucide-react'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { DEFAULT_RESUME_TEMPLATE } from '@/data/defaultTemplate'
import { saveResume, setCurrentResumeId } from '@/services/resumeStorage'
import {
  getLatexTemplates,
  resolveTemplatePreviewUrl,
  type ResumeTemplateMetadata,
} from '@/services/resumeTemplates'

export default function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ResumeTemplateMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getLatexTemplates()
      .then((items) => {
        if (mounted) setTemplates(items)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : '模板列表加载失败')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const handleUseTemplate = async (template: ResumeTemplateMetadata) => {
    const resumeData = structuredClone(DEFAULT_RESUME_TEMPLATE)
    resumeData.id = `resume_latex_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    resumeData.templateType = 'latex'
    resumeData.templateId = template.id
    resumeData.updatedAt = new Date().toISOString()
    const saved = await saveResume(resumeData as any, resumeData.id)
    setCurrentResumeId(saved.id)
    navigate(`/workspace/latex/${saved.id}`)
  }

  return (
    <WorkspaceLayout>
      <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">LaTeX 模板广场</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                选择一个 LaTeX 模板开始编辑，模板只影响 PDF 排版。
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/create-new')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              返回
            </button>
          </div>

          {loading && (
            <div className="flex h-64 items-center justify-center text-slate-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              正在加载模板
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((template) => {
                const previewUrl = resolveTemplatePreviewUrl(template)
                return (
                  <article
                    key={template.id}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex aspect-[3/4] items-center justify-center bg-slate-100 dark:bg-slate-800">
                      {previewUrl ? (
                        <img src={previewUrl} alt={template.name} className="h-full w-full object-contain p-3" />
                      ) : (
                        <FileText className="h-12 w-12 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-3 p-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{template.name}</h2>
                        <p className="mt-1 min-h-10 text-sm text-slate-500 dark:text-slate-400">{template.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {template.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(template)}
                        className="mt-auto rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        使用此模板
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  )
}
```

- [ ] **Step 2: Register `/templates` route**

Modify `frontend/src/App.tsx`:

```typescript
const TemplatesPage = lazyWithRetry(() => import('./pages/Templates'))
```

Add route:

```tsx
<Route path="/templates" element={<TemplatesPage />} />
```

- [ ] **Step 3: Change LaTeX create entry**

Modify `frontend/src/pages/CreateNew/index.tsx`:

```typescript
  const handleLatexTemplate = () => {
    setCurrentResumeId(null)
    localStorage.removeItem('resume_v2_data')
    navigate('/templates')
  }
```

Update visible text from “默认模板 LaTeX” to “选择 LaTeX 模板”.

- [ ] **Step 4: Add sidebar template button**

Modify `WorkspaceLayout` navigation after “我的简历”:

```tsx
              <button
                onClick={(e) => handleWorkspaceChange("templates", e)}
                className={cn(
                  "w-full rounded-lg transition-all duration-200",
                  sidebarCollapsed
                    ? "flex flex-col items-center justify-center gap-1 py-2.5"
                    : "flex items-center gap-2.5 py-2.5 px-2.5",
                  currentWorkspace === "templates"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
                title="模板广场"
              >
                <LayoutTemplate className="w-6 h-6 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-base font-medium">模板广场</span>
                )}
              </button>
```

- [ ] **Step 5: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add frontend/src/pages/Templates/index.tsx frontend/src/App.tsx frontend/src/pages/CreateNew/index.tsx frontend/src/pages/WorkspaceLayout/index.tsx
git commit -m "feat: add latex template gallery page"
```

---

## Task 6: Workspace Template Switcher

**Files:**
- Create: `frontend/src/pages/Workspace/v2/components/TemplateSwitcherModal.tsx`
- Modify: `frontend/src/pages/Workspace/v2/components/Header.tsx`
- Modify: `frontend/src/pages/Workspace/v2/latex/index.tsx`

- [ ] **Step 1: Create switcher modal**

Create `frontend/src/pages/Workspace/v2/components/TemplateSwitcherModal.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  getLatexTemplates,
  resolveTemplatePreviewUrl,
  type ResumeTemplateMetadata,
} from '@/services/resumeTemplates'

interface TemplateSwitcherModalProps {
  currentTemplateId?: string | null
  open: boolean
  onClose: () => void
  onSelect: (templateId: string) => void
}

export function TemplateSwitcherModal({
  currentTemplateId,
  open,
  onClose,
  onSelect,
}: TemplateSwitcherModalProps) {
  const [templates, setTemplates] = useState<ResumeTemplateMetadata[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    getLatexTemplates()
      .then(setTemplates)
      .catch((err) => setError(err instanceof Error ? err.message : '模板列表加载失败'))
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">更换 LaTeX 模板</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">只切换 PDF 排版，不修改简历内容。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const selected = (currentTemplateId || 'classic') === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    onSelect(template.id)
                    onClose()
                  }}
                  className={`overflow-hidden rounded-lg border text-left transition ${
                    selected
                      ? 'border-blue-500 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-300 dark:border-slate-800'
                  }`}
                >
                  <div className="aspect-[3/4] bg-slate-100 dark:bg-slate-800">
                    {resolveTemplatePreviewUrl(template) && (
                      <img src={resolveTemplatePreviewUrl(template)} alt={template.name} className="h-full w-full object-contain p-3" />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{template.name}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{template.description}</div>
                    {selected && <div className="mt-2 text-xs font-bold text-blue-600">当前模板</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add optional Header action**

Modify `HeaderProps` in `Header.tsx`:

```typescript
  onOpenTemplateSwitcher?: () => void
```

Destructure it from props. Add a button before Save:

```tsx
        {onOpenTemplateSwitcher && (
          <button
            type="button"
            onClick={onOpenTemplateSwitcher}
            className={cn(
              "px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2",
              "bg-white border border-slate-200 dark:border-slate-800",
              "text-slate-700 dark:text-slate-300 hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-slate-700",
              "active:scale-95 shadow-sm"
            )}
          >
            <LayoutGrid className="w-4 h-4 text-blue-500" />
            更换模板
          </button>
        )}
```

- [ ] **Step 3: Wire modal into LaTeX workspace**

Modify `frontend/src/pages/Workspace/v2/latex/index.tsx` imports:

```typescript
import { TemplateSwitcherModal } from '../components/TemplateSwitcherModal'
```

Add state:

```typescript
  const [templateSwitcherOpen, setTemplateSwitcherOpen] = useState(false)
```

Add handler:

```typescript
  const handleTemplateSelect = (templateId: string) => {
    setResumeData((prev) => ({
      ...prev,
      templateType: 'latex',
      templateId,
      updatedAt: new Date().toISOString(),
    }))
  }
```

Pass header prop:

```tsx
        onOpenTemplateSwitcher={() => setTemplateSwitcherOpen(true)}
```

Render modal near `AIImportModal`:

```tsx
      <TemplateSwitcherModal
        open={templateSwitcherOpen}
        currentTemplateId={resumeData.templateId}
        onClose={() => setTemplateSwitcherOpen(false)}
        onSelect={handleTemplateSelect}
      />
```

- [ ] **Step 4: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add frontend/src/pages/Workspace/v2/components/TemplateSwitcherModal.tsx frontend/src/pages/Workspace/v2/components/Header.tsx frontend/src/pages/Workspace/v2/latex/index.tsx
git commit -m "feat: allow switching latex templates in workspace"
```

---

## Task 7: Full Verification

**Files:**
- No source changes unless verification exposes defects.

- [ ] **Step 1: Run backend template and PDF tests**

Run:

```powershell
pytest backend/tests/test_latex_template_registry.py backend/tests/test_pdf_template_selection.py backend/tests/test_pdf_stream_threadpool.py backend/tests/test_latex_custom_sections.py backend/tests/test_latex_education_description.py -v
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```powershell
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start backend**

Run:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

Expected: backend responds at `http://127.0.0.1:9000/docs`.

- [ ] **Step 4: Start frontend**

Run in a separate terminal:

```powershell
cd frontend
npm run dev
```

Expected: frontend is available at `http://127.0.0.1:5173`.

- [ ] **Step 5: Browser smoke test**

Manual path:

1. Open `http://127.0.0.1:5173/templates`.
2. Confirm `classic` and `compact` templates are visible.
3. Choose `compact`.
4. Confirm app navigates to `/workspace/latex/:resumeId`.
5. Confirm PDF preview renders.
6. Click “更换模板”.
7. Choose `classic`.
8. Confirm resume content remains and PDF re-renders.
9. Save resume.
10. Return to “我的简历” and reopen it.
11. Confirm the selected template persists.

Expected: no critical console errors and PDF preview remains usable.

- [ ] **Step 6: Verify backend API directly**

Run:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:9000/api/resume-templates?type=latex"
```

Expected: response contains `classic` and `compact`.

- [ ] **Step 7: Commit verification fixes**

If verification required code fixes, run `git status --short`, identify the changed files that belong to this feature, and commit only those explicit paths:

```powershell
git status --short
git add backend/routes/pdf.py frontend/src/services/api.ts
git commit -m "fix: stabilize latex template gallery verification"
```

The `git add` command above shows the expected path style. Replace the two paths with the actual feature files changed by verification. If no fixes were needed, do not create an empty commit.

---

## Task 8: Documentation Closeout

**Files:**
- Modify: `knowledge-base/specs/2026-05-21-latex-template-gallery-design.md`
- Create or Modify: `knowledge-base/reviews/2026-05-21-latex-template-gallery-review.md`

- [ ] **Step 1: Add implementation notes to review file**

Create `knowledge-base/reviews/2026-05-21-latex-template-gallery-review.md`:

```markdown
# LaTeX 模板广场实施记录

## 日期

2026-05-21

## 范围

- 新增 LaTeX 模板注册表
- 新增模板列表与预览 API
- PDF 渲染支持 `template_id`
- 新增 `/templates` 模板广场
- LaTeX 工作台支持更换模板

## 验证

- `pytest backend/tests/test_latex_template_registry.py backend/tests/test_pdf_template_selection.py backend/tests/test_pdf_stream_threadpool.py backend/tests/test_latex_custom_sections.py backend/tests/test_latex_education_description.py -v`
- `cd frontend && npm run build`
- 浏览器验证 `/templates` 创建简历、更换模板、PDF 重渲染、保存后重进

## 剩余风险

- `compact` 第一版复用当前 LaTeX 生成器，只通过全局排版参数体现差异。
- 后续如果新增双栏或强视觉模板，应新增完全独立 section renderer，而不是继续扩展 `json_to_latex()`。
```

- [ ] **Step 2: Check docs reference implementation**

Open `knowledge-base/specs/2026-05-21-latex-template-gallery-design.md` and confirm it still matches the implemented file paths. If implementation chose a different file path, update the spec to match reality.

- [ ] **Step 3: Commit docs**

Run:

```powershell
git add knowledge-base/specs/2026-05-21-latex-template-gallery-design.md knowledge-base/reviews/2026-05-21-latex-template-gallery-review.md
git commit -m "docs: record latex template gallery implementation"
```

---

## Plan Self-Review

- Spec coverage: covered backend registry, renderer contract, template API, PDF request contract, frontend gallery, template switching, persistence, and verification.
- Red-flag scan: no incomplete markers and no incomplete file paths.
- Type consistency: backend uses `template_id`; frontend persists `templateId`; API client maps `templateId` to `template_id`.
- Scope check: first version remains LaTeX-only and does not include user-uploaded templates, paid templates, or HTML template gallery.
