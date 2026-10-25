"""Gallery photos as served (BRD FR-GAL-006, BR-071).

Every upload is decoded and re-encoded, never stored as sent: the result
carries no EXIF, GPS or camera data, which could reveal where and when a
photo of members was taken. Two WebP sizes are kept, a thumbnail for the
grid and a display size for the viewer, so a slow connection loads the
small one first. The original file is not kept.
"""

import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ACCEPTED_TYPES = ("image/jpeg", "image/png", "image/webp")
# A file that decodes to more pixels than this is refused before it can use the memory.
MAX_PIXELS = 40_000_000
DISPLAY_EDGE = 1600
THUMB_EDGE = 480
WEBP_QUALITY = 80
SIZES = ("display", "thumb")


class ImageRejected(Exception):
    """unsupported_type or too_many_pixels."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class PreparedPhoto:
    display: bytes
    thumb: bytes
    width: int  # of the display size
    height: int


def _webp(image: Image.Image, edge: int) -> bytes:
    copy = image.copy()
    copy.thumbnail((edge, edge))
    out = io.BytesIO()
    copy.save(out, format="WEBP", quality=WEBP_QUALITY)  # no exif= argument: nothing carried over
    return out.getvalue()


def prepare(data: bytes) -> PreparedPhoto:
    """Decode an upload and produce the two sizes without any metadata."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data), formats=["JPEG", "PNG", "WEBP"]) as opened:
                if opened.width * opened.height > MAX_PIXELS:
                    raise ImageRejected("too_many_pixels")
                # Camera rotation lives in EXIF, which is dropped: apply it to the pixels first.
                upright = ImageOps.exif_transpose(opened).convert("RGB")
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError):
        raise ImageRejected("unsupported_type") from None
    display = _webp(upright, DISPLAY_EDGE)
    with Image.open(io.BytesIO(display)) as shown:
        width, height = shown.size
    return PreparedPhoto(display=display, thumb=_webp(upright, THUMB_EDGE), width=width, height=height)


def blurred(webp: bytes) -> bytes:
    """The same image blurred beyond recognition, for a "blur" decision on a removal request."""
    with Image.open(io.BytesIO(webp)) as image:
        radius = max(image.size) / 30
        out = io.BytesIO()
        image.convert("RGB").filter(ImageFilter.GaussianBlur(radius)).save(out, format="WEBP", quality=WEBP_QUALITY)
    return out.getvalue()
