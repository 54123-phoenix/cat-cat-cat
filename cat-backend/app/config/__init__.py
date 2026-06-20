import os


class Settings:
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    ALGORITHM: str = "HS256"
    TOKEN_TTL_MINUTES: int = 60 * 24 * 7
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./cat_community.db")
    ADMIN_PASSWORD: str = os.environ["ADMIN_PASSWORD"]
    DEMO_PASSWORD: str = os.getenv("DEMO_PASSWORD", "")
    INIT_DEMO_USER: bool = os.getenv("INIT_DEMO_USER") == "1"

    RATE_RECOGNIZE_PER_MIN: int = int(os.getenv("RATE_RECOGNIZE_PER_MIN", "10"))
    RATE_POST_PER_MIN: int = int(os.getenv("RATE_POST_PER_MIN", "5"))
    RATE_SIGHTING_PER_MIN: int = int(os.getenv("RATE_SIGHTING_PER_MIN", "20"))
    RATE_REGISTER_PER_MIN: int = int(os.getenv("RATE_REGISTER_PER_MIN", "10"))
    RATE_LOGIN_PER_MIN: int = int(os.getenv("RATE_LOGIN_PER_MIN", "5"))

    RECOGNIZE_THRESHOLD_CONFIRMED: float = float(os.getenv("RECOGNIZE_THRESHOLD_CONFIRMED", "0.45"))
    RECOGNIZE_THRESHOLD_UNCERTAIN: float = float(os.getenv("RECOGNIZE_THRESHOLD_UNCERTAIN", "0.30"))

    WECHAT_APPID: str = os.getenv("WECHAT_APPID", "")
    WECHAT_SECRET: str = os.getenv("WECHAT_SECRET", "")


settings = Settings()
