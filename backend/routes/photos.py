"""
用户照片上传路由
- POST /api/photos/upload  上传用户照片到 COS
"""
import os
import re
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from middleware.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Photos"])


def _import_cos_base_url() -> str:
    """复用 company_logos 的 COS_BASE_URL"""
    try:
        import backend.company_logos as m
    except ModuleNotFoundError:
        import company_logos as m
    return m.COS_BASE_URL


def _sanitize_account_name(account: str) -> str:
    """将账号名转换为安全的文件夹名"""
    if not account:
        return "unknown"
    lowered = account.strip().lower()
    # 保留常见用户名字符，其他字符替换为下划线，避免路径问题
    return re.sub(r"[^a-z0-9._-]+", "_", lowered).strip("._-") or "unknown"


@router.post("/photos/upload")
async def upload_photo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """
    上传用户照片到 COS
    - 仅登录用户可用
    - 支持 png/jpg/jpeg/webp
    - 最大 2MB
    - 存储路径: users/<account>/photos/<uuid>.<ext>
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")

    # 校验格式
    allowed_ext = {'.png', '.jpg', '.jpeg', '.webp'}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"不支持的格式 {ext}，仅支持 {', '.join(allowed_ext)}")

    content = await file.read()
    max_size = 2 * 1024 * 1024  # 2MB
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="文件过大，最大 2MB")

    try:
        from qcloud_cos import CosConfig, CosS3Client

        secret_id = os.getenv('COS_SECRET_ID', '')
        secret_key = os.getenv('COS_SECRET_KEY', '')
        region = os.getenv('COS_REGION', 'ap-guangzhou')
        bucket = os.getenv('COS_BUCKET', 'resumecos-1327706280')

        if not secret_id or not secret_key:
            raise HTTPException(status_code=500, detail="COS 凭证未配置")

        config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
        client = CosS3Client(config)

        # 以数据库 username 创建目录
        account = getattr(current_user, 'username', '') or getattr(current_user, 'email', '') or str(getattr(current_user, 'id', ''))
        safe_account = _sanitize_account_name(account)
        filename = f"{uuid.uuid4().hex}{ext}"
        cos_key = f"users/{safe_account}/photos/{filename}"

        client.put_object(
            Bucket=bucket,
            Body=content,
            Key=cos_key,
            ContentType=file.content_type or 'image/png',
        )

        import urllib.parse
        cos_base = _import_cos_base_url()
        url = f"{cos_base}/{urllib.parse.quote(cos_key, safe='/')}"

        return {
            "success": True,
            "photo": {
                "url": url,
                "key": cos_key,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
