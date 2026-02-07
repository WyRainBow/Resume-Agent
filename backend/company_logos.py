"""
公司 Logo 映射配置
Logo 图片托管在腾讯云 COS，编译 LaTeX 时按需下载
"""
import os
import urllib.request
from pathlib import Path

COS_BASE_URL = 'https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com'

# Logo key -> COS 文件名映射
LOGO_FILE_MAP = {
    'bytedance': '字节跳动.png',
    'tencent': '腾讯.png',
    'alibaba': '阿里巴巴.png',
    'meituan': '美团.png',
    'kuaishou': '快手.png',
    'baidu': '百度.png',
    'jd': '京东.png',
    'huawei': '华为.png',
    'xiaohongshu': '小红书.png',
    'netease': '网易.png',
    'xiaomi': '小米.png',
    'didi': '滴滴.png',
    'pinduoduo': '拼多多.png',
    'bilibili': 'bilibili.png',
    'antgroup': '蚂蚁集团.png',
    'microsoft': '微软.png',
    'google': '谷歌.png',
    'apple': '苹果.png',
}


def get_logo_cos_url(key: str) -> str | None:
    """根据 key 获取 Logo 的 COS URL"""
    filename = LOGO_FILE_MAP.get(key)
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
