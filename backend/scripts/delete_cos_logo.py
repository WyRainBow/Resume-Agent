"""
从腾讯云 COS 删除指定 Logo 文件（按文件名，与 /api/logos/upload 使用的 key 一致）。

用法（项目根目录）:
  PYTHONPATH=. python backend/scripts/delete_cos_logo.py 微信图片_20260209155331_5821_2850.png

依赖：.env 中配置 COS_SECRET_ID、COS_SECRET_KEY（以及可选 COS_REGION、COS_BUCKET）。
"""
import os
import sys
from pathlib import Path

# 加载项目根目录 .env
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except Exception:
    pass

def main():
    if len(sys.argv) < 2:
        print("用法: python backend/scripts/delete_cos_logo.py <cos_key>")
        print("示例: python backend/scripts/delete_cos_logo.py 微信图片_20260209155331_5821_2850.png")
        sys.exit(1)
    cos_key = sys.argv[1].strip()
    if not cos_key:
        print("错误: cos_key 为空")
        sys.exit(1)

    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    region = os.getenv("COS_REGION", "ap-guangzhou")
    bucket = os.getenv("COS_BUCKET", "resumecos-1327706280")

    if not secret_id or not secret_key:
        print("错误：.env 中未配置 COS_SECRET_ID / COS_SECRET_KEY")
        sys.exit(1)

    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        print("错误：请安装 qcloud_cos: pip install cos-python-sdk-v5")
        sys.exit(1)

    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    client = CosS3Client(config)

    try:
        client.delete_object(Bucket=bucket, Key=cos_key)
        print(f"已从 COS 删除: {cos_key}")
    except Exception as e:
        print(f"删除失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
