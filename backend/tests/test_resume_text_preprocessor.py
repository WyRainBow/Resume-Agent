"""Tests for pasted resume text preprocessing and internship merge fixes."""

from backend.resume_text_preprocessor import normalize_pasted_resume_text
from backend.chunk_processor import _fix_internship_entries, merge_resume_chunks


SAMPLE_FLAT_RESUME = (
    "导入简历内容：陈晓民 📞 13022052961 求职意向: Java/Go 开发 "
    "教育经历 中国科学技术大学（C9） 硕士 软件工程 2023.09-2026.06 "
    "实习经历 智谱-后端开发实习生 2025.08-至今 主要工作成果: 阶段定时任务平台 "
    "核心职责： - 架构设计：负责平台整体架构 - 存储设计：设计了 MySQL+Redis "
    "项目经历： 多阶段异步处理框架 (实验室合作项目) 项目背景: 实验室场景 "
    "- 架构设计: 采用生产者-消费者模式 - 数据库设计: 三张数据表"
)


def test_normalize_inserts_section_and_bullet_breaks():
    normalized = normalize_pasted_resume_text(SAMPLE_FLAT_RESUME)
    assert "\n\n实习经历\n" in normalized
    assert "\n\n项目经历\n" in normalized or "\n\n项目经历：\n" in normalized
    assert "\n- 架构设计" in normalized


def test_fix_internship_entries_merges_orphan_bullets():
    merged = merge_resume_chunks(
        [
            {
                "internships": [
                    {
                        "title": "智谱",
                        "subtitle": "后端开发实习生",
                        "date": "2025.08-至今",
                        "highlights": ["主要工作成果: 阶段定时任务平台"],
                    },
                    {"title": "架构设计", "highlights": ["负责平台整体架构"]},
                    {"title": "存储设计", "highlights": ["设计了 MySQL+Redis"]},
                ]
            }
        ]
    )
    internships = merged["internships"]
    assert len(internships) == 1
    assert internships[0]["title"] == "智谱"
    assert len(internships[0]["highlights"]) >= 3


def test_fix_internship_entries_standalone():
    fixed = _fix_internship_entries(
        [
            {"title": "智谱", "subtitle": "后端开发实习生", "date": "2025.08-至今"},
            {"title": "性能调优", "highlights": ["QPS 从 5000 提升至 20000"]},
        ]
    )
    assert len(fixed) == 1
    assert any("性能调优" in h for h in fixed[0]["highlights"])
