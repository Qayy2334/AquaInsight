from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "mysql+pymysql://water:water@localhost:3306/water_quality?charset=utf8mb4"
    model_dir: str = "/app/artifacts"
    # Real plant records imported automatically when the record store is empty.
    seed_file: str = "/app/seed_data/tumen_groundwater_2026-08_09.docx"
    seed_name: str = "地下水厂 土门"
    # Synthetic data is only for UI development without real records; off by default.
    seed_demo_data: bool = False
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    # Sign-in tokens. Set JWT_SECRET in the environment for any shared deployment.
    jwt_secret: str = "dev-only-change-me"
    token_hours: int = 12

    test_ratio: float = 0.2
    iqr_k: float = 1.5
    iforest_contamination: float = 0.05


settings = Settings()
