"""Deduplicate products that appear across multiple sources."""

from __future__ import annotations

import re
from scraper.models import Product


def _normalize_key(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s*\d+\s*ml\b", "", text)
    text = re.sub(r"[^a-zåäöæøü0-9 ]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def deduplicate(products: list[Product]) -> list[Product]:
    """Keep the product entry with the most information per unique brand+name."""
    seen: dict[str, Product] = {}
    for p in products:
        key = f"{_normalize_key(p.brand)}|{_normalize_key(p.product_name)}"
        if key in seen:
            existing = seen[key]
            if _richness(p) > _richness(existing):
                seen[key] = _merge(existing, p)
            else:
                seen[key] = _merge(p, existing)
        else:
            seen[key] = p
    return list(seen.values())


def _richness(p: Product) -> int:
    score = 0
    if p.ingredients_list:
        score += 3
    if p.average_rating is not None:
        score += 2
    if p.num_reviews and p.num_reviews > 0:
        score += 1
    if p.price_sek and p.price_sek > 0:
        score += 1
    if p.url:
        score += 1
    return score


def _merge(base: Product, richer: Product) -> Product:
    """Take richer as primary but fill gaps from base."""
    data = richer.model_dump()
    base_data = base.model_dump()
    for field in ["ingredients_raw", "ingredients_list", "average_rating",
                   "num_reviews", "price_sek", "price_original", "url", "volume_ml"]:
        if not data.get(field) and base_data.get(field):
            data[field] = base_data[field]
    if base.source and richer.source and base.source != richer.source:
        data["source"] = f"{richer.source}, {base.source}"
    return Product(**data)
