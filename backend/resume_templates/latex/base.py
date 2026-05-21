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
