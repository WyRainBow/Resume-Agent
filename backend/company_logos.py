"""
公司 Logo 管理
从腾讯云 COS 动态获取 Logo 列表，支持关键词匹配
新增 Logo 只需上传到 COS，无需改代码
"""
import os
import time
import urllib.request
from pathlib import Path

COS_BASE_URL = 'https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com'

# ── 非 Logo 文件排除列表（COS 中的截图、UI 素材等） ──
EXCLUDED_FILES = {
    'AI对话生成简历.png',
    'classic.png',
    'html.png',
    'resume.preview.png',
    '工作区.png',
    '我的简历.png',
    '首页.png',
}

# ── 已知 Logo 的丰富元数据（可选，用于关键词匹配和英文 key） ──
# 如果 COS 上的某个 Logo 文件不在此表中，会自动生成基础信息
KNOWN_LOGO_META = {
    '字节跳动.png': {
        'key': 'bytedance',
        'keywords': ['字节', '跳动', 'bytedance', 'tiktok', '抖音', '飞书', '头条'],
    },
    '腾讯.png': {
        'key': 'tencent',
        'keywords': ['腾讯', 'tencent', '微信', 'wechat', 'qq'],
    },
    '腾讯云.png': {
        'key': 'tencentcloud',
        'keywords': ['腾讯云', 'tencent cloud', 'tencentcloud'],
    },
    '阿里巴巴.png': {
        'key': 'alibaba',
        'keywords': ['阿里', 'alibaba', '淘宝', '天猫', '达摩院', '钉钉'],
    },
    '美团.png': {
        'key': 'meituan',
        'keywords': ['美团', 'meituan'],
    },
    '快手.png': {
        'key': 'kuaishou',
        'keywords': ['快手', 'kuaishou'],
    },
    '百度.png': {
        'key': 'baidu',
        'keywords': ['百度', 'baidu'],
    },
    '京东.png': {
        'key': 'jd',
        'keywords': ['京东', 'jd', 'jingdong'],
    },
    '华为.png': {
        'key': 'huawei',
        'keywords': ['华为', 'huawei'],
    },
    '小红书.png': {
        'key': 'xiaohongshu',
        'keywords': ['小红书', 'xiaohongshu', 'red'],
    },
    '网易.png': {
        'key': 'netease',
        'keywords': ['网易', 'netease'],
    },
    '小米.png': {
        'key': 'xiaomi',
        'keywords': ['小米', 'xiaomi', 'mi'],
    },
    '滴滴.png': {
        'key': 'didi',
        'keywords': ['滴滴', 'didi'],
    },
    '拼多多.png': {
        'key': 'pinduoduo',
        'keywords': ['拼多多', 'pinduoduo', 'pdd'],
    },
    'bilibili.png': {
        'key': 'bilibili',
        'keywords': ['bilibili', 'b站', '哔哩'],
    },
    '蚂蚁集团.png': {
        'key': 'antgroup',
        'keywords': ['蚂蚁集团', '蚂蚁金服', 'ant', '支付宝'],
    },
    '微软.png': {
        'key': 'microsoft',
        'keywords': ['微软', 'microsoft', 'msft'],
    },
    '谷歌.png': {
        'key': 'google',
        'keywords': ['谷歌', 'google'],
    },
    '苹果.png': {
        'key': 'apple',
        'keywords': ['苹果', 'apple'],
    },
    '深言科技.png': {
        'key': 'deeplang',
        'keywords': ['深言', 'deeplang', '深言科技'],
    },
}

# ── COS 扫描结果缓存 ──
_cos_cache: list[dict] | None = None
_cos_cache_time: float = 0
_COS_CACHE_TTL = 300  

# 同时构建 key -> 文件名 查找表（在扫描后更新）
_key_to_file: dict[str, str] = {}


def _scan_cos_logos() -> list[dict]:
    """扫描 COS 获取所有 Logo 文件，排除非 Logo 文件"""
    global _cos_cache, _cos_cache_time, _key_to_file

    # 使用缓存
    if _cos_cache is not None and (time.time() - _cos_cache_time) < _COS_CACHE_TTL:
        return _cos_cache

    try:
        from qcloud_cos import CosConfig, CosS3Client

        secret_id = os.getenv('secret_id', '')
        secret_key = os.getenv('secret_key', '')
        region = os.getenv('region', 'ap-guangzhou')
        bucket = os.getenv('bucket', 'resumecos-1327706280')

        if not secret_id or not secret_key:
            print("[Logo] COS 凭证未配置，使用已知 Logo 列表")
            return _fallback_logos()

        config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
        client = CosS3Client(config)
        response = client.list_objects(Bucket=bucket, MaxKeys=500)

        logos = []
        key_map = {}

        for obj in response.get('Contents', []):
            filename = obj['Key']
            # 只要 .png 文件，排除非 Logo
            if not filename.lower().endswith('.png'):
                continue
            if filename in EXCLUDED_FILES:
                continue

            name = filename.rsplit('.', 1)[0]  # 去掉 .png 后缀
            meta = KNOWN_LOGO_META.get(filename, {})
            logo_key = meta.get('key', name)  # 没有配置的用文件名做 key
            keywords = meta.get('keywords', [name])  # 没有配置的用文件名做关键词

            logo_entry = {
                'key': logo_key,
                'name': name,
                'url': f"{COS_BASE_URL}/{urllib.request.quote(filename)}",
                'keywords': keywords,
            }
            logos.append(logo_entry)
            key_map[logo_key] = filename

        _cos_cache = logos
        _cos_cache_time = time.time()
        _key_to_file = key_map
        print(f"[Logo] COS 扫描完成，发现 {len(logos)} 个 Logo")
        return logos

    except Exception as e:
        print(f"[Logo] COS 扫描失败: {e}，使用已知 Logo 列表")
        return _fallback_logos()


def _fallback_logos() -> list[dict]:
    """COS 不可用时的降级方案：使用已知 Logo 列表"""
    global _key_to_file
    logos = []
    key_map = {}
    for filename, meta in KNOWN_LOGO_META.items():
        logo_key = meta['key']
        name = filename.rsplit('.', 1)[0]
        logos.append({
            'key': logo_key,
            'name': name,
            'url': f"{COS_BASE_URL}/{urllib.request.quote(filename)}",
            'keywords': meta['keywords'],
        })
        key_map[logo_key] = filename
    _key_to_file = key_map
    return logos


def get_all_logos_with_urls() -> list[dict]:
    """获取所有 Logo 列表（从 COS 动态扫描），供 API 返回"""
    return _scan_cos_logos()


def get_logo_cos_url(key: str) -> str | None:
    """根据 key 获取 Logo 的 COS URL"""
    # 确保缓存已加载
    _scan_cos_logos()

    filename = _key_to_file.get(key)
    if not filename:
        return None
    return f"{COS_BASE_URL}/{urllib.request.quote(filename)}"


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
