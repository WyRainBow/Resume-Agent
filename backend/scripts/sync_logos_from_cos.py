"""
从 COS 拉取 Logo 并保存到仓库 images/logo/。

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
        EXCLUDED_FILES,
    )
except ModuleNotFoundError:
    from company_logos import (
        LOCAL_LOGO_DIR,
        KNOWN_LOGO_META,
        EXCLUDED_FILES,
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

    # 优先全量扫描 COS（保留中文原名）；失败时降级为已知列表
    items: list[str] = []
    try:
        marker = ""
        while True:
            resp = client.list_objects(Bucket=bucket, Prefix="", MaxKeys=1000, Marker=marker)
            for o in resp.get("Contents", []):
                key = o["Key"]
                lower = key.lower()
                if "/" in key:
                    continue
                if not lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg")):
                    continue
                if key in EXCLUDED_FILES:
                    continue
                items.append(key)
            if resp.get("IsTruncated") == "true":
                marker = resp.get("NextMarker", "")
                if not marker:
                    break
            else:
                break
        items = sorted(set(items))
    except Exception as exc:
        print(f"[Logo] list_objects 失败，降级已知列表: {exc}", flush=True)
        items = list(KNOWN_LOGO_META.keys())

    LOCAL_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for idx, cos_filename in enumerate(items, start=1):
        local_path = LOCAL_LOGO_DIR / cos_filename
        try:
            resp = client.get_object(Bucket=bucket, Key=cos_filename)
            # 注意：qcloud_cos 的 Body.read() 默认只读 1024 bytes，必须流式写入
            resp["Body"].get_stream_to_file(str(local_path))
            count += 1
            size = local_path.stat().st_size if local_path.exists() else 0
            print(f"  [{idx}/{len(items)}] {cos_filename} -> {local_path.name} ({size} bytes)", flush=True)
        except Exception as e:
            print(f"  下载失败 {cos_filename}: {e}", flush=True)

    print(f"[Logo] 同步完成，共 {count} 个文件已保存到 {LOCAL_LOGO_DIR}", flush=True)


if __name__ == "__main__":
    main()
