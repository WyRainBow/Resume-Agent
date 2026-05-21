from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    from backend.resume_templates.latex.registry import list_latex_templates, resolve_latex_template
except ImportError:
    from resume_templates.latex.registry import list_latex_templates, resolve_latex_template

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
