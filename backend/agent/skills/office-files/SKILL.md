---
name: office-files
description: Skill suite for creating, editing, and analyzing Office files (docx, pdf, pptx, xlsx).
---

# Office Files

Entry point for all document processing tasks. Routes to the appropriate sub-skill based on file format.

## Sub-Skills

| Sub-Skill | File Type | Key Capabilities |
|-----------|-----------|------------------|
| `docx/` | Word (.docx) | Create, edit, tracked changes, comments, text extraction |
| `pdf/` | PDF (.pdf) | Read, extract text/tables, fill forms, merge/split |
| `pptx/` | PowerPoint (.pptx) | Create, edit, HTML to slides, speaker notes |
| `xlsx/` | Excel (.xlsx) | Create, formulas, formatting, data analysis, charts |

## Routing

Based on file extension or document type mentioned:

| User Mentions | Route to |
|---------------|----------|
| .docx, Word, 文档 | `docx/` |
| .pdf, PDF | `pdf/` |
| .pptx, PowerPoint, PPT, 幻灯片, 演示文稿 | `pptx/` |
| .xlsx, Excel, 表格, 电子表格 | `xlsx/` |

## Workflow

1. **Identify Format**: Determine the file type from user request or file extension
2. **Load Sub-Skill**: Read the appropriate `[format]/SKILL.md`
3. **Execute**: Follow the sub-skill's workflow

## Common Cross-Format Tasks

| Task | Typical Flow |
|------|--------------|
| Convert Word to PDF | `docx/` → export as PDF |
| HTML to PowerPoint | `pptx/` → use html2pptx |
| Extract data from PDF | `pdf/` → text/table extraction |
| Fill PDF form | `pdf/` → read `forms.md` |
| Create presentation from content | `pptx/` → create workflow |
| Build financial model | `xlsx/` → follow color coding standards |

## When Format is Ambiguous

If user says "create a document" without specifying format:
- Ask: "What format do you need? (Word/PDF/PowerPoint/Excel)"
- Or infer from context:
  - Text-heavy content → Word (.docx)
  - Presentation/slides → PowerPoint (.pptx)
  - Data/calculations → Excel (.xlsx)
  - Final distribution → PDF (.pdf)

