"""
从 COS 拉取 Logo 并保存到仓库 images/logo/，按已知列表一个个下载，避免 list 超时。

在项目根目录执行：
  python backend/scripts/sync_logos_from_cos.py

依赖：.env 中配置 COS_SECRET_ID、COS_SECRET_KEY（以及可选 COS_REGION、COS_BUCKET）。
"""
import os
import sys
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

# 复用 company_logos 的目录与 key 映射
try:
    from backend.company_logos import (
        LOCAL_LOGO_DIR,
        KNOWN_LOGO_META,
    )
except ModuleNotFoundError:
    from company_logos import (
        LOCAL_LOGO_DIR,
        KNOWN_LOGO_META,
    )


def main():
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

    # 只按已知列表逐个下载，不调 list_objects
    # 保持 COS 原始文件名（通常为中文名），避免本地文件名与线上不一致
    items = list(KNOWN_LOGO_META.keys())

    LOCAL_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for idx, cos_filename in enumerate(items, start=1):
        local_path = LOCAL_LOGO_DIR / cos_filename
        try:
            resp = client.get_object(Bucket=bucket, Key=cos_filename)
            data = resp["Body"].read()
            local_path.write_bytes(data)
            count += 1
            print(f"  [{idx}/{len(items)}] {cos_filename} -> {local_path.name}", flush=True)
        except Exception as e:
            print(f"  下载失败 {cos_filename}: {e}", flush=True)

    print(f"[Logo] 同步完成，共 {count} 个文件已保存到 {LOCAL_LOGO_DIR}", flush=True)


if __name__ == "__main__":
    main()
