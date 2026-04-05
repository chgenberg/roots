from __future__ import annotations

import random
import time
import logging

import requests
from fake_useragent import UserAgent
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from scraper.config import (
    MAX_RETRIES,
    REQUEST_DELAY_MAX,
    REQUEST_DELAY_MIN,
    REQUEST_TIMEOUT,
)

logger = logging.getLogger(__name__)

_ua = UserAgent(fallback="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")


def _random_ua() -> str:
    try:
        return _ua.random
    except Exception:
        return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"


def build_session(retries: int = MAX_RETRIES) -> requests.Session:
    session = requests.Session()
    retry_strategy = Retry(
        total=retries,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def rate_limited_get(
    session: requests.Session,
    url: str,
    *,
    params: dict | None = None,
    headers: dict | None = None,
    timeout: int = REQUEST_TIMEOUT,
    delay_min: float = REQUEST_DELAY_MIN,
    delay_max: float = REQUEST_DELAY_MAX,
) -> requests.Response | None:
    delay = random.uniform(delay_min, delay_max)
    time.sleep(delay)

    req_headers = {"User-Agent": _random_ua()}
    if headers:
        req_headers.update(headers)

    try:
        resp = session.get(url, params=params, headers=req_headers, timeout=timeout)
        resp.raise_for_status()
        return resp
    except requests.RequestException as exc:
        logger.warning("GET %s failed: %s", url, exc)
        return None
