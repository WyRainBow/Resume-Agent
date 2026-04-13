import sys

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# 统一模块别名，避免 `jd_models` 与 `backend.jd_models` 重复加载后生成两套 mapper。
if __name__ == "jd_models":
    sys.modules.setdefault("backend.jd_models", sys.modules[__name__])
elif __name__ == "backend.jd_models":
    sys.modules.setdefault("jd_models", sys.modules[__name__])

try:
    from database import Base
except ImportError:
    from backend.database import Base


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    __table_args__ = {"extend_existing": True}

    id = Column(String(255), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    source_type = Column(String(32), nullable=False)
    source_url = Column(String(1024), nullable=True)
    raw_text = Column(Text, nullable=False)
    structured_data = Column(JSON, nullable=True)
    is_default = Column(Boolean, nullable=False, server_default="0", index=True)
    fetched_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), index=True)

    analysis_results = relationship(
        lambda: JDAnalysisResult,
        back_populates="jd",
        cascade="all, delete-orphan",
        lazy="select",
    )


class JDAnalysisResult(Base):
    __tablename__ = "jd_analysis_results"
    __table_args__ = {"extend_existing": True}

    id = Column(String(255), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    resume_id = Column(String(255), nullable=False, index=True)
    jd_id = Column(String(255), ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    match_score = Column(Float, nullable=False)
    report_data = Column(JSON, nullable=False)
    learning_path_data = Column(JSON, nullable=False)
    patch_batches_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    jd = relationship(lambda: JobDescription, back_populates="analysis_results", lazy="select")
