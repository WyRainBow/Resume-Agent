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
