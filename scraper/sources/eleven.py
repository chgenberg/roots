"""Eleven.se scraper – Swedish beauty retailer."""

from __future__ import annotations

import json
import logging
import re

from bs4 import BeautifulSoup

from scraper.config import SEGMENTS
from scraper.models import Product
from scraper.sources.base import BaseScraper
from scraper.utils.ingredients import parse_inci

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.eleven.se/search/"
MAX_PAGES = 3


class ElevenScraper(BaseScraper):
    name = "eleven"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[Eleven] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            url = f"{SEARCH_URL}?q={term.replace(' ', '+')}&page={page}"
            resp = self.get(url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
            if resp is None:
                break

            soup = BeautifulSoup(resp.text, "lxml")

            ld_scripts = soup.select('script[type="application/ld+json"]')
            for script in ld_scripts:
                try:
                    ld = json.loads(script.string)
                    if isinstance(ld, dict) and ld.get("@type") == "ItemList":
                        for item in ld.get("itemListElement", []):
                            self._parse_ld_product(item.get("item", item), segment)
                        return
                except (json.JSONDecodeError, TypeError):
                    continue

            links = soup.select("a[href*='/product/'], a[href*='/produkt/']")
            if not links:
                links = soup.select(".product-card a, .product-list a[href]")

            if not links:
                break

            seen: set[str] = set()
            for link in links:
                href = link.get("href", "")
                if not href or href in seen:
                    continue
                seen.add(href)
                full_url = href if href.startswith("http") else f"https://www.eleven.se{href}"
                if self._url_visited(full_url):
                    continue
                self._mark_url(full_url)
                self._scrape_product(full_url, segment)

            if len(seen) < 10:
                break

    def _parse_ld_product(self, data: dict, segment: str) -> None:
        name = data.get("name", "")
        brand = ""
        if isinstance(data.get("brand"), dict):
            brand = data["brand"].get("name", "")
        url = data.get("url", "")

        price = None
        offers = data.get("offers", {})
        if isinstance(offers, dict):
            try:
                price = float(offers.get("price", 0))
            except (ValueError, TypeError):
                pass

        rating = None
        reviews = None
        agg = data.get("aggregateRating", {})
        if agg:
            try:
                rating = float(agg.get("ratingValue", 0))
                reviews = int(agg.get("reviewCount", 0))
            except (ValueError, TypeError):
                pass

        key = f"{brand.lower().strip()}|{name.lower().strip()}"
        if not name or self._already_scraped(key):
            return

        product = Product(
            segment=segment,
            product_name=name,
            brand=brand,
            price_original=price,
            currency="SEK",
            price_sek=price,
            average_rating=min(rating, 5.0) if rating else None,
            num_reviews=reviews,
            source="Eleven",
            url=url,
        )
        self._enrich_ingredients(product)
        self._add_product(product)

    def _scrape_product(self, url: str, segment: str) -> None:
        resp = self.get(url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
        if resp is None:
            return

        soup = BeautifulSoup(resp.text, "lxml")

        name = ""
        brand = ""
        title_el = soup.select_one("h1")
        if title_el:
            name = title_el.get_text(strip=True)

        brand_el = soup.select_one(".product-brand, a[href*='/brand/']")
        if brand_el:
            brand = brand_el.get_text(strip=True)

        price = None
        price_el = soup.select_one(".product-price, [itemprop='price']")
        if price_el:
            text = price_el.get("content", "") or price_el.get_text()
            m = re.search(r"([\d\s.,]+)", text)
            if m:
                try:
                    price = float(m.group(1).replace(" ", "").replace(",", "."))
                except ValueError:
                    pass

        rating = None
        rating_el = soup.select_one("[itemprop='ratingValue']")
        if rating_el:
            try:
                rating = float(rating_el.get("content", rating_el.get_text(strip=True)))
            except ValueError:
                pass

        reviews = None
        rev_el = soup.select_one("[itemprop='reviewCount']")
        if rev_el:
            m = re.search(r"(\d+)", rev_el.get("content", rev_el.get_text()))
            if m:
                reviews = int(m.group(1))

        inci_raw = self._extract_ingredients(soup)
        inci_list = parse_inci(inci_raw)

        key = f"{brand.lower().strip()}|{name.lower().strip()}"
        if not name or self._already_scraped(key):
            return

        vol = None
        vm = re.search(r"(\d+)\s*ml", name, re.I)
        if vm:
            vol = float(vm.group(1))

        self._add_product(Product(
            segment=segment,
            product_name=name,
            brand=brand,
            price_original=price,
            currency="SEK",
            price_sek=price,
            volume_ml=vol,
            average_rating=min(rating, 5.0) if rating else None,
            num_reviews=reviews,
            ingredients_raw=inci_raw,
            ingredients_list=inci_list,
            total_ingredient_count=len(inci_list),
            source="Eleven",
            url=url,
        ))

    def _enrich_ingredients(self, product: Product) -> None:
        if not product.url or product.ingredients_list:
            return
        resp = self.get(product.url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
        if resp is None:
            return
        soup = BeautifulSoup(resp.text, "lxml")
        inci_raw = self._extract_ingredients(soup)
        if inci_raw:
            product.ingredients_raw = inci_raw
            product.ingredients_list = parse_inci(inci_raw)
            product.total_ingredient_count = len(product.ingredients_list)

    @staticmethod
    def _extract_ingredients(soup: BeautifulSoup) -> str:
        marker = soup.find(string=re.compile(r"ingrediens|inci|ingredients", re.I))
        if marker:
            parent = marker.find_parent(["div", "section", "p", "td"])
            if parent:
                text = parent.get_text(separator=" ", strip=True)
                text = re.sub(r"^.*?(?:ingrediens|inci|ingredients)\s*:?\s*", "", text, flags=re.I)
                if len(text) > 20:
                    return text
        return ""
