"""Cargador y validador del archivo de datos de /data.

Flujo:
  1. Detecta los archivos disponibles (o usa DATA_FILE_PATH si está definida).
  2. Lee CSV / JSON (Excel solo si pandas tiene motor disponible).
  3. Reconoce cada archivo por sus columnas y lo mapea al modelo interno.
  4. Valida columnas obligatorias y tipos; normaliza equipos, posiciones y nombres.
  5. Genera un reporte de calidad visible para el admin.
Si no hay datos utilizables, genera un dataset de DEMOSTRACIÓN claramente etiquetado.

El modelo interno usa las tablas:
  partidos      gameId, week, homeTeamAbbr, visitorTeamAbbr, gameDate
  jugadas       gameId, playId, week, possessionTeam, defensiveTeam, down, yardsToGo,
                playResult, passResult, playDescription, yardlineSide, yardlineNumber, ...
  jugadores     nflId, displayName, officialPosition
  participacion gameId, playId, nflId, pff_role, pff_positionLinedUp, pff_sack, ...
  estadisticas_jugador (opcional) nombre, equipo, posicion, yardas_tierra, fg_hechos, ...
  formacion     (opcional) nombre, equipo, unidad, x, y
"""
from __future__ import annotations

import io
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
CARPETA_DATOS = RAIZ / "data"
EXTENSIONES = {".csv", ".json", ".xlsx", ".xls"}

# --- Normalización de equipos -------------------------------------------------
ALIAS_EQUIPOS = {
    "MIN": ["min", "minnesota", "minnesota vikings", "vikings", "vikes"],
    "SF": ["sf", "sfo", "san francisco", "san francisco 49ers", "49ers", "niners", "sf 49ers"],
}
_MAPA_EQUIPOS = {a: k for k, v in ALIAS_EQUIPOS.items() for a in v}


def normalizar_equipo(valor) -> str | float:
    """Convierte nombres/abreviaturas de equipo a su código de 2-3 letras."""
    if pd.isna(valor):
        return np.nan
    s = str(valor).strip()
    return _MAPA_EQUIPOS.get(s.lower(), s.upper())


# --- Áreas por posición -------------------------------------------------------
AREA_POR_POSICION = {
    "QB": "ofensiva", "RB": "ofensiva", "HB": "ofensiva", "FB": "ofensiva", "WR": "ofensiva",
    "TE": "ofensiva", "T": "ofensiva", "G": "ofensiva", "C": "ofensiva", "OT": "ofensiva",
    "OG": "ofensiva", "OL": "ofensiva",
    "DE": "defensiva", "DT": "defensiva", "NT": "defensiva", "DL": "defensiva", "OLB": "defensiva",
    "ILB": "defensiva", "MLB": "defensiva", "LB": "defensiva", "CB": "defensiva", "DB": "defensiva",
    "FS": "defensiva", "SS": "defensiva", "S": "defensiva",
    "K": "equipos especiales", "P": "equipos especiales", "LS": "equipos especiales",
}
ALIAS_POSICION = {"HB": "RB", "OT": "T", "OG": "G", "SAF": "S", "EDGE": "DE"}


def normalizar_posicion(valor) -> str | float:
    if pd.isna(valor):
        return np.nan
    p = str(valor).strip().upper()
    return ALIAS_POSICION.get(p, p)


