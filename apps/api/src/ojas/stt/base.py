from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Transcript:
    text: str
    language: str
    segments: list[dict[str, object]] = field(default_factory=list)
    duration_seconds: float = 0.0


class STTClient(ABC):
    """Abstract interface for speech-to-text backends."""

    @abstractmethod
    async def transcribe(
        self,
        audio_bytes: bytes,
        language: str | None = None,
    ) -> Transcript:
        """Transcribe audio bytes and return a Transcript."""

    @abstractmethod
    def transcribe_stream(self, audio_path: str) -> tuple[object, object]:
        """Transcribe an audio file and stream segments."""

