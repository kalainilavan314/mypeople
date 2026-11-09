"""Capture-quality checks for identity photos (BRD FR-IDV-001, AI-01, M01) as plain functions.

Advice to the member, never a decision: a photo that fails a check is still
stored and counts as received, and the member chooses whether to retake it
(BR-091). The checks are simple image statistics, not a model, so they need
no AI provider (OD-42). [ASSUMPTION] The thresholds are starting values until
they are tuned on the consented local test set (DEP-16).

Not checked here: whether the whole card is inside the frame (edge
visibility), which needs document-edge detection.
"""

from dataclasses import dataclass
from io import BytesIO
from typing import Literal

from PIL import Image, ImageFilter, ImageStat, UnidentifiedImageError

Problem = Literal["blurry", "too_dark", "glare", "too_small"]

MIN_SHORT_SIDE = 600  # pixels on the short side of the original photo
ANALYSIS_LONG_SIDE = 800  # photos are scaled down to this before measuring
MIN_SHARPNESS = 60.0  # variance of the Laplacian on the scaled grey image
MIN_BRIGHTNESS = 50.0  # mean grey level, 0 to 255
GLARE_LEVEL = 250  # a grey level this high is blown out
MAX_GLARE_SHARE = 0.08  # share of blown-out pixels allowed on an ID page

# The 3x3 Laplacian, offset to mid-grey so negative responses survive in an 8-bit image.
_LAPLACIAN = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1, offset=128)


@dataclass(frozen=True)
class Quality:
    """`checked` is False when the photo could not be decoded here (HEIC), so no advice is given."""

    checked: bool
    problems: tuple[Problem, ...]


NOT_CHECKED = Quality(checked=False, problems=())


def assess(data: bytes, *, document_page: bool) -> Quality:
    """The problems a reviewer would likely have with this photo; empty when it looks usable.

    `document_page` is True for NIC sides and the passport page, where glare on the
    laminate hides the details; a selfie is not checked for glare.
    """
    try:
        with Image.open(BytesIO(data)) as opened:
            opened.load()
            width, height = opened.size
            grey = opened.convert("L")
    except (UnidentifiedImageError, OSError, ValueError):
        return NOT_CHECKED  # HEIC or a file Pillow cannot read: no advice rather than wrong advice

    problems: list[Problem] = []
    if min(width, height) < MIN_SHORT_SIDE:
        problems.append("too_small")

    grey.thumbnail((ANALYSIS_LONG_SIDE, ANALYSIS_LONG_SIDE))
    if ImageStat.Stat(grey).mean[0] < MIN_BRIGHTNESS:
        problems.append("too_dark")
    elif ImageStat.Stat(grey.filter(_LAPLACIAN)).var[0] < MIN_SHARPNESS:
        # A dark photo also measures as soft; naming darkness alone gives the member one clear fix.
        problems.append("blurry")

    if document_page:
        histogram = grey.histogram()
        blown_out = sum(histogram[GLARE_LEVEL:]) / max(1, grey.width * grey.height)
        if blown_out > MAX_GLARE_SHARE:
            problems.append("glare")

    return Quality(checked=True, problems=tuple(problems))
