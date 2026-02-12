"""
一次性脚本：将项目根目录的 image.png 上传到 COS，并输出可公网访问的 URL。
在项目根目录执行：python backend/scripts/upload_landing_image.py
"""
import os
import sys
import urllib.parse
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

COS_BASE_URL = "https://resumecos-1327706280.cos.ap-guangzhou.myqcloud.com"
COS_KEY = "landing/product-preview.png"


def main():
    image_path = PROJECT_ROOT / "image.png"
    if not image_path.is_file():
        print(f"错误：未找到 {image_path}")
        sys.exit(1)

    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    region = os.getenv("COS_REGION", "ap-guangzhou")
    bucket = os.getenv("COS_BUCKET", "resumecos-1327706280")

    if not secret_id or not secret_key:
        print("错误：.env 中未配置 COS_SECRET_ID / COS_SECRET_KEY")
        sys.exit(1)

    from qcloud_cos import CosConfig, CosS3Client

    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    client = CosS3Client(config)

    with open(image_path, "rb") as f:
        body = f.read()

    client.put_object(
        Bucket=bucket,
        Body=body,
        Key=COS_KEY,
        ContentType="image/png",
    )

    url = f"{COS_BASE_URL}/{urllib.parse.quote(COS_KEY, safe='/')}"
    print(url)


if __name__ == "__main__":
    main()
