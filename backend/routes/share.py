"""
分享简历的 API 路由
提供生成分享链接和查看分享简历的功能
"""
import uuid
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

# 与其他接口保持一致，使用 /api 前缀
router = APIRouter(prefix="/api/resume", tags=["resume-share"])

# 使用内存存储（生产环境请替换为数据库/Redis）
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
        "views": 0,
    }

    # 分享链接配置（根据环境设置）
    # 开发环境：http://localhost:5173/share/{share_id}
    # 生产环境：https://yourdomain.com/share/{share_id}
    share_url = f"http://localhost:5173/share/{share_id}"

    return ShareResumeResponse(
        share_url=share_url,
        share_id=share_id,
        expires_at=expires_at.isoformat(),
    )


@router.get("/share/{share_id}")
async def get_shared_resume(share_id: str):
    """获取分享的简历"""
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
        "views": share_data["views"],
    }


@router.delete("/share/{share_id}")
async def delete_share_link(share_id: str):
    """删除分享链接"""
    if share_id not in share_store:
        raise HTTPException(status_code=404, detail="分享链接不存在")

    del share_store[share_id]
    return {"success": True, "message": "分享链接已删除"}


@router.get("/shares")
async def list_share_links():
    """列出所有分享链接"""
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
            "is_expired": is_expired,
        })

    return {"shares": shares}
