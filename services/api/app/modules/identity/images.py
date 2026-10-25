"""Which uploads count as identity images (BRD FR-REG-010).

The type is read from the file's first bytes, not from the name or the
Content-Type a client claims, so a PDF or a script renamed .jpg is refused.
"""

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # FR-REG-010: up to 10 MB, compressed on the device first
ACCEPTED_TYPES = ("image/jpeg", "image/png", "image/heic")

# ISO base media "brands" used by HEIC photos (iPhone and most Android cameras).
_HEIC_BRANDS = {b"heic", b"heix", b"heim", b"heis", b"mif1"}


def image_type(data: bytes) -> str | None:
    """The image's media type, or None when it is not JPEG, PNG or HEIC."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[4:8] == b"ftyp" and data[8:12] in _HEIC_BRANDS:
        return "image/heic"
    return None
