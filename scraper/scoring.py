"""Scoring engine – compute a 1-10 'fit score' for each product."""

from __future__ import annotations

from scraper.config import (
    GENDERED_KEYWORDS_FEMALE,
    GENDERED_KEYWORDS_MALE,
    SCORING_WEIGHTS,
    TARGET_PRICE_PER_PRODUCT_SEK,
)
from scraper.models import Product
from scraper.utils.ingredients import classify_ingredient, naturalness_ratio


def score_product(product: Product) -> Product:
    """Populate fit_score and fit_motivation on the product (mutates in place)."""
    scores: dict[str, float] = {}
    reasons: list[str] = []

    # --- Naturalness (35 %) ---
    if product.ingredients_list:
        nat, syn, total = naturalness_ratio(product.ingredients_list)
        product.natural_ingredient_count = nat
        product.synthetic_ingredient_count = syn
        product.total_ingredient_count = total

        if total > 0:
            nat_ratio = nat / total
            syn_ratio = syn / total
            # Higher ratio of natural ingredients → higher score
            s = min(10.0, max(1.0, nat_ratio * 12 - syn_ratio * 8))
        else:
            s = 5.0
        scores["naturalness"] = s
        reasons.append(f"Naturlighet {s:.1f}/10 ({nat} nat, {syn} syn av {total})")
    else:
        scores["naturalness"] = 5.0
        reasons.append("Naturlighet 5.0/10 (ingen INCI)")

    # --- Review score (20 %) ---
    if product.average_rating is not None and product.average_rating > 0:
        s = min(10.0, product.average_rating * 2.0)
        if product.num_reviews and product.num_reviews < 5:
            s *= 0.7  # penalise low review count
        scores["review_score"] = s
        rev_txt = f"{product.num_reviews or '?'} recensioner"
        reasons.append(f"Betyg {s:.1f}/10 ({product.average_rating:.1f}/5, {rev_txt})")
    else:
        scores["review_score"] = 5.0
        reasons.append("Betyg 5.0/10 (saknas)")

    # --- Price fit (15 %) ---
    if product.price_sek and product.price_sek > 0:
        diff = abs(product.price_sek - TARGET_PRICE_PER_PRODUCT_SEK)
        # Perfect at target, drops off linearly
        s = max(1.0, 10.0 - (diff / TARGET_PRICE_PER_PRODUCT_SEK) * 8)
        scores["price_fit"] = s
        reasons.append(f"Pris {s:.1f}/10 ({product.price_sek:.0f} SEK, mål ~{TARGET_PRICE_PER_PRODUCT_SEK})")
    else:
        scores["price_fit"] = 5.0
        reasons.append("Pris 5.0/10 (okänt)")

    # --- Unisex suitability (15 %) ---
    text = (product.product_name + " " + product.brand).lower()
    male_hits = sum(1 for kw in GENDERED_KEYWORDS_MALE if kw in text)
    female_hits = sum(1 for kw in GENDERED_KEYWORDS_FEMALE if kw in text)
    gendered = male_hits + female_hits
    if gendered == 0:
        s = 10.0
    elif gendered == 1:
        s = 6.0
    else:
        s = 3.0
    scores["unisex"] = s
    reasons.append(f"Unisex {s:.1f}/10 ({'neutralt' if gendered == 0 else f'{gendered} könade ord'})")

    # --- Ingredient simplicity (15 %) ---
    n = product.total_ingredient_count
    if n > 0:
        if n <= 10:
            s = 10.0
        elif n <= 20:
            s = 8.0
        elif n <= 30:
            s = 6.0
        elif n <= 45:
            s = 4.0
        else:
            s = 2.0
        scores["simplicity"] = s
        reasons.append(f"Enkelhet {s:.1f}/10 ({n} ingredienser)")
    else:
        scores["simplicity"] = 5.0
        reasons.append("Enkelhet 5.0/10 (okänt antal)")

    # --- Weighted average ---
    total_score = sum(
        scores[k] * SCORING_WEIGHTS[k] for k in SCORING_WEIGHTS
    )
    product.fit_score = round(min(10.0, max(1.0, total_score)), 1)
    product.fit_motivation = " | ".join(reasons)
    return product


def score_all(products: list[Product]) -> list[Product]:
    return [score_product(p) for p in products]