# --- Esquemas reconocidos -----------------------------------------------------
# Cada tabla: columnas obligatorias, columnas numéricas y alias (español/otros) -> nombre interno.
ESQUEMAS = {
    "partidos": {
        "obligatorias": ["gameId", "homeTeamAbbr", "visitorTeamAbbr"],
        "numericas": ["gameId", "week", "season"],
        "alias": {"partido_id": "gameId", "id_partido": "gameId", "semana": "week", "local": "homeTeamAbbr",
                  "visitante": "visitorTeamAbbr", "fecha": "gameDate", "temporada": "season",
                  "marcador_local": "homeScore", "marcador_visitante": "visitorScore"},
    },
    "jugadas": {
        "obligatorias": ["gameId", "playId", "possessionTeam", "down", "yardsToGo", "playResult"],
        "numericas": ["gameId", "playId", "quarter", "down", "yardsToGo", "yardlineNumber", "playResult",
                      "prePenaltyPlayResult", "penaltyYards", "absoluteYardlineNumber", "defendersInBox"],
        "alias": {"partido_id": "gameId", "jugada_id": "playId", "equipo": "possessionTeam",
                  "equipo_ofensivo": "possessionTeam", "equipo_defensivo": "defensiveTeam", "distancia": "yardsToGo",
                  "yardas_ganadas": "playResult", "resultado": "passResult", "descripcion": "playDescription",
                  "cuarto": "quarter", "formacion": "offenseFormation", "semana": "week", "tipo_jugada": "playType",
                  "zona_campo": "fieldZone"},
    },
    "jugadores": {
        "obligatorias": ["nflId", "displayName"],
        "numericas": ["nflId", "weight"],
        "alias": {"id": "nflId", "jugador_id": "nflId", "nombre": "displayName", "posicion": "officialPosition",
                  "position": "officialPosition", "equipo": "team", "numero": "jerseyNumber", "estatus": "status"},
    },
    "participacion": {
        "obligatorias": ["gameId", "playId", "nflId", "pff_role"],
        "numericas": ["gameId", "playId", "nflId", "pff_hit", "pff_hurry", "pff_sack", "pff_hitAllowed",
                      "pff_hurryAllowed", "pff_sackAllowed", "pff_beatenByDefender"],
        "alias": {},
    },
    "estadisticas_jugador": {
        "obligatorias": ["nombre", "equipo", "posicion"],
        "numericas": ["yardas_pase", "yardas_tierra", "acarreos", "yardas_recepcion", "recepciones", "td",
                      "intercepciones", "capturas", "tackleos", "pases_defendidos", "fg_hechos", "fg_intentos",
                      "yardas_despeje", "despejes", "numero"],
        "alias": {"name": "nombre", "player": "nombre", "team": "equipo", "position": "posicion",
                  "rushing_yards": "yardas_tierra", "carries": "acarreos", "tackles": "tackleos",
                  "field_goals_made": "fg_hechos", "field_goals_att": "fg_intentos", "punt_yards": "yardas_despeje",
                  "punts": "despejes"},
    },
    "formacion": {
        "obligatorias": ["nombre", "equipo", "unidad", "x", "y"],
        "numericas": ["x", "y"],
        "alias": {"jugador": "nombre", "team": "equipo", "unit": "unidad"},
    },
}

# Orden de detección: la tabla más específica primero.
ORDEN_DETECCION = ["participacion", "jugadas", "partidos", "formacion", "estadisticas_jugador", "jugadores"]


@dataclass
class Dataset:
    tablas: dict[str, pd.DataFrame] = field(default_factory=dict)
    reporte: dict = field(default_factory=dict)
    es_demo: bool = False
    cargado_en: str = ""

    def tiene(self, *nombres: str) -> bool:
        return all(n in self.tablas and not self.tablas[n].empty for n in nombres)


def _aplicar_alias(df: pd.DataFrame, tabla: str) -> pd.DataFrame:
    """Renombra columnas en español/otros idiomas al nombre interno de `tabla` (sin distinguir mayúsculas)."""
    ren = {}
    for alias, interno in ESQUEMAS[tabla]["alias"].items():
        for col in df.columns:
            if col.strip().lower() == alias and interno not in df.columns and interno not in ren.values():
                ren[col] = interno
    return df.rename(columns=ren)


def _identificar(df: pd.DataFrame, sugerido: str, nombre_archivo: str) -> tuple[str | None, pd.DataFrame]:
    """Decide a qué tabla interna corresponde el DataFrame y le aplica los alias de esa tabla."""
    if nombre_archivo.lower().startswith("tracking"):
        return "tracking", df
    candidatos = ([sugerido] if sugerido in ESQUEMAS else []) + ORDEN_DETECCION
    for t in candidatos:
        d = _aplicar_alias(df, t)
        if set(ESQUEMAS[t]["obligatorias"]) <= set(d.columns):
            return t, d
    return None, df

