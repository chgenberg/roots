"""INCI ingredient parsing and naturalness classification."""

from __future__ import annotations

import re

KNOWN_SYNTHETIC = {
    "sodium lauryl sulfate", "sodium laureth sulfate", "sls", "sles",
    "cocamidopropyl betaine", "dimethicone", "cyclomethicone",
    "cyclopentasiloxane", "dimethiconol", "amodimethicone",
    "peg-", "ppg-", "polyethylene", "polypropylene",
    "methylparaben", "propylparaben", "butylparaben", "ethylparaben",
    "methylisothiazolinone", "methylchloroisothiazolinone",
    "phenoxyethanol", "dmdm hydantoin", "imidazolidinyl urea",
    "diazolidinyl urea", "quaternium-15",
    "triethanolamine", "diethanolamine", "monoethanolamine",
    "bht", "bha", "edta", "disodium edta",
    "triclosan", "triclocarban",
    "synthetic fragrance", "parfum",
    "ci 77891", "ci 77491", "ci 77492", "ci 77499",
    "carbomer", "polyquaternium", "pvp", "vp/va copolymer",
    "cetrimonium chloride", "behentrimonium chloride",
    "mineral oil", "paraffinum liquidum", "petrolatum",
    "isopropyl myristate", "isopropyl palmitate",
}

KNOWN_NATURAL = {
    "water", "aqua", "aloe barbadensis",
    "coconut oil", "cocos nucifera", "olea europaea",
    "shea butter", "butyrospermum parkii",
    "jojoba", "simmondsia chinensis",
    "argan", "argania spinosa",
    "glycerin", "vegetable glycerin",
    "sodium cocoyl isethionate", "decyl glucoside",
    "coco-glucoside", "lauryl glucoside",
    "sodium coco-sulfate", "cocamidopropyl hydroxysultaine",
    "citric acid", "tocopherol", "ascorbic acid",
    "panthenol", "niacinamide",
    "lavandula angustifolia", "rosmarinus officinalis",
    "chamomilla recutita", "calendula officinalis",
    "mentha piperita", "eucalyptus globulus",
    "tea tree", "melaleuca alternifolia",
    "hemp seed oil", "cannabis sativa",
    "avocado oil", "persea gratissima",
    "castor oil", "ricinus communis",
    "xanthan gum", "guar gum", "cellulose",
    "kaolin", "bentonite",
    "sea salt", "maris sal",
    "sodium chloride", "sodium bicarbonate",
    "lactic acid", "malic acid",
    "cetearyl alcohol", "cetyl alcohol", "stearyl alcohol",
}


def parse_inci(raw: str) -> list[str]:
    if not raw:
        return []
    raw = re.sub(r"\s+", " ", raw.strip())
    parts = re.split(r",\s*(?![^()]*\))", raw)
    return [p.strip() for p in parts if p.strip()]


def _normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower().strip().rstrip("."))


def classify_ingredient(name: str) -> str:
    """Return 'natural', 'synthetic', or 'unknown'."""
    norm = _normalize(name)
    for syn in KNOWN_SYNTHETIC:
        if syn in norm or norm.startswith(syn):
            return "synthetic"
    for nat in KNOWN_NATURAL:
        if nat in norm or norm.startswith(nat):
            return "natural"
    if _looks_botanical(norm):
        return "natural"
    return "unknown"


def _looks_botanical(name: str) -> bool:
    """Heuristic: Latin binomial names (two+ words, no digits) are likely botanical."""
    words = name.split()
    if len(words) >= 2 and all(w.isalpha() for w in words[:2]):
        if words[0][0].isupper() or "/" in name:
            return False
        return True
    return False


def naturalness_ratio(ingredients: list[str]) -> tuple[int, int, int]:
    """Return (natural_count, synthetic_count, total_count)."""
    nat = syn = 0
    for ing in ingredients:
        cls = classify_ingredient(ing)
        if cls == "natural":
            nat += 1
        elif cls == "synthetic":
            syn += 1
    return nat, syn, len(ingredients)
