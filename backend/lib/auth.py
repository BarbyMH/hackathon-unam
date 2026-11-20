"""Autenticación y autorización con dos portales separados.

- Contraseñas: scrypt (KDF de memoria dura de la librería estándar). bcrypt/argon2 requieren
  dependencias que no forman parte del stack del hackathon.
- Tokens: JWT HS256 firmados con secretos distintos por portal, con claims `rol` y `aud` distintos.
- Cookies: `gmx_usr_session` (usuario) y `gmx_adm_session` (admin), httpOnly + Secure + SameSite=Strict.
- CSRF: doble envío (cookie legible `*_csrf` + cabecera X-CSRF-Token) en todo POST autenticado.
- 2FA de administradores: TOTP (RFC 6238), compatible con Google Authenticator / Authy.
- Límite de intentos: 5 fallos en 15 min por correo o por IP bloquean el acceso temporalmente.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import struct
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, Response

from . import store

DEMO = os.environ.get("DEMO_MODE", "1") != "0"
_SECRETO_BASE = os.environ.get("JWT_SECRET") or secrets.token_urlsafe(48)
COOKIE_SEGURA = os.environ.get("COOKIE_SECURE", "1") != "0"

# Configuración por portal: nada se comparte entre ambos.
PORTALES = {
    "usuario": {"cookie": "gmx_usr_session", "csrf": "gmx_usr_csrf", "aud": "gridiron-apuestas",
                "rol": "usuario", "ttl": 60 * 60 * 8, "inicio": "/apuestas", "login": "/apuestas/login"},
    "admin": {"cookie": "gmx_adm_session", "csrf": "gmx_adm_csrf", "aud": "gridiron-analisis",
              "rol": "admin", "ttl": 60 * 60 * 2, "inicio": "/admin/analisis", "login": "/admin/login"},
}


def _secreto(aud: str) -> bytes:
    """Deriva un secreto distinto por audiencia: un token de un portal no valida en el otro."""
    return hmac.new(_SECRETO_BASE.encode(), aud.encode(), hashlib.sha256).digest()


# --- Contraseñas --------------------------------------------------------------
def hash_password(password: str) -> str:
    sal = secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode(), salt=sal, n=2 ** 14, r=8, p=1, dklen=32)
    return f"scrypt$16384$8$1${sal.hex()}${h.hex()}"


def verificar_password(password: str, guardado: str) -> bool:
    try:
        _, n, r, p, sal, h = guardado.split("$")
        calc = hashlib.scrypt(password.encode(), salt=bytes.fromhex(sal), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(calc.hex(), h)
    except (ValueError, TypeError):
        return False


# Hash de relleno: se verifica aunque el correo no exista, para no revelar qué cuentas existen por tiempo de respuesta.
HASH_FALSO = hash_password(secrets.token_urlsafe(16))


def validar_politica_password(password: str) -> str | None:
    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres."
    if not any(c.isdigit() for c in password) or not any(c.isalpha() for c in password):
        return "La contraseña debe combinar letras y números."
    return None


# --- JWT HS256 ----------------------------------------------------------------
def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def crear_jwt(sub: str, rol: str, aud: str, ttl: int, extra: dict | None = None) -> str:
    ahora = int(time.time())
    carga = {"sub": sub, "rol": rol, "aud": aud, "iat": ahora, "exp": ahora + ttl, "jti": secrets.token_hex(8), **(extra or {})}
    cab = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    cue = _b64(json.dumps(carga, separators=(",", ":")).encode())
    firma = _b64(hmac.new(_secreto(aud), f"{cab}.{cue}".encode(), hashlib.sha256).digest())
    return f"{cab}.{cue}.{firma}"


def leer_jwt(token: str, aud: str) -> dict | None:
    try:
        cab, cue, firma = token.split(".")
        esperada = _b64(hmac.new(_secreto(aud), f"{cab}.{cue}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(firma, esperada):
            return None
        if json.loads(_unb64(cab)).get("alg") != "HS256":
            return None
        carga = json.loads(_unb64(cue))
        if carga.get("aud") != aud or carga.get("exp", 0) < time.time():
            return None
        return carga
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


# --- TOTP (2FA) -----------------------------------------------------------------
def nuevo_secreto_totp() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def codigo_totp(secreto: str, t: float | None = None, paso: int = 30) -> str:
    clave = base64.b32decode(secreto + "=" * (-len(secreto) % 8), casefold=True)
    contador = int((t or time.time()) // paso)
    h = hmac.new(clave, struct.pack(">Q", contador), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    return f"{(struct.unpack('>I', h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def verificar_totp(secreto: str, codigo: str) -> bool:
    ahora = time.time()
    return any(hmac.compare_digest(codigo_totp(secreto, ahora + d * 30), codigo.strip()) for d in (-1, 0, 1))


# --- Límite de intentos -------------------------------------------------------------
_FALLOS: dict[str, deque] = defaultdict(deque)
VENTANA, MAX_FALLOS = 15 * 60, 5


def _limpiar(clave: str) -> deque:
    q = _FALLOS[clave]
    while q and q[0] < time.time() - VENTANA:
        q.popleft()
    return q


def comprobar_bloqueo(*claves: str) -> None:
    if any(len(_limpiar(c)) >= MAX_FALLOS for c in claves):
        raise HTTPException(429, "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.")


def registrar_fallo(*claves: str) -> None:
    for c in claves:
        _FALLOS[c].append(time.time())


def limpiar_fallos(*claves: str) -> None:
    for c in claves:
        _FALLOS.pop(c, None)


def ip_de(request: Request) -> str:
    reenviada = request.headers.get("x-forwarded-for", "")
    return reenviada.split(",")[0].strip() if reenviada else (request.client.host if request.client else "?")


# --- Sesiones --------------------------------------------------------------------
def abrir_sesion(response: Response, portal: str, sub: str, extra: dict | None = None) -> str:
    cfg = PORTALES[portal]
    token = crear_jwt(sub, cfg["rol"], cfg["aud"], cfg["ttl"], extra)
    csrf = secrets.token_urlsafe(24)
    response.set_cookie(cfg["cookie"], token, max_age=cfg["ttl"], httponly=True, secure=COOKIE_SEGURA,
                        samesite="strict", path="/")
    response.set_cookie(cfg["csrf"], csrf, max_age=cfg["ttl"], httponly=False, secure=COOKIE_SEGURA,
                        samesite="strict", path="/")
    return csrf


def cerrar_sesion(response: Response, portal: str) -> None:
    cfg = PORTALES[portal]
    response.delete_cookie(cfg["cookie"], path="/")
    response.delete_cookie(cfg["csrf"], path="/")


def _sesion(request: Request, portal: str) -> dict | None:
    cfg = PORTALES[portal]
    token = request.cookies.get(cfg["cookie"])
    if not token:
        return None
    carga = leer_jwt(token, cfg["aud"])
    return carga if carga and carga.get("rol") == cfg["rol"] else None


def exigir(portal: str):
    """Dependencia FastAPI: exige sesión válida del portal y CSRF en métodos que modifican.

    Si quien llama tiene sesión del OTRO portal, responde 403 con la ruta a la que debe volver.
    """
    otro = "admin" if portal == "usuario" else "usuario"

    def dependencia(request: Request) -> dict:
        carga = _sesion(request, portal)
        if carga is None:
            if _sesion(request, otro) is not None:
                store.registrar_acceso("acceso_denegado", portal, ip_de(request), detalle=f"rol {otro} -> {request.url.path}", ok=False)
                raise HTTPException(403, {"mensaje": "Este portal no está disponible para tu tipo de cuenta.",
                                          "redirigir": PORTALES[otro]["inicio"]})
            raise HTTPException(401, {"mensaje": "Inicia sesión para continuar.", "redirigir": PORTALES[portal]["login"]})
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            cookie = request.cookies.get(PORTALES[portal]["csrf"], "")
            cabecera = request.headers.get("x-csrf-token", "")
            if not cookie or not hmac.compare_digest(cookie, cabecera):
                store.registrar_acceso("csrf_invalido", portal, ip_de(request), ok=False, detalle=request.url.path)
                raise HTTPException(403, {"mensaje": "La sesión no es válida para esta acción. Recarga la página."})
        return carga

    return dependencia


# --- Cuentas semilla -------------------------------------------------------------
DEMO_ADMIN_EMAIL = "admin@gridiron.demo"
DEMO_USUARIO_EMAIL = "aficionado@gridiron.demo"


def sembrar_cuentas() -> None:
    """Crea el primer superadmin desde variables de entorno; en modo demo, además cuentas de prueba."""
    email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "")
    if email and pwd:
        secreto = os.environ.get("ADMIN_TOTP_SECRET") or nuevo_secreto_totp()
        store.ADMINS[email] = store.Admin(store.nuevo_id("ADM"), "Superadmin", email, hash_password(pwd), secreto, superadmin=True)
    if DEMO:
        if DEMO_ADMIN_EMAIL not in store.ADMINS:
            store.ADMINS[DEMO_ADMIN_EMAIL] = store.Admin(
                store.nuevo_id("ADM"), "Analista demo", DEMO_ADMIN_EMAIL, hash_password("AdminDemo2026"),
                os.environ.get("DEMO_ADMIN_TOTP_SECRET") or nuevo_secreto_totp(), superadmin=not (email and pwd))
        if DEMO_USUARIO_EMAIL not in store.USUARIOS:
            store.USUARIOS[DEMO_USUARIO_EMAIL] = store.Usuario(
                store.nuevo_id("USR"), "Aficionado demo", DEMO_USUARIO_EMAIL, hash_password("Aficionado2026"),
                "1995-05-20", verificado=True, saldo=2500.0)
