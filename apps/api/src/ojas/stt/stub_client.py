import asyncio

from ojas.stt.base import STTClient, Transcript


class StubSTTClient(STTClient):
    """Returns a placeholder transcript after a 1-second simulated delay."""

    async def transcribe(self, audio_bytes: bytes, language: str | None = None) -> Transcript:
        await asyncio.sleep(1)
        estimated_duration = max(1.0, len(audio_bytes) / 16000)
        return Transcript(
            text=(
                f"[Transcription stub — STT not yet wired. "
                f"Estimated duration: {estimated_duration:.1f}s. "
                f"Edit this text before saving.]"
            ),
            language="en",
            duration_seconds=estimated_duration,
        )

    def transcribe_stream(self, audio_path: str) -> tuple[object, object]:
        import os
        from dataclasses import dataclass

        @dataclass
        class DummyInfo:
            duration: float
            language: str

        @dataclass
        class DummySegment:
            start: float
            end: float
            text: str

        size = os.path.getsize(audio_path)
        estimated_duration = max(1.0, size / 16000)
        
        def segment_generator():
            yield DummySegment(0.0, estimated_duration, "[Transcription stub — streaming...]")
            
        return segment_generator(), DummyInfo(duration=estimated_duration, language="en")
