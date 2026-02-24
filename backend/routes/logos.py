"""
公司 Logo 路由
- GET  /api/logos           获取所有可用的 Logo 列表
- GET  /api/logos/file/{key}  获取本地 Logo 图片（当使用 images/logo 时）
- POST /api/logos/upload    上传自定义 Logo 到 COS
"""
import os
import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from middleware.auth import require_admin_or_member
from models import User

router = APIRouter(prefix="/api", tags=["Logos"])
logger = logging.getLogger(__name__)


def _import_logos():
    """兼容两种导入方式"""
    try:
        import backend.company_logos as m
    except ModuleNotFoundError:
        import company_logos as m
    return m


@router.get("/logos/file/{key}")
async def get_logo_file(key: str):
    """提供本地 images/logo 目录下的 Logo 图片（支持中文文件名，key 可为英文或中文）"""
    m = _import_logos()
    if ".." in key or "/" in key or "\\" in key:
        raise HTTPException(status_code=400, detail="无效的 key")
    path = m.get_logo_local_path(key)
    if path is None:
        raise HTTPException(status_code=404, detail="Logo 不存在")
    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@router.get("/logos")
async def get_logos():
    """获取所有可用的公司 Logo 列表（含 COS URL）。异常时始终返回 200 + 空列表，避免 500。"""
    try:
        m = _import_logos()
        logos = m.get_all_logos_with_urls()
        return JSONResponse(status_code=200, content={"logos": logos})
    except Exception as e:
        module_file = ""
        logo_dir = ""
        try:
            m = _import_logos()
            module_file = str(getattr(m, "__file__", ""))
            logo_dir = str(getattr(m, "LOCAL_LOGO_DIR", ""))
        except Exception:
            pass
        logger.exception(
            "[Logo] get_logos failed: err=%s module_file=%s logo_dir=%s",
            e,
            module_file,
            logo_dir,
        )
        return JSONResponse(
            status_code=200,
            content={
                "logos": [],
                "error_code": "LOGO_LIST_FAILED",
                "error": str(e),
                "error_message": str(e),
            },
        )


@router.post("/logos/upload")
async def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin_or_member),
):
    """
    上传自定义 Logo 到 COS
    - 支持 png/jpg/jpeg/webp/svg 格式
    - 文件名作为 Logo 名称（去掉后缀）
    - 上传成功后清除缓存，下次 GET /api/logos 会包含新 Logo
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")
    safe_filename = Path(file.filename).name
    if not safe_filename:
        raise HTTPException(status_code=400, detail="文件名无效")

    # 校验格式
    allowed_ext = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in allowed_ext:
        raise HTTPException(status_code=400, detail=f"不支持的格式 {ext}，仅支持 {', '.join(allowed_ext)}")

    # 校验大小（读取内容）
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

        # 上传到 COS（直接用原文件名）
        cos_key = safe_filename
        client.put_object(
            Bucket=bucket,
            Body=content,
            Key=cos_key,
            ContentType=file.content_type or 'image/png',
        )

        m = _import_logos()
        # 同步写入本地 images/logo（与 COS 保持同名）
        local_dir = Path(m.LOCAL_LOGO_DIR)
        local_dir.mkdir(parents=True, exist_ok=True)
        (local_dir / cos_key).write_bytes(content)

        # 清除缓存，让下次 GET 能拿到新 Logo
        m.clear_cache()

        import urllib.request
        cos_base = m.COS_BASE_URL
        name = os.path.splitext(cos_key)[0]
        url = f"{cos_base}/{urllib.request.quote(cos_key)}"

        return {
            "success": True,
            "logo": {
                "key": name,
                "name": name,
                "url": url,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
