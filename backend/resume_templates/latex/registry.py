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
