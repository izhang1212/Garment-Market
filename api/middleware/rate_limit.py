"""
In-memory sliding-window rate limiter.

No Redis or extra dependencies needed for a single-dyno Render deployment.
Keys are typically client IP addresses. Buckets are cleaned on each check so
memory stays bounded to active clients.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, calls: int, period: int) -> None:
        self.calls = calls
        self.period = period
        self._buckets: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.time()
        with self._lock:
            timestamps = self._buckets[key]
            # Drop timestamps outside the window
            self._buckets[key] = [t for t in timestamps if now - t < self.period]
            if len(self._buckets[key]) >= self.calls:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded — max {self.calls} requests per {self.period}s. Try again shortly.",
                )
            self._buckets[key].append(now)


def client_ip(request: Request) -> str:
    """Extract real client IP, respecting Render/Vercel proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
