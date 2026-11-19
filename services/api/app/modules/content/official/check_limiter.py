"""How often one address may check a statement without signing in (BRD INT-22: rate-limited).

Kept in memory, so nothing about who checked what is stored: the API runs as one uvicorn process
(deployment/systemd/mypeople-api.service). With several processes each would count on its own,
and Nginx's limit_req would be the place for the limit instead.
"""

import threading
import time
from collections.abc import Callable


class CheckLimiter:
    def __init__(self, limit: int, window_seconds: int, clock: Callable[[], float] = time.monotonic) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._windows: dict[str, tuple[float, int]] = {}

    def wait_needed(self, address: str) -> int | None:
        """Count one check. None when it may go ahead; otherwise the seconds until it may."""
        now = self._clock()
        with self._lock:
            if len(self._windows) > 10_000:
                self._windows = {a: w for a, w in self._windows.items() if now - w[0] < self._window}
            started, count = self._windows.get(address, (now, 0))
            if now - started >= self._window:
                started, count = now, 0
            if count >= self._limit:
                return max(int(started + self._window - now) + 1, 1)
            self._windows[address] = (started, count + 1)
            return None
