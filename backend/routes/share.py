"""
分享简历的 API 路由
提供生成分享链接和查看分享简历的功能
"""
import uuid
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/resume", tags=["resume-share"])

# 使用内存存储（生产环境应使用数据库）
# 实际应用中应该使用 Redis 或数据库
share_store: Dict[str, Dict[str, Any]] = {}


class ShareResumeRequest(BaseModel):
    """分享简历请求"""
    resume_data: Dict[str, Any]
    resume_name: str
    expire_days: int = 30  # 默认 30 天后过期


class ShareResumeResponse(BaseModel):
    """分享简历响应"""
    share_url: str
    share_id: str
    expires_at: str


@router.post("/share", response_model=ShareResumeResponse)
async def create_share_link(request: ShareResumeRequest):
    """
    生成分享链接
    
    Args:
        request: 包含简历数据和名称
        
    Returns:
        分享链接信息
    """
    # 生成唯一 ID
    share_id = str(uuid.uuid4())[:8]
    
    # 计算过期时间
    expires_at = datetime.now() + timedelta(days=request.expire_days)
    
    # 存储分享数据
    share_store[share_id] = {
        "resume_data": request.resume_data,
        "resume_name": request.resume_name,
        "created_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "views": 0
    }
    
    # 构建分享 URL（应该配置实际域名）
    # 本地开发: http://localhost:3000/share/{share_id}
    # 生产环境: https://yourdomain.com/share/{share_id}
    share_url = f"http://localhost:3000/share/{share_id}"
    
    return ShareResumeResponse(
        share_url=share_url,
        share_id=share_id,
        expires_at=expires_at.isoformat()
    )


@router.get("/share/{share_id}")
async def get_shared_resume(share_id: str):
    """
    获取分享的简历
    
    Args:
        share_id: 分享 ID
        
    Returns:
        简历数据
    """
    if share_id not in share_store:
        raise HTTPException(status_code=404, detail="分享链接不存在或已过期")
    
    share_data = share_store[share_id]
    
    # 检查是否过期
    expires_at = datetime.fromisoformat(share_data["expires_at"])
    if datetime.now() > expires_at:
        del share_store[share_id]
        raise HTTPException(status_code=404, detail="分享链接已过期")
    
    # 增加浏览次数
    share_data["views"] += 1
    
    return {
        "success": True,
        "data": share_data["resume_data"],
        "name": share_data["resume_name"],
        "expires_at": share_data["expires_at"],
        "views": share_data["views"]
    }


@router.delete("/share/{share_id}")
async def delete_share_link(share_id: str):
    """
    删除分享链接
    
    Args:
        share_id: 分享 ID
        
    Returns:
        删除结果
    """
    if share_id not in share_store:
        raise HTTPException(status_code=404, detail="分享链接不存在")
    
    del share_store[share_id]
    return {"success": True, "message": "分享链接已删除"}


@router.get("/shares")
async def list_share_links():
    """
    列出所有分享链接（用于管理）
    
    Returns:
        分享链接列表
    """
    shares = []
    for share_id, data in share_store.items():
        expires_at = datetime.fromisoformat(data["expires_at"])
        is_expired = datetime.now() > expires_at
        
        shares.append({
            "share_id": share_id,
            "resume_name": data["resume_name"],
            "created_at": data["created_at"],
            "expires_at": data["expires_at"],
            "views": data["views"],
            "is_expired": is_expired
        })
    
    return {"shares": shares}


# 数据库存储版本（生产环境推荐）
"""
# 使用 SQLAlchemy 的数据库存储示例

from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session
import uuid

Base = declarative_base()

class ShareResume(Base):
    __tablename__ = "share_resumes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4())[:8])
    resume_name = Column(String)
    resume_data = Column(Text)  # JSON 字符串
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime)
    views = Column(Integer, default=0)
    
    @classmethod
    def from_request(cls, request: ShareResumeRequest):
        share_id = str(uuid.uuid4())[:8]
        expires_at = datetime.now() + timedelta(days=request.expire_days)
        return cls(
            id=share_id,
            resume_name=request.resume_name,
            resume_data=json.dumps(request.resume_data),
            expires_at=expires_at
        )

@router.post("/share", response_model=ShareResumeResponse)
async def create_share_link_db(request: ShareResumeRequest, db: Session = Depends(get_db)):
    share = ShareResume.from_request(request)
    db.add(share)
    db.commit()
    db.refresh(share)
    
    return ShareResumeResponse(
        share_url=f"http://localhost:3000/share/{share.id}",
        share_id=share.id,
        expires_at=share.expires_at.isoformat()
    )
"""

