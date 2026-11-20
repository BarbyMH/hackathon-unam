"""Análisis del partido MIN vs SF a partir del dataset cargado.

Todo se calcula en memoria al arrancar (o al subir un archivo) y se guarda en caché.
Cada bloque indica su `fuente`: "archivo" (calculado del dataset), "demo" (datos ilustrativos)
o "plantilla" (ubicaciones estándar de formación).
"""
from __future__ import annotations

import re
from functools import lru_cache

import numpy as np
import pandas as pd

from . import data_loader, mercados

EQUIPOS = {"MIN": {"nombre": "Minnesota Vikings", "corto": "Vikings"},
           "SF": {"nombre": "San Francisco 49ers", "corto": "49ers"}}
FOCO = ("MIN", "SF")
PTS_POR_YARDA = 2.6       # 1 yarda más por jugada de pase ≈ 2.6 puntos por partido
SD_MARGEN, SD_TOTAL = 13.5, 13.0
LOCALIA = 0.6             # localía designada en sede neutral: ventaja pequeña
PUNTOS_BASE = 22.5
LINEA_SPREAD, LINEA_TOTAL = 3.0, 46.5

_ABREV_SUFIJOS = re.compile(r"\s+(Jr\.?|Sr\.?|II|III|IV|V)$")
_PARENTESIS = re.compile(r"\(([^()]*)\)")
_DIRECCION = re.compile(r"\b(short|deep)\s+(left|middle|right)\b")
_PENAL = re.compile(r"PENALTY on ([A-Z]{2,3})-")


def _r(x, n=1):
    """Redondeo seguro (NaN -> None) para JSON."""
    try:
        return None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), n)
    except (TypeError, ValueError):
        return None


def _pct(a, b, n=1):
    return _r(100 * a / b, n) if b else None


def abreviaturas(nombre: str) -> list[str]:
    """'Justin Jefferson' -> ['J.Jefferson']. Las descripciones del play-by-play usan ese formato."""
    nombre = str(nombre).strip()
    partes = nombre.split(" ", 1)
    if len(partes) < 2:
        return [nombre]
    ab = f"{partes[0][0]}.{partes[1]}"
    sin = _ABREV_SUFIJOS.sub("", ab)
    return list(dict.fromkeys([ab, sin]))


# ---------------------------------------------------------------------------
# Preparación
# ---------------------------------------------------------------------------
def _jugadas(ds) -> pd.DataFrame:
    j = ds.tablas["jugadas"].copy()
    j["playDescription"] = j["playDescription"].fillna("").astype(str)
    j["yardas"] = pd.to_numeric(j["prePenaltyPlayResult"], errors="coerce").fillna(0)
    j["td"] = j["playDescription"].str.contains("TOUCHDOWN", case=False) & j["passResult"].isin(["C", "R"])
    dist = j["playDescription"].str.extract(_DIRECCION)
    j["profundidad"], j["lado"] = dist[0], dist[1]
    # Yardas a la zona de anotación (para detectar zona roja)
    if "yardlineNumber" in j and "yardlineSide" in j:
        propio = j["yardlineSide"] == j["possessionTeam"]
        j["a_meta"] = np.where(propio, 100 - j["yardlineNumber"], j["yardlineNumber"])
        j.loc[j["yardlineNumber"] == 50, "a_meta"] = 50
    else:
        j["a_meta"] = np.nan
    return j


def _participantes(ds, j: pd.DataFrame) -> pd.DataFrame:
    """Une participación (PFF) + jugadores + jugadas, solo para los partidos de MIN y SF."""
    if not ds.tiene("participacion", "jugadores"):
        return pd.DataFrame()
    claves = j[(j["possessionTeam"].isin(FOCO)) | (j["defensiveTeam"].isin(FOCO))]
    p = ds.tablas["participacion"].merge(
        claves[["gameId", "playId", "possessionTeam", "defensiveTeam", "passResult", "yardas", "td", "playDescription", "week"]],
        on=["gameId", "playId"], how="inner")
    jug = ds.tablas["jugadores"][[c for c in ("nflId", "displayName", "officialPosition") if c in ds.tablas["jugadores"]]]
    p = p.merge(jug, on="nflId", how="left")
    ofensivo = p["pff_role"].isin(["Pass", "Pass Route", "Pass Block"])
    p["equipo"] = np.where(ofensivo, p["possessionTeam"], p["defensiveTeam"])
    p = p[p["equipo"].isin(FOCO)].copy()
    for c in ("pff_hit", "pff_hurry", "pff_sack", "pff_hitAllowed", "pff_hurryAllowed", "pff_sackAllowed"):
        p[c] = pd.to_numeric(p.get(c, 0), errors="coerce").fillna(0)
    return p


