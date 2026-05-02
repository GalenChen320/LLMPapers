#!/usr/bin/env python3
"""Fetch oral/spotlight paper metadata from OpenReview for multiple conferences.

For ACL/EMNLP: scrapes ACL Anthology proceedings pages to find award (oral) papers,
then fetches metadata from individual paper pages.
For COLM: fetches all papers from OpenReview (no oral/poster distinction).
For ICLR/NeurIPS/ICML: fetches oral/spotlight papers from OpenReview.
"""

import argparse
import json
import os
import re
import time

import openreview
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

BASE_URL = "https://api2.openreview.net"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "papers", "raw")

VENUE_CONFIGS = [
    {"conference": "ICLR", "year": 2024, "invitation": "ICLR.cc/2024/Conference/-/Submission", "venue_patterns": ["ICLR 2024 oral", "ICLR 2024 spotlight"], "mode": "filter"},
    {"conference": "ICLR", "year": 2025, "invitation": "ICLR.cc/2025/Conference/-/Submission", "venue_patterns": ["ICLR 2025 Oral", "ICLR 2025 Spotlight"], "mode": "filter"},
    {"conference": "ICLR", "year": 2026, "invitation": "ICLR.cc/2026/Conference/-/Submission", "venue_patterns": ["ICLR 2026 Oral", "ICLR 2026 Spotlight"], "mode": "filter"},
    {"conference": "NeurIPS", "year": 2024, "invitation": "NeurIPS.cc/2024/Conference/-/Submission", "venue_patterns": ["NeurIPS 2024 oral", "NeurIPS 2024 spotlight"], "mode": "filter"},
    {"conference": "NeurIPS", "year": 2025, "invitation": "NeurIPS.cc/2025/Conference/-/Submission", "venue_patterns": ["NeurIPS 2025 oral", "NeurIPS 2025 spotlight"], "mode": "filter"},
    {"conference": "ICML", "year": 2024, "invitation": "ICML.cc/2024/Conference/-/Submission", "venue_patterns": ["ICML 2024 Oral", "ICML 2024 Spotlight"], "mode": "filter"},
    {"conference": "ICML", "year": 2025, "invitation": "ICML.cc/2025/Conference/-/Submission", "venue_patterns": ["ICML 2025 oral", "ICML 2025 spotlightposter"], "mode": "filter"},
    {"conference": "ACL", "year": 2024, "anthology_volumes": ["2024.acl-long", "2024.acl-short"], "mode": "acl_anthology"},
    {"conference": "ACL", "year": 2025, "anthology_volumes": ["2025.acl-long", "2025.acl-short"], "mode": "acl_anthology"},
    {"conference": "EMNLP", "year": 2024, "anthology_volumes": ["2024.emnlp-main"], "mode": "acl_anthology"},
    {"conference": "EMNLP", "year": 2025, "anthology_volumes": ["2025.emnlp-main"], "mode": "acl_anthology"},
    {"conference": "COLM", "year": 2024, "invitation": "colmweb.org/COLM/2024/Conference/-/Submission", "mode": "all"},
    {"conference": "COLM", "year": 2025, "invitation": "colmweb.org/COLM/2025/Conference/-/Submission", "mode": "all"},
]


def create_client(username=None, password=None):
    kwargs = {"baseurl": BASE_URL}
    if username and password:
        try:
            kwargs["username"] = username
            kwargs["password"] = password
            client = openreview.api.OpenReviewClient(**kwargs)
            print(f"Logged in as: {username}")
            return client
        except Exception as e:
            print(f"Login failed: {e}")
            print("Falling back to anonymous access.")
    for attempt in range(3):
        try:
            client = openreview.api.OpenReviewClient(baseurl=BASE_URL)
            return client
        except Exception as e:
            if attempt < 2:
                print(f"Anonymous access failed, retrying in 30s ... ({e})")
                time.sleep(30)
            else:
                raise


