from pydantic_settings import BaseSettings
from pydantic import model_validator


class Settings(BaseSettings):
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    TOKEN_TTL_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "./uploads"
    DATABASE_URL: str = "sqlite:///./cat_community.db"
    ADMIN_PASSWORD: str
    DEMO_PASSWORD: str = ""
    INIT_DEMO_USER: bool = False

    RATE_RECOGNIZE_PER_MIN: int = 10
    RATE_POST_PER_MIN: int = 5
    RATE_SIGHTING_PER_MIN: int = 20
    RATE_REGISTER_PER_MIN: int = 10
    RATE_LOGIN_PER_MIN: int = 5
    RATE_AGENT_PER_MIN: int = 20

    AGENT_ENABLED: bool = False
    AGENT_BASE_URL: str = "https://api.openai.com/v1"
    AGENT_API_KEY: str = ""
    AGENT_MODEL: str = ""
    AGENT_TIMEOUT_SECONDS: int = 25
    AGENT_MAX_TOOL_CALLS: int = 3

    # Tuned for the DINOv3 finetuned extractor (cosine on L2-normalized
    # embeddings). Matches Campus-Cat-ReID's validated thresholds.
    RECOGNIZE_THRESHOLD_CONFIRMED: float = 0.57
    RECOGNIZE_THRESHOLD_UNCERTAIN: float = 0.49

    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.RECOGNIZE_THRESHOLD_UNCERTAIN >= self.RECOGNIZE_THRESHOLD_CONFIRMED:
            raise ValueError("RECOGNIZE_THRESHOLD_UNCERTAIN must be less than RECOGNIZE_THRESHOLD_CONFIRMED")
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
