"""Preparation and validation of bank transfer slips for finance review (M1.4).

- Accepts JPEG and PNG only.
- Confirms actual decoded format; never trusts HTTP Content-Type headers.
- Enforces 15 MB payload limit and 40,000,000 decoded pixel limit (decompression bomb defense).
- Normalizes camera orientation via EXIF transpose.
- Strips all EXIF, GPS, device and personal metadata.
- Bounds maximum image edge to 4096 px while preserving high resolution for zoom inspection.
- Produces canonical sanitized bytes with SHA-256 hash.
"""

import hashlib
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_DECODED_PIXELS = 40_000_000      # 40 MP
MAX_STORED_EDGE = 4096              # 4K max edge for detailed slip inspection


class SlipImageRejected(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class PreparedSlip:
    content_type: str
    data: bytes
    sha256: str
    width: int
    height: int


def sniff_magic(data: bytes) -> str:
    """Validate true format signature by magic bytes."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    raise SlipImageRejected("unsupported_media_type")


def prepare_slip(data: bytes) -> PreparedSlip:
    """Decode, sanitize, and canonicalize a bank transfer slip."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise SlipImageRejected("slip_too_large")

    media_type = sniff_magic(data)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=["JPEG", "PNG"]) as opened:
                if opened.width * opened.height > MAX_DECODED_PIXELS:
                    raise SlipImageRejected("too_many_pixels")

                # Normalize orientation from EXIF before stripping metadata
                transposed = ImageOps.exif_transpose(opened)

                # Convert to RGB (or RGBA if transparency is present in PNG)
                if transposed.mode not in ("RGB", "L"):
                    transposed = transposed.convert("RGB")

                # Scale down only if larger than 4096 px
                if max(transposed.width, transposed.height) > MAX_STORED_EDGE:
                    transposed.thumbnail((MAX_STORED_EDGE, MAX_STORED_EDGE), Image.Resampling.LANCZOS)

                out = io.BytesIO()
                # Re-encode to canonical clean output without passing exif parameter
                if media_type == "image/jpeg":
                    transposed.save(out, format="JPEG", quality=90, optimize=True)
                    target_content_type = "image/jpeg"
                else:
                    transposed.save(out, format="PNG", optimize=True)
                    target_content_type = "image/png"

                clean_bytes = out.getvalue()
                digest = hashlib.sha256(clean_bytes).hexdigest()

                return PreparedSlip(
                    content_type=target_content_type,
                    data=clean_bytes,
                    sha256=digest,
                    width=transposed.width,
                    height=transposed.height,
                )

    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError):
        raise SlipImageRejected("malformed_or_dangerous_image") from None