# ---------------------------------------------------------------------------
# Estadísticas de equipo
# ---------------------------------------------------------------------------
def _exito(fila) -> bool:
    """Jugada exitosa: 40 % de la distancia en 1.er down, 60 % en 2.º, 100 % en 3.º/4.º."""
    meta = {1: 0.4, 2: 0.6}.get(int(fila.down) if not pd.isna(fila.down) else 3, 1.0)
    return fila.yardas >= meta * fila.yardsToGo


def stats_equipo(j: pd.DataFrame, eq: str) -> dict:
    o = j[j["possessionTeam"] == eq]
    d = j[j["defensiveTeam"] == eq]
    partidos = max(o["gameId"].nunique(), 1)
    intentos = o["passResult"].isin(["C", "I", "IN"]).sum()
    comp = (o["passResult"] == "C").sum()
    yd_aire = o.loc[o["passResult"] == "C", "yardas"].sum()
    yd_scr = o.loc[o["passResult"] == "R", "yardas"].sum()
    yd_capt = o.loc[o["passResult"] == "S", "yardas"].sum()
    o = o.assign(exito=o.apply(_exito, axis=1)) if len(o) else o.assign(exito=[])
    tercer = o[o["down"] == 3]
    conv3 = (tercer["yardas"] >= tercer["yardsToGo"]) & tercer["passResult"].isin(["C", "R"])
    zr = o[o["a_meta"] <= 20]
    por_down = []
    for dn in (1, 2, 3, 4):
        s = o[o["down"] == dn]
        por_down.append({"down": dn, "jugadas": int(len(s)), "exito": _pct(s["exito"].sum(), len(s)),
                         "yardas_prom": _r(s["yardas"].mean()) if len(s) else None})
    cubetas = [("Corta (1-3)", 1, 3), ("Media (4-6)", 4, 6), ("Larga (7-10)", 7, 10), ("Muy larga (11+)", 11, 99)]
    por_dist = []
    for nombre, a, b in cubetas:
        s = o[(o["yardsToGo"] >= a) & (o["yardsToGo"] <= b)]
        por_dist.append({"distancia": nombre, "jugadas": int(len(s)), "exito": _pct(s["exito"].sum(), len(s))})
    juegos = j[(j["possessionTeam"] == eq) | (j["defensiveTeam"] == eq)]
    penal = juegos["playDescription"].str.findall(_PENAL).explode()
    semanas = []
    for (sem, gid), s in o.groupby(["week", "gameId"]):
        rival = s["defensiveTeam"].iloc[0]
        semanas.append({"semana": int(sem), "rival": rival, "yardas": _r(s["yardas"].sum(), 0),
                        "yardas_por_jugada": _r(s["yardas"].mean(), 2), "jugadas": int(len(s))})
    form = o["offenseFormation"].dropna()
    formaciones = [{"formacion": k, "uso": _pct(v, len(form)), "yardas_por_jugada": _r(o.loc[o["offenseFormation"] == k, "yardas"].mean(), 2)}
                   for k, v in form.value_counts().head(6).items()]
    zonas = []
    for prof in ("short", "deep"):
        for lado in ("left", "middle", "right"):
            s = o[(o["profundidad"] == prof) & (o["lado"] == lado)]
            zonas.append({"profundidad": "corto" if prof == "short" else "profundo",
                          "lado": {"left": "izquierda", "middle": "centro", "right": "derecha"}[lado],
                          "intentos": int(len(s)), "yardas_por_intento": _r(s["yardas"].mean(), 1) if len(s) else 0})
    return {
        "equipo": eq, "partidos": int(o["gameId"].nunique()), "jugadas_pase": int(len(o)),
        "yardas_totales_pj": _r((yd_aire + yd_scr + yd_capt) / partidos), "yardas_aire_pj": _r(yd_aire / partidos),
        "yardas_scramble_pj": _r(yd_scr / partidos), "yardas_por_intento": _r(yd_aire / intentos if intentos else 0, 2),
        "yardas_por_jugada": _r(o["yardas"].mean(), 2), "completos_pct": _pct(comp, intentos),
        "td_pase": int(o["td"].sum()), "intercepciones": int((o["passResult"] == "IN").sum()),
        "capturas_recibidas": int((o["passResult"] == "S").sum()), "capturas_pct": _pct((o["passResult"] == "S").sum(), len(o)),
        "tercer_down_pct": _pct(conv3.sum(), len(tercer)), "tercer_down_intentos": int(len(tercer)),
        "zona_roja_jugadas": int(len(zr)), "zona_roja_td_pct": _pct(zr["td"].sum(), len(zr)),
        "explosivas": int((o["yardas"] >= 20).sum()), "explosivas_pct": _pct((o["yardas"] >= 20).sum(), len(o)),
        "penalizaciones_pj": _r((penal == eq).sum() / max(juegos["gameId"].nunique(), 1)),
        "def_yardas_por_jugada": _r(d["yardas"].mean(), 2), "def_capturas": int((d["passResult"] == "S").sum()),
        "def_intercepciones": int((d["passResult"] == "IN").sum()), "def_tercer_down_pct": _pct(
            ((d["down"] == 3) & (d["yardas"] >= d["yardsToGo"]) & d["passResult"].isin(["C", "R"])).sum(), (d["down"] == 3).sum()),
        "por_down": por_down, "por_distancia": por_dist, "por_semana": sorted(semanas, key=lambda x: x["semana"]),
        "formaciones": formaciones, "zonas_pase": zonas,
    }


