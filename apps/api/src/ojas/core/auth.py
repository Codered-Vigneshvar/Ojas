from functools import lru_cache

import jwt
from jwt import PyJWKClient

from ojas.config import settings


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def verify_supabase_token(token: str) -> dict:
    """Verify a Supabase-issued JWT using the project's JWKS endpoint.

    Works with any signing algorithm Supabase uses (currently ECC P-256 / ES256).
    JWKS keys are cached in memory — no network call after the first request.
    """
    client = _jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256", "HS256"],
        audience="authenticated",
    )
