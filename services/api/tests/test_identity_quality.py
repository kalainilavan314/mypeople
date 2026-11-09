"""M01 capture-quality advice (FR-IDV-001) on generated photos; no database needed."""

from io import BytesIO

from PIL import Image, ImageDraw, ImageFilter

from app.modules.identity.documents.quality import assess


def _jpeg(image: Image.Image) -> bytes:
    out = BytesIO()
    image.convert("RGB").save(out, format="JPEG", quality=90)
    return out.getvalue()


def _sharp_card(width: int = 1200, height: int = 760) -> Image.Image:
    """A mid-grey card with black text-like stripes: sharp edges, normal light, no glare."""
    card = Image.new("L", (width, height), 150)
    draw = ImageDraw.Draw(card)
    for y in range(40, height - 40, 24):
        for x in range(40, width - 40, 60):
            draw.rectangle([x, y, x + 30, y + 8], fill=20)
    return card


def test_a_clear_well_lit_card_gets_no_advice():
    assert assess(_jpeg(_sharp_card()), document_page=True).problems == ()


def test_a_blurred_photo_is_named_blurry():
    blurred = _sharp_card().filter(ImageFilter.GaussianBlur(8))
    quality = assess(_jpeg(blurred), document_page=True)
    assert quality.checked
    assert quality.problems == ("blurry",)


def test_a_dark_photo_is_named_too_dark_not_also_blurry():
    dark = _sharp_card().point(lambda value: value // 6)
    assert assess(_jpeg(dark), document_page=True).problems == ("too_dark",)


def test_glare_on_an_id_page_is_named_but_not_on_a_selfie():
    card = _sharp_card()
    ImageDraw.Draw(card).ellipse([300, 150, 900, 600], fill=255)
    assert "glare" in assess(_jpeg(card), document_page=True).problems
    assert "glare" not in assess(_jpeg(card), document_page=False).problems


def test_a_small_photo_is_named_too_small():
    assert "too_small" in assess(_jpeg(_sharp_card(500, 320)), document_page=True).problems


def test_a_photo_that_cannot_be_read_here_gets_no_advice_rather_than_wrong_advice():
    heic_like = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 64
    quality = assess(heic_like, document_page=True)
    assert not quality.checked
    assert quality.problems == ()
