"""Open Beauty Facts API scraper – open database with INCI ingredient lists."""

from __future__ import annotations

import logging
from scraper.config import SEGMENTS, CURRENCY_TO_SEK
from scraper.models import Product
from scraper.sources.base import BaseScraper
from scraper.utils.ingredients import parse_inci

logger = logging.getLogger(__name__)

API_SEARCH = "https://world.openbeautyfacts.org/cgi/search.pl"
PAGE_SIZE = 100
MAX_PAGES = 10


class OpenBeautyFactsScraper(BaseScraper):
    name = "open_beauty_facts"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[OBF] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            params = {
                "search_terms": term,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page": page,
                "page_size": PAGE_SIZE,
                "sort_by": "popularity",
            }
            resp = self.get(API_SEARCH, params=params, delay_min=1.0, delay_max=2.0)
            if resp is None:
                break

            try:
                data = resp.json()
            except Exception:
                logger.warning("[OBF] Invalid JSON for term=%s page=%d", term, page)
                break

            products = data.get("products", [])
            if not products:
                break

            for item in products:
                product = self._parse_product(item, segment)
                if product and not self._already_scraped(product.unique_key()):
                    self._add_product(product)

            if len(products) < PAGE_SIZE:
                break

    def _parse_product(self, item: dict, segment: str) -> Product | None:
        name = item.get("product_name", "").strip()
        brand = item.get("brands", "").strip()
        if not name:
            return None

        inci_raw = item.get("ingredients_text", "") or ""
        inci_list = parse_inci(inci_raw)

        return Product(
            segment=segment,
            product_name=name,
            brand=brand,
            ingredients_raw=inci_raw,
            ingredients_list=inci_list,
            total_ingredient_count=len(inci_list),
            source="Open Beauty Facts",
            url=f"https://world.openbeautyfacts.org/product/{item.get('code', '')}",
        )
