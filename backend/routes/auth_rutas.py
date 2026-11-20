"""Endpoints de autenticación, separados por portal: /api/auth/usuario/* y /api/auth/admin/*."""
from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from ..lib import auth, store

usuario = APIRouter(prefix="/api/auth/usuario", tags=["auth-usuario"])
admin = APIRouter(prefix="/api/auth/admin", tags=["auth-admin"])


def _email(v: str) -> str:
    v = v.strip().lower()
    if "@" not in v or len(v) > 120 or " " in v:
        raise HTTPException(422, "Escribe un correo válido.")
    return v


# =============================== USUARIOS ===================================
class Registro(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    email: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128)
    fecha_nacimiento: date
    acepta_terminos: bool


class Verificacion(BaseModel):
    email: str
    codigo: str = Field(min_length=6, max_length=6)


class Login(BaseModel):
    email: str
    password: str = Field(max_length=128)


def _edad(nac: date) -> int:
    hoy = date.today()
    return hoy.year - nac.year - ((hoy.month, hoy.day) < (nac.month, nac.day))


@usuario.post("/registro")
def registro(datos: Registro, request: Request):
    email = _email(datos.email)
    if not datos.acepta_terminos:
        raise HTTPException(422, "Debes aceptar los términos y las reglas de juego responsable.")
    if _edad(datos.fecha_nacimiento) < 18:
        store.registrar_acceso("registro_menor", "usuario", auth.ip_de(request), email, ok=False)
        raise HTTPException(403, "Solo mayores de 18 años pueden registrarse.")
    if (err := auth.validar_politica_password(datos.password)):
        raise HTTPException(422, err)
    with store.LOCK:
        if email in store.USUARIOS or email in store.ADMINS:
            raise HTTPException(409, "Ya existe una cuenta con ese correo.")
        codigo = f"{secrets.randbelow(1_000_000):06d}"
        store.USUARIOS[email] = store.Usuario(store.nuevo_id("USR"), datos.nombre.strip(), email,
                                              auth.hash_password(datos.password), datos.fecha_nacimiento.isoformat(),
                                              codigo_verificacion=codigo)
    store.registrar_acceso("registro", "usuario", auth.ip_de(request), email)
    respuesta = {"mensaje": "Cuenta creada. Revisa tu correo y escribe el código de verificación de 6 dígitos."}
    if auth.DEMO:  # sin servicio de correo en la demo: el código se muestra en pantalla
        respuesta["codigo_demo"] = codigo
    return respuesta


@usuario.post("/verificar")
def verificar(datos: Verificacion, request: Request):
    email = _email(datos.email)
    auth.comprobar_bloqueo(f"ver:{email}")
    u = store.USUARIOS.get(email)
    if not u or not u.codigo_verificacion or not secrets.compare_digest(u.codigo_verificacion, datos.codigo):
        auth.registrar_fallo(f"ver:{email}")
        raise HTTPException(400, "El código no es correcto.")
    u.verificado, u.codigo_verificacion = True, None
    store.registrar_acceso("correo_verificado", "usuario", auth.ip_de(request), email)
    return {"mensaje": "Correo verificado. Ya puedes iniciar sesión."}


@usuario.post("/login")
def login_usuario(datos: Login, request: Request, response: Response):
    email, ip = _email(datos.email), auth.ip_de(request)
    auth.comprobar_bloqueo(f"usr:{email}", f"ip:{ip}")
    u = store.USUARIOS.get(email)
    if not auth.verificar_password(datos.password, u.hash_password if u else auth.HASH_FALSO) or not u:
        auth.registrar_fallo(f"usr:{email}", f"ip:{ip}")
        store.registrar_acceso("login_fallido", "usuario", ip, email, ok=False)
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    if not u.verificado:
        raise HTTPException(403, "Verifica tu correo antes de entrar.")
    auth.limpiar_fallos(f"usr:{email}")
    auth.abrir_sesion(response, "usuario", u.id, {"email": email})
    store.registrar_acceso("login", "usuario", ip, email)
    return {"mensaje": "Sesión iniciada.", "redirigir": "/apuestas"}