# ---------------------------------------------------------------------------
# Jugadores por área
# ---------------------------------------------------------------------------
def _rating(c, a, y, t, i) -> float | None:
    """Passer rating oficial de la NFL."""
    if not a:
        return None
    lim = lambda v: max(0.0, min(2.375, v))
    return round((lim((c / a - .3) * 5) + lim((y / a - 3) * .25) + lim(t / a * 20) + lim(2.375 - i / a * 25)) / 6 * 100, 1)


def _nombres_parentesis(desc: str) -> set[str]:
    nombres = set()
    for g in _PARENTESIS.findall(desc):
        if re.fullmatch(r"\d{1,2}:\d{2}|Shotgun|No Huddle|No Huddle, Shotgun", g.strip()):
            continue
        nombres.update(n.strip() for n in re.split(r"[;,]", g) if n.strip())
    return nombres


def _top(df: pd.DataFrame, eq: str, orden: str, n: int = 4) -> list[dict]:
    s = df[df["equipo"] == eq].sort_values(orden, ascending=False).head(n)
    return s.replace({np.nan: None}).to_dict("records")


def jugadores(p: pd.DataFrame) -> dict:
    if p.empty:
        return {}
    p = p.copy()
    p["abrevs"] = p["displayName"].fillna("").map(abreviaturas)
    base = ["nflId", "displayName", "officialPosition", "equipo"]
    out = {}

    # QB
    q = p[p["pff_role"] == "Pass"]
    qb = q.groupby(base, dropna=False).apply(lambda s: pd.Series({
        "jugadas": len(s), "intentos": s["passResult"].isin(["C", "I", "IN"]).sum(), "completos": (s["passResult"] == "C").sum(),
        "yardas": s.loc[s["passResult"] == "C", "yardas"].sum(), "td": int((s["td"] & (s["passResult"] == "C")).sum()),
        "intercepciones": (s["passResult"] == "IN").sum(), "capturas": (s["passResult"] == "S").sum()}), include_groups=False).reset_index()
    qb["rating"] = [_rating(r.completos, r.intentos, r.yardas, r.td, r.intercepciones) for r in qb.itertuples()]
    qb["completos_pct"] = [_pct(r.completos, r.intentos) for r in qb.itertuples()]
    qb["yardas_por_intento"] = [_r(r.yardas / r.intentos, 1) if r.intentos else None for r in qb.itertuples()]
    out["QB"] = qb

    # Receptores (WR/TE/RB): objetivo = corredor de ruta cuyo nombre aparece tras " to " en la descripción
    r = p[p["pff_role"] == "Pass Route"].copy()
    r["objetivo"] = [any(re.search(rf" to {re.escape(a)}(?![A-Za-z])", d) for a in ab) for d, ab in zip(r["playDescription"], r["abrevs"])]
    r = r[r["objetivo"]]
    rec = r.groupby(base, dropna=False).apply(lambda s: pd.Series({
        "objetivos": len(s), "recepciones": (s["passResult"] == "C").sum(),
        "yardas": s.loc[s["passResult"] == "C", "yardas"].sum(), "td": int((s["td"] & (s["passResult"] == "C")).sum())}), include_groups=False).reset_index()
    rec["yardas_por_recepcion"] = [_r(x.yardas / x.recepciones, 1) if x.recepciones else None for x in rec.itertuples()]
    out["REC"] = rec

    # Línea ofensiva
    b = p[p["pff_role"] == "Pass Block"]
    ol = b.groupby(base, dropna=False).agg(snaps=("playId", "size"), capturas_permitidas=("pff_sackAllowed", "sum"),
                                            golpes_permitidos=("pff_hitAllowed", "sum"), apuros_permitidos=("pff_hurryAllowed", "sum")).reset_index()
    ol["presiones_permitidas"] = ol[["capturas_permitidas", "golpes_permitidos", "apuros_permitidos"]].sum(axis=1)
    ol["proteccion_pct"] = [_r(100 - 100 * x.presiones_permitidas / x.snaps, 1) if x.snaps else None for x in ol.itertuples()]
    out["OL"] = ol[ol["officialPosition"].isin(["T", "G", "C"])]

    # Defensa: presión (PFF) + tackleos/intercepciones/pases defendidos (descripción, aproximado)
    dfn = p[p["pff_role"].isin(["Pass Rush", "Coverage"])].copy()
    dfn["en_par"] = [bool(set(ab) & _nombres_parentesis(dd)) for dd, ab in zip(dfn["playDescription"], dfn["abrevs"])]
    dfn["int"] = [any(f"INTERCEPTED by {a}" in dd for a in ab) for dd, ab in zip(dfn["playDescription"], dfn["abrevs"])]
    dfn["tackleo"] = dfn["en_par"] & dfn["passResult"].isin(["C", "R"])
    dfn["pd"] = dfn["en_par"] & (dfn["passResult"] == "I")
    de = dfn.groupby(base, dropna=False).agg(snaps=("playId", "size"), capturas=("pff_sack", "sum"), golpes=("pff_hit", "sum"),
                                             apuros=("pff_hurry", "sum"), tackleos=("tackleo", "sum"), intercepciones=("int", "sum"),
                                             pases_defendidos=("pd", "sum")).reset_index()
    de["presiones"] = de[["capturas", "golpes", "apuros"]].sum(axis=1)
    out["DL"] = de[de["officialPosition"].isin(["DE", "DT", "NT", "OLB", "ILB", "MLB", "LB"])]
    out["DB"] = de[de["officialPosition"].isin(["CB", "FS", "SS", "S", "DB"])]
    return out


