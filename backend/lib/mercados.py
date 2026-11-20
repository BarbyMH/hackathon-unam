"""Mercados de apuesta del partido MIN vs SF con cuotas SIMULADAS (datos de demostración).

Las cuotas se mueven de forma determinista en función del tiempo (pasos de 4 s), así el servidor
y el navegador siempre ven la misma cuota y el servidor puede validar el boleto sin confiar en el cliente.
"""
from __future__ import annotations

import math
import time
import zlib

PASO_SEGUNDOS = 4

# cat: principales | mitades | props | especiales
MERCADOS = [
    {"id": "ml", "cat": "principales", "titulo": "Ganador del partido", "termino": "moneyline",
     "ayuda": "Elige qué equipo gana el partido, por cualquier diferencia de puntos.",
     "opciones": [("ml-min", "Vikings ganan", "Visitante", 145), ("ml-sf", "49ers ganan", "Local designado", -175)]},
    {"id": "sp", "cat": "principales", "titulo": "Spread / Hándicap (3.0)", "termino": "spread",
     "ayuda": "Los 49ers deben ganar por 4 o más. Los Vikings ganan la apuesta si ganan o pierden por 2 o menos.",
     "opciones": [("sp-min", "Vikings +3.0", "Pierden por 2 o menos, o ganan", -110), ("sp-sf", "49ers -3.0", "Ganan por 4 o más", -110)]},
    {"id": "ou", "cat": "principales", "titulo": "Total de puntos (46.5)", "termino": "over_under",
     "ayuda": "Suma los puntos de los dos equipos. ¿Habrá más o menos de 46.5?",
     "opciones": [("ou-o", "Más de 46.5 (Over)", "47 puntos o más", -110), ("ou-u", "Menos de 46.5 (Under)", "46 puntos o menos", -110)]},
    {"id": "fs", "cat": "principales", "titulo": "Primer equipo en anotar", "termino": "anotacion",
     "ayuda": "¿Qué equipo hace los primeros puntos del partido?",
     "opciones": [("fs-min", "Vikings", "Primeros puntos", 115), ("fs-sf", "49ers", "Primeros puntos", -135)]},
    {"id": "h1", "cat": "mitades", "titulo": "Ganador de la 1.ª mitad", "termino": "mitad",
     "ayuda": "Solo cuenta el marcador al medio tiempo (después de 2 cuartos).",
     "opciones": [("h1-min", "Vikings", "Al medio tiempo", 135), ("h1-tie", "Empate", "Al medio tiempo", 1400), ("h1-sf", "49ers", "Al medio tiempo", -155)]},
    {"id": "q1", "cat": "mitades", "titulo": "Ganador del 1.er cuarto", "termino": "cuarto",
     "ayuda": "Solo cuentan los puntos de los primeros 15 minutos.",
     "opciones": [("q1-min", "Vikings", "1.er cuarto", 150), ("q1-tie", "Empate", "1.er cuarto", 300), ("q1-sf", "49ers", "1.er cuarto", 105)]},
    {"id": "td", "cat": "mitades", "titulo": "Total de touchdowns (5.5)", "termino": "touchdown",
     "ayuda": "Cuenta todos los touchdowns del partido, de ambos equipos.",
     "opciones": [("td-o", "Más de 5.5", "6 o más TD", 105), ("td-u", "Menos de 5.5", "5 o menos TD", -125)]},
    {"id": "p-qb", "cat": "props", "titulo": "QB 49ers: yardas por pase (264.5)", "termino": "qb",
     "ayuda": "Yardas que gana el quarterback de San Francisco lanzando pases.",
     "opciones": [("pqb-o", "Más de 264.5", "Over", -115), ("pqb-u", "Menos de 264.5", "Under", -105)]},
    {"id": "p-rb", "cat": "props", "titulo": "RB Vikings: yardas por tierra (68.5)", "termino": "rb",
     "ayuda": "Yardas que gana el corredor principal de Minnesota corriendo con el balón.",
     "opciones": [("prb-o", "Más de 68.5", "Over", -110), ("prb-u", "Menos de 68.5", "Under", -110)]},
    {"id": "p-wr", "cat": "props", "titulo": "WR Vikings: yardas de recepción (88.5)", "termino": "wr",
     "ayuda": "Yardas que gana el receptor estrella de Minnesota atrapando pases.",
     "opciones": [("pwr-o", "Más de 88.5", "Over", -110), ("pwr-u", "Menos de 88.5", "Under", -110)]},
    {"id": "p-atd", "cat": "props", "titulo": "Touchdown en cualquier momento", "termino": "touchdown",
     "ayuda": "Ganas si ese jugador anota un touchdown en cualquier momento del partido.",
     "opciones": [("atd-sfrb", "RB titular 49ers", "Corredor SF", -165), ("atd-minwr", "WR1 Vikings", "Receptor MIN", 120), ("atd-sfte", "TE titular 49ers", "Ala cerrada SF", 175)]},
    {"id": "p-max", "cat": "props", "titulo": "Jugador con más yardas totales", "termino": "yardas",
     "ayuda": "¿Quién suma más yardas por carrera y recepción en todo el partido? (Las yardas por pase no cuentan.)",
     "opciones": [("max-minwr", "WR1 Vikings", "Receptor MIN", 180), ("max-sfrb", "RB titular 49ers", "Corredor SF", 160), ("max-otro", "Otro jugador", "Cualquier otro", 110)]},
    {"id": "boost", "cat": "especiales", "titulo": "Momio Mejorado CDMX", "termino": "momio_mejorado", "mejorado": True,
     "ayuda": "Combinada con pago aumentado: 49ers ganan + RB 49ers anota TD + WR1 Vikings más de 75 yardas. Antes +360.",
     "opciones": [("boost-1", "Especial Estadio Banorte", "Antes +360", 425)]},
]