@usuario.post("/logout")
def logout_usuario(request: Request, response: Response):
    auth.cerrar_sesion(response, "usuario")
    store.registrar_acceso("logout", "usuario", auth.ip_de(request))
    return {"mensaje": "Sesión cerrada."}


@usuario.get("/sesion")
def sesion_usuario(s: dict = Depends(auth.exigir("usuario"))):
    u = next((x for x in store.USUARIOS.values() if x.id == s["sub"]), None)
    if not u:
        raise HTTPException(401, {"mensaje": "Tu cuenta ya no existe.", "redirigir": "/apuestas/login"})
    return {"id": u.id, "nombre": u.nombre, "email": u.email, "rol": "usuario"}


# =============================== ADMINS =====================================
class Login2FA(BaseModel):
    token: str
    codigo: str = Field(min_length=6, max_length=6)


@admin.post("/login")
def login_admin(datos: Login, request: Request):
    """Paso 1: correo y contraseña. Devuelve un token temporal para el paso 2 (código 2FA)."""
    email, ip = _email(datos.email), auth.ip_de(request)
    auth.comprobar_bloqueo(f"adm:{email}", f"ip:{ip}")
    a = store.ADMINS.get(email)
    if not auth.verificar_password(datos.password, a.hash_password if a else auth.HASH_FALSO) or not a:
        auth.registrar_fallo(f"adm:{email}", f"ip:{ip}")
        store.registrar_acceso("login_fallido", "admin", ip, email, ok=False)
        raise HTTPException(401, "Credenciales incorrectas.")
    token = auth.crear_jwt(a.id, "admin-2fa", "gridiron-2fa", 300, {"email": email})
    respuesta = {"paso": "2fa", "token": token, "mensaje": "Escribe el código de 6 dígitos de tu app de autenticación."}
    if auth.DEMO and email == auth.DEMO_ADMIN_EMAIL:
        respuesta["codigo_demo"] = auth.codigo_totp(a.totp_secreto)
    return respuesta


@admin.post("/2fa")
def segundo_factor(datos: Login2FA, request: Request, response: Response):
    ip = auth.ip_de(request)
    carga = auth.leer_jwt(datos.token, "gridiron-2fa")
    if not carga or carga.get("rol") != "admin-2fa":
        raise HTTPException(401, "El paso de verificación expiró. Vuelve a escribir tu contraseña.")
    email = carga["email"]
    auth.comprobar_bloqueo(f"2fa:{email}", f"ip:{ip}")
    a = store.ADMINS.get(email)
    if not a or not auth.verificar_totp(a.totp_secreto, datos.codigo):
        auth.registrar_fallo(f"2fa:{email}", f"ip:{ip}")
        store.registrar_acceso("2fa_fallido", "admin", ip, email, ok=False)
        raise HTTPException(401, "El código 2FA no es correcto.")
    auth.limpiar_fallos(f"adm:{email}", f"2fa:{email}")
    auth.abrir_sesion(response, "admin", a.id, {"email": email})
    store.registrar_acceso("login", "admin", ip, email)
    return {"mensaje": "Acceso concedido.", "redirigir": "/admin/analisis"}


@admin.post("/logout")
def logout_admin(request: Request, response: Response):
    auth.cerrar_sesion(response, "admin")
    store.registrar_acceso("logout", "admin", auth.ip_de(request))
    return {"mensaje": "Sesión cerrada."}


@admin.get("/sesion")
def sesion_admin(s: dict = Depends(auth.exigir("admin"))):
    a = next((x for x in store.ADMINS.values() if x.id == s["sub"]), None)
    if not a:
        raise HTTPException(401, {"mensaje": "Tu cuenta ya no existe.", "redirigir": "/admin/login"})
    return {"id": a.id, "nombre": a.nombre, "email": a.email, "rol": "admin", "superadmin": a.superadmin}