def _demo_area(area: str) -> list[dict]:
    """Datos ilustrativos para áreas que el archivo no cubre. Nombres genéricos para no confundir."""
    if area == "RB":
        return [
            {"displayName": "RB1 Vikings (demo)", "equipo": "MIN", "officialPosition": "RB", "yardas_tierra": 612, "yardas_por_acarreo": 4.6, "td": 5},
            {"displayName": "RB2 Vikings (demo)", "equipo": "MIN", "officialPosition": "RB", "yardas_tierra": 241, "yardas_por_acarreo": 4.1, "td": 2},
            {"displayName": "RB1 49ers (demo)", "equipo": "SF", "officialPosition": "RB", "yardas_tierra": 734, "yardas_por_acarreo": 4.9, "td": 7},
            {"displayName": "RB2 49ers (demo)", "equipo": "SF", "officialPosition": "RB", "yardas_tierra": 302, "yardas_por_acarreo": 4.4, "td": 2},
        ]
    return [
        {"displayName": "K Vikings (demo)", "equipo": "MIN", "officialPosition": "K", "fg_pct": 88.2, "fg_largo": 56, "yardas_por_despeje": None},
        {"displayName": "P Vikings (demo)", "equipo": "MIN", "officialPosition": "P", "fg_pct": None, "fg_largo": None, "yardas_por_despeje": 47.1},
        {"displayName": "K 49ers (demo)", "equipo": "SF", "officialPosition": "K", "fg_pct": 86.4, "fg_largo": 54, "yardas_por_despeje": None},
        {"displayName": "P 49ers (demo)", "equipo": "SF", "officialPosition": "P", "fg_pct": None, "fg_largo": None, "yardas_por_despeje": 46.3},
    ]


