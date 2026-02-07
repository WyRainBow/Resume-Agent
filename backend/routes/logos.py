"""
公司 Logo 路由
- GET  /api/logos         获取所有可用的 Logo 列表
- POST /api/logos/upload  上传自定义 Logo 到 COS
"""
import os
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/api", tags=["Logos"])


def _import_logos():
    """兼容两种导入方式"""
    try:
        import backend.company_logos as m
    except ModuleNotFoundError:
        import company_logos as m
    return m


@router.get("/logos")
async def get_logos():
    """获取所有可用的公司 Logo 列表（含 COS URL）"""
    try:
        m = _import_logos()
        logos = m.get_all_logos_with_urls()
        return {"logos": logos}
    except Exception as e:
        return {"logos": [], "error": str(e)}


@router.post("/logos/upload")
async def upload_logo(file: UploadFile = File(...)):
    """
    上传自定义 Logo 到 COS
    - 支持 png/jpg/jpeg/webp/svg 格式
    - 文件名作为 Logo 名称（去掉后缀）
    - 上传成功后清除缓存，下次 GET /api/logos 会包含新 Logo
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")

    # 校验格式
    allowed_ext = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
    ext = os.path.splitext(file.filename)[1].lower()
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
        cos_key = file.filename
        client.put_object(
            Bucket=bucket,
            Body=content,
            Key=cos_key,
            ContentType=file.content_type or 'image/png',
        )

        # 清除缓存，让下次 GET 能拿到新 Logo
        m = _import_logos()
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
