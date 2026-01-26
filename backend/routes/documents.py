"""
文档内容管理路由
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database import get_db
from backend.models import Document

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentContentRequest(BaseModel):
    """文档内容更新请求"""
    content: str


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    db: Session = Depends(get_db)
):
    """
    获取文档内容
    
    Args:
        document_id: 文档 ID
        db: 数据库会话
    
    Returns:
        { content, updated_at }
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        return {
            "content": document.content,
            "updated_at": document.updated_at.isoformat() if document.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文档内容失败: {str(e)}")


@router.post("/{document_id}/content")
async def update_document_content(
    document_id: str,
    request: DocumentContentRequest,
    db: Session = Depends(get_db)
):
    """
    更新文档内容（简单覆盖）
    
    Args:
        document_id: 文档 ID
        request: 文档内容请求
        db: 数据库会话
    
    Returns:
        { success }
    """
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise HTTPException(status_code=404, detail="文档不存在")
        
        # 直接更新内容
        document.content = request.content
        db.commit()
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"更新文档内容失败: {str(e)}")