def _areas_desde_stats(stats: pd.DataFrame, area: str) -> list[dict] | None:
    """Usa estadisticas_jugador del archivo para carrera y equipos especiales si existen."""
    if stats is None or stats.empty:
        return None
    s = stats[stats["equipo"].isin(FOCO)].copy()
    if area == "RB" and "yardas_tierra" in s:
        s = s[s["posicion"].isin(["RB", "FB"])]
        s["yardas_por_acarreo"] = (s["yardas_tierra"] / s["acarreos"]).round(1) if "acarreos" in s else None
        return [{"displayName": x["nombre"], "equipo": x["equipo"], "officialPosition": x["posicion"], "yardas_tierra": _r(x["yardas_tierra"], 0),
                 "yardas_por_acarreo": _r(x.get("yardas_por_acarreo")), "td": _r(x.get("td"), 0)} for _, x in s.iterrows()]
    if area == "ST" and "fg_hechos" in s:
        s = s[s["posicion"].isin(["K", "P"])]
        return [{"displayName": x["nombre"], "equipo": x["equipo"], "officialPosition": x["posicion"],
                 "fg_pct": _pct(x.get("fg_hechos", 0), x.get("fg_intentos", 0)),
                 "fg_largo": None, "yardas_por_despeje": _r(x["yardas_despeje"] / x["despejes"]) if x.get("despejes") else None}
                for _, x in s.iterrows()]
    return None


def areas(ds, p: pd.DataFrame) -> dict:
    """Arma las 7 áreas con métricas, tipo de gráfica, top por equipo y fuente."""
    js = jugadores(p)
    stats = ds.tablas.get("estadisticas_jugador")
    defs = {
        "QB": ("Quarterbacks (QB)", "QB", "yardas", ["yardas", "td", "intercepciones", "rating", "completos_pct"], "barras_radar", 2),
        "RB": ("Corredores (RB)", None, "yardas_tierra", ["yardas_tierra", "yardas_por_acarreo", "td"], "barras_horizontales", 3),
        "WR": ("Receptores (WR) y alas cerradas (TE)", "REC", "yardas", ["recepciones", "yardas", "td", "objetivos"], "barras_dispersion", 5),
        "OL": ("Línea ofensiva (OL)", "OL", "snaps", ["capturas_permitidas", "presiones_permitidas", "proteccion_pct"], "barras", 5),
        "DL": ("Línea defensiva (DL) y linebackers (LB)", "DL", "presiones", ["capturas", "tackleos", "presiones"], "barras", 5),
        "DB": ("Esquineros (CB) y safeties (S)", "DB", "tackleos", ["intercepciones", "pases_defendidos", "tackleos"], "barras", 5),
        "ST": ("Equipos especiales (K/P)", None, "fg_pct", ["fg_pct", "yardas_por_despeje"], "barras", 2),
    }
    res = {}
    for clave, (titulo, fuente_js, orden, metricas, grafica, n) in defs.items():
        if fuente_js and fuente_js in js:
            df = js[fuente_js]
            if clave == "WR":
                df = df[df["officialPosition"].isin(["WR", "TE"])]
            jug = _top(df, "MIN", orden, n) + _top(df, "SF", orden, n)
            fuente = "archivo"
        else:
            jug = _areas_desde_stats(stats, clave)
            fuente = "archivo" if jug else "demo"
            jug = jug or _demo_area(clave)
        for x in jug:
            x.pop("abrevs", None)
            for k, v in list(x.items()):
                if isinstance(v, (np.integer, np.floating)):
                    x[k] = _r(v, 1)
        res[clave] = {"titulo": titulo, "metricas": metricas, "grafica": grafica, "fuente": fuente, "jugadores": jug}
    return res


# ---------------------------------------------------------------------------
# Campo: plantilla de formación con jugadores reales del archivo
# ---------------------------------------------------------------------------
GRUPOS_POSICION = {
    "QB": ["QB"], "RB": ["HB", "HB-L", "HB-R"], "FB": ["FB", "FB-L", "FB-R"],
    "WR": ["LWR", "RWR", "SLWR", "SRWR", "SLiWR", "SLoWR", "SRiWR", "SRoWR"], "TE": ["TE-L", "TE-R", "TE-iL", "TE-iR", "TE-oL", "TE-oR"],
    "LT": ["LT"], "LG": ["LG"], "C": ["C"], "RG": ["RG"], "RT": ["RT"],
    "DE": ["LEO", "REO", "LE", "RE", "LOLB", "ROLB"], "DT": ["DLT", "DRT", "NT", "NLT", "NRT"],
    "LB": ["LILB", "RILB", "MLB", "LLB", "RLB"], "CB": ["LCB", "RCB"], "NB": ["SCBL", "SCBR", "SCBiL", "SCBiR", "SCBoL", "SCBoR"],
    "FS": ["FS", "FSL", "FSR"], "SS": ["SS", "SSL", "SSR"],
}


