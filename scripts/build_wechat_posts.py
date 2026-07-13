#!/usr/bin/env python3
"""Build homepage WeChat article data from a local WeChat backup folder."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


DATE_RE = re.compile(r"(20\d{2})[-_/\.]?(\d{2})[-_/\.]?(\d{2})")


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def first_value(data: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = data.get(key)
        if value:
            return clean_text(value)
    return ""


def normalize_date(value: str, fallback_name: str) -> str:
    source = value or fallback_name
    if source.isdigit() and len(source) >= 10:
        try:
            return datetime.fromtimestamp(int(source[:10])).strftime("%Y-%m-%d")
        except Exception:
            pass
    match = DATE_RE.search(source)
    if match:
        return "-".join(match.groups())
    return ""


def relative_url(path: Path, root: Path, prefix: str) -> str:
    try:
        rel = path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        rel = path.as_posix()
    return f"{prefix.rstrip('/')}/{rel}" if prefix else rel


def find_first_file(folder: Path, patterns: list[str]) -> Path | None:
    for pattern in patterns:
        matches = sorted(folder.glob(pattern))
        if matches:
            return matches[0]
    return None


def extract_post(meta_path: Path, backup_root: Path, site_prefix: str) -> dict[str, str] | None:
    folder = meta_path.parent
    meta = read_json(meta_path)
    html_file = find_first_file(folder, ["*.html", "*.htm"])
    image_file = find_first_file(folder / "images", ["*.jpg", "*.jpeg", "*.png", "*.webp", "*.gif"])

    title = first_value(meta, ["title", "name", "article_title", "appmsg_title"]) or folder.name
    date = normalize_date(
        first_value(meta, ["date", "publish_date", "create_time", "publish_time", "update_time"]),
        folder.name,
    )
    summary = first_value(meta, ["summary", "digest", "description", "desc", "abstract"])
    url = first_value(meta, ["url", "link", "content_url", "article_url"])
    cover = first_value(meta, ["cover", "cover_url", "thumb_url", "image", "image_url"])

    if not url and html_file:
        url = relative_url(html_file, backup_root, site_prefix)
    if not cover and image_file:
        cover = relative_url(image_file, backup_root, site_prefix)
    if not summary:
        summary = "点击阅读公众号文章。"

    if not title or not url:
        return None

    return {
        "title": title,
        "date": date,
        "summary": summary,
        "url": url,
        "cover": cover or "assets/wechat-light-qrcode.jpg",
    }


def build_posts(backup_root: Path, site_prefix: str, limit: int) -> list[dict[str, str]]:
    posts: list[dict[str, str]] = []
    for meta_path in backup_root.rglob("meta.json"):
        post = extract_post(meta_path, backup_root, site_prefix)
        if post:
            posts.append(post)
    posts.sort(key=lambda item: item.get("date") or "", reverse=True)
    return posts[:limit]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--backup", default="wechat-articles", help="Local WeChat backup folder")
    parser.add_argument("--output", default="assets/data/wechat-posts.json", help="Homepage JSON output")
    parser.add_argument("--account", default="瓶子先森Light", help="WeChat account display name")
    parser.add_argument("--site-prefix", default="wechat-articles", help="Public URL prefix for local article files")
    parser.add_argument("--limit", type=int, default=6, help="Max article cards for the homepage")
    args = parser.parse_args()

    backup_root = Path(args.backup)
    output = Path(args.output)
    posts = build_posts(backup_root, args.site_prefix, args.limit) if backup_root.exists() else []
    payload = {
        "updated": datetime.now().strftime("%Y-%m-%d"),
        "account": args.account,
        "posts": posts,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(posts)} WeChat posts to {output}")


if __name__ == "__main__":
    main()
