"""Service configuration from environment variables (and secret files)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_service_urls(raw: str | None) -> dict[str, str]:
    """Parse ``Orders=http://orders:3002,Vehicles=http://fleet:3004``."""
    urls: dict[str, str] = {}
    if not raw:
        return urls
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            raise ValueError(f"LODESTAR_SERVICE_URLS entry '{part}' must look like EntitySet=url")
        name, url = part.split("=", 1)
        urls[name.strip()] = url.strip().rstrip("/")
    return urls


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore", case_sensitive=False)

    # Model
    agent_model: str = Field(default="mock", alias="AGENT_MODEL")
    azure_openai_endpoint: str | None = Field(default=None, alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_key: SecretStr | None = Field(default=None, alias="AZURE_OPENAI_API_KEY")
    azure_openai_deployment: str | None = Field(default=None, alias="AZURE_OPENAI_DEPLOYMENT")
    azure_openai_api_version: str | None = Field(default=None, alias="AZURE_OPENAI_API_VERSION")
    # one LLM call (phrasing an explanation or answer); on timeout the deterministic text is used
    azure_openai_timeout_s: float = Field(default=20.0, alias="AZURE_OPENAI_TIMEOUT_S")

    # LLM router (AGENT_MODEL=gemini): Gemini -> Groq -> deterministic template. Keys only from the environment.
    gemini_api_key: SecretStr | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash-lite", alias="GEMINI_MODEL")
    gemini_timeout_s: float = Field(default=20.0, alias="GEMINI_TIMEOUT_SECONDS")
    gemini_max_output_tokens: int = Field(default=512, alias="GEMINI_MAX_OUTPUT_TOKENS")
    groq_api_key: SecretStr | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.1-8b-instant", alias="GROQ_MODEL")
    groq_timeout_s: float = Field(default=20.0, alias="GROQ_TIMEOUT_SECONDS")
    groq_max_output_tokens: int = Field(default=512, alias="GROQ_MAX_OUTPUT_TOKENS")
    llm_primary_provider: str = Field(default="gemini", alias="LLM_PRIMARY_PROVIDER")
    llm_fallback_provider: str = Field(default="groq", alias="LLM_FALLBACK_PROVIDER")
    llm_max_retries: int = Field(default=1, ge=0, le=3, alias="LLM_MAX_RETRIES")
    llm_enable_fallback: bool = Field(default=True, alias="LLM_ENABLE_FALLBACK")
    llm_temperature: float = Field(default=0.0, ge=0, le=1, alias="LLM_TEMPERATURE")
    llm_enable_cache: bool = Field(default=True, alias="LLM_ENABLE_CACHE")
    llm_log_prompts: bool = Field(default=False, alias="LLM_LOG_PROMPTS")
    llm_log_responses: bool = Field(default=False, alias="LLM_LOG_RESPONSES")

    # Persistence
    database_url: SecretStr | None = Field(default=None, alias="DATABASE_URL")
    checkpoint_schema: str = Field(default="agent", alias="AGENT_DB_SCHEMA")

    # Identity (inbound verification)
    oidc_issuer: str = Field(default="http://identity:8080/realms/lodestar", alias="OIDC_ISSUER")
    oidc_jwks_url: str | None = Field(default=None, alias="OIDC_JWKS_URL")
    oidc_audience: str = Field(default="lodestar-api", alias="OIDC_AUDIENCE")
    jwt_leeway_s: int = Field(default=30, alias="JWT_LEEWAY_S")

    # Identity (outbound, client credentials)
    oidc_token_url: str | None = Field(default=None, alias="OIDC_TOKEN_URL")
    oidc_client_id: str = Field(default="svc-agent", alias="OIDC_CLIENT_ID")
    oidc_client_secret: SecretStr | None = Field(default=None, alias="OIDC_CLIENT_SECRET")
    oidc_client_secret_file: str | None = Field(default=None, alias="OIDC_CLIENT_SECRET_FILE")
    oidc_scope: str | None = Field(default=None, alias="OIDC_SCOPE")

    # OData API
    lodestar_api_url: str = Field(default="http://gateway:8443", alias="LODESTAR_API_URL")
    lodestar_service_urls_raw: str | None = Field(default=None, alias="LODESTAR_SERVICE_URLS")
    odata_ca_bundle: str | None = Field(default=None, alias="ODATA_CA_BUNDLE")
    http_timeout_s: float = Field(default=10.0, alias="HTTP_TIMEOUT_S")
    odata_max_pages: int = Field(default=50, alias="ODATA_MAX_PAGES")

    # Planning
    # allocation: "exact" (the Datathon MILP, kept when rule-clean and at least as good as greedy) or "greedy"
    allocator: str = Field(default="exact", alias="AGENT_ALLOCATOR")
    allocation_time_limit_s: float = Field(default=30.0, ge=1.0, le=100.0, alias="AGENT_ALLOCATION_TIME_LIMIT_S")
    # bounded repair loop (validate -> redraft); AGENT_MAX_REDRAFTS is the older name
    max_redrafts: int = Field(default=2, ge=0, le=5, validation_alias=AliasChoices("AGENT_MAX_REPAIR_ATTEMPTS", "AGENT_MAX_REDRAFTS"))
    first_departure: str = Field(default="03:30", alias="AGENT_FIRST_DEPARTURE")

    # ML service (Task 1 stop model): empty = disabled, the drafts keep the heuristic service time / ETA / late risk
    ml_url: str = Field(default="", alias="ML_URL")
    ml_timeout_s: float = Field(default=8.0, alias="ML_TIMEOUT_S")

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @field_validator("agent_model", "llm_primary_provider", "llm_fallback_provider")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()

    @property
    def jwks_url(self) -> str:
        return self.oidc_jwks_url or f"{self.oidc_issuer.rstrip('/')}/protocol/openid-connect/certs"

    @property
    def token_url(self) -> str:
        return self.oidc_token_url or f"{self.oidc_issuer.rstrip('/')}/protocol/openid-connect/token"

    @property
    def service_urls(self) -> dict[str, str]:
        return _parse_service_urls(self.lodestar_service_urls_raw)

    def client_secret(self) -> str | None:
        if self.oidc_client_secret is not None:
            return self.oidc_client_secret.get_secret_value()
        if self.oidc_client_secret_file:
            return Path(self.oidc_client_secret_file).read_text(encoding="utf-8").strip()
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
