"""API de GRIDIRON MX // CDMX 2026 (Vikings vs. 49ers). Ejecuta: .venv/bin/uvicorn backend.main:app --reload

Dos portales independientes:
  /api/auth/usuario/*  + /api/apuestas/*   -> rol `usuario`
  /api/auth/admin/*    + /api/admin/*      -> rol `admin` (con 2FA)
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path


def cargar_env():
    f = Path(__file__).resolve().parent.parent / ".env"
    if f.exists():
        for linea in f.read_text(encoding="utf-8-sig").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env()

from fastapi import FastAPI, Request  # noqa: E402

from .lib import analytics, auth, data_loader  # noqa: E402
from .routes import admin, apuestas, auth_rutas  # noqa: E402


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    """Al arrancar: crea cuentas semilla, carga/valida /data y precalcula el análisis."""
    auth.sembrar_cuentas()
    data_loader.obtener()
    analytics.analisis()
    yield


app = FastAPI(title="GRIDIRON MX // CDMX 2026", lifespan=ciclo_de_vida)


@app.middleware("http")
async def cabeceras_seguridad(request: Request, call_next):
    respuesta = await call_next(request)
    respuesta.headers.setdefault("X-Content-Type-Options", "nosniff")
    respuesta.headers.setdefault("X-Frame-Options", "DENY")
    respuesta.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/api/"):
        respuesta.headers.setdefault("Cache-Control", "no-store")
    return respuesta


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(auth_rutas.usuario)
app.include_router(auth_rutas.admin)
app.include_router(apuestas.router)
app.include_router(admin.router)
