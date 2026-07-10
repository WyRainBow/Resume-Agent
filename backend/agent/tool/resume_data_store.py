"""
共享的简历数据存储

所有简历相关工具（cv_reader_agent, cv_analyzer_agent, cv_editor_agent）
共享同一个简历数据源，确保数据一致性。
"""

from typing import Optional, Dict, Any

from backend.agent.agent.shared_state import AgentSharedState
from backend.agent.utils.experience_entry import sanitize_resume_payload
from backend.core.logger import get_logger

logger = get_logger(__name__)


class ResumeDataStore:
    """共享的简历数据存储"""

    _data: Optional[dict] = None
    _data_by_session: Dict[str, dict] = {}
    _shared_state_by_session: Dict[str, AgentSharedState] = {}
    _meta_by_session: Dict[str, Dict[str, Any]] = {}
    # 会话级目标岗位 JD：一次提供、本会话后续所有优化自动对齐
    _jd_by_session: Dict[str, str] = {}

    @staticmethod
    def _extract_meta(resume_data: dict) -> Dict[str, Any]:
        """从简历数据中提取元信息（如 resume_id/user_id）"""
        meta = resume_data.get("_meta") or {}
        return {
            "resume_id": resume_data.get("resume_id") or resume_data.get("id") or meta.get("resume_id"),
            "user_id": resume_data.get("user_id") or meta.get("user_id"),
        }

    @staticmethod
    def _extract_name(resume_data: dict) -> Optional[str]:
        """尽量从简历数据中提取名称"""
        basics = resume_data.get("basic") or resume_data.get("basics") or {}
        if isinstance(basics, str):
            return basics.strip() or None
        if isinstance(basics, dict):
            return basics.get("name")
        return None

    @staticmethod
    def _needs_sanitize(resume_data: dict) -> bool:
        basic = resume_data.get("basic") or resume_data.get("basics")
        if isinstance(basic, str):
            return True
        exp = resume_data.get("experience")
        if isinstance(exp, list):
            for item in exp:
                if item is None or item == {} or isinstance(item, str):
                    return True
        return False

    @classmethod
    def _prepare_data(cls, resume_data: dict) -> dict:
        if not isinstance(resume_data, dict):
            return {}
        if not cls._needs_sanitize(resume_data):
            return resume_data
        return sanitize_resume_payload(resume_data)

    @classmethod
    def set_data(cls, resume_data: dict, session_id: Optional[str] = None):
        """设置简历数据（严格按 session 隔离）"""
        cleaned = cls._prepare_data(resume_data)
        if session_id:
            cls._data_by_session[session_id] = cleaned
            cls._meta_by_session[session_id] = cls._extract_meta(cleaned)
            shared_state = cls._shared_state_by_session.get(session_id)
            if shared_state:
                shared_state.set("resume_data", cleaned)
        else:
            cls._data = cleaned

    @classmethod
    def get_data(cls, session_id: Optional[str] = None) -> Optional[dict]:
        """获取简历数据（严格按 session，不 fallback 到全局）"""
        if session_id:
            raw: Optional[dict] = None
            shared_state = cls._shared_state_by_session.get(session_id)
            if shared_state and shared_state.has("resume_data"):
                raw = shared_state.get("resume_data")
            elif session_id in cls._data_by_session:
                raw = cls._data_by_session[session_id]
            if raw is None:
                return None
            cleaned = cls._prepare_data(raw)
            if cleaned != raw:
                cls._data_by_session[session_id] = cleaned
                if shared_state:
                    shared_state.set("resume_data", cleaned)
            return cleaned
        if cls._data is None:
            return None
        return cls._prepare_data(cls._data)

    @classmethod
    def clear_data(cls, session_id: Optional[str] = None):
        """清空简历数据"""
        if session_id:
            cls._data_by_session.pop(session_id, None)
            cls._meta_by_session.pop(session_id, None)
            cls._jd_by_session.pop(session_id, None)
            shared_state = cls._shared_state_by_session.pop(session_id, None)
            if shared_state:
                shared_state.delete("resume_data")
        else:
            cls._data = None

    @classmethod
    def set_shared_state(cls, session_id: str, state: AgentSharedState):
        """绑定会话级 shared_state"""
        cls._shared_state_by_session[session_id] = state

    @classmethod
    def persist_data(cls, session_id: str) -> bool:
        """将简历数据写回 AI 简历存储（如果具备必要上下文）"""
        resume_data = cls.get_data(session_id)
        if not resume_data:
            logger.warning(
                f"[ResumeDataStore] No resume data for session: {session_id}"
            )
            return False

        meta = cls._meta_by_session.get(session_id, {})
        resume_id = meta.get("resume_id")
        user_id = meta.get("user_id")
        if not resume_id or not user_id:
            logger.warning(
                "[ResumeDataStore] Missing resume_id or user_id for session: "
                f"{session_id}, meta={meta}"
            )
            return False

        try:
            from backend.database import SessionLocal
            from backend.models import Resume

            db = SessionLocal()
            try:
                resume = db.query(Resume).filter(
                    Resume.id == resume_id, Resume.user_id == user_id
                ).first()
                if not resume:
                    logger.warning(
                        "[ResumeDataStore] Resume not found: "
                        f"resume_id={resume_id}, user_id={user_id}"
                    )
                    return False

                resume.name = cls._extract_name(resume_data) or resume.name
                resume.data = resume_data
                db.commit()
                logger.info(
                    "[ResumeDataStore] Successfully persisted resume: "
                    f"resume_id={resume_id}, name={resume.name}"
                )
                return True
            finally:
                db.close()
        except Exception as exc:
            logger.exception(
                "[ResumeDataStore] Failed to persist resume: "
                f"session_id={session_id}, resume_id={resume_id}, error={exc}"
            )
            return False


    @classmethod
    def set_session_jd(cls, session_id: str, jd_text: str) -> None:
        """记录本会话的目标岗位 JD（后续优化自动对齐）。"""
        if session_id and jd_text and jd_text.strip():
            cls._jd_by_session[session_id] = jd_text.strip()

    @classmethod
    def get_session_jd(cls, session_id: str) -> str:
        return cls._jd_by_session.get(session_id or "", "")
