"""Bangerhead.se scraper – Swedish beauty retailer."""

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

SEARCH_URL = "https://www.bangerhead.se/catalogsearch/result/"
MAX_PAGES = 3


class BangerheadScraper(BaseScraper):
    name = "bangerhead"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[Bangerhead] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            url = f"{SEARCH_URL}?q={term.replace(' ', '+')}&p={page}"
            resp = self.get(url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
            if resp is None:
                break

            soup = BeautifulSoup(resp.text, "lxml")

            cards = soup.select("a.product-item-link, .product-item a[href]")
            if not cards:
                cards = soup.select("li.product-item a[href*='bangerhead.se']")

            if not cards:
                break

            seen_urls: set[str] = set()
            for card in cards:
                href = card.get("href", "")
                if not href or href in seen_urls or "/catalogsearch/" in href:
                    continue
                seen_urls.add(href)
                if self._url_visited(href):
                    continue
                self._mark_url(href)
                self._scrape_product(href, segment)

            if len(seen_urls) < 10:
                break

    def _scrape_product(self, url: str, segment: str) -> None:
        resp = self.get(url, headers={"Accept-Language": "sv-SE,sv;q=0.9"})
        if resp is None:
            return

        soup = BeautifulSoup(resp.text, "lxml")

        name = ""
        brand = ""
        title_el = soup.select_one("h1.page-title span, h1")
        if title_el:
            name = title_el.get_text(strip=True)

        brand_el = soup.select_one("a[href*='/brand/'], .product-brand")
        if brand_el:
            brand = brand_el.get_text(strip=True)

        ld_scripts = soup.select('script[type="application/ld+json"]')
        for script in ld_scripts:
            try:
                ld = json.loads(script.string)
                if isinstance(ld, dict) and ld.get("@type") == "Product":
                    if not brand and isinstance(ld.get("brand"), dict):
                        brand = ld["brand"].get("name", "")
                    if not name:
                        name = ld.get("name", "")
                    offers = ld.get("offers", {})
                    if isinstance(offers, dict):
                        price = offers.get("price")
                    elif isinstance(offers, list) and offers:
                        price = offers[0].get("price")
                    break
            except (json.JSONDecodeError, TypeError):
                continue
        else:
            price = None

        price_sek = None
        if price:
            try:
                price_sek = float(str(price).replace(",", ".").replace(" ", ""))
            except ValueError:
                pass

        price_el = soup.select_one(".price-wrapper .price, .product-info-price .price")
        if price_sek is None and price_el:
            m = re.search(r"([\d\s.,]+)", price_el.get_text())
            if m:
                try:
                    price_sek = float(m.group(1).replace(" ", "").replace(",", "."))
                except ValueError:
                    pass

        rating = None
        rev_count = None
        rating_el = soup.select_one("[itemprop='ratingValue']")
        if rating_el:
            try:
                rating = float(rating_el.get("content", rating_el.get_text(strip=True)))
            except ValueError:
                pass
        rev_el = soup.select_one("[itemprop='reviewCount']")
        if rev_el:
            m = re.search(r"(\d+)", rev_el.get("content", rev_el.get_text()))
            if m:
                rev_count = int(m.group(1))

        inci_raw = ""
        inci_section = soup.find(string=re.compile(r"ingrediens|inci|ingredients", re.I))
        if inci_section:
            parent = inci_section.find_parent(["div", "section", "p", "td", "li"])
            if parent:
                text = parent.get_text(separator=" ", strip=True)
                text = re.sub(r"^.*?(?:ingrediens|inci|ingredients)\s*:?\s*", "", text, flags=re.I)
                if len(text) > 20:
                    inci_raw = text

        inci_list = parse_inci(inci_raw)

        key = f"{brand.lower().strip()}|{name.lower().strip()}"
        if not name or self._already_scraped(key):
            return

        vol = None
        vol_match = re.search(r"(\d+)\s*ml", name + " " + soup.get_text()[:500], re.I)
        if vol_match:
            vol = float(vol_match.group(1))

        self._add_product(Product(
            segment=segment,
            product_name=name,
            brand=brand,
            price_original=price_sek,
            currency="SEK",
            price_sek=price_sek,
            volume_ml=vol,
            average_rating=min(rating, 5.0) if rating else None,
            num_reviews=rev_count,
            ingredients_raw=inci_raw,
            ingredients_list=inci_list,
            total_ingredient_count=len(inci_list),
            source="Bangerhead",
            url=url,
        ))
