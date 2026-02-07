"""
公司 Logo 配置 - 唯一数据源
Logo 图片托管在腾讯云 COS，后端提供 /api/logos 接口供前端获取
新增 Logo 只需：1) 上传到 COS  2) 在此文件添加一条记录
"""
import os
import urllib.request
from pathlib import Path

COS_BASE_URL = 'https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com'

# Logo 完整配置列表
# key: 唯一标识（英文）
# name: 显示名称（中文）
# file: COS 上的文件名
# keywords: 用于模糊匹配公司名称的关键词列表
LOGO_LIST = [
    {
        'key': 'bytedance',
        'name': '字节跳动',
        'file': '字节跳动.png',
        'keywords': ['字节', '跳动', 'bytedance', 'tiktok', '抖音', '飞书', '头条'],
    },
    {
        'key': 'tencent',
        'name': '腾讯',
        'file': '腾讯.png',
        'keywords': ['腾讯', 'tencent', '微信', 'wechat', 'qq'],
    },
    {
        'key': 'tencentcloud',
        'name': '腾讯云',
        'file': '腾讯云.png',
        'keywords': ['腾讯云', 'tencent cloud', 'tencentcloud'],
    },
    {
        'key': 'alibaba',
        'name': '阿里巴巴',
        'file': '阿里巴巴.png',
        'keywords': ['阿里', 'alibaba', '淘宝', '天猫', '达摩院', '钉钉'],
    },
    {
        'key': 'meituan',
        'name': '美团',
        'file': '美团.png',
        'keywords': ['美团', 'meituan'],
    },
    {
        'key': 'kuaishou',
        'name': '快手',
        'file': '快手.png',
        'keywords': ['快手', 'kuaishou'],
    },
    {
        'key': 'baidu',
        'name': '百度',
        'file': '百度.png',
        'keywords': ['百度', 'baidu'],
    },
    {
        'key': 'jd',
        'name': '京东',
        'file': '京东.png',
        'keywords': ['京东', 'jd', 'jingdong'],
    },
    {
        'key': 'huawei',
        'name': '华为',
        'file': '华为.png',
        'keywords': ['华为', 'huawei'],
    },
    {
        'key': 'xiaohongshu',
        'name': '小红书',
        'file': '小红书.png',
        'keywords': ['小红书', 'xiaohongshu', 'red'],
    },
    {
        'key': 'netease',
        'name': '网易',
        'file': '网易.png',
        'keywords': ['网易', 'netease'],
    },
    {
        'key': 'xiaomi',
        'name': '小米',
        'file': '小米.png',
        'keywords': ['小米', 'xiaomi', 'mi'],
    },
    {
        'key': 'didi',
        'name': '滴滴',
        'file': '滴滴.png',
        'keywords': ['滴滴', 'didi'],
    },
    {
        'key': 'pinduoduo',
        'name': '拼多多',
        'file': '拼多多.png',
        'keywords': ['拼多多', 'pinduoduo', 'pdd'],
    },
    {
        'key': 'bilibili',
        'name': 'bilibili',
        'file': 'bilibili.png',
        'keywords': ['bilibili', 'b站', '哔哩'],
    },
    {
        'key': 'antgroup',
        'name': '蚂蚁集团',
        'file': '蚂蚁集团.png',
        'keywords': ['蚂蚁集团', '蚂蚁金服', 'ant', '支付宝'],
    },
    {
        'key': 'microsoft',
        'name': '微软',
        'file': '微软.png',
        'keywords': ['微软', 'microsoft', 'msft'],
    },
    {
        'key': 'google',
        'name': '谷歌',
        'file': '谷歌.png',
        'keywords': ['谷歌', 'google'],
    },
    {
        'key': 'apple',
        'name': '苹果',
        'file': '苹果.png',
        'keywords': ['苹果', 'apple'],
    },
    {
        'key': 'deeplang',
        'name': '深言科技',
        'file': '深言科技.png',
        'keywords': ['深言', 'deeplang', '深言科技'],
    },
]

# 构建 key -> 配置 的快速查找表
_LOGO_MAP = {item['key']: item for item in LOGO_LIST}


def get_logo_by_key(key: str) -> dict | None:
    """根据 key 获取 Logo 完整配置"""
    return _LOGO_MAP.get(key)


def get_logo_cos_url(key: str) -> str | None:
    """根据 key 获取 Logo 的 COS URL"""
    item = _LOGO_MAP.get(key)
    if not item:
        return None
    return f"{COS_BASE_URL}/{urllib.request.quote(item['file'])}"


def get_all_logos_with_urls() -> list[dict]:
    """获取所有 Logo 列表（含完整 COS URL），供 API 返回"""
    result = []
    for item in LOGO_LIST:
        result.append({
            'key': item['key'],
            'name': item['name'],
            'url': f"{COS_BASE_URL}/{urllib.request.quote(item['file'])}",
            'keywords': item['keywords'],
        })
    return result


def download_logos_to_dir(internships: list, target_dir: str) -> dict[int, str]:
    """
    将 internships 中用到的 Logo 下载到目标目录
    
    返回: { index: local_filename } 映射，如 { 0: 'logo_0.png', 2: 'logo_2.png' }
    """
    logos_dir = Path(target_dir) / 'logos'
    logo_map = {}
    
    for idx, it in enumerate(internships):
        logo_key = it.get('logo')
        if not logo_key:
            continue
        
        cos_url = get_logo_cos_url(logo_key)
        if not cos_url:
            print(f"[Logo] 未知的 Logo key: {logo_key}")
            continue
        
        # 创建 logos 子目录
        logos_dir.mkdir(exist_ok=True)
        
        local_filename = f'logo_{idx}.png'
        local_path = logos_dir / local_filename
        
        try:
            print(f"[Logo] 下载: {cos_url} -> {local_path}")
            urllib.request.urlretrieve(cos_url, str(local_path))
            logo_map[idx] = local_filename
            print(f"[Logo] 下载成功: {local_filename} ({local_path.stat().st_size} bytes)")
        except Exception as e:
            print(f"[Logo] 下载失败 ({logo_key}): {e}")
    
    return logo_map
