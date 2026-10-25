"""How long a staff authenticator is locked after wrong codes (NFR-SEC-04, FR-STF-001).

Failures are counted per authenticator, across every session, because a
count kept per session started again with each sign-in: with three codes
valid at any moment (clock drift), unlimited sessions made a six-digit code
guessable. Five wrong codes lock the authenticator, each lockout in a row
longer than the last, so the guesses possible in a day stay in single
figures. A correct code clears both counts.

[ASSUMPTION] The BRD sets no figures; these are proposed for sponsor
confirmation alongside the sign-in throttle's.
"""

FAILURES_PER_LOCKOUT = 5
LOCKOUT_SECONDS = (15 * 60, 60 * 60, 4 * 60 * 60, 24 * 60 * 60)


def lockout_seconds(failed_attempts: int, previous_lockouts: int) -> int | None:
    """The lockout this many failures starts, or None while they are below the limit."""
    if failed_attempts < FAILURES_PER_LOCKOUT:
        return None
    return LOCKOUT_SECONDS[min(previous_lockouts, len(LOCKOUT_SECONDS) - 1)]
