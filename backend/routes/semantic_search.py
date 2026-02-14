"""
语义搜索 API - 基于向量嵌入的简历内容搜索
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from database import get_db
from services.embedding_service import EmbeddingService


router = APIRouter(prefix="/api/search", tags=["Semantic Search"])


class SearchRequest(BaseModel):
    """语义搜索请求"""
    query: str = Field(..., description="搜索查询文本")
    content_type: Optional[str] = Field(None, description="限制内容类型: summary/experience/projects/skills/education")
    limit: int = Field(10, description="返回结果数量", ge=1, le=50)


class SearchResult(BaseModel):
    """搜索结果"""
    id: int
    resume_id: str
    content_type: str
    content: str
    metadata: Dict[str, Any]
    similarity: float


@router.post("/semantic", response_model=List[SearchResult])
async def semantic_search(
    request: SearchRequest,
    db: Session = Depends(get_db)
):
    """
    语义搜索简历内容

    基于向量嵌入进行语义相似度搜索，而非关键词匹配。

    需要：
    - 已配置 OpenAI API（或其他兼容 API）
    - 已为简历生成向量嵌入
    - 数据库支持 pgvector（PostgreSQL）

    示例查询：
    - "Python 后端开发经验"
    - "机器学习项目"
    - "React 前端工程师"
    """
    from routes.auth import get_current_user

    # 获取当前用户
    current_user = await get_current_user(dependency=None)
    if not current_user:
        return []

    service = EmbeddingService(db)

    results = service.search_similar(
        query=request.query,
        user_id=current_user.id,
        limit=request.limit,
        content_type=request.content_type
    )

    return results


@router.post("/embeddings/generate/{resume_id}")
async def generate_embeddings(
    resume_id: str,
    db: Session = Depends(get_db)
):
    """
    为指定简历生成向量嵌入

    这将：
    1. 删除该简历的旧嵌入
    2. 提取简历的各个部分（summary, experience, projects, skills 等）
    3. 为每个部分生成向量嵌入
    4. 存储到数据库

    调用此 API 会产生 OpenAI API 费用。
    """
    from routes.auth import get_current_user

    current_user = await get_current_user(dependency=None)
    if not current_user:
        return {"error": "Unauthorized"}

    from services.embedding_service import create_embeddings_for_user_resume

    success = create_embeddings_for_user_resume(db, current_user.id, resume_id)

    if success:
        return {"status": "ok", "message": "Embeddings generated successfully"}
    else:
        return {"status": "error", "message": "Failed to generate embeddings"}


@router.get("/embeddings/status/{resume_id}")
async def get_embedding_status(
    resume_id: str,
    db: Session = Depends(get_db)
):
    """
    查询简历的向量嵌入状态

    返回该简历已生成的嵌入数量和类型分布。
    """
    from routes.auth import get_current_user
    from models import ResumeEmbedding
    from sqlalchemy import func

    current_user = await get_current_user(dependency=None)
    if not current_user:
        return {"error": "Unauthorized"}

    # 统计嵌入数量
    total = db.query(ResumeEmbedding).filter(
        ResumeEmbedding.resume_id == resume_id,
        ResumeEmbedding.user_id == current_user.id
    ).count()

    # 按类型分组统计
    type_stats = db.query(
        ResumeEmbedding.content_type,
        func.count(ResumeEmbedding.id)
    ).filter(
        ResumeEmbedding.resume_id == resume_id,
        ResumeEmbedding.user_id == current_user.id
    ).group_by(ResumeEmbedding.content_type).all()

    return {
        "resume_id": resume_id,
        "total_embeddings": total,
        "by_type": {t: c for t, c in type_stats}
    }
