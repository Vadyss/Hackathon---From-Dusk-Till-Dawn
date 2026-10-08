"""Independent examiner: only an attack description and a format enter it."""
from __future__ import annotations

from gatekeeper.types import ParseFailure
from orchestrator.llm import LlmClient, LlmError, extract_json, prompt_for, untrusted


class Examiner:
    def __init__(self, client: LlmClient):
        self.client = client
        self.system = prompt_for("examiner")

    async def generate(self, attack_description: str, log_format: str) -> dict | ParseFailure:
        if (not isinstance(attack_description, str) or not attack_description.strip()
                or len(attack_description) > 300 or not isinstance(log_format, str)
                or not log_format.strip() or len(log_format) > 4000):
            return ParseFailure("Neplatný popis útoku nebo formátu logu.")
        user = untrusted("attack_description", attack_description) + "\n" + untrusted("log_format", log_format)
        for attempt in range(2):
            repair = "\nReturn only valid JSON matching {\"code\":\"Python source\"}, with no additional text." if attempt else ""
            try:
                response = await self.client.chat("examiner", self.system, user + repair, context=None)
            except LlmError:
                return ParseFailure("Zkoušeči se nepodařilo připravit generátor dat.")
            result = response if isinstance(response, ParseFailure) else extract_json(response.text)
            if isinstance(result, dict):
                code = result.get("code")
                try:
                    valid = isinstance(code, str) and code.strip() and len(code.encode("utf-8")) <= 20000
                except UnicodeError:
                    valid = False
                if valid:
                    # The caller owns AST checks and the isolated execution. No
                    # generator module is imported or evaluated in this process.
                    return {"code": code}
        return ParseFailure("Zkoušeč nevrátil platný generátor dat.")
