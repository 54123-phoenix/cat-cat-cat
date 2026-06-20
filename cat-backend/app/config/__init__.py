from pydantic_settings import BaseSettings
from pydantic import model_validator


class Settings(BaseSettings):
    JWT_SECRET: str
    ALGORITHM: str = "HS256"
    TOKEN_TTL_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
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

    RECOGNIZE_THRESHOLD_CONFIRMED: float = 0.45
    RECOGNIZE_THRESHOLD_UNCERTAIN: float = 0.30

    WECHAT_APPID: str = ""
    WECHAT_SECRET: str = ""

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.RECOGNIZE_THRESHOLD_UNCERTAIN >= self.RECOGNIZE_THRESHOLD_CONFIRMED:
            raise ValueError("RECOGNIZE_THRESHOLD_UNCERTAIN must be less than RECOGNIZE_THRESHOLD_CONFIRMED")
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
