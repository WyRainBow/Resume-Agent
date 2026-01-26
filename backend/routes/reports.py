"""
报告管理路由
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Report, Document, ReportConversation

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/")
async def create_report(
    topic: str,
    title: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    创建新报告
    
    Args:
        topic: 报告主题
        title: 报告标题（可选，默认从 topic 生成）
        db: 数据库会话
    
    Returns:
        { reportId, mainId, conversation_id }
    """
    try:
        # 生成报告 ID
        report_id = str(uuid.uuid4())
        
        # 生成标题（如果没有提供）
        if not title:
            title = topic[:50] + ("..." if len(topic) > 50 else "")
        
        # 1. 创建文档记录（content 为空）
        document_id = str(uuid.uuid4())
        document = Document(
            id=document_id,
            content="",
            type="main"
        )
        db.add(document)
        db.flush()
        
        # 2. 创建报告记录
        report = Report(
            id=report_id,
            title=title,
            main_id=document_id,
            user_id=None  # 暂不支持用户关联
        )
        db.add(report)
        db.flush()
        
        # 3. 创建对话（使用 report_id 作为 conversation_id 的一部分）
        conversation_id = f"report-{report_id}"
        
        # 4. 关联报告和对话
        report_conv = ReportConversation(
            report_id=report_id,
            conversation_id=conversation_id
        )
        db.add(report_conv)
        
        db.commit()
        
        return {
            "reportId": report_id,
            "mainId": document_id,
            "conversation_id": conversation_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建报告失败: {str(e)}")


@router.get("/{report_id}")
async def get_report(
    report_id: str,
    db: Session = Depends(get_db)
):
    """
    获取报告详情
    
    Args:
        report_id: 报告 ID
        db: 数据库会话
    
    Returns:
        报告信息
    """
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="报告不存在")
        
        # 获取关联的对话 ID
        report_conv = db.query(ReportConversation).filter(
            ReportConversation.report_id == report_id
        ).first()
        
        conversation_id = report_conv.conversation_id if report_conv else None
        
        return {
            "id": report.id,
            "title": report.title,
            "main_id": report.main_id,
            "conversation_id": conversation_id,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "updated_at": report.updated_at.isoformat() if report.updated_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报告失败: {str(e)}")


@router.post("/{report_id}/ensure-conversation")
async def ensure_conversation(
    report_id: str,
    db: Session = Depends(get_db)
):
    """
    确保报告有关联的对话
    
    Args:
        report_id: 报告 ID
        db: 数据库会话
    
    Returns:
        { conversation_id }
    """
    try:
        # 检查报告是否存在
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="报告不存在")
        
        # 检查是否已有对话关联
        report_conv = db.query(ReportConversation).filter(
            ReportConversation.report_id == report_id
        ).first()
        
        if report_conv:
            # 已有对话，直接返回
            return {"conversation_id": report_conv.conversation_id}
        
        # 创建新对话关联
        conversation_id = f"report-{report_id}"
        report_conv = ReportConversation(
            report_id=report_id,
            conversation_id=conversation_id
        )
        db.add(report_conv)
        db.commit()
        
        return {"conversation_id": conversation_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"确保对话关联失败: {str(e)}")
