#!/usr/bin/env python3
"""Translate paper titles and abstracts to Chinese using LLM (OpenAI-compatible API).

Features:
  - Concurrent translation with configurable concurrency limit
  - Retry on API errors with exponential backoff
  - Resume from last checkpoint (skip already translated papers)
  - Per-file progress tracking via translation cache files
  - Reads from papers/raw/, outputs merged JSON to papers/processed/
"""

import argparse
import asyncio
import json
import os
import sys
import time

from dotenv import load_dotenv
from openai import AsyncOpenAI

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(SCRIPT_DIR, "..")
RAW_DIR = os.path.join(PROJECT_DIR, "papers", "raw")
PROCESSED_DIR = os.path.join(PROJECT_DIR, "papers", "processed")
CACHE_DIR = os.path.join(PROJECT_DIR, "papers", ".translation_cache")

PROMPT_TEMPLATE = """Translate the following English text to Chinese. Only output the translation, nothing else.

Title: {title}

Abstract: {abstract}"""


def get_cache_path(filename):
    return os.path.join(CACHE_DIR, filename)


def load_cache(filename):
    path = get_cache_path(filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(filename, cache):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = get_cache_path(filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def load_processed(filename):
    path = os.path.join(PROCESSED_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_processed(filename, papers):
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    path = os.path.join(PROCESSED_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)


async def translate_one(client, model, paper, cache, semaphore, max_retries=5):
    pdf_url = paper.get("pdf_url", "")
    if pdf_url in cache:
        return cache[pdf_url], True

    title = paper.get("title", "")
    abstract = paper.get("abstract", "")
    if not title and not abstract:
        return {"title_zh": "", "abstract_zh": ""}, False

    prompt = PROMPT_TEMPLATE.format(title=title, abstract=abstract)

    async with semaphore:
        for attempt in range(max_retries):
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )
                text = resp.choices[0].message.content.strip()

                title_zh = ""
                abstract_zh = ""
                if "摘要：" in text or "摘要:" in text:
                    parts = text.split("摘要", 1)
                    title_part = parts[0]
                    abstract_part = parts[1].lstrip("：:").strip() if len(parts) > 1 else ""
                    title_zh = title_part.replace("标题", "").replace("：", "").replace(":", "").strip()
                    abstract_zh = abstract_part.strip()
                elif "标题：" in text or "标题:" in text:
                    lines = text.split("\n")
                    for line in lines:
                        line_stripped = line.strip()
                        if line_stripped.startswith("标题") and ("：" in line_stripped or ":" in line_stripped):
                            title_zh = line_stripped.split("：", 1)[-1].split(":", 1)[-1].strip()
                        elif line_stripped.startswith("摘要") and ("：" in line_stripped or ":" in line_stripped):
                            abstract_zh = line_stripped.split("：", 1)[-1].split(":", 1)[-1].strip()
                else:
                    if "\n" in text:
                        first_newline = text.index("\n")
                        title_zh = text[:first_newline].strip()
                        abstract_zh = text[first_newline + 1:].strip()
                    else:
                        title_zh = text
                        abstract_zh = ""

                result = {"title_zh": title_zh, "abstract_zh": abstract_zh}
                cache[pdf_url] = result
                return result, False

            except Exception as e:
                if attempt < max_retries - 1:
                    wait = min(2 ** attempt * 2, 60)
                    print(f"    Retry {attempt + 1}/{max_retries} after {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    print(f"    FAILED after {max_retries} retries: {e}")
                    return {"title_zh": "", "abstract_zh": ""}, False


async def translate_file(client, model, filename, concurrency, save_interval):
    raw_path = os.path.join(RAW_DIR, filename)
    if not os.path.exists(raw_path):
        print(f"  Raw file not found: {raw_path}")
        return

    with open(raw_path, "r", encoding="utf-8") as f:
        papers = json.load(f)

    if not papers:
        print(f"  No papers in {filename}")
        return

    cache = load_cache(filename)
    already = sum(1 for p in papers if p.get("pdf_url") in cache)
    total = len(papers)
    pending = total - already
    print(f"  {filename}: {total} papers, {already} cached, {pending} to translate")

    if pending == 0:
        print(f"  All translations already cached for {filename}")
        for paper in papers:
            pdf_url = paper.get("pdf_url", "")
            if pdf_url in cache:
                paper["title_zh"] = cache[pdf_url].get("title_zh", "")
                paper["abstract_zh"] = cache[pdf_url].get("abstract_zh", "")
        save_processed(filename, papers)
        print(f"  Saved to processed/{filename}")
        return

    semaphore = asyncio.Semaphore(concurrency)
    completed = 0
    translations = {}

    async def wrapped_translate(paper):
        nonlocal completed
        result, was_cached = await translate_one(client, model, paper, cache, semaphore)
        if not was_cached:
            completed += 1
            if completed % save_interval == 0:
                save_cache(filename, cache)
                print(f"  [{completed}/{pending}] Progress saved")
        translations[paper.get("pdf_url", "")] = result
        return result

    tasks = [wrapped_translate(paper) for paper in papers]
    await asyncio.gather(*tasks)

    save_cache(filename, cache)

    for paper in papers:
        pdf_url = paper.get("pdf_url", "")
        if pdf_url in cache:
            paper["title_zh"] = cache[pdf_url].get("title_zh", "")
            paper["abstract_zh"] = cache[pdf_url].get("abstract_zh", "")

    save_processed(filename, papers)
    print(f"  {filename}: translation complete ({completed} newly translated)")
    print(f"  Saved to processed/{filename}")


async def main_async(args):
    env_path = os.path.join(PROJECT_DIR, ".env")
    load_dotenv(env_path)

    base_url = os.environ.get("LLM_BASE_URL", "")
    model = os.environ.get("LLM_MODEL", "")
    api_key = os.environ.get("LLM_API_KEY", "")

    if not api_key:
        print("Error: LLM_API_KEY not set in .env")
        sys.exit(1)
    if not model:
        print("Error: LLM_MODEL not set in .env")
        sys.exit(1)

    client = AsyncOpenAI(base_url=base_url or None, api_key=api_key)

    paper_files = sorted(f for f in os.listdir(RAW_DIR) if f.endswith(".json"))

    if args.files:
        requested = set(f.strip() for f in args.files.split(","))
        paper_files = [f for f in paper_files if f in requested]

    if not paper_files:
        print("No paper files found in papers/raw/")
        return

    print(f"Translating {len(paper_files)} file(s) with concurrency={args.concurrency}, model={model}")
    print(f"Input: papers/raw/")
    print(f"Output: papers/processed/")

    for filename in paper_files:
        await translate_file(client, model, filename, args.concurrency, args.save_interval)

    print("\nAll done!")


def main():
    parser = argparse.ArgumentParser(description="Translate paper titles and abstracts to Chinese via LLM")
    parser.add_argument("--files", default="", help="Comma-separated paper filenames to translate (default: all)")
    parser.add_argument("--concurrency", type=int, default=10, help="Max concurrent API calls (default: 10)")
    parser.add_argument("--save-interval", type=int, default=20, help="Save cache every N new translations (default: 20)")
    args = parser.parse_args()

    start = time.time()
    asyncio.run(main_async(args))
    elapsed = time.time() - start
    print(f"Total time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
