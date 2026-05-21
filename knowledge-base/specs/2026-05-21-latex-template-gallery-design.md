# LaTeX 简历模板广场设计

## 概述

目标：在当前默认 LaTeX 简历链路基础上，新增一个只面向 LaTeX 的模板广场。用户可以选择任意内置 LaTeX 模板创建简历，后续在工作台中继续编辑内容，并按所选模板真实渲染 PDF。

第一版采用“每套模板独立 Renderer”的方案，以扩展性优先。模板不只是替换 `resume.cls`，而是拥有独立的 Python 渲染器，可以自由决定 LaTeX 文档结构、section 排版、头部布局、单双栏样式和资源目录。

## 当前链路

现有 LaTeX 简历创建与渲染流程：

1. `/create-new` 点击“默认模板 LaTeX”
2. 前端清理 `resume_v2_data` 与当前简历 ID
3. 跳转 `/workspace/latex`
4. 工作台编辑 `ResumeData`
5. `convertToBackendFormat()` 转换为后端简历 JSON
6. `renderPDFStream()` 调用 `/api/pdf/render/stream`
7. 后端 `json_to_latex()` 生成 LaTeX
8. 后端固定使用根目录 `latex-resume-template/`
9. `compile_latex_to_pdf()` 调用 XeLaTeX 编译 PDF

当前已有但未完整接入的模板能力：

- `ResumeData.templateId`
- `ResumeData.templateType`
- `frontend/src/data/templates.ts`
- `TemplateCard` / `SimpleTemplateCard`
- `WorkspaceLayout` 已有 `templates` 工作区类型和 `/templates` 路径判断

当前缺口：

- 前端渲染请求没有传递模板 ID
- 后端 `RenderPDFRequest` 没有模板 ID 字段
- 后端 PDF 路由固定选择 `latex-resume-template/`
- `json_to_latex()` 是单模板生成器，不能承载差异较大的模板
- `/templates` 没有正式路由页面

## 产品范围

第一版只支持 LaTeX 模板，不把 HTML 模板放入模板广场。

包含：

- LaTeX 模板广场页面
- 后端模板列表接口
- 后端模板注册表
- 每套模板独立 Renderer
- `classic` 模板作为现有模板的兼容迁移
- 至少新增一个示范 LaTeX 模板
- 创建简历时写入 `templateType = "latex"` 与 `templateId`
- 编辑工作台按 `templateId` 渲染 PDF
- 工作台内可更换 LaTeX 模板，更换只影响排版，不修改简历内容

不包含：

- 用户上传模板
- 在线编辑 `.cls` / `.sty`
- 模板付费权限
- 模板后台管理
- AI 自动推荐模板
- HTML 模板广场

## 推荐架构

新增模板插件目录：

```text
backend/resume_templates/
  latex/
    base.py
    registry.py
    classic/
      manifest.json
      renderer.py
      resume.cls
      fontawesome.sty
      linespacing_fix.sty
      zh_CN-Adobefonts_external.sty
      zh_CN-Adobefonts_internal.sty
      fonts/
      preview.png
    compact/
      manifest.json
      renderer.py
      resume.cls
      fontawesome.sty
      linespacing_fix.sty
      zh_CN-Adobefonts_external.sty
      zh_CN-Adobefonts_internal.sty
      fonts/
      preview.png
```

核心链路：

```text
ResumeData
  -> convertToBackendFormat()
  -> RenderPDFRequest(template_id, resume, section_order)
  -> TemplateRegistry.resolve(template_id)
  -> TemplateRenderer.render(resume, section_order)
  -> compile_latex_to_pdf(latex_content, template_dir, resume_data)
```

## 后端接口设计

### 模板列表

新增：

```text
GET /api/resume-templates?type=latex
```

响应：

```json
{
  "data": [
    {
      "id": "classic",
      "name": "经典 LaTeX",
      "description": "适合程序员通用投递",
      "type": "latex",
      "category": "通用",
      "tags": ["经典", "单栏", "ATS友好"],
      "previewUrl": "/api/resume-templates/classic/preview"
    }
  ]
}
```

第一版不需要分页，因为内置模板数量有限。若后续模板数量增长，再按现有接口追加 `page` 与 `pageSize`，不破坏当前字段。

### 模板预览图

新增：

```text
GET /api/resume-templates/{template_id}/preview
```

行为：

- 模板存在且有 `preview.png`：返回图片
- 模板不存在：404
- 模板无预览图：404，前端使用本地占位图

### PDF 渲染请求

扩展现有 `RenderPDFRequest`：

```python
class RenderPDFRequest(BaseModel):
    resume: Dict[str, Any]
    demo: Optional[bool] = False
    section_order: Optional[List[str]] = None
    engine: Optional[str] = "latex"
    template_id: Optional[str] = None
```

前端请求体：

```json
{
  "template_id": "classic",
  "resume": {},
  "section_order": ["education", "internships", "projects"],
  "engine": "latex"
}
```

兼容策略：

- `template_id` 缺失：使用 `classic`
- `resume.templateId` 存在但请求顶层 `template_id` 缺失：使用 `resume.templateId`
- 两者都缺失：使用 `classic`
- 非法模板 ID：422，返回模板不存在
- 渲染失败：保持现有 500 和 `X-PDF-Trace-*` 日志口径

## Renderer 契约

所有 LaTeX 模板 Renderer 遵循同一内部接口：

```python
from typing import Any

class LatexTemplateRenderer:
    template_id: str

    def render(
        self,
        resume_data: dict[str, Any],
        section_order: list[str] | None = None,
    ) -> str:
        raise NotImplementedError
```

