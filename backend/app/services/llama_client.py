import logging
from typing import Optional, Any, Dict

from openai import OpenAI
from openai import OpenAIError

from app.core.config import settings

logger = logging.getLogger(__name__)


class LlamaResponse:
    """Lightweight response wrapper to match the helper interface."""

    def __init__(self, text: str, raw_response: Any):
        self.text = text
        self.raw_response = raw_response


def _normalize_prompt(prompt: str, system_prompt: Optional[str]) -> list:
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt.strip()})
    
    base_prompt = prompt.strip()
    messages.append({"role": "user", "content": base_prompt})
    return messages


class LlamaModel:
    """Simple wrapper that provides a generate_content method for Llama models."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        top_p: float = 0.95,
        **kwargs
    ) -> None:
        self.model_name = model_name or settings.LLAMA_MODEL
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        
        api_key = settings.LLAMA_API_KEY
        base_url = settings.LLAMA_BASE_URL
        
        # If running locally (like Ollama), an empty API key is usually fine,
        # but the openai client requires some string.
        if not api_key or api_key == "your-api-key-here":
            api_key = "local-key"
            
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def generate_content(self, prompt: str, system_prompt: Optional[str] = None) -> LlamaResponse:
        if not prompt or not prompt.strip():
            raise ValueError("Prompt must not be empty")

        messages = _normalize_prompt(prompt, system_prompt)

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                top_p=self.top_p,
            )
        except OpenAIError as exc:
            logger.error("Llama API call failed: %s", exc, exc_info=True)
            raise RuntimeError(f"Llama API error: {exc}") from exc
        except Exception as exc:
            logger.error("Unexpected error during Llama API call: %s", exc, exc_info=True)
            raise

        text = response.choices[0].message.content.strip() if response.choices else ""
        if not text:
            raise RuntimeError("Empty response from Llama API")

        return LlamaResponse(text=text, raw_response=response)
