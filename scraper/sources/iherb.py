"""iHerb scraper – large natural products retailer with reviews + INCI."""

from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from scraper.config import SEGMENTS, CURRENCY_TO_SEK
from scraper.models import Product
from scraper.sources.base import BaseScraper
from scraper.utils.ingredients import parse_inci

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.iherb.com/search"
MAX_PAGES = 5


class IHerbScraper(BaseScraper):
    name = "iherb"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[iHerb] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            url = f"{SEARCH_URL}?kw={term.replace(' ', '+')}&p={page}&srt=4"
            resp = self.get(url)
            if resp is None:
                break

            soup = BeautifulSoup(resp.text, "lxml")
            items = soup.select("div.product-cell-container")
            if not items:
                items = soup.select("[data-ga-product-name]")

            if not items:
                break

            for item in items:
                product = self._parse_listing(item, segment)
                if product and not self._already_scraped(product.unique_key()):
                    if not self._url_visited(product.url):
                        self._mark_url(product.url)
                        self._enrich_product(product)
                        self._add_product(product)

            if len(items) < 24:
                break

    def _parse_listing(self, el, segment: str) -> Product | None:
        name_el = el.select_one("a.product-title, [data-ga-product-name]")
        if not name_el:
            return None

        full_name = name_el.get("title") or name_el.get_text(strip=True)
        href = name_el.get("href", "")
        url = href if href.startswith("http") else f"https://www.iherb.com{href}"

        brand = ""
        brand_el = el.select_one("a.product-brand, .product-brand-name")
        if brand_el:
            brand = brand_el.get_text(strip=True)

        price = None
        price_el = el.select_one(".price .price-olp, .product-price")
        if price_el:
            price_text = price_el.get_text(strip=True)
            m = re.search(r"[\$€]?([\d.,]+)", price_text)
            if m:
                price = float(m.group(1).replace(",", "."))

        rating = None
        rating_el = el.select_one("[data-ga-product-rating]")
        if rating_el:
            try:
                rating = float(rating_el["data-ga-product-rating"])
            except (ValueError, KeyError):
                pass

        reviews = None
        reviews_el = el.select_one(".product-rating-count, .rating-count")
        if reviews_el:
            m = re.search(r"(\d[\d,]*)", reviews_el.get_text())
            if m:
                reviews = int(m.group(1).replace(",", ""))

        return Product(
            segment=segment,
            product_name=full_name,
            brand=brand,
            price_original=price,
            currency="USD",
            price_sek=round(price * CURRENCY_TO_SEK["USD"], 2) if price else None,
            average_rating=min(rating, 5.0) if rating else None,
            num_reviews=reviews,
            source="iHerb",
            url=url,
        )

    def _enrich_product(self, product: Product) -> None:
        if not product.url:
            return
        resp = self.get(product.url)
        if resp is None:
            return
        soup = BeautifulSoup(resp.text, "lxml")

        inci_section = soup.select_one("#product-specs-list")
        if inci_section:
            text = inci_section.get_text(separator="\n")
            for line in text.split("\n"):
                lower = line.lower()
                if "ingredient" in lower and len(line) > 30:
                    product.ingredients_raw = line.strip()
                    product.ingredients_list = parse_inci(line.strip())
                    product.total_ingredient_count = len(product.ingredients_list)
                    break

        if not product.ingredients_raw:
            desc = soup.select_one("#product-summary-toggler-content, .product-overview")
            if desc:
                text = desc.get_text(separator="\n")
                for line in text.split("\n"):
                    if "ingredient" in line.lower() and len(line) > 30:
                        product.ingredients_raw = line.strip()
                        product.ingredients_list = parse_inci(line.strip())
                        product.total_ingredient_count = len(product.ingredients_list)
                        break

        vol_el = soup.select_one(".product-weight")
        if vol_el:
            m = re.search(r"(\d+)\s*ml", vol_el.get_text(), re.IGNORECASE)
            if m:
                product.volume_ml = float(m.group(1))