def _leer_archivo(ruta: Path, contenido: bytes | None = None) -> list[tuple[str, pd.DataFrame]]:
    """Lee un archivo y devuelve [(nombre_tabla_sugerida, df)]. Un JSON puede traer varias tablas."""
    ext = ruta.suffix.lower()
    fuente = io.BytesIO(contenido) if contenido is not None else ruta
    if ext == ".csv":
        return [(ruta.stem, pd.read_csv(fuente, low_memory=False))]
    if ext == ".json":
        datos = json.loads(contenido.decode("utf-8-sig") if contenido is not None else ruta.read_text("utf-8-sig"))
        if isinstance(datos, list):
            return [(ruta.stem, pd.DataFrame(datos))]
        if isinstance(datos, dict):
            return [(k, pd.DataFrame(v)) for k, v in datos.items() if isinstance(v, list)]
        raise ValueError("El JSON debe ser una lista de registros o un objeto {tabla: [registros]}")
    if ext in (".xlsx", ".xls"):
        try:
            hojas = pd.read_excel(fuente, sheet_name=None)
        except ImportError as e:  # openpyxl no forma parte del stack
            raise ValueError("Excel no soportado en este entorno (falta el motor openpyxl). Exporta el archivo a CSV.") from e
        return list(hojas.items())
    raise ValueError(f"Extensión no soportada: {ext}")


def detectar_archivos() -> list[Path]:
    """Usa DATA_FILE_PATH si existe; si no, busca en /data todos los archivos soportados."""
    env = os.environ.get("DATA_FILE_PATH", "").strip()
    if env:
        p = Path(env)
        p = p if p.is_absolute() else RAIZ / p
        if p.is_file():
            return [p]
        if p.is_dir():
            return sorted(f for f in p.rglob("*") if f.suffix.lower() in EXTENSIONES)
        return []
    if not CARPETA_DATOS.exists():
        return []
    return sorted(f for f in CARPETA_DATOS.rglob("*") if f.suffix.lower() in EXTENSIONES and f.is_file())


def _validar(nombre: str, df: pd.DataFrame, archivo: str) -> tuple[pd.DataFrame, dict]:
    """Valida tipos, cuenta errores y normaliza valores. Devuelve (df, reporte_tabla)."""
    esquema = ESQUEMAS[nombre]
    conocidas = set(esquema["obligatorias"]) | set(esquema["numericas"]) | set(esquema["alias"].values())
    errores = []
    for col in esquema["numericas"]:
        if col in df.columns:
            convertido = pd.to_numeric(df[col].replace("NA", np.nan), errors="coerce")
            malos = int((convertido.isna() & df[col].notna() & (df[col].astype(str) != "NA")).sum())
            if malos:
                errores.append(f"{col}: {malos} valores no numéricos (se ignoran)")
            df[col] = convertido
    for col in ("possessionTeam", "defensiveTeam", "homeTeamAbbr", "visitorTeamAbbr", "yardlineSide", "equipo", "team"):
        if col in df.columns:
            df[col] = df[col].map(normalizar_equipo)
    for col in ("officialPosition", "posicion"):
        if col in df.columns:
            df[col] = df[col].map(normalizar_posicion)
    for col in ("displayName", "nombre"):
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    faltan = [c for c in esquema["obligatorias"] if c not in df.columns]
    reporte = {
        "archivo": archivo, "tabla": nombre, "filas": int(len(df)), "columnas": int(df.shape[1]),
        "errores": errores, "columnas_faltantes": faltan,
        "columnas_no_reconocidas": sorted(c for c in df.columns if c not in conocidas)[:25],
    }
    return df, reporte