def plantilla_campo(ds, p: pd.DataFrame, j: pd.DataFrame, areas_res: dict) -> dict:
    lineas = {}
    for x in [y for a in areas_res.values() for y in a["jugadores"]]:
        k = (x.get("displayName"), x.get("equipo"))
        partes = [f"{m.replace('_', ' ')}: {x[m]}" for m in ("yardas", "td", "recepciones", "capturas", "tackleos", "presiones", "rating") if x.get(m) not in (None, 0)]
        lineas.setdefault(k, ", ".join(partes[:3]))
    equipos = {}
    prioridad = ["QB", "LT", "LG", "C", "RG", "RT", "RB", "TE", "WR", "FB", "DE", "DT", "CB", "SS", "FS", "LB", "NB"]
    for eq in FOCO:
        grupos, usados = {}, set()
        if not p.empty and "pff_positionLinedUp" in p:
            s = p[p["equipo"] == eq]
            for grupo in prioridad:
                top = s[s["pff_positionLinedUp"].isin(GRUPOS_POSICION[grupo])].groupby(["displayName", "officialPosition"]).size().sort_values(ascending=False)
                elegidos = [(n, pos, v) for (n, pos), v in top.items() if n not in usados][:4]
                usados.update(n for n, _, _ in elegidos[:2 if grupo in ("WR", "DE", "DT", "CB", "LB") else 1])
                grupos[grupo] = [{"nombre": n, "posicion": pos, "veces": int(v), "resumen": lineas.get((n, eq), "")} for n, pos, v in elegidos]
        equipos[eq] = grupos
    usos = {eq: stats_equipo(j, eq)["formaciones"] for eq in FOCO}
    return {"fuente": "plantilla" if not p.empty else "demo", "equipos": equipos, "uso_formaciones": usos,
            "nota": "Ubicaciones ilustrativas calculadas con plantillas estándar de formación; el archivo no incluye coordenadas x/y."}


# ---------------------------------------------------------------------------
# Modelo de probabilidad
# ---------------------------------------------------------------------------
def _ratings(j: pd.DataFrame) -> tuple[dict, float]:
    liga = j["yardas"].mean()
    out = {}
    for eq in FOCO:
        ofe = j.loc[j["possessionTeam"] == eq, "yardas"].mean()
        de = j.loc[j["defensiveTeam"] == eq, "yardas"].mean()
        out[eq] = {"ofensiva": ofe, "defensiva": de}
    return out, liga


def _simular(r: dict, liga: float, rng, n=10000) -> dict:
    pts = {
        "SF": PUNTOS_BASE + PTS_POR_YARDA * ((r["SF"]["ofensiva"] - liga) + (r["MIN"]["defensiva"] - liga)) + LOCALIA / 2,
        "MIN": PUNTOS_BASE + PTS_POR_YARDA * ((r["MIN"]["ofensiva"] - liga) + (r["SF"]["defensiva"] - liga)) - LOCALIA / 2,
    }
    margen = rng.normal(pts["SF"] - pts["MIN"], SD_MARGEN, n)
    total = rng.normal(pts["SF"] + pts["MIN"], SD_TOTAL, n)
    return {"p_sf": float((margen > 0).mean()), "p_cubre_sf": float((margen > LINEA_SPREAD).mean()),
            "p_over": float((total > LINEA_TOTAL).mean()), "pts": pts}