def get_output_path(config):
    mode = config["mode"]
    if mode == "filter":
        suffix = "oral_spotlight"
    elif mode == "acl_anthology":
        suffix = "oral"
    else:
        suffix = "all"
    return os.path.join(OUTPUT_DIR, f"{config['conference'].lower()}{config['year']}_{suffix}.json")


def fetch_papers_for_venue(client, config):
    output_path = get_output_path(config)
    if os.path.exists(output_path):
        print(f"[{config['conference']} {config['year']}] Already exists: {output_path}")
        return

    mode = config["mode"]
    print(f"\n[{config['conference']} {config['year']}] Fetching papers (mode: {mode}) ...")

    target_notes = []
    if mode == "filter":
        target_notes = fetch_openreview_filtered(client, config)
    elif mode == "all":
        target_notes = fetch_openreview_all(client, config)
    elif mode == "acl_anthology":
        fetch_acl_anthology(config, output_path)
        return

    if not target_notes:
        print(f"  No papers found.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    papers = [extract_metadata_openreview(note) for note in target_notes]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)

    print(f"  Saved {len(target_notes)} papers to: {output_path}")


def fetch_openreview_filtered(client, config):
    notes = client.get_all_notes(invitation=config["invitation"])
    print(f"  Total submissions: {len(notes)}")

    venue_map = {}
    for n in notes:
        venue = n.content.get("venue", {}).get("value", "")
        venue_map.setdefault(venue, []).append(n)

    print("  Venue distribution:")
    for v in sorted(venue_map):
        print(f"    {v}: {len(venue_map[v])}")

    target_notes = []
    for pattern in config["venue_patterns"]:
        target_notes.extend(venue_map.get(pattern, []))
    return target_notes


def fetch_openreview_all(client, config):
    notes = client.get_all_notes(invitation=config["invitation"])
    print(f"  Total papers: {len(notes)}")
    return notes


def extract_metadata_openreview(note):
    content = note.content
    forum_id = note.id
    authors = content.get("authors", {}).get("value", [])
    keywords = content.get("keywords", {}).get("value", [])
    return {
        "title": content.get("title", {}).get("value", ""),
        "authors": authors if isinstance(authors, list) else [],
        "abstract": content.get("abstract", {}).get("value", ""),
        "keywords": keywords if isinstance(keywords, list) else [],
        "tldr": content.get("TLDR", {}).get("value", ""),
        "venue": content.get("venue", {}).get("value", ""),
        "primary_area": content.get("primary_area", {}).get("value", ""),
        "pdf_url": f"{BASE_URL}/pdf?id={forum_id}",
        "html_url": f"https://openreview.net/forum?id={forum_id}",
    }


def get_award_paper_ids_from_volume(volume_id):
    url = f"https://aclanthology.org/{volume_id}/"
    print(f"  Fetching proceedings: {url}")
    for attempt in range(3):
        try:
            resp = requests.get(url, timeout=180)
            resp.raise_for_status()
            html = resp.text
            break
        except Exception as e:
            if attempt < 2:
                print(f"    Attempt {attempt+1} failed: {e}, retrying in 10s ...")
                time.sleep(10)
            else:
                print(f"    All attempts failed for {volume_id}")
                return []

    award_ids = []
    parts = html.split("fa-award")
    for part in parts[1:]:
        link_match = re.search(r'href=["\']?(/' + re.escape(volume_id) + r'\.\d+)["\']?', part[:500])
        if link_match:
            paper_path = link_match.group(1).strip("/")
            award_ids.append(paper_path)

    award_ids = list(dict.fromkeys(award_ids))
    print(f"    Found {len(award_ids)} award papers in {volume_id}")
    return award_ids


def get_all_paper_ids_from_volume(volume_id):
    url = f"https://aclanthology.org/{volume_id}/"
    print(f"  Fetching proceedings: {url}")
    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    html = resp.text

    paper_ids = re.findall(r'href=["\']?(/' + re.escape(volume_id) + r'\.\d+)["\']?', html)
    paper_ids = list(dict.fromkeys(paper_ids))
    print(f"    Found {len(paper_ids)} papers in {volume_id}")
    return [pid.strip("/") for pid in paper_ids]


def fetch_paper_metadata_from_anthology(paper_id, conference, year):
    url = f"https://aclanthology.org/{paper_id}/"
    resp = requests.get(url, timeout=30)
    if not resp.ok:
        return None
    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("h2", id="title")
    title = title_tag.get_text(strip=True) if title_tag else ""

    abstract_tag = soup.find("div", class_="acl-abstract")
    abstract = ""
    if abstract_tag:
        abstract = abstract_tag.get_text(strip=True)
        if abstract.startswith("Abstract"):
            abstract = abstract[8:].strip()

    author_tags = soup.find_all("meta", attrs={"name": "citation_author"})
    authors = [a.get("content", "") for a in author_tags]

    award_dd = None
    for dt in soup.find_all("dt"):
        if "Award" in dt.get_text():
            award_dd = dt.find_next_sibling("dd")
            break
    award = ""
    if award_dd:
        award = award_dd.get_text(strip=True)

    pdf_link = soup.find("a", href=re.compile(r"\.pdf$"))
    pdf_url = ""
    if pdf_link:
        href = pdf_link.get("href", "")
        if href.startswith("/"):
            pdf_url = f"https://aclanthology.org{href}"
        else:
            pdf_url = href

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "keywords": [],
        "tldr": "",
        "venue": f"{conference} {year}",
        "primary_area": "",
        "award": award,
        "pdf_url": pdf_url,
        "html_url": url,
    }


