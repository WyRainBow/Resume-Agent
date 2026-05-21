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
