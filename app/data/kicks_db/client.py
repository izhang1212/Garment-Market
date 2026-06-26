import time
import requests

_BASE_URL = "https://api.kicks.dev/v3"


class KicksDBClient:
    """Thin HTTP wrapper around the KicksDB REST API.

    Enforces a minimum delay between requests so we stay well under
    the Standard API rate limit (sub-300 ms latency target).
    """

    def __init__(self, api_key: str, min_interval: float = 0.2) -> None:
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        })
        self._min_interval = min_interval
        self._last_call: float = 0.0

    def get(self, path: str, params: dict | None = None) -> dict | list:
        elapsed = time.monotonic() - self._last_call
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)

        response = self._session.get(f"{_BASE_URL}{path}", params=params)
        self._last_call = time.monotonic()
        response.raise_for_status()
        return response.json()