def modelo(j: pd.DataFrame) -> dict:
    rng = np.random.default_rng(22112026)
    r, liga = _ratings(j)
    base = _simular(r, liga, rng)
    # Intervalo: remuestreo por partido (bootstrap) sobre sumas por partido de cada equipo
    agregados = {}
    for eq in FOCO:
        for lado, col in (("ofensiva", "possessionTeam"), ("defensiva", "defensiveTeam")):
            g = j[j[col] == eq].groupby("gameId")["yardas"].agg(["sum", "count"]).to_numpy()
            agregados[(eq, lado)] = g
    muestras = []
    for _ in range(400):
        rb = {eq: {} for eq in FOCO}
        for (eq, lado), g in agregados.items():
            if len(g):
                s = g[rng.integers(0, len(g), len(g))]
                rb[eq][lado] = s[:, 0].sum() / max(s[:, 1].sum(), 1)
            else:
                rb[eq][lado] = r[eq][lado]
        muestras.append(_simular(rb, liga, rng, 2000)["p_sf"])
    lo, hi = np.percentile(muestras, [5, 95])
    ancho = hi - lo
    confianza = "alta" if ancho < .15 else "media" if ancho < .3 else "baja"
    pts = base["pts"]
    factores = [
        {"factor": "Ataque aéreo", "detalle": f"49ers {r['SF']['ofensiva']:.2f} vs Vikings {r['MIN']['ofensiva']:.2f} yardas por jugada de pase (promedio liga {liga:.2f}).",
         "favorece": "SF" if r["SF"]["ofensiva"] > r["MIN"]["ofensiva"] else "MIN", "puntos": _r(PTS_POR_YARDA * (r["SF"]["ofensiva"] - r["MIN"]["ofensiva"]))},
        {"factor": "Defensa contra el pase", "detalle": f"49ers permiten {r['SF']['defensiva']:.2f} y Vikings {r['MIN']['defensiva']:.2f} yardas por jugada (menos es mejor).",
         "favorece": "SF" if r["SF"]["defensiva"] < r["MIN"]["defensiva"] else "MIN", "puntos": _r(PTS_POR_YARDA * (r["MIN"]["defensiva"] - r["SF"]["defensiva"]))},
        {"factor": "Localía designada", "detalle": "SF es local en papel, pero en sede neutral la ventaja es pequeña.", "favorece": "SF", "puntos": LOCALIA},
        {"factor": "Altitud de la CDMX (~2,240 m)", "detalle": "El balón vuela más en patadas y pases largos; el desgaste físico sube para ambos. No se asigna ventaja a un equipo.", "favorece": None, "puntos": 0},
    ]
    p_sf = base["p_sf"]
    return {
        "probabilidad": {"SF": _r(100 * p_sf), "MIN": _r(100 * (1 - p_sf))},
        "intervalo_sf": [_r(100 * lo), _r(100 * hi)], "nivel_confianza": confianza,
        "marcador_esperado": {"SF": _r(pts["SF"]), "MIN": _r(pts["MIN"])},
        "spread": {"linea": f"49ers -{LINEA_SPREAD}", "p_cubre_sf": _r(100 * base["p_cubre_sf"]), "p_cubre_min": _r(100 * (1 - base["p_cubre_sf"]))},
        "total": {"linea": LINEA_TOTAL, "p_over": _r(100 * base["p_over"]), "p_under": _r(100 * (1 - base["p_over"]))},
        "factores": factores, "simulaciones": 10000,
        "metodo": "Simulación Monte Carlo del margen y del total con distribución normal; intervalo del 90 % por remuestreo de partidos.",
        "aviso": "Son estimaciones estadísticas con datos históricos del archivo, no garantías de resultado.",
    }


def comparativo_mercado(m: dict) -> list[dict]:
    ids = ["ml-sf", "ml-min", "sp-sf", "sp-min", "ou-o", "ou-u"]
    imp = mercados.probabilidad_implicita(ids)
    mod = {"ml-sf": m["probabilidad"]["SF"], "ml-min": m["probabilidad"]["MIN"], "sp-sf": m["spread"]["p_cubre_sf"],
           "sp-min": m["spread"]["p_cubre_min"], "ou-o": m["total"]["p_over"], "ou-u": m["total"]["p_under"]}
    filas = []
    for i in ids:
        _, etiqueta = mercados.info_opcion(i)
        im, mo = _r(100 * imp[i]), mod[i]
        dif = _r(mo - im) if mo is not None and im is not None else None
        lectura = "El modelo ve más probable que el mercado" if dif and dif > 2 else "El modelo ve menos probable que el mercado" if dif and dif < -2 else "Modelo y mercado coinciden"
        filas.append({"id": i, "pronostico": etiqueta, "cuota": mercados.cuota_actual(i), "prob_mercado": im, "prob_modelo": mo, "diferencia": dif, "lectura": lectura})
    return filas


