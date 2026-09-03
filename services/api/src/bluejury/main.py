from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from bluejury.api.routes import router
from bluejury.config.settings import get_settings

app = FastAPI(title="BLUEJURY AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().web_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