`base.py` 定义抽象基类或 Protocol。`registry.py` 负责加载内置模板，不从用户输入路径直接拼接文件系统路径。

每套模板可复用现有公共工具：

- `escape_latex`
- `html_to_latex`
- `html_to_latex_items`
- `normalize_resume_json`
- `SECTION_GENERATORS` 中可复用的 section 生成逻辑

但模板不被强制使用这些工具。差异较大的模板可以完全自定义 section 输出。

## 模板 Manifest

每套模板提供 `manifest.json`：

```json
{
  "id": "classic",
  "name": "经典 LaTeX",
  "description": "适合程序员通用投递",
  "type": "latex",
  "category": "通用",
  "tags": ["经典", "单栏", "ATS友好"],
  "preview": "preview.png"
}
```

约束：

- `id` 必须与目录名一致
- `type` 第一版只能是 `latex`
- `preview` 只能指向模板目录内的文件
- 后端对 manifest 做边界校验，避免路径穿越

## 前端设计

### 模板广场页面

新增 `/templates` 路由，使用 `WorkspaceLayout` 保持工作区侧边栏一致。

页面职责：

- 拉取 `GET /api/resume-templates?type=latex`
- 展示模板卡片
- 支持按标签或分类筛选，第一版可只做静态分类展示
- 点击“使用模板”创建新简历
- 点击“预览”查看大图或直接使用卡片缩略图，第一版可不做弹窗

### 创建入口

`/create-new` 的 LaTeX 入口改为“选择 LaTeX 模板”，点击后进入 `/templates`。

### 创建简历

用户选择模板后：

1. 克隆默认 `ResumeData`
2. 写入 `templateType: "latex"`
3. 写入 `templateId: selectedTemplateId`
4. 保存到 `resumeStorage`
5. 跳转 `/workspace/latex/:resumeId`

### 更换模板

工作台内提供“更换模板”入口。第一版建议放在预览工具栏或顶部 Header 中。

更换模板行为：

- 只更新 `resumeData.templateId`
- 不修改 `basic`、`education`、`experience`、`projects` 等内容
- 触发 PDF 重新渲染
- 保存时将新 `templateId` 写回本地或数据库

## 数据流与持久化

`ResumeData` 继续作为前端编辑态主模型：

```ts
interface ResumeData {
  templateId: string | null
  templateType?: 'latex' | 'html'
  basic: BasicInfo
  education: Education[]
  experience: Experience[]
  projects: Project[]
  menuSections: MenuSection[]
  globalSettings: GlobalSettings
}
```

后端存储仍使用 `Resume.data` JSON，不新增数据库列。`template_type` 继续从 `data.templateType` 提取。

`templateId` 存储在 `data.templateId` 中，原因：

- 当前存储适配器已保存完整 `ResumeData`
- 不需要数据库迁移
- 更换模板属于简历数据的一部分，随简历复制和导入导出保留

## 迁移策略

旧简历可能没有 `templateId`：

- 加载时前端保留 `templateId`，为空不强制写入
- 渲染时后端默认 `classic`
- 用户保存后可以把 `templateId` 补为 `classic`

现有根目录 `latex-resume-template/`：

- 第一阶段复制到 `backend/resume_templates/latex/classic/`
- 保留根目录一段时间，避免未迁移路径立即失效
- 迁移完成后如要删除根目录，需要另写迁移记录并验证所有引用

## 安全与边界

- 后端只允许注册表中的模板 ID
- 禁止根据用户传入 ID 直接拼接任意路径
- `manifest.json` 视为本地可信配置，但仍校验必要字段
- 预览图只从模板目录读取
- 不支持用户上传 LaTeX，避免任意 TeX 执行风险
- PDF 渲染继续保留 trace 日志，但不输出完整敏感配置

## 测试与验证

后端：

- `GET /api/resume-templates?type=latex` 返回模板列表
- 非法模板 ID 渲染返回 422
- 缺失 `template_id` 渲染默认 `classic`
- `classic` renderer 输出与当前模板关键结构一致
- 新模板 renderer 可以独立生成可编译 LaTeX
- `/api/pdf/render/stream` 使用不同 `template_id` 生成不同 PDF

前端：

- `/templates` 可进入并展示 LaTeX 模板
- 从模板广场创建简历后，保存数据包含 `templateType` 和 `templateId`
- `/workspace/latex/:resumeId` 加载后保留模板 ID
- 更换模板只改变 `templateId`，不丢失简历内容
- `npm run build` 通过
- 启动 dev server 后实测创建、编辑、渲染、下载路径

PDF 链路：

- 至少使用 `classic` 与一个新增模板各渲染一次
- 覆盖中文字体、section order、HTML 富文本、公司 Logo、学校 Logo、照片字段

## 实施约束

- 进入代码实现前必须新开 Git 分支
- 当前仓库若仍处于无提交状态，需要先确认分支策略；不能在用户未确认的情况下做破坏性 Git 操作
- 修改范围应集中在模板接口、PDF 渲染链路、模板广场页面和创建入口
- 不改无关 UI 风格，不移动无关文件
- 架构和用户流程变化完成后，需要同步更新 `knowledge-base/`

## 决策记录

选择方案 B：每套 LaTeX 模板独立 Renderer。

原因：

- 模板扩展性最高，未来可以支持完全不同版式
- 避免把所有模板差异塞进单个 `json_to_latex()` 中形成复杂分支
- 每个模板可以单独测试和演进
- 保持统一 `ResumeData`，不影响工作台、AI、存储和评分主链路

代价：

- 第一版实现成本高于“只换模板目录”
- 需要定义并维护 Renderer 契约
- `classic` 迁移时要确保现有 PDF 行为不回归