# ---------------------------------------------------------------------------
# Resúmenes en lenguaje natural
# ---------------------------------------------------------------------------
def _mas(a, b, eq_a="49ers", eq_b="Vikings"):
    return eq_a if (a or 0) >= (b or 0) else eq_b


def resumenes(s: dict, m: dict, temporada: str) -> dict:
    sf, mi = s["SF"], s["MIN"]
    lider_y = _mas(sf["yardas_por_jugada"], mi["yardas_por_jugada"])
    return {
        "resumen": f"Con datos de {temporada}, los {lider_y} ganan más yardas por jugada de pase "
                   f"({max(sf['yardas_por_jugada'] or 0, mi['yardas_por_jugada'] or 0):.1f} contra {min(sf['yardas_por_jugada'] or 0, mi['yardas_por_jugada'] or 0):.1f}). "
                   f"El modelo da {m['probabilidad']['SF']}% a los 49ers y {m['probabilidad']['MIN']}% a los Vikings.",
        "jugadas": f"En tercer down, los 49ers convierten {sf['tercer_down_pct']}% y los Vikings {mi['tercer_down_pct']}%. "
                   f"Jugadas de 20+ yardas: 49ers {sf['explosivas']}, Vikings {mi['explosivas']}.",
        "yardas": f"Por aire, los 49ers promedian {sf['yardas_aire_pj']} yardas por partido y los Vikings {mi['yardas_aire_pj']}.",
        "probabilidades": f"Los 49ers son favoritos con {m['probabilidad']['SF']}% (rango probable {m['intervalo_sf'][0]}%–{m['intervalo_sf'][1]}%). Confianza {m['nivel_confianza']}.",
    }


# ---------------------------------------------------------------------------
# Punto de entrada con caché
# ---------------------------------------------------------------------------
@lru_cache(maxsize=4)
def _calcular(clave: str) -> dict:
    ds = data_loader.obtener()
    j = _jugadas(ds)
    p = _participantes(ds, j)
    temporadas = ds.tablas.get("partidos", pd.DataFrame()).get("season")
    temporada = "demostración" if ds.es_demo else (
        f"la temporada {int(temporadas.dropna().iloc[0])} (semanas {int(j['week'].min())}–{int(j['week'].max())})"
        if temporadas is not None and len(temporadas.dropna()) else "el archivo")
    s = {eq: stats_equipo(j, eq) for eq in FOCO}
    ar = areas(ds, p)
    m = modelo(j)
    h2h = j[(j["possessionTeam"].isin(FOCO)) & (j["defensiveTeam"].isin(FOCO))]
    partidos = []
    if ds.tiene("partidos"):
        g = ds.tablas["partidos"]
        for eq in FOCO:
            gg = g[(g["homeTeamAbbr"] == eq) | (g["visitorTeamAbbr"] == eq)]
            partidos += [{"equipo": eq, "semana": _r(x.get("week"), 0), "local": x["homeTeamAbbr"], "visitante": x["visitorTeamAbbr"],
                          "fecha": x.get("gameDate")} for _, x in gg.iterrows()]
    qbs = {eq: next((x for x in ar["QB"]["jugadores"] if x["equipo"] == eq), None) for eq in FOCO}
    return {
        "dataset": {"es_demo": ds.es_demo, "temporada": temporada, "cargado_en": ds.cargado_en,
                    "modulos": ds.reporte.get("modulos", {}), "fuente": "demo" if ds.es_demo else "archivo"},
        "equipos": EQUIPOS, "estadisticas": s, "areas": ar, "modelo": m, "partidos": partidos,
        "qb_titulares": qbs, "h2h": {"jugadas": int(len(h2h)), "nota": "Sin enfrentamientos directos MIN-SF en el archivo." if h2h.empty else ""},
        "campo": plantilla_campo(ds, p, j, ar), "resumenes": resumenes(s, m, temporada),
        "contexto": {"altitud_m": 2240, "sede": "Estadio Banorte (Estadio Azteca), Ciudad de México", "local_designado": "SF",
                     "nota_altitud": "A 2,240 m el aire es ~22 % menos denso que al nivel del mar: las patadas y los pases largos viajan más y la fatiga llega antes."},
    }


def analisis() -> dict:
    ds = data_loader.obtener()
    return _calcular(ds.cargado_en)


def invalidar() -> None:
    _calcular.cache_clear()
