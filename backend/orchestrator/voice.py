"""Optional ElevenLabs speech; failure never changes the detection run."""
from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote

import httpx

from orchestrator.config import Settings
from orchestrator.events import EventEmitter
from orchestrator.run_store import RunState
from orchestrator.text import clip

LOGGER = logging.getLogger(__name__)
MAX_AUDIO_BYTES = 5_000_000
TIMEOUT_S = 30


class VoiceService:
    def __init__(self, settings: Settings, emitter: EventEmitter, *,
                 transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.settings = settings
        self.emitter = emitter
        self.client = httpx.AsyncClient(base_url="https://api.elevenlabs.io", timeout=TIMEOUT_S,
                                        transport=transport, trust_env=False, follow_redirects=False)

    @property
    def enabled(self) -> bool:
        return bool(self.settings.elevenlabs_api_key.strip() and self.settings.elevenlabs_voice_id.strip())

    async def speak(self, run: RunState, text: str) -> None:
        if not self.enabled:
            return
        try:
            async with asyncio.timeout(TIMEOUT_S):
                voice_id = quote(self.settings.elevenlabs_voice_id, safe="")
                async with self.client.stream(
                    "POST", f"/v1/text-to-speech/{voice_id}",
                    params={"output_format": "mp3_44100_128"},
                    headers={"xi-api-key": self.settings.elevenlabs_api_key,
                             "Content-Type": "application/json", "Accept": "audio/mpeg"},
                    json={"text": clip(text, 1000), "model_id": self.settings.elevenlabs_model_id},
                ) as answer:
                    answer.raise_for_status()
                    audio = bytearray()
                    async for chunk in answer.aiter_bytes():
                        if len(audio) + len(chunk) > MAX_AUDIO_BYTES:
                            raise ValueError("Hlasové shrnutí překračuje limit 5 MB.")
                        audio.extend(chunk)
                if not audio:
                    raise ValueError("Prázdné hlasové shrnutí.")
                async with run.lock:
                    run.audio = bytes(audio)
                await self.emitter.emit(run, "voice_ready", "approval",
                                        {"audio_url": f"/api/runs/{run.run_id}/audio"})
        except Exception as exc:
            # Remote bodies and exception messages can include secrets. Log
            # only the exception class, never headers, response text or repr.
            LOGGER.warning("Hlasové shrnutí není dostupné (%s).", type(exc).__name__)

    async def close(self) -> None:
        await self.client.aclose()
