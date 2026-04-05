"""Base scraper class with checkpointing and rate-limited HTTP."""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from pathlib import Path

from scraper.config import INTERMEDIATE_DIR
from scraper.models import Product
from scraper.utils.http import build_session, rate_limited_get

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    name: str = "base"

    def __init__(self) -> None:
        self.session = build_session()
        self._checkpoint_path = INTERMEDIATE_DIR / f"{self.name}.json"
        self._products: list[Product] = []
        self._visited_urls: set[str] = set()
        self._load_checkpoint()

    def _load_checkpoint(self) -> None:
        if self._checkpoint_path.exists():
            try:
                data = json.loads(self._checkpoint_path.read_text(encoding="utf-8"))
                self._products = [Product(**p) for p in data]
                logger.info(
                    "[%s] Loaded %d products from checkpoint",
                    self.name, len(self._products),
                )
            except Exception as exc:
                logger.warning("[%s] Could not load checkpoint: %s", self.name, exc)
                self._products = []

    def _save_checkpoint(self) -> None:
        data = [p.model_dump() for p in self._products]
        self._checkpoint_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        logger.info(
            "[%s] Saved checkpoint with %d products", self.name, len(self._products)
        )

    def _already_scraped(self, key: str) -> bool:
        return any(p.unique_key() == key for p in self._products)

    def _url_visited(self, url: str) -> bool:
        if url in self._visited_urls:
            return True
        if any(p.url == url for p in self._products):
            return True
        return False

    def _mark_url(self, url: str) -> None:
        self._visited_urls.add(url)

    def _add_product(self, product: Product) -> None:
        self._products.append(product)
        if len(self._products) % 25 == 0:
            self._save_checkpoint()

    def get(self, url: str, **kwargs) -> "requests.Response | None":
        return rate_limited_get(self.session, url, **kwargs)

    @abstractmethod
    def scrape(self) -> list[Product]:
        ...

    def run(self) -> list[Product]:
        logger.info("[%s] Starting scrape …", self.name)
        try:
            results = self.scrape()
        except Exception as exc:
            logger.error("[%s] Scrape failed: %s", self.name, exc, exc_info=True)
            results = self._products
        self._save_checkpoint()
        logger.info("[%s] Finished with %d products", self.name, len(results))
        return results
