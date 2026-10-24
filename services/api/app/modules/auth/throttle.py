"""Sign-in throttling rules, the same as login in server/src/throttle.js.

Failed attempts are counted per NIC hash AND client IP together, never per IP
alone: members in a government office, an internet cafe or behind a carrier
NAT share one public address, and one person's typo must not lock the whole
building out. The counts live in npm.auth_attempt, which both APIs share, so
attempts made through either API count towards the same limits.
"""

import asyncio
from dataclasses import dataclass
from datetime import timedelta

WINDOW = timedelta(minutes=15)
SOFT_FAILURES = 5  # from here on, every attempt is slowed down
HARD_FAILURES = 10  # from here on, attempts are refused
LOCKOUT_SECONDS = 900
DELAY_STEP_SECONDS = 0.4
MAX_DELAY_SECONDS = 2.0


@dataclass(frozen=True)
class SignInGate:
    allowed: bool
    delay_seconds: float = 0.0
    retry_after: int | None = None  # seconds, for the Retry-After header


def sign_in_gate(recent_failures: int) -> SignInGate:
    """Decide what to do with a sign-in after this many failures in the window."""
    if recent_failures >= HARD_FAILURES:
        return SignInGate(allowed=False, retry_after=LOCKOUT_SECONDS)
    if recent_failures >= SOFT_FAILURES:
        # Progressive delay: unnoticeable to someone who mistyped, expensive
        # for a script making thousands of guesses.
        steps = recent_failures - SOFT_FAILURES + 1
        return SignInGate(allowed=True, delay_seconds=min(MAX_DELAY_SECONDS, round(steps * DELAY_STEP_SECONDS, 1)))
    return SignInGate(allowed=True)


async def wait(seconds: float) -> None:
    """Pause without holding a worker thread (tests replace this)."""
    if seconds > 0:
        await asyncio.sleep(seconds)
