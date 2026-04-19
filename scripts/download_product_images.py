#!/usr/bin/env python3
"""Seed product photos from Wikipedia / Wikimedia Commons.

Downloads one image per product into public/uploads/seed/{slug}.jpg,
writes _attributions.json with source article + license note,
and updates data/products.seed.json so imagePath points to the new file.

Run: /tmp/swiss-venv/bin/python scripts/download_product_images.py
"""
import json
import time
from io import BytesIO
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SEED_JSON = ROOT / "data" / "products.seed.json"
OUT_DIR = ROOT / "public" / "uploads" / "seed"
ATTRIB_FILE = OUT_DIR / "_attributions.json"

UA = ("SwissBakerySeed/1.0 (contact@swissbakery.com.au) "
      "python-urllib seed-image bootstrap")

# slug -> ordered candidate Wikipedia article titles (first match wins)
ARTICLE_MAP = {
    # savoury
    "chicken-patty": ["Jamaican_patty", "Meat_pie"],
    "paneer-patty": ["Jamaican_patty", "Paneer"],
    "beef-patty": ["Jamaican_patty", "Meat_pie"],
    "tuna-patty": ["Fish_cake", "Tuna"],
    "vegetable-patty": ["Jamaican_patty", "Vegetable_pie"],
    "chicken-sandwich": ["Chicken_sandwich"],
    "tuna-sandwich": ["Tuna_fish_sandwich"],
    "small-burger": ["Slider_(sandwich)", "Hamburger"],
    "prawn-roll": ["Spring_roll", "Lumpia"],
    "chicken-roll": ["Kati_roll"],
    "beef-roll": ["Kati_roll"],
    "samosa": ["Samosa"],
    "veg-singara": ["Samosa"],
    "liver-singara": ["Samosa"],
    "piyaju": ["Piyaju", "Pakora"],
    "dal-puri": ["Dal_puri", "Puri_(food)"],
    "mughlai-paratha": ["Mughlai_paratha"],
    "popcorn-chicken": ["Popcorn_chicken"],
    # bakery
    "swiss-short-bread": ["Shortbread"],
    "salty-cookies-nimki": ["Nimki", "Cracker_(food)"],
    "butter-bun": ["Bun_(bread)", "Brioche"],
    "cream-roll": ["Cream_horn"],
    "kaza": ["Khaja_(food)"],
    "fruit-cake": ["Fruitcake"],
    "baklava": ["Baklava"],
    "patishapta": ["Patishapta"],
    "pakon-pitha": ["Pitha"],
    "narikel-puli": ["Pitha"],
    # sweets
    "laddu-three-varieties": ["Laddu"],
    "monsor": ["Sandesh_(confectionery)"],
    "kodom": ["Sandesh_(confectionery)"],
    "balu-shai": ["Balushahi"],
    "aflaton": ["Kalakand", "Barfi"],
    "pera": ["Peda"],
    "bondia": ["Boondi"],
    "halwa-chana-dal-hazelnut": ["Halva", "Mohanthal"],
    "chana-mukhi": ["Chhena"],
    "rasgulla": ["Rasgulla"],
    "cham-cham": ["Chomchom"],
    "rosmalai": ["Rasmalai"],
    "hafsa": ["Barfi", "Sandesh_(confectionery)"],
    "firni": ["Phirni"],
    # beverages
    "malai-cha": ["Masala_chai"],
    "poro-roti": ["Paratha"],
    "buttered-corn": ["Corn_on_the_cob"],
}


def http_get(url: str, accept: str = "application/json") -> bytes:
    req = Request(url, headers={"User-Agent": UA, "Accept": accept})
    with urlopen(req, timeout=25) as r:
        return r.read()


def fetch_summary(title: str):
    url = ("https://en.wikipedia.org/api/rest_v1/page/summary/"
           + quote(title, safe="()_"))
    try:
        data = json.loads(http_get(url))
    except Exception as e:
        return None
    if data.get("type") == "disambiguation":
        return None
    img = data.get("originalimage") or data.get("thumbnail")
    if not img or not img.get("source"):
        return None
    src = img["source"]
    if src.lower().endswith(".svg") or ".svg/" in src.lower():
        return None
    return {
        "title": data.get("title"),
        "image_url": src,
        "page_url": (data.get("content_urls", {})
                     .get("desktop", {}).get("page", "")),
    }


def download_and_resize(url: str, dest: Path, max_side: int = 1200) -> bool:
    try:
        raw = http_get(url, accept="image/*")
    except Exception as e:
        print(f"  download fail: {e}")
        return False
    try:
        img = Image.open(BytesIO(raw))
        img = img.convert("RGB")
        w, h = img.size
        scale = min(max_side / max(w, h), 1.0)
        if scale < 1.0:
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        img.save(dest, "JPEG", quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"  image process fail: {e}")
        return False


def main() -> None:
    data = json.loads(SEED_JSON.read_text())
    products = data["products"]
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    attributions = {
        "_license_note": (
            "Images sourced from Wikimedia Commons via Wikipedia summary "
            "API. Most are CC-BY-SA 3.0/4.0; a few may be public domain. "
            "Each image's canonical licence lives on its Commons file page "
            "— visit the page_url listed for each entry to confirm before "
            "commercial launch. Attribution credit recommended in the site "
            "footer (e.g. 'Some product images courtesy Wikimedia Commons "
            "contributors, used under CC-BY-SA')."
        ),
        "images": {},
    }
    success, failed = [], []

    for p in products:
        slug = p["slug"]
        candidates = ARTICLE_MAP.get(slug, [])
        summary = None
        for title in candidates:
            summary = fetch_summary(title)
            time.sleep(0.15)
            if summary:
                break
        if not summary:
            print(f"{slug}: no article (tried {candidates})")
            failed.append(slug)
            continue
        dest = OUT_DIR / f"{slug}.jpg"
        if download_and_resize(summary["image_url"], dest):
            print(f"{slug}: OK   ({summary['title']})")
            success.append(slug)
            attributions["images"][slug] = {
                "source_article": summary["title"],
                "page_url": summary["page_url"],
                "image_url": summary["image_url"],
            }
            p["imagePath"] = f"/uploads/seed/{slug}.jpg"
        else:
            failed.append(slug)
        time.sleep(0.1)

    ATTRIB_FILE.write_text(
        json.dumps(attributions, indent=2, ensure_ascii=False) + "\n")
    SEED_JSON.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n")

    print(f"\nSuccess: {len(success)}/{len(products)}")
    if failed:
        print("Failed (need manual sourcing):")
        for s in failed:
            print(f"  - {s}")


if __name__ == "__main__":
    main()