def fetch_acl_anthology(config, output_path):
    all_paper_ids = set()
    for volume in config["anthology_volumes"]:
        try:
            award_ids = get_award_paper_ids_from_volume(volume)
            all_paper_ids.update(award_ids)
        except Exception as e:
            print(f"    Error fetching {volume}: {e}")

    if not all_paper_ids:
        print(f"  No award/oral papers found for {config['conference']} {config['year']}")
        return

    print(f"  Total award papers to fetch: {len(all_paper_ids)}")

    papers = []
    for i, pid in enumerate(sorted(all_paper_ids)):
        try:
            meta = fetch_paper_metadata_from_anthology(pid, config["conference"], config["year"])
            if meta:
                papers.append(meta)
                print(f"    [{i+1}/{len(all_paper_ids)}] {meta['title'][:60]}")
        except Exception as e:
            print(f"    [{i+1}/{len(all_paper_ids)}] Error fetching {pid}: {e}")
        time.sleep(0.5)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(papers, f, ensure_ascii=False, indent=2)

    print(f"  Saved {len(papers)} papers to: {output_path}")


def main():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    load_dotenv(env_path)

    parser = argparse.ArgumentParser(description="Fetch oral/spotlight papers from OpenReview and ACL Anthology")
    parser.add_argument("--username", default="", help="OpenReview username")
    parser.add_argument("--password", default="", help="OpenReview password")
    parser.add_argument("--conferences", default="", help="Conferences to fetch, e.g., 'ICLR2024,ACL2024'. Default: all")
    args = parser.parse_args()

    username = args.username or os.environ.get("OPENREVIEW_USERNAME", "")
    password = args.password or os.environ.get("OPENREVIEW_PASSWORD", "")

    client = create_client(username=username or None, password=password or None)

    configs_to_fetch = VENUE_CONFIGS
    if args.conferences:
        requested = set(c.strip().upper() for c in args.conferences.split(","))
        configs_to_fetch = [
            c for c in VENUE_CONFIGS
            if f"{c['conference'].upper()}{c['year']}" in requested
        ]

    for config in configs_to_fetch:
        fetch_papers_for_venue(client, config)

    print("\nDone!")


if __name__ == "__main__":
    main()
