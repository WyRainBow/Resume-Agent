"""
公司 Logo 路由
提供 /api/logos 接口，前端从此获取可用的 Logo 列表
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Logos"])


@router.get("/logos")
async def get_logos():
    """获取所有可用的公司 Logo 列表（含 COS URL）"""
    try:
        # 兼容两种导入方式
        try:
            from backend.company_logos import get_all_logos_with_urls
        except ModuleNotFoundError:
            from company_logos import get_all_logos_with_urls

        logos = get_all_logos_with_urls()
        return {"logos": logos}
    except Exception as e:
        return {"logos": [], "error": str(e)}
