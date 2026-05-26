from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=False, extra="ignore"
    )

    database_url: str = Field(
        default="postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas_demo"
    )
    deepgram_api_key: str = Field(default="")
    google_vision_api_key: str = Field(default="")
    openai_api_key: str = Field(default="")
    uploads_dir: str = Field(default="./uploads")
    openai_model: str = Field(default="gpt-4o")


settings = Settings()
