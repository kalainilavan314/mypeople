"""Write the API's OpenAPI document to packages/api-client/openapi.json.

The TypeScript client's types are generated from that file, so run this after
changing any endpoint or schema (from services/api, with the venv active):

    python scripts/export_openapi.py
    npm run generate -w @my-people/api-client      (from the repository root)
"""

import json
from pathlib import Path

from app.core.config import Settings
from app.main import create_app

TARGET = Path(__file__).resolve().parents[3] / "packages" / "api-client" / "openapi.json"

# Building the schema connects to nothing and reads no secret; these values only
# satisfy the required settings.
settings = Settings(
    _env_file=None,
    app_env="development",
    database_url="postgresql://schema-export@localhost/unused",
    jwt_secret="used-only-to-export-the-schema",
    nic_pepper="used-only-to-export-the-schema",
)
schema = create_app(settings).openapi()
# LF line endings on every platform, so a regenerate on Windows matches CI on Linux.
TARGET.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
print(f"wrote {TARGET.relative_to(TARGET.parents[2])}")
