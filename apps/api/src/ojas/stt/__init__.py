from ojas.config import settings
from ojas.stt.base import STTClient


def get_stt_client() -> STTClient:
    provider = settings.stt_provider
    if provider == "stub":
        from ojas.stt.stub_client import StubSTTClient

        return StubSTTClient()
    if provider == "local":
        from ojas.stt.local_client import LocalSTTClient

        return LocalSTTClient()
    raise ValueError(f"Unknown STT provider: {provider!r}. Set STT_PROVIDER=stub|local in .env")
