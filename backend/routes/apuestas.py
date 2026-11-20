"""Portal A (/api/apuestas/*): SOLO rol `usuario`. No expone análisis ni predicciones."""
from __future__ import annotations

import time
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..lib import auth, mercados, store

router = APIRouter(prefix="/api/apuestas", tags=["apuestas"])
sesion = auth.exigir("usuario")
MONTO_MIN, MONTO_MAX = 10.0, 10_000.0


def _usuario(s: dict) -> store.Usuario:
    u = next((x for x in store.USUARIOS.values() if x.id == s["sub"]), None)
    if not u:
        raise HTTPException(401, {"mensaje": "Tu cuenta ya no existe.", "redirigir": "/apuestas/login"})
    hoy = date.today().isoformat()
    if u.dia_deposito != hoy:
        u.dia_deposito, u.depositado_hoy = hoy, 0.0
    return u


def _autoexcluido(u: store.Usuario) -> bool:
    return u.autoexcluido_hasta > time.time()


def _cuenta(u: store.Usuario) -> dict:
    apuestas = [a for a in store.APUESTAS if a.usuario_id == u.id]
    return {
        "nombre": u.nombre, "saldo": round(u.saldo, 2), "limite_deposito_diario": u.limite_deposito_diario,
        "depositado_hoy": u.depositado_hoy, "autoexcluido_hasta": u.autoexcluido_hasta if _autoexcluido(u) else None,
        "apuestas": [{"id": a.id, "selecciones": a.selecciones, "tipo": a.tipo, "monto": a.monto, "cuota_decimal": round(a.cuota_decimal, 3),
                      "pago_potencial": round(a.pago_potencial, 2), "estado": a.estado, "creada": a.creada} for a in reversed(apuestas)],
        "movimientos": [m for m in reversed(store.MOVIMIENTOS) if m["usuario_id"] == u.id][:30],
        "demo": True,
    }


@router.get("/mercados")
def ver_mercados(s: dict = Depends(sesion)):
    return mercados.listar()


@router.get("/cuenta")
def ver_cuenta(s: dict = Depends(sesion)):
    return _cuenta(_usuario(s))


class Boleto(BaseModel):
    selecciones: list[str] = Field(min_length=1, max_length=8)
    monto: float
    cuotas_vistas: dict[str, int] = {}


@router.post("/boleto")
def confirmar_boleto(b: Boleto, s: dict = Depends(sesion)):
    u = _usuario(s)
    if _autoexcluido(u):
        raise HTTPException(403, "Tienes la autoexclusión activa. No puedes apostar por ahora.")
    if not (MONTO_MIN <= b.monto <= MONTO_MAX):
        raise HTTPException(422, f"El monto debe estar entre ${MONTO_MIN:,.0f} y ${MONTO_MAX:,.0f} MXN.")
    if len(set(b.selecciones)) != len(b.selecciones):
        raise HTTPException(422, "Hay selecciones repetidas en el boleto.")
    sel, mercados_usados = [], set()
    for oid in b.selecciones:
        info = mercados.info_opcion(oid)
        if not info:
            raise HTTPException(422, "Una de las selecciones ya no existe.")
        m, etiqueta = info
        if m["id"] in mercados_usados:
            raise HTTPException(422, f"No puedes combinar dos opciones del mismo mercado ({m['titulo']}).")
        mercados_usados.add(m["id"])
        sel.append({"id": oid, "mercado": m["titulo"], "etiqueta": etiqueta, "cuota": mercados.cuota_actual(oid)})
    cambios = {x["id"]: x["cuota"] for x in sel if x["id"] in b.cuotas_vistas and b.cuotas_vistas[x["id"]] != x["cuota"]}
    if cambios:
        raise HTTPException(409, {"mensaje": "Las cuotas cambiaron. Revisa el boleto y confirma otra vez.", "cuotas": cambios})
    with store.LOCK:
        if b.monto > u.saldo:
            raise HTTPException(422, "Saldo insuficiente.")
        dec = 1.0
        for x in sel:
            dec *= mercados.a_decimal(x["cuota"])
        a = store.Apuesta(store.nuevo_id("GMX"), u.id, sel, "combinada" if len(sel) > 1 else "sencilla",
                          round(b.monto, 2), dec, round(b.monto * dec, 2))
        u.saldo -= a.monto
        store.APUESTAS.append(a)
        store.MOVIMIENTOS.append({"usuario_id": u.id, "t": time.time(), "tipo": "apuesta", "monto": -a.monto, "ref": a.id})
    return {"mensaje": "Apuesta registrada (demostración).", "apuesta_id": a.id, "cuenta": _cuenta(u)}


class Monto(BaseModel):
    monto: float = Field(gt=0, le=50_000)


@router.post("/deposito")
def depositar(d: Monto, s: dict = Depends(sesion)):
    u = _usuario(s)
    if _autoexcluido(u):
        raise HTTPException(403, "Tienes la autoexclusión activa. No puedes depositar por ahora.")
    if u.depositado_hoy + d.monto > u.limite_deposito_diario:
        disponible = max(u.limite_deposito_diario - u.depositado_hoy, 0)
        raise HTTPException(422, f"Supera tu límite diario. Hoy puedes depositar hasta ${disponible:,.2f} MXN.")
    with store.LOCK:
        u.saldo += d.monto
        u.depositado_hoy += d.monto
        store.MOVIMIENTOS.append({"usuario_id": u.id, "t": time.time(), "tipo": "deposito (simulado)", "monto": d.monto})
    return _cuenta(u)


@router.post("/retiro")
def retirar(d: Monto, s: dict = Depends(sesion)):
    u = _usuario(s)
    with store.LOCK:
        if d.monto > u.saldo:
            raise HTTPException(422, "No tienes saldo suficiente para ese retiro.")
        u.saldo -= d.monto
        store.MOVIMIENTOS.append({"usuario_id": u.id, "t": time.time(), "tipo": "retiro (simulado)", "monto": -d.monto})
    return _cuenta(u)


class Limites(BaseModel):
    limite_deposito_diario: float = Field(ge=100, le=50_000)


@router.post("/limites")
def fijar_limites(l: Limites, s: dict = Depends(sesion)):
    u = _usuario(s)
    u.limite_deposito_diario = l.limite_deposito_diario
    return _cuenta(u)


class Autoexclusion(BaseModel):
    horas: int = Field(ge=24, le=24 * 365)


@router.post("/autoexclusion")
def autoexcluir(a: Autoexclusion, s: dict = Depends(sesion)):
    """La autoexclusión no se puede levantar antes de tiempo (solo un admin podría hacerlo)."""
    u = _usuario(s)
    u.autoexcluido_hasta = max(u.autoexcluido_hasta, time.time() + a.horas * 3600)
    return _cuenta(u)
