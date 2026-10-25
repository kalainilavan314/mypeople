"""Where gallery photos are kept: WebP files in MEDIA_STORAGE_DIR, named by photo id and size.

The directory is outside any web root; photos are served only through the
API, after it checks that the album is published and the photo not removed.
"""

import os
import uuid
from pathlib import Path

from app.modules.content.gallery.images import SIZES


class PhotoMissing(Exception):
    pass


class MediaStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def _path(self, photo_id: uuid.UUID, size: str) -> Path:
        if size not in SIZES:
            raise ValueError(size)
        return self.root / f"{photo_id}-{size}.webp"

    def save(self, photo_id: uuid.UUID, size: str, data: bytes) -> None:
        """Written to a temporary name and renamed, so a reader never sees half a file."""
        self.root.mkdir(parents=True, exist_ok=True)
        path = self._path(photo_id, size)
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(data)
        os.replace(temporary, path)

    def read(self, photo_id: uuid.UUID, size: str) -> bytes:
        try:
            return self._path(photo_id, size).read_bytes()
        except FileNotFoundError:
            raise PhotoMissing() from None

    def delete(self, photo_id: uuid.UUID) -> None:
        for size in SIZES:
            self._path(photo_id, size).unlink(missing_ok=True)
