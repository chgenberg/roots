"""Lyko.se scraper – large Nordic beauty retailer."""

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

SEARCH_URL = "https://www.lyko.se/search"
MAX_PAGES = 5


class LykoScraper(BaseScraper):
    name = "lyko"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[Lyko] Searching '%s' for segment=%s", term, segment)
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
                            prod_data = item.get("item", item)
                            self._parse_ld_product(prod_data, segment)
                        return
                except (json.JSONDecodeError, TypeError):
                    continue

            cards = soup.select("a[href*='/produkt/'], a[href*='/product/']")
            if not cards:
                cards = soup.select(".product-card a, .ProductCard a")

            if not cards:
                break

            seen_urls = set()
            for card in cards:
                href = card.get("href", "")
                if not href or href in seen_urls:
                    continue
                seen_urls.add(href)
                product_url = href if href.startswith("http") else f"https://www.lyko.se{href}"
                if self._url_visited(product_url):
                    continue
                self._mark_url(product_url)
                self._scrape_product(product_url, segment)

            if len(cards) < 20:
                break

    def _parse_ld_product(self, data: dict, segment: str) -> None:
        name = data.get("name", "")
        brand = ""
        if isinstance(data.get("brand"), dict):
            brand = data["brand"].get("name", "")
        elif isinstance(data.get("brand"), str):
            brand = data["brand"]
        url = data.get("url", "")

        price = None
        offers = data.get("offers", {})
        if isinstance(offers, dict):
            try:
                price = float(offers.get("price", 0))
            except (ValueError, TypeError):
                pass
        elif isinstance(offers, list) and offers:
            try:
                price = float(offers[0].get("price", 0))
            except (ValueError, TypeError):
                pass

        rating = None
        agg = data.get("aggregateRating", {})
        if agg:
            try:
                rating = float(agg.get("ratingValue", 0))
            except (ValueError, TypeError):
                pass

        reviews = None
        if agg:
            try:
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
            source="Lyko",
            url=url,
        )
        self._enrich_product(product)
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

        brand_el = soup.select_one("a[href*='/brand/'], .product-brand")
        if brand_el:
            brand = brand_el.get_text(strip=True)

        price = None
        price_el = soup.select_one("[data-price], .ProductPrice, .product-price")
        if price_el:
            text = price_el.get("data-price", "") or price_el.get_text()
            m = re.search(r"([\d\s.,]+)", text)
            if m:
                try:
                    price = float(m.group(1).replace(" ", "").replace(",", "."))
                except ValueError:
                    pass

        rating = None
        rating_el = soup.select_one("[itemprop='ratingValue'], .rating-value")
        if rating_el:
            try:
                rating = float(rating_el.get("content", rating_el.get_text(strip=True)))
            except ValueError:
                pass

        reviews = None
        rev_el = soup.select_one("[itemprop='reviewCount'], .review-count")
        if rev_el:
            m = re.search(r"(\d+)", rev_el.get("content", rev_el.get_text()))
            if m:
                reviews = int(m.group(1))

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
            source="Lyko",
            url=url,
        )
        self._enrich_product(product)
        self._add_product(product)

    def _enrich_product(self, product: Product) -> None:
        if not product.url:
            return
        resp = self.get(product.url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
        if resp is None:
            return
        soup = BeautifulSoup(resp.text, "lxml")

        inci_section = soup.find(string=re.compile(r"ingrediens|inci|ingredients", re.I))
        if inci_section:
            parent = inci_section.find_parent(["div", "section", "p", "td"])
            if parent:
                text = parent.get_text(separator=" ", strip=True)
                text = re.sub(r"^.*?(?:ingrediens|inci|ingredients)\s*:?\s*", "", text, flags=re.I)
                if len(text) > 20:
                    product.ingredients_raw = text
                    product.ingredients_list = parse_inci(text)
                    product.total_ingredient_count = len(product.ingredients_list)

        if not product.volume_ml:
            vol_match = re.search(r"(\d+)\s*ml", soup.get_text(), re.I)
            if vol_match:
                product.volume_ml = float(vol_match.group(1))
