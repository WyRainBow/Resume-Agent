"""
共享的简历数据存储

所有简历相关工具（cv_reader_agent, cv_analyzer_agent, cv_editor_agent）
共享同一个简历数据源，确保数据一致性。
"""

from typing import Optional, Dict, Any

from backend.agent.agent.shared_state import AgentSharedState


class ResumeDataStore:
    """共享的简历数据存储"""

    _data: Optional[dict] = None
    _data_by_session: Dict[str, dict] = {}
    _shared_state_by_session: Dict[str, AgentSharedState] = {}
    _meta_by_session: Dict[str, Dict[str, Any]] = {}

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
        return basics.get("name")

    @classmethod
    def set_data(cls, resume_data: dict, session_id: Optional[str] = None):
        """设置简历数据"""
        cls._data = resume_data
        if session_id:
            cls._data_by_session[session_id] = resume_data
            cls._meta_by_session[session_id] = cls._extract_meta(resume_data)
            shared_state = cls._shared_state_by_session.get(session_id)
            if shared_state:
                shared_state.set("resume_data", resume_data)

    @classmethod
    def get_data(cls, session_id: Optional[str] = None) -> Optional[dict]:
        """获取简历数据"""
        if session_id:
            shared_state = cls._shared_state_by_session.get(session_id)
            if shared_state and shared_state.has("resume_data"):
                return shared_state.get("resume_data")
            if session_id in cls._data_by_session:
                return cls._data_by_session[session_id]
        return cls._data

    @classmethod
    def clear_data(cls, session_id: Optional[str] = None):
        """清空简历数据"""
        cls._data = None
        if session_id and session_id in cls._data_by_session:
            cls._data_by_session.pop(session_id, None)
            cls._meta_by_session.pop(session_id, None)
            shared_state = cls._shared_state_by_session.get(session_id)
            if shared_state:
                shared_state.delete("resume_data")

    @classmethod
    def set_shared_state(cls, session_id: str, state: AgentSharedState):
        """绑定会话级 shared_state"""
        cls._shared_state_by_session[session_id] = state

    @classmethod
    def persist_data(cls, session_id: str) -> bool:
        """将简历数据写回 AI 简历存储（如果具备必要上下文）"""
        resume_data = cls.get_data(session_id)
        if not resume_data:
            return False

        meta = cls._meta_by_session.get(session_id, {})
        resume_id = meta.get("resume_id")
        user_id = meta.get("user_id")
        if not resume_id or not user_id:
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
                    return False

                resume.name = cls._extract_name(resume_data) or resume.name
                resume.data = resume_data
                db.commit()
                return True
            finally:
                db.close()
        except Exception:
            return False
