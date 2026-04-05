"""INCIDecoder scraper – product ingredient analysis database."""

from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from scraper.config import SEGMENTS
from scraper.models import Product
from scraper.sources.base import BaseScraper
from scraper.utils.ingredients import parse_inci

logger = logging.getLogger(__name__)

BASE_URL = "https://incidecoder.com"
SEARCH_URL = f"{BASE_URL}/search"
MAX_PAGES = 2


class INCIDecoderScraper(BaseScraper):
    name = "incidecoder"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[INCIDecoder] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            url = f"{SEARCH_URL}?query={term.replace(' ', '+')}"
            if page > 1:
                url += f"&page={page}"

            resp = self.get(url)
            if resp is None:
                break

            soup = BeautifulSoup(resp.text, "lxml")
            product_cards = soup.select("a.prodlink")
            if not product_cards:
                product_cards = soup.select("a[href*='/products/']")

            if not product_cards:
                break

            logger.info("[INCIDecoder]   page %d: found %d links", page, len(product_cards))
            for card in product_cards:
                href = card.get("href", "")
                if not href or "/products/" not in href:
                    continue
                product_url = href if href.startswith("http") else BASE_URL + href
                if self._url_visited(product_url):
                    continue
                self._mark_url(product_url)
                self._scrape_product(product_url, segment)

            if len(product_cards) < 20:
                break

    def _scrape_product(self, url: str, segment: str) -> None:
        resp = self.get(url)
        if resp is None:
            return

        soup = BeautifulSoup(resp.text, "lxml")

        title_el = soup.select_one("h1") or soup.select_one(".product-header h1")
        if not title_el:
            return
        full_title = title_el.get_text(strip=True)

        brand = ""
        name = full_title
        brand_el = soup.select_one(".product-brand") or soup.select_one("h1 a")
        if brand_el:
            brand = brand_el.get_text(strip=True)
            name = full_title.replace(brand, "").strip().lstrip("-–— ").strip()
        elif " " in full_title:
            parts = full_title.split(" ", 1)
            brand = parts[0]
            name = parts[1] if len(parts) > 1 else full_title

        inci_el = soup.select_one("#ingredlist") or soup.select_one(".ingredlist")
        inci_raw = ""
        if inci_el:
            inci_raw = inci_el.get_text(separator=", ", strip=True)

        if not inci_raw:
            inci_spans = soup.select(".ingred-link")
            if inci_spans:
                inci_raw = ", ".join(s.get_text(strip=True) for s in inci_spans)

        inci_list = parse_inci(inci_raw)

        key = f"{brand.lower().strip()}|{name.lower().strip()}"
        if self._already_scraped(key):
            return

        self._add_product(Product(
            segment=segment,
            product_name=name,
            brand=brand,
            ingredients_raw=inci_raw,
            ingredients_list=inci_list,
            total_ingredient_count=len(inci_list),
            source="INCIDecoder",
            url=url,
        ))
