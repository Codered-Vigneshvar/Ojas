from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    environment: Literal["dev", "staging", "prod"] = "dev"
    log_level: str = "DEBUG"

    # Database
    database_url: str = Field(default="postgresql+asyncpg://ojas:ojas_dev@localhost:5432/ojas")

    # Redis
    redis_url: str = Field(default="redis://localhost:6379/0")

    # Object storage
    s3_endpoint_url: str = Field(default="http://localhost:9000")
    s3_access_key: str = Field(default="minioadmin")
    s3_secret_key: str = Field(default="minioadmin")
    s3_bucket: str = Field(default="ojas-artifacts")

    # STT
    stt_provider: str = Field(default="local")
    stt_model_size: str = Field(default="small")
    stt_compute_type: str = Field(default="int8")
    stt_device: str = Field(default="cpu")
    stt_cpu_threads: int = Field(default=4)
    whisper_download_dir: str = Field(default="./models/whisper")
    stt_language: str = Field(default="en")
    stt_initial_prompt: str = Field(
        default="Clinical consultation in English with occasional Tamil. Medical terminology, drug names, dosages, lab values."
    )

    # Auth
    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    @property
    def is_dev(self) -> bool:
        return self.environment == "dev"

    @property
    def is_prod(self) -> bool:
        return self.environment == "prod"


settings = Settings()
