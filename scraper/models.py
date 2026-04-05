from __future__ import annotations

from pydantic import BaseModel, Field


class Product(BaseModel):
    segment: str = Field(description="shampoo | conditioner | body_wash")
    product_name: str = ""
    brand: str = ""
    price_original: float | None = None
    currency: str = "SEK"
    price_sek: float | None = None
    volume_ml: float | None = None
    average_rating: float | None = Field(None, ge=0, le=5)
    num_reviews: int | None = None
    source: str = ""
    url: str = ""
    ingredients_raw: str = ""
    ingredients_list: list[str] = Field(default_factory=list)
    natural_ingredient_count: int = 0
    synthetic_ingredient_count: int = 0
    total_ingredient_count: int = 0
    ewg_score: float | None = None
    fit_score: float | None = Field(None, ge=0, le=10)
    fit_motivation: str = ""

    def unique_key(self) -> str:
        return f"{self.brand.lower().strip()}|{self.product_name.lower().strip()}"
