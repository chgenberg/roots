from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
INTERMEDIATE_DIR = DATA_DIR / "intermediate"
OUTPUT_DIR = DATA_DIR / "output"

INTERMEDIATE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SEGMENTS = {
    "shampoo": {
        "search_terms": [
            "natural shampoo",
            "naturligt schampo",
            "organic shampoo",
            "sulfate free shampoo",
            "clean shampoo",
            "eco shampoo",
            "vegan shampoo",
        ],
        "display_name": "Schampo",
    },
    "conditioner": {
        "search_terms": [
            "natural conditioner",
            "naturligt balsam",
            "organic conditioner",
            "clean conditioner",
            "eco conditioner",
            "vegan conditioner",
        ],
        "display_name": "Balsam",
    },
    "body_wash": {
        "search_terms": [
            "natural body wash",
            "naturlig duschtvål",
            "organic body wash",
            "clean body wash",
            "eco body wash",
            "natural shower gel",
            "vegan body wash",
        ],
        "display_name": "Body Wash",
    },
}

TARGET_PRICE_PER_PRODUCT_SEK = 133  # ~399 SEK / 3 products
TARGET_PACKAGE_PRICE_SEK = 399

REQUEST_DELAY_MIN = 1.5
REQUEST_DELAY_MAX = 3.5
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30

TOP_N_PRODUCTS = 100

SCORING_WEIGHTS = {
    "naturalness": 0.35,
    "review_score": 0.20,
    "price_fit": 0.15,
    "unisex": 0.15,
    "simplicity": 0.15,
}

CURRENCY_TO_SEK = {
    "SEK": 1.0,
    "NOK": 1.02,
    "DKK": 1.55,
    "EUR": 11.5,
    "USD": 10.5,
    "GBP": 13.3,
}

GENDERED_KEYWORDS_MALE = [
    "men", "man", "för honom", "masculine", "beard", "herr",
    "gentleman", "barber",
]
GENDERED_KEYWORDS_FEMALE = [
    "women", "woman", "för henne", "feminine", "princess",
    "kvinna", "dam", "lady", "ladies",
]
