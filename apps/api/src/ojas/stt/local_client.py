"""Local STT client using faster-whisper with ffmpeg normalisation."""

import json
import os
import subprocess
import tempfile

import structlog

from ojas.config import settings
from ojas.stt.base import STTClient, Transcript

logger = structlog.get_logger(__name__)


def _get_audio_info(path: str) -> dict:  # type: ignore[type-arg]
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", "-show_format", path],
            capture_output=True, text=True,
        )
        data = json.loads(r.stdout)
        stream = next(
            (s for s in data.get("streams", []) if s.get("codec_type") == "audio"), {}
        )
        fmt = data.get("format", {})
        return {
            "codec": stream.get("codec_name"),
            "sample_rate": stream.get("sample_rate"),
            "channels": stream.get("channels"),
            "duration": fmt.get("duration"),
            "format_name": fmt.get("format_name"),
        }
    except Exception as exc:
        return {"error": str(exc)}


def _normalize_to_wav(input_path: str) -> str:
    """Convert any browser audio to 16 kHz mono WAV.

    Tries format hints in order because browsers vary:
    - Chrome/Edge: audio/webm;codecs=opus  → EBML container
    - Safari:      audio/mp4               → MP4/M4A container
    - Firefox:     audio/ogg;codecs=opus   → OGG container
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as _f:
        out = _f.name
    base_args = ["-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-f", "wav", out]

    # Try auto-detect first, then explicit container hints
    format_attempts = [None, "webm", "matroska", "mp4", "ogg", "aac"]

    last_stderr = ""
    for fmt in format_attempts:
        cmd = ["ffmpeg", "-y"]
        if fmt:
            cmd += ["-f", fmt]
        cmd += ["-i", input_path] + base_args
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0:
            return out
        last_stderr = r.stderr

    raise RuntimeError(
        f"ffmpeg could not decode audio with any known format.\n{last_stderr[-600:]}"
    )


class LocalSTTClient(STTClient):
    def __init__(self, model_size: str | None = None) -> None:
        # Verify ffmpeg is available
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        if r.returncode != 0:
            raise RuntimeError("ffmpeg is not installed or not in PATH")

        from faster_whisper import WhisperModel

        size = model_size or settings.stt_model_size
        logger.info(
            "stt_init",
            model=size,
            compute_type=settings.stt_compute_type,
            device=settings.stt_device,
        )

        if settings.whisper_download_dir:
            os.makedirs(settings.whisper_download_dir, exist_ok=True)

        self._model = WhisperModel(
            model_size_or_path=size,
            device=settings.stt_device,
            compute_type=settings.stt_compute_type,
            download_root=settings.whisper_download_dir or None,
            cpu_threads=settings.stt_cpu_threads,
            num_workers=1,
        )
        logger.info("whisper_model_ready", model=size)

    async def transcribe(
        self,
        audio_bytes: bytes,
        language: str | None = None,
    ) -> Transcript:
        if len(audio_bytes) == 0:
            raise ValueError("Received empty audio (0 bytes)")

        # Write raw bytes to a file with no extension so ffmpeg probes from
        # magic bytes rather than being misled by a .webm / .mp4 extension.
        with tempfile.NamedTemporaryFile(delete=False, suffix=".audio") as f:
            f.write(audio_bytes)
            tmp_in = f.name

        wav_path: str | None = None
        try:
            logger.info("transcribe_probe", **_get_audio_info(tmp_in))
            wav_path = _normalize_to_wav(tmp_in)
            logger.info("transcribe_wav_ready", **_get_audio_info(wav_path))

            segments_raw, info = self._model.transcribe(
                wav_path,
                language=language or settings.stt_language,
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500, "threshold": 0.35},
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                initial_prompt=settings.stt_initial_prompt,
            )

            segments = list(segments_raw)
            text = " ".join(s.text.strip() for s in segments).strip()
            duration = info.duration

            logger.info(
                "transcribe_done",
                language=info.language,
                language_probability=getattr(info, "language_probability", None),
                segments=len(segments),
                chars=len(text),
                duration=duration,
            )
            if duration > 0 and not segments:
                logger.warning("transcribe_vad_filtered_all", duration=duration)

            return Transcript(
                text=text,
                language=info.language,
                segments=[{"start": s.start, "end": s.end, "text": s.text} for s in segments],
                duration_seconds=duration,
            )
        finally:
            for p in [tmp_in, wav_path]:
                if p and os.path.exists(p):
                    try:
                        os.remove(p)
                    except OSError:
                        pass

    def transcribe_stream(self, audio_path: str) -> tuple[object, object]:
        """Stream transcription segments live from the file path."""
        logger.info("transcribe_stream_input", **_get_audio_info(audio_path))
        wav_path = _normalize_to_wav(audio_path)
        logger.info("transcribe_stream_wav_ready", **_get_audio_info(wav_path))

        segments_raw, info = self._model.transcribe(
            wav_path,
            language=settings.stt_language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500, "threshold": 0.35},
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            initial_prompt=settings.stt_initial_prompt,
        )

        logger.info(
            "transcribe_stream_started",
            language=info.language,
            duration=info.duration
        )

        def segment_generator():
            count = 0
            chars = 0
            try:
                for s in segments_raw:
                    count += 1
                    chars += len(s.text)
                    yield s
            finally:
                logger.info("transcribe_stream_finished", segment_count=count, total_chars=chars)
                if info.duration > 0 and count == 0:
                    logger.warning("transcribe_stream_vad_filtered_all", duration=info.duration)
                if os.path.exists(wav_path):
                    try:
                        os.remove(wav_path)
                    except OSError:
                        pass

        return segment_generator(), info