_POR_OPCION = {o[0]: (m, o) for m in MERCADOS for o in m["opciones"]}


def a_decimal(americana: int) -> float:
    return americana / 100 + 1 if americana > 0 else 100 / abs(americana) + 1


def a_americana(decimal: float) -> int:
    """Convierte de decimal a americana y redondea a múltiplos de 5 (como las casas de apuestas)."""
    if decimal >= 2:
        v = round((decimal - 1) * 100 / 5) * 5
        return max(v, 100)
    v = round(-100 / (decimal - 1) / 5) * 5
    return min(v, -105)


def cuota_actual(id_opcion: str, ahora: float | None = None) -> int:
    """Cuota simulada: oscila ±3 % alrededor de la base. Las opciones mejoradas no se mueven."""
    m, o = _POR_OPCION[id_opcion]
    if m.get("mejorado"):
        return o[3]
    paso = int((ahora or time.time()) // PASO_SEGUNDOS)
    fase = (zlib.crc32(id_opcion.encode()) % 628) / 100
    factor = 1 + 0.03 * math.sin(paso * 0.45 + fase) * math.cos(paso * 0.13 + fase / 2)
    return a_americana(1 + (a_decimal(o[3]) - 1) * factor)


def listar(ahora: float | None = None) -> dict:
    ahora = ahora or time.time()
    paso = int(ahora // PASO_SEGUNDOS)
    salida = []
    for m in MERCADOS:
        ops = []
        for oid, etiqueta, sub, _ in m["opciones"]:
            actual, previa = cuota_actual(oid, ahora), cuota_actual(oid, ahora - PASO_SEGUNDOS)
            tendencia = "sube" if a_decimal(actual) > a_decimal(previa) else "baja" if a_decimal(actual) < a_decimal(previa) else None
            ops.append({"id": oid, "etiqueta": etiqueta, "sub": sub, "cuota": actual, "tendencia": tendencia})
        salida.append({"id": m["id"], "cat": m["cat"], "titulo": m["titulo"], "ayuda": m["ayuda"],
                       "termino": m["termino"], "mejorado": bool(m.get("mejorado")), "opciones": ops})
    return {"paso": paso, "segundos_por_paso": PASO_SEGUNDOS, "demo": True, "mercados": salida}


def info_opcion(id_opcion: str):
    """Devuelve (mercado, etiqueta) o None si la opción no existe."""
    if id_opcion not in _POR_OPCION:
        return None
    m, o = _POR_OPCION[id_opcion]
    return m, o[1]


def probabilidad_implicita(ids: list[str]) -> dict[str, float]:
    """Probabilidad implícita sin margen de la casa (normalizada dentro del mercado)."""
    out = {}
    for m in MERCADOS:
        crudas = {o[0]: 1 / a_decimal(cuota_actual(o[0])) for o in m["opciones"]}
        total = sum(crudas.values())
        for k, v in crudas.items():
            if k in ids:
                out[k] = v / total if len(crudas) > 1 else v
    return out
