"""Almacén en memoria (el servidor es efímero; no se escribe en disco).

Guarda usuarios, administradores, apuestas, movimientos y el registro de accesos.
Al reiniciar el servidor todo vuelve al estado inicial (cuentas semilla).
"""
from __future__ import annotations

import secrets
import threading
import time
from collections import deque
from dataclasses import dataclass, field

LOCK = threading.RLock()


@dataclass
class Usuario:
    id: str
    nombre: str
    email: str
    hash_password: str
    fecha_nacimiento: str
    verificado: bool = False
    codigo_verificacion: str | None = None
    saldo: float = 1000.0
    limite_deposito_diario: float = 5000.0
    depositado_hoy: float = 0.0
    dia_deposito: str = ""
    autoexcluido_hasta: float = 0.0
    creado: float = field(default_factory=time.time)


@dataclass
class Admin:
    id: str
    nombre: str
    email: str
    hash_password: str
    totp_secreto: str
    superadmin: bool = False
    creado: float = field(default_factory=time.time)


@dataclass
class Apuesta:
    id: str
    usuario_id: str
    selecciones: list[dict]
    tipo: str
    monto: float
    cuota_decimal: float
    pago_potencial: float
    estado: str = "Abierta"
    creada: float = field(default_factory=time.time)


USUARIOS: dict[str, Usuario] = {}   # por email
ADMINS: dict[str, Admin] = {}       # por email
APUESTAS: list[Apuesta] = []
MOVIMIENTOS: list[dict] = []
ACCESOS: deque = deque(maxlen=1000)


def nuevo_id(prefijo: str) -> str:
    return f"{prefijo}-{secrets.token_hex(4).upper()}"


def registrar_acceso(evento: str, portal: str, ip: str, email: str = "", ok: bool = True, detalle: str = "") -> None:
    """Registro de accesos e intentos no autorizados (nunca guarda contraseñas ni tokens)."""
    with LOCK:
        ACCESOS.appendleft({"t": time.time(), "evento": evento, "portal": portal, "ip": ip,
                            "email": email, "ok": ok, "detalle": detalle})
