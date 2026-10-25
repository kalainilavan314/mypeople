# The My People API (FastAPI). Build from the repository root:
#   docker build -t my-people-api services/api
#
# Settings come from the environment at run time (DATABASE_URL, JWT_SECRET,
# NIC_PEPPER, ...; see .env.example). None are baked into the image.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# uvicorn trusts X-Forwarded-For only from this address; per-IP sign-in limits
# depend on it (README.md, "Sessions"). Set it to the reverse proxy's address.
ENV FORWARDED_ALLOW_IPS=127.0.0.1

WORKDIR /srv/api

COPY pyproject.toml README.md alembic.ini ./
COPY alembic ./alembic
COPY app ./app
RUN pip install .

# Run as an unprivileged user. Identity evidence is written only to
# EVIDENCE_STORAGE_DIR, which should be a mounted, encrypted volume.
RUN useradd --system --uid 10001 --home-dir /srv/api api \
    && mkdir -p /var/lib/my-people/evidence \
    && chown api /var/lib/my-people/evidence \
    && chmod 700 /var/lib/my-people/evidence
USER api

EXPOSE 8000

CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
