import pytest

from app.modules.auth.throttle import LOCKOUT_SECONDS, SignInGate, sign_in_gate


# Expected values written out from server/src/throttle.js checkLogin:
# delayMs = min(2000, (failures - 5 + 1) * 400) from 5 failures, refusal from 10.
@pytest.mark.parametrize(
    ("failures", "expected"),
    [
        (0, SignInGate(allowed=True)),
        (4, SignInGate(allowed=True)),
        (5, SignInGate(allowed=True, delay_seconds=0.4)),
        (6, SignInGate(allowed=True, delay_seconds=0.8)),
        (7, SignInGate(allowed=True, delay_seconds=1.2)),
        (8, SignInGate(allowed=True, delay_seconds=1.6)),
        (9, SignInGate(allowed=True, delay_seconds=2.0)),
        (10, SignInGate(allowed=False, retry_after=LOCKOUT_SECONDS)),
        (50, SignInGate(allowed=False, retry_after=LOCKOUT_SECONDS)),
    ],
)
def test_sign_in_gate(failures, expected):
    assert sign_in_gate(failures) == expected


def test_lockout_lasts_fifteen_minutes():
    assert LOCKOUT_SECONDS == 15 * 60
