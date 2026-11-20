"""Ingesta de información pública complementaria (récord del equipo) con caché y manejo de errores.

- Usa solo la librería estándar (urllib) con tiempo de espera corto.
- Guarda en memoria el resultado y la fecha de consulta (TTL de 30 minutos).
- Si la fuente falla, la plataforma sigue funcionando con el archivo local.
- Se desactiva con EXTERNAL_SOURCES=0 (por ejemplo, si el servidor no tiene salida a internet).
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from datetime import datetime, timezone

TTL = 30 * 60
TIEMPO_ESPERA = 4
FUENTES = {
    "MIN": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/min",
    "SF": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/sf",
}
_CACHE: dict[str, dict] = {}


def _consultar(equipo: str) -> dict:
    url = FUENTES[equipo]
    req = urllib.request.Request(url, headers={"User-Agent": "GridironMX-demo/1.0"})
    with urllib.request.urlopen(req, timeout=TIEMPO_ESPERA) as r:  # noqa: S310 (URL fija y conocida)
        datos = json.loads(r.read().decode("utf-8"))
    equipo_json = datos.get("team", {})
    items = equipo_json.get("record", {}).get("items", [])
    record = next((i.get("summary") for i in items if i.get("type") == "total"), items[0].get("summary") if items else None)
    return {"record": record, "nombre": equipo_json.get("displayName"), "posicion": equipo_json.get("standingSummary")}


def obtener(forzar: bool = False) -> dict:
    """Devuelve {equipo: {ok, datos|error, fuente, consultado_en}}."""
    if os.environ.get("EXTERNAL_SOURCES", "1") == "0":
        return {eq: {"ok": False, "error": "Fuentes externas desactivadas (EXTERNAL_SOURCES=0).", "fuente": "ESPN"} for eq in FUENTES}
    salida = {}
    for eq in FUENTES:
        c = _CACHE.get(eq)
        if c and not forzar and time.time() - c["_t"] < TTL:
            salida[eq] = {k: v for k, v in c.items() if k != "_t"}
            continue
        ahora = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            res = {"ok": True, "datos": _consultar(eq), "fuente": "ESPN (site.api.espn.com)", "consultado_en": ahora}
        except Exception as e:  # red caída, formato distinto, tiempo agotado...
            previo = c if c and c.get("ok") else None
            res = {"ok": bool(previo), "datos": previo.get("datos") if previo else None,
                   "error": f"No se pudo consultar la fuente: {type(e).__name__}. Se usa el archivo local.",
                   "fuente": "ESPN (site.api.espn.com)", "consultado_en": previo["consultado_en"] if previo else ahora}
        _CACHE[eq] = {**res, "_t": time.time()}
        salida[eq] = res
    return salida
