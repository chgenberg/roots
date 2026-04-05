"""Main orchestration – run all scrapers, deduplicate, score, and export."""

from __future__ import annotations

import logging
import re
import sys
import time

from scraper.export import export_excel
from scraper.models import Product
from scraper.scoring import score_all
from scraper.utils.dedup import deduplicate

from scraper.sources.open_beauty_facts import OpenBeautyFactsScraper
from scraper.sources.incidecoder import INCIDecoderScraper
from scraper.sources.iherb import IHerbScraper
from scraper.sources.lyko import LykoScraper
from scraper.sources.bangerhead import BangerheadScraper
from scraper.sources.eleven import ElevenScraper
from scraper.sources.lookfantastic import LookfantasticScraper
from scraper.sources.ecco_verde import EccoVerdeScraper

class _FlushHandler(logging.StreamHandler):
    def emit(self, record):
        super().emit(record)
        self.flush()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[_FlushHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

SCRAPERS = [
    OpenBeautyFactsScraper,
    INCIDecoderScraper,
    IHerbScraper,
    LykoScraper,
    BangerheadScraper,
    ElevenScraper,
    LookfantasticScraper,
    EccoVerdeScraper,
]


def main() -> None:
    start = time.time()
    all_products = []

    for scraper_cls in SCRAPERS:
        scraper = scraper_cls()
        logger.info("=" * 60)
        logger.info("Running scraper: %s", scraper.name)
        logger.info("=" * 60)
        try:
            products = scraper.run()
            logger.info("  -> Got %d products from %s", len(products), scraper.name)
            all_products.extend(products)
        except Exception as exc:
            logger.error("Scraper %s crashed: %s", scraper.name, exc, exc_info=True)

    logger.info("Total raw products: %d", len(all_products))

    logger.info("Cleaning up product data …")
    all_products = [_cleanup_product(p) for p in all_products]

    logger.info("Deduplicating …")
    unique = deduplicate(all_products)
    logger.info("After dedup: %d products", len(unique))

    logger.info("Scoring …")
    scored = score_all(unique)

    logger.info("Exporting to Excel …")
    path = export_excel(scored)

    elapsed = time.time() - start
    logger.info("Done in %.1f minutes. Output: %s", elapsed / 60, path)


_KNOWN_BRANDS = [
    "Sachajuan", "Maria Åkerberg", "Maria Nila", "Rahua", "Davines",
    "Olaplex", "Kevin Murphy", "Moroccanoil", "Bumble and bumble",
    "Kérastase", "Redken", "Paul Mitchell", "IDUN Minerals", "Molton Brown",
    "L'Oréal", "Schwarzkopf", "Wella", "Lador", "Innersense",
    "Acure", "Attitude", "Dr. Bronner", "Weleda", "Urtekram",
    "Faith in Nature", "Green People", "Natura Siberica", "Organic Shop",
    "Jason", "Avalon Organics", "Giovanni", "Desert Essence",
    "Shea Moisture", "Maui Moisture", "OGX", "Garnier", "Herbal Essences",
    "TRESemmé", "Aussie", "Balmain Hair Couture", "Björk", "Cutrin",
    "Sim Sensitive", "Lernberger Stafsing", "Sachajuan", "Hårologi",
    "ACO", "Barnängen", "CCS", "Dove", "Nivea", "Rituals", "Baylis & Harding",
    "Babor", "Unite", "Pureology", "Aveda", "Verb", "Briogeo",
    "Function of Beauty", "Drunk Elephant", "Caudalie", "Klorane",
    "Bioderma", "Nuxe", "Korres", "Apivita", "Biotherm", "Melvita",
    "Cattier", "Coslys", "Naturtint", "Oway", "Kemon", "Insight",
    "Naturie", "NatureLab", "Marc Inbane",
]


def _cleanup_product(p: Product) -> Product:
    """Fix missing brands and clean up concatenated product names."""
    name = p.product_name.strip()

    if not p.brand or p.brand.strip() == "":
        for b in _KNOWN_BRANDS:
            if name.startswith(b):
                p.brand = b
                remainder = name[len(b):].strip()
                if remainder:
                    p.product_name = remainder
                break

    name = p.product_name
    m = re.match(r"^([A-ZÅÄÖÆØÜ][a-zåäöæøü]+(?:\s+[A-ZÅÄÖÆØÜ][a-zåäöæøü]+)*)\s*([A-Z].*)", name)
    if m and not p.brand:
        candidate_brand = m.group(1).strip()
        if len(candidate_brand) >= 3 and len(candidate_brand.split()) <= 4:
            p.brand = candidate_brand
            p.product_name = m.group(2).strip()

    p.product_name = re.sub(r"(\d+)\s*ml\b", r"\1 ml", p.product_name)

    return p


if __name__ == "__main__":
    main()
