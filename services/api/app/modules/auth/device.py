"""What a session shows about its device (BRD FR-AUTH-019, FR-AUTH-020): a coarse label, never
a precise location, and a key to notice a sign-in from a device not seen before.

Apps send a stable install id in the X-Device-Id header; for browsers the key
falls back to the browser's description, which is good enough to tell a new
device from a known one.
"""

import hashlib
from dataclasses import dataclass


@dataclass(frozen=True)
class Device:
    label: str
    key: str


_PLATFORMS = (
    ("iphone", "iPhone"),
    ("ipad", "iPad"),
    ("android", "Android"),
    ("windows", "Windows"),
    ("macintosh", "Mac"),
    ("mac os", "Mac"),
    ("cros", "Chromebook"),
    ("linux", "Linux"),
)


def describe(user_agent: str | None, device_id: str | None) -> Device:
    agent = (user_agent or "").lower()
    platform = next((name for marker, name in _PLATFORMS if marker in agent), "Other device")
    kind = "browser" if "mozilla" in agent else "app"
    identity = f"id:{device_id.strip()}" if device_id and device_id.strip() else f"ua:{agent}"
    return Device(label=f"{platform} {kind}", key=hashlib.sha256(identity.encode("utf-8")).hexdigest()[:32])
