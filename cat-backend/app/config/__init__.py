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
    RATE_RECOGNIZE_PER_MIN: int = 10
    RATE_POST_PER_MIN: int = 5
    RATE_SIGHTING_PER_MIN: int = 20


settings = Settings()
