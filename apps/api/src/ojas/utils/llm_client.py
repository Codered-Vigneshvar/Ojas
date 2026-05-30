import structlog
import openai
from openai import AsyncOpenAI
from ojas.config import settings

logger = structlog.get_logger(__name__)

_primary_client: AsyncOpenAI | None = None
_groq_client: AsyncOpenAI | None = None

def get_primary_client() -> AsyncOpenAI:
    global _primary_client
    if _primary_client is None:
        if settings.gemini_api_key:
            _primary_client = AsyncOpenAI(
                api_key=settings.gemini_api_key,
                base_url=settings.gemini_base_url,
            )
        else:
            _primary_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _primary_client

def get_groq_client() -> AsyncOpenAI:
    global _groq_client
    if _groq_client is None:
        _groq_client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )
    return _groq_client

async def generate_chat_completion(messages: list[dict], max_tokens: int, response_format: dict | None = None, is_pro: bool = False) -> str:
    primary_client = get_primary_client()
    model = settings.gemini_model_pro if is_pro else settings.gemini_model_flash
    if not settings.gemini_api_key:
        model = settings.openai_model
        
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if response_format:
        kwargs["response_format"] = response_format

    try:
        response = await primary_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or "{}"
    except openai.RateLimitError as e:
        logger.warning(f"Primary LLM rate limit hit, falling back to Groq: {e}")
        if settings.groq_api_key:
            groq_client = get_groq_client()
            kwargs["model"] = settings.groq_model
            response = await groq_client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or "{}"
        else:
            raise e
