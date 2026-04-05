"""Lookfantastic.com scraper – large European beauty retailer."""

from __future__ import annotations

import json
import logging
import re

from bs4 import BeautifulSoup

from scraper.config import SEGMENTS, CURRENCY_TO_SEK
from scraper.models import Product
from scraper.sources.base import BaseScraper
from scraper.utils.ingredients import parse_inci

logger = logging.getLogger(__name__)

SEARCH_URL = "https://www.lookfantastic.com/health-beauty.list"
MAX_PAGES = 3


class LookfantasticScraper(BaseScraper):
    name = "lookfantastic"

    def scrape(self) -> list[Product]:
        for segment, cfg in SEGMENTS.items():
            for term in cfg["search_terms"]:
                self._search(segment, term)
        return self._products

    def _search(self, segment: str, term: str) -> None:
        logger.info("[Lookfantastic] Searching '%s' for segment=%s", term, segment)
        for page in range(1, MAX_PAGES + 1):
            url = f"{SEARCH_URL}?search={term.replace(' ', '+')}&pageNumber={page}&sortOrder=rating"
            resp = self.get(url)
            if resp is None:
                break

            soup = BeautifulSoup(resp.text, "lxml")

            cards = soup.select("li.productListProducts_product a.productBlock_link")
            if not cards:
                cards = soup.select("a[href*='/products/']")

            if not cards:
                break

            seen: set[str] = set()
            for card in cards:
                href = card.get("href", "")
                if not href or href in seen:
                    continue
                seen.add(href)
                full_url = href if href.startswith("http") else f"https://www.lookfantastic.com{href}"
                if self._url_visited(full_url):
                    continue
                self._mark_url(full_url)
                self._scrape_product(full_url, segment)

            if len(seen) < 10:
                break

    def _scrape_product(self, url: str, segment: str) -> None:
        resp = self.get(url)
        if resp is None:
            return

        soup = BeautifulSoup(resp.text, "lxml")

        name = ""
        brand = ""

        ld_scripts = soup.select('script[type="application/ld+json"]')
        price = None
        rating = None
        reviews = None
        for script in ld_scripts:
            try:
                ld = json.loads(script.string)
                if isinstance(ld, dict) and ld.get("@type") == "Product":
                    name = ld.get("name", "")
                    if isinstance(ld.get("brand"), dict):
                        brand = ld["brand"].get("name", "")
                    elif isinstance(ld.get("brand"), str):
                        brand = ld["brand"]

                    offers = ld.get("offers", {})
                    if isinstance(offers, dict):
                        try:
                            price = float(offers.get("price", 0))
                        except (ValueError, TypeError):
                            pass
                        currency = offers.get("priceCurrency", "GBP")
                    elif isinstance(offers, list) and offers:
                        try:
                            price = float(offers[0].get("price", 0))
                        except (ValueError, TypeError):
                            pass
                        currency = offers[0].get("priceCurrency", "GBP")
                    else:
                        currency = "GBP"

                    agg = ld.get("aggregateRating", {})
                    if agg:
                        try:
                            rating = float(agg.get("ratingValue", 0))
                            reviews = int(agg.get("reviewCount", 0))
                        except (ValueError, TypeError):
                            pass
                    break
            except (json.JSONDecodeError, TypeError):
                continue
        else:
            currency = "GBP"

        if not name:
            title_el = soup.select_one("h1")
            if title_el:
                name = title_el.get_text(strip=True)

        key = f"{brand.lower().strip()}|{name.lower().strip()}"
        if not name or self._already_scraped(key):
            return

        price_sek = None
        if price and currency in CURRENCY_TO_SEK:
            price_sek = round(price * CURRENCY_TO_SEK[currency], 2)

        inci_raw = ""
        inci_section = soup.find(string=re.compile(r"ingredients?\s*:", re.I))
        if inci_section:
            parent = inci_section.find_parent(["div", "p", "section"])
            if parent:
                text = parent.get_text(separator=" ", strip=True)
                text = re.sub(r"^.*?ingredients?\s*:?\s*", "", text, flags=re.I)
                if len(text) > 20:
                    inci_raw = text

        if not inci_raw:
            details = soup.select_one("#product-description-content-lg-3, .product-description")
            if details:
                text = details.get_text(separator="\n")
                for line in text.split("\n"):
                    if len(line) > 40 and line.count(",") > 5:
                        inci_raw = line.strip()
                        break

        inci_list = parse_inci(inci_raw)

        vol = None
        vm = re.search(r"(\d+)\s*ml", name + " " + (soup.title.string or ""), re.I)
        if vm:
            vol = float(vm.group(1))

        self._add_product(Product(
            segment=segment,
            product_name=name,
            brand=brand,
            price_original=price,
            currency=currency,
            price_sek=price_sek,
            volume_ml=vol,
            average_rating=min(rating, 5.0) if rating else None,
            num_reviews=reviews,
            ingredients_raw=inci_raw,
            ingredients_list=inci_list,
            total_ingredient_count=len(inci_list),
            source="Lookfantastic",
            url=url,
        ))
