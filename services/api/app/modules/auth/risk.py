"""Risk rules for a successful sign-in (BRD NFR-SEC-12, FR-AUTH-018, BR-151) as plain functions.

NFR-SEC-12 names three signals: a new device, unusual velocity and impossible
travel. Impossible travel needs the location of every sign-in, which this
platform does not collect (location is optional and purpose-specific), so it
is not used. [ASSUMPTION] until the security lead sets them, the thresholds
below decide; a new device on its own is not suspicious (FR-AUTH-019 already
tells the member about it), but it adds to any other signal.
"""

from datetime import timedelta

FAILURE_WINDOW = timedelta(hours=1)
FAILURES_BEFORE_SUCCESS = 3  # wrong passwords on the account, from any address, in the hour before this sign-in
VELOCITY_WINDOW = timedelta(hours=1)
SIGN_INS_PER_HOUR = 5  # sign-ins to the account in the hour before this one


def signals(*, new_device: bool, recent_failures: int, recent_sign_ins: int) -> list[str]:
    """The reasons this sign-in looks suspicious; empty when it does not."""
    found = []
    if recent_failures >= FAILURES_BEFORE_SUCCESS:
        found.append("recent_failures")
    if recent_sign_ins >= SIGN_INS_PER_HOUR:
        found.append("unusual_velocity")
    if found and new_device:
        found.insert(0, "new_device")
    return found