def cargar(archivos_extra: list[tuple[str, bytes]] | None = None) -> Dataset:
    """Carga todo lo disponible. `archivos_extra` permite subir un archivo desde el panel admin (solo memoria)."""
    ds = Dataset(cargado_en=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    detalle, avisos = [], []
    entradas: list[tuple[Path, bytes | None]] = [(p, None) for p in detectar_archivos()]
    if archivos_extra:
        entradas = [(Path(n), c) for n, c in archivos_extra]  # un archivo subido reemplaza al local
    if os.environ.get("DATA_FILE_PATH") and not entradas:
        avisos.append(f"DATA_FILE_PATH={os.environ['DATA_FILE_PATH']} no existe.")

    for ruta, contenido in entradas:
        rel = ruta.name if contenido is not None else str(ruta.relative_to(RAIZ)).replace("\\", "/")
        if ruta.name.lower().startswith("tracking"):
            detalle.append({"archivo": rel, "tabla": "tracking", "filas": None, "errores": [],
                            "columnas_faltantes": [], "columnas_no_reconocidas": [],
                            "nota": "Tracking opcional: no se carga para mantener el arranque rápido."})
            continue
        try:
            partes = _leer_archivo(ruta, contenido)
        except Exception as e:  # archivo dañado o formato no soportado
            detalle.append({"archivo": rel, "tabla": None, "filas": 0, "errores": [f"No se pudo leer: {e}"],
                            "columnas_faltantes": [], "columnas_no_reconocidas": []})
            continue
        for sugerido, df in partes:
            tabla, df = _identificar(df, sugerido, ruta.name)
            if tabla is None or tabla == "tracking":
                detalle.append({"archivo": rel, "tabla": None, "filas": int(len(df)), "errores": [],
                                "columnas_faltantes": [], "nota": "Estructura no reconocida; se ignora.",
                                "columnas_no_reconocidas": list(df.columns)[:25]})
                continue
            df, rep = _validar(tabla, df, rel)
            detalle.append(rep)
            ds.tablas[tabla] = pd.concat([ds.tablas[tabla], df], ignore_index=True) if tabla in ds.tablas else df

    _completar_jugadas(ds)
    requeridas = ("jugadas",)
    if not ds.tiene(*requeridas):
        avisos.append("No se encontró un archivo de jugadas válido en /data. Se usan datos de DEMOSTRACIÓN.")
        demo = generar_demo()
        demo.reporte = {"archivos": detalle, "avisos": avisos}
        _resumir_reporte(demo)
        return demo

    ds.reporte = {"archivos": detalle, "avisos": avisos}
    _resumir_reporte(ds)
    return ds


def _completar_jugadas(ds: Dataset) -> None:
    """Agrega semana y equipo defensivo a las jugadas cuando se pueden deducir de los partidos."""
    if not ds.tiene("jugadas"):
        return
    j = ds.tablas["jugadas"]
    if ds.tiene("partidos"):
        p = ds.tablas["partidos"][[c for c in ("gameId", "week", "homeTeamAbbr", "visitorTeamAbbr") if c in ds.tablas["partidos"]]]
        j = j.drop(columns=[c for c in ("week",) if c in j.columns and "week" in p.columns]).merge(p, on="gameId", how="left")
        if "defensiveTeam" not in j.columns:
            j["defensiveTeam"] = np.where(j["possessionTeam"] == j["homeTeamAbbr"], j["visitorTeamAbbr"], j["homeTeamAbbr"])
    for col in ("playDescription", "passResult", "yardlineSide", "offenseFormation"):
        if col not in j.columns:
            j[col] = np.nan
    if "prePenaltyPlayResult" not in j.columns:
        j["prePenaltyPlayResult"] = j["playResult"]
    ds.tablas["jugadas"] = j


def _resumir_reporte(ds: Dataset) -> None:
    arch = ds.reporte.get("archivos", [])
    ds.reporte.update({
        "es_demo": ds.es_demo,
        "cargado_en": ds.cargado_en,
        "filas_totales": int(sum(a.get("filas") or 0 for a in arch)),
        "errores_totales": int(sum(len(a.get("errores", [])) for a in arch)),
        "tablas": {k: int(len(v)) for k, v in ds.tablas.items()},
        "modulos": disponibilidad_modulos(ds),
    })


def disponibilidad_modulos(ds: Dataset) -> dict:
    """Indica qué módulos del análisis tienen datos reales y cuáles usan demostración."""
    stats = ds.tablas.get("estadisticas_jugador", pd.DataFrame())
    tiene_stats = lambda *c: not stats.empty and all(x in stats.columns for x in c)
    return {
        "resumen": "archivo" if ds.tiene("jugadas") else "demo",
        "jugadas": "archivo" if ds.tiene("jugadas") else "demo",
        "yardas": "archivo" if ds.tiene("jugadas") else "demo",
        "jugadores_pase": "archivo" if ds.tiene("jugadas", "participacion", "jugadores") else "demo",
        "jugadores_carrera": "archivo" if tiene_stats("yardas_tierra") else "demo",
        "equipos_especiales": "archivo" if tiene_stats("fg_hechos") else "demo",
        "formacion": "archivo" if ds.tiene("formacion") else ("plantilla" if ds.tiene("participacion") else "demo"),
    }


# --- Dataset de demostración -------------------------------------------------
def generar_demo() -> Dataset:
    """Genera jugadas sintéticas MIN/SF para que la plataforma funcione sin archivo. Etiquetado como demo."""
    rng = np.random.default_rng(2026)
    filas, partidos = [], []
    rivales = ["DET", "GB", "CHI", "SEA", "ARI", "LAR", "DAL"]
    gid = 2026000000
    for semana in range(1, 8):
        for equipo, media in (("MIN", 6.1), ("SF", 7.0)):
            gid += 1
            rival = rivales[(semana + (equipo == "SF")) % len(rivales)]
            partidos.append({"gameId": gid, "week": semana, "homeTeamAbbr": equipo, "visitorTeamAbbr": rival})
            for k in range(70):
                ofe = equipo if k % 2 == 0 else rival
                down = int(rng.integers(1, 5))
                ytg = int(rng.integers(1, 15))
                res = int(round(rng.normal(media if ofe == equipo else 5.8, 9)))
                pr = rng.choice(["C", "I", "S", "IN", "R"], p=[.62, .28, .06, .02, .02])
                prof, lado = rng.choice(["short", "deep"], p=[.8, .2]), rng.choice(["left", "middle", "right"])
                filas.append({"gameId": gid, "playId": k, "week": semana, "quarter": 1 + k // 18,
                              "possessionTeam": ofe, "defensiveTeam": rival if ofe == equipo else equipo,
                              "down": down, "yardsToGo": ytg, "playResult": res if pr in "CR" else (0 if pr != "S" else -7),
                              "prePenaltyPlayResult": res, "passResult": pr, "yardlineSide": ofe,
                              "yardlineNumber": int(rng.integers(1, 50)), "offenseFormation": rng.choice(["SHOTGUN", "SINGLEBACK", "I_FORM", "EMPTY"]),
                              "playDescription": f"(DEMO) pass {prof} {lado} for {res} yards" + (" TOUCHDOWN" if rng.random() < .04 else "")})
    ds = Dataset(tablas={"jugadas": pd.DataFrame(filas), "partidos": pd.DataFrame(partidos)}, es_demo=True,
                 cargado_en=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    return ds


# Estado global del dataset (se recarga al subir un archivo desde el panel admin)
_DATASET: Dataset | None = None


def obtener() -> Dataset:
    global _DATASET
    if _DATASET is None:
        _DATASET = cargar()
    return _DATASET


def reemplazar(nombre: str, contenido: bytes) -> Dataset:
    """Carga un archivo subido por el admin. Vive solo en memoria (el servidor es efímero)."""
    global _DATASET
    if Path(nombre).suffix.lower() not in EXTENSIONES:
        raise ValueError("Formato no soportado. Usa CSV, JSON o Excel.")
    if not re.fullmatch(r"[\w.\- ]{1,120}", nombre):
        raise ValueError("Nombre de archivo no válido.")
    _DATASET = cargar([(nombre, contenido)])
    return _DATASET


def recargar() -> Dataset:
    global _DATASET
    _DATASET = cargar()
    return _DATASET
