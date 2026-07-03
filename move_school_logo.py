#!/usr/bin/env python3
"""
移动学校 logo：在腾讯 COS 与本地缓存目录（images/school_logo）之间，
把某个学校从一个分组目录移动到另一个分组目录，COS 与本地同步。

用法:
    python move_school_logo.py --school 北京交通大学 --from 985 --to 211

参数:
    --school  学校名（与文件名一致、不含扩展名，如「北京交通大学」）
    --from    源分组: 985 / 211 / 香港 / 双非
    --to      目标分组: 985 / 211 / 香港 / 双非

说明:
    - COS 上没有原生 move，脚本用「复制到目标 + 删除源」实现。
    - 本地 images/school_logo 存在同名文件则一起移动；不存在则跳过（线上以 COS 为准）。
    - 移动后后端有 logo 列表缓存，前端未即时刷新时重启后端或等缓存过期即可。
    - 依赖 qcloud_cos 与根目录 .env 的 COS_SECRET_ID/COS_SECRET_KEY/COS_BUCKET/COS_REGION。
      用项目虚拟环境运行，例如: .venv/bin/python move_school_logo.py --school ... --from ... --to ...
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
LOCAL_SCHOOL_LOGO_DIR = REPO_ROOT / "images" / "school_logo"
ALLOWED_GROUPS = {"985", "211", "香港", "双非"}
EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg"]

import os

try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except Exception:
    pass


def _cos_client():
    secret_id = os.getenv("COS_SECRET_ID", "")
    secret_key = os.getenv("COS_SECRET_KEY", "")
    region = os.getenv("COS_REGION", "ap-guangzhou")
    bucket = os.getenv("COS_BUCKET", "")
    if not (secret_id and secret_key and bucket):
        sys.exit("错误: COS 凭证未配置（需 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET）")
    from qcloud_cos import CosConfig, CosS3Client

    client = CosS3Client(
        CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    )
    return client, bucket, region


def _cos_exists(client, bucket, key) -> bool:
    try:
        client.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def _find_ext(client, bucket, group, school):
    """在 COS school_logo/{group}/ 下找 {school}.{ext} 实际存在的扩展名"""
    for ext in EXTS:
        if _cos_exists(client, bucket, f"school_logo/{group}/{school}{ext}"):
            return ext
    return None


def main():
    ap = argparse.ArgumentParser(
        description="移动学校 logo（COS + 本地同步）"
    )
    ap.add_argument("--school", required=True, help="学校名（与文件名一致，不含扩展名）")
    ap.add_argument("--from", dest="from_group", required=True, help="源分组: 985/211/香港/双非")
    ap.add_argument("--to", dest="to_group", required=True, help="目标分组: 985/211/香港/双非")
    args = ap.parse_args()

    school = args.school.strip()
    fg, tg = args.from_group.strip(), args.to_group.strip()

    for g, label in ((fg, "--from"), (tg, "--to")):
        if g not in ALLOWED_GROUPS:
            sys.exit(f"错误: {label} 分组「{g}」无效，仅支持 {sorted(ALLOWED_GROUPS)}")
    if fg == tg:
        sys.exit("错误: 源分组与目标分组相同")

    client, bucket, region = _cos_client()

    ext = _find_ext(client, bucket, fg, school)
    if not ext:
        sys.exit(f"错误: COS 上 school_logo/{fg}/ 下找不到「{school}」（试过扩展名 {EXTS}）")

    src_key = f"school_logo/{fg}/{school}{ext}"
    dst_key = f"school_logo/{tg}/{school}{ext}"

    if _cos_exists(client, bucket, dst_key):
        sys.exit(f"错误: 目标已存在 {dst_key}，为避免覆盖已中止")

    # 1) COS：复制到目标 + 删除源
    # 注意：必须用高级接口 client.copy，不能用 copy_object——后者对中文文件名会静默失败（不报错也不复制）。
    print(f"COS 复制: {src_key} -> {dst_key}")
    client.copy(
        Bucket=bucket,
        Key=dst_key,
        CopySource={"Bucket": bucket, "Key": src_key, "Region": region},
    )
    if not _cos_exists(client, bucket, dst_key):
        sys.exit("错误: 复制后目标不存在，已中止，未删除源文件")
    print(f"COS 删除源: {src_key}")
    client.delete_object(Bucket=bucket, Key=src_key)

    # 2) 本地缓存同步（存在才移动）
    local_src = LOCAL_SCHOOL_LOGO_DIR / fg / f"{school}{ext}"
    local_dst = LOCAL_SCHOOL_LOGO_DIR / tg / f"{school}{ext}"
    if local_src.exists():
        local_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(local_src), str(local_dst))
        print(f"本地移动: {local_src} -> {local_dst}")
    else:
        print(f"本地无缓存文件（{local_src}），跳过本地（线上以 COS 为准）")

    print(f"\n完成: 「{school}」已从 {fg} 移动到 {tg}")
    print("提示: 后端有 logo 列表缓存，前端未即时更新时重启后端或等缓存过期即可。")


if __name__ == "__main__":
    main()
