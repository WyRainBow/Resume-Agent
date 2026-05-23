from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def read_frontend(path: str) -> str:
    return (PROJECT_ROOT / "frontend" / "src" / path).read_text(encoding="utf-8")


def test_direction_templates_include_html_render_engine_contract():
    source = read_frontend("data/resumeDirectionTemplates.ts")

    assert "renderEngine?: ResumeRenderEngine" in source
    assert "renderTemplateId?: string" in source
    assert "renderEngine: 'html'" in source
    assert "renderTemplateId: 'html-classic'" in source
    assert "templateType: renderEngine" in source
    assert "templateId: renderTemplateId" in source


def test_direction_templates_initialize_from_real_sample_resume_content():
    source = read_frontend("data/resumeDirectionTemplates.ts")

    assert "sampleResume?: DirectionTemplateSampleResume" in source
    assert source.count("sampleResume: {") >= 7
    assert "basic: structuredClone(template.sampleResume.basic)" in source
    assert "title: template.sampleResume.resumeTitle || `${template.sampleResume.basic.title}简历`" in source
    assert "education: cloneResumeItems(template.sampleResume.education)" in source
    assert "skillContent: template.sampleResume.skillContent" in source


def test_latex_direction_templates_have_filled_section_samples():
    source = read_frontend("data/resumeDirectionTemplates.ts")

    expected_sample_ids = [
        "se_exp_1",
        "se_proj_1",
        "se_os_1",
        "po_exp_1",
        "po_proj_1",
        "po_growth_1",
        "dc_exp_1",
        "dc_proj_1",
        "dc_portfolio_1",
        "fb_exp_1",
        "fb_proj_1",
        "fb_cert_1",
        "lam_exp_1",
        "lam_proj_1",
        "lam_work_1",
        "rg_research_1",
        "rg_pub_1",
        "rg_proj_1",
    ]

    for sample_id in expected_sample_ids:
        assert sample_id in source


def test_latex_direction_templates_have_richer_award_and_summary_samples():
    source = read_frontend("data/resumeDirectionTemplates.ts")

    expected_rich_sample_ids = [
        "se_award_1",
        "po_award_1",
        "dc_award_1",
        "fb_award_1",
        "lam_award_1",
        "rg_award_1",
    ]

    for sample_id in expected_rich_sample_ids:
        assert sample_id in source

    assert source.count("<strong>") >= 24


def test_template_gallery_routes_html_templates_to_html_workspace():
    source = read_frontend("pages/Templates/index.tsx")

    assert "templateGroups" in source
    assert "HTML 模板" in source
    assert "LaTeX 模板" in source
    assert "lg:grid-cols-2" in source
    assert "engineFilter" not in source
    assert "resolveDirectionTemplateEngine" in source
    assert "workspacePath = engine === 'html' ? '/workspace/html' : '/workspace/latex'" in source
    assert "HTML" in source


def test_template_gallery_renders_latex_previews_from_real_pdf_output():
    source = read_frontend("pages/Templates/index.tsx")

    assert "TemplateResumePreview" in source
    assert "RenderedLatexPreview" in source
    assert "renderPDF(" in source
    assert "pdfjsLib.getDocument" in source
    assert "convertToBackendFormat" in source
    assert "createResumeFromDirectionTemplate(template.id)" in source
    assert "<TemplateResumePreview template={template}" in source
    assert "DEFAULT_DIRECTION_TEMPLATE_PREVIEW_URL" not in source


def test_resume_data_hook_initializes_html_workspace_from_direction_template():
    source = read_frontend("pages/Workspace/v2/hooks/useResumeData.ts")

    assert "location.pathname === '/workspace/html'" in source
    assert "routeTemplateType" in source
    assert "templateType: routeTemplateType" in source


def test_html_workspace_has_template_switcher_and_registry():
    workspace_source = read_frontend("pages/Workspace/v2/html/index.tsx")
    renderer_source = read_frontend("pages/Workspace/v2/HTMLTemplateRenderer/index.tsx")
    registry_path = PROJECT_ROOT / "frontend" / "src" / "pages" / "Workspace" / "v2" / "html" / "templates" / "registry.ts"

    assert registry_path.exists()
    assert "TemplateSwitcherModal" in workspace_source
    assert "templateType=\"html\"" in workspace_source
    assert "normalizeHtmlTemplateId" in workspace_source
    assert "normalizeHtmlTemplateId(resumeData.templateId)" in renderer_source
