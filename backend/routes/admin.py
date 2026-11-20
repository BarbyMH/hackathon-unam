"""Portal B (/api/admin/*): SOLO rol `admin`. Análisis, calidad de datos, gestión y exportación."""
from __future__ import annotations

import csv
import io
import time
import urllib.parse
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..lib import analytics, auth, data_loader, fuentes_externas, store

router = APIRouter(prefix="/api/admin", tags=["admin"])
sesion = auth.exigir("admin")
MAX_ARCHIVO = 25 * 1024 * 1024


@router.get("/analisis")
def ver_analisis(s: dict = Depends(sesion)):
    a = analytics.analisis()
    return {**a, "mercado": analytics.comparativo_mercado(a["modelo"])}


@router.get("/fuentes-externas")
def ver_fuentes(forzar: bool = False, s: dict = Depends(sesion)):
    externas = fuentes_externas.obtener(forzar)
    a = analytics.analisis()
    discrepancias = []
    for eq, r in externas.items():
        partidos_archivo = a["estadisticas"][eq]["partidos"]
        rec = (r.get("datos") or {}).get("record")
        if rec and "-" in rec:
            jugados = sum(int(x) for x in rec.split("-") if x.isdigit())
            if jugados != partidos_archivo:
                discrepancias.append(f"{eq}: la fuente externa reporta {jugados} partidos ({rec}) y el archivo tiene {partidos_archivo}. "
                                     "Se prioriza la fuente más reciente (externa) para el récord; el análisis usa el archivo.")
    return {"equipos": externas, "discrepancias": discrepancias}


@router.get("/calidad-datos")
def calidad(s: dict = Depends(sesion)):
    return data_loader.obtener().reporte


@router.post("/datos")
async def subir_datos(request: Request, s: dict = Depends(sesion)):
    """Sube un CSV/JSON en el cuerpo de la petición. Se procesa en memoria; no se escribe en /data."""
    nombre = urllib.parse.unquote(request.headers.get("x-nombre-archivo", ""))
    cuerpo = await request.body()
    if not cuerpo:
        raise HTTPException(422, "El archivo está vacío.")
    if len(cuerpo) > MAX_ARCHIVO:
        raise HTTPException(413, "El archivo supera 25 MB.")
    try:
        ds = data_loader.reemplazar(nombre, cuerpo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    analytics.invalidar()
    store.registrar_acceso("datos_subidos", "admin", auth.ip_de(request), s.get("email", ""), detalle=nombre)
    return ds.reporte


@router.post("/datos/recargar")
def recargar_datos(request: Request, s: dict = Depends(sesion)):
    ds = data_loader.recargar()
    analytics.invalidar()
    store.registrar_acceso("datos_recargados", "admin", auth.ip_de(request), s.get("email", ""))
    return ds.reporte


@router.get("/usuarios")
def usuarios(s: dict = Depends(sesion)):
    return {
        "usuarios": [{"id": u.id, "nombre": u.nombre, "email": u.email, "verificado": u.verificado, "saldo": round(u.saldo, 2),
                      "autoexcluido": u.autoexcluido_hasta > time.time(), "creado": u.creado} for u in store.USUARIOS.values()],
        "administradores": [{"id": a.id, "nombre": a.nombre, "email": a.email, "superadmin": a.superadmin} for a in store.ADMINS.values()],
    }


@router.get("/actividad")
def actividad(s: dict = Depends(sesion)):
    """Actividad de apuestas agregada (sin datos personales)."""
    ap = store.APUESTAS
    por_opcion = Counter(x["etiqueta"] for a in ap for x in a.selecciones)
    return {"apuestas": len(ap), "monto_total": round(sum(a.monto for a in ap), 2),
            "pago_potencial_total": round(sum(a.pago_potencial for a in ap), 2),
            "combinadas": sum(a.tipo == "combinada" for a in ap), "usuarios_activos": len({a.usuario_id for a in ap}),
            "selecciones_populares": [{"seleccion": k, "veces": v} for k, v in por_opcion.most_common(8)]}


@router.get("/accesos")
def accesos(s: dict = Depends(sesion)):
    return {"registros": list(store.ACCESOS)[:200]}


class NuevoAdmin(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=10, max_length=128)


@router.post("/administradores")
def crear_admin(d: NuevoAdmin, request: Request, s: dict = Depends(sesion)):
    """Solo un superadmin crea cuentas de administrador. El secreto 2FA se muestra una sola vez."""
    yo = store.ADMINS.get(s.get("email", ""))
    if not yo or not yo.superadmin:
        raise HTTPException(403, "Solo un superadmin puede crear administradores.")
    email = d.email.strip().lower()
    if "@" not in email or email in store.ADMINS or email in store.USUARIOS:
        raise HTTPException(409, "Correo no válido o ya registrado.")
    if (err := auth.validar_politica_password(d.password)):
        raise HTTPException(422, err)
    secreto = auth.nuevo_secreto_totp()
    store.ADMINS[email] = store.Admin(store.nuevo_id("ADM"), d.nombre.strip(), email, auth.hash_password(d.password), secreto)
    store.registrar_acceso("admin_creado", "admin", auth.ip_de(request), yo.email, detalle=email)
    uri = f"otpauth://totp/GridironMX:{urllib.parse.quote(email)}?secret={secreto}&issuer=GridironMX"
    return {"mensaje": "Administrador creado. Guarda el secreto 2FA en una app de autenticación; no se volverá a mostrar.",
            "totp_secreto": secreto, "otpauth_uri": uri}


@router.get("/exportar.csv")
def exportar_csv(s: dict = Depends(sesion)):
    a = analytics.analisis()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["seccion", "equipo", "metrica", "valor", "fuente"])
    fuente = a["dataset"]["fuente"]
    for eq, st in a["estadisticas"].items():
        for k, v in st.items():
            if not isinstance(v, list):
                w.writerow(["equipo", eq, k, v, fuente])
    for area, info in a["areas"].items():
        for j in info["jugadores"]:
            for m in info["metricas"]:
                w.writerow([f"area_{area}", j.get("equipo"), f"{j.get('displayName')} | {m}", j.get(m), info["fuente"]])
    m = a["modelo"]
    w.writerow(["modelo", "SF", "prob_victoria_%", m["probabilidad"]["SF"], "modelo"])
    w.writerow(["modelo", "MIN", "prob_victoria_%", m["probabilidad"]["MIN"], "modelo"])
    w.writerow(["modelo", "SF", "prob_cubrir_-3_%", m["spread"]["p_cubre_sf"], "modelo"])
    w.writerow(["modelo", "-", "prob_over_46.5_%", m["total"]["p_over"], "modelo"])
    return Response(buf.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="gridiron_mx_analisis_min_sf_2026.csv"'})
