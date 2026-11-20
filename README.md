# GRIDIRON MX // CDMX 2026

Plataforma web de demostración dedicada a un solo partido: **Minnesota Vikings vs. San Francisco 49ers**, NFL Mexico City Game 2026 (domingo 22 de noviembre de 2026, 7:20 p.m. CDMX, Estadio Banorte, semana 11, Sunday Night Football; SF es local designado).

Tiene dos portales independientes:

| | Portal A: apuestas | Portal B: análisis |
|---|---|---|
| Rol | `usuario` | `admin` (con 2FA) |
| Login | `#/apuestas/login` | `#/admin/login` |
| Registro | Sí, `#/apuestas/registro` (+18 y verificación de correo) | No, un superadmin crea las cuentas |
| Inicio tras login | `#/apuestas` | `#/admin/analisis` |
| API | `/api/auth/usuario/*`, `/api/apuestas/*` | `/api/auth/admin/*`, `/api/admin/*` |

**Hallazgo principal (archivo de /data, temporada 2021, semanas 1 a 8):** los 49ers ganan más yardas por jugada de pase que los Vikings (7.5 contra 6.9). Con defensas casi iguales, el modelo da a SF cerca de 56 % de probabilidad de ganar. El rango probable es amplio (aprox. 38 % a 74 %), así que la confianza es baja. **Para quién:** aficionados nuevos que quieren entender el partido y administradores que revisan el análisis.

> **Aviso:** proyecto de demostración. Marca ficticia sin relación con la NFL. No opera apuestas reales ni recibe dinero, y no cuenta con permiso de la SEGOB. Las cuotas y los saldos son simulados. Solo mayores de 18 años.

## Cómo verla

Requiere el entorno del hackathon (`setup.cmd` o `setup.sh`, que crea `.venv` y Node portátil).

```
# Terminal 1: backend (raíz del proyecto)
.venv\Scripts\uvicorn backend.main:app --reload        # Windows
.venv/bin/uvicorn backend.main:app --reload            # macOS / Linux

# Terminal 2: frontend
cd dashboard
npm run dev
```

Abre `http://localhost:5173` (usa `localhost`, no `127.0.0.1`). Vite envía `/api` al backend en el puerto 8000.

**Cuentas de prueba (solo con `DEMO_MODE=1`, que es el valor por defecto):**

- Usuario: `aficionado@gridiron.demo` / `Aficionado2026`
- Admin: `admin@gridiron.demo` / `AdminDemo2026`. En modo demo, el código 2FA vigente aparece en pantalla.

Si tu navegador no guarda la sesión en `http://localhost` (por ejemplo Safari), crea `.env` con `COOKIE_SECURE=0`.

## Crear el primer administrador

No hay registro público de administradores. El primer superadmin se crea al arrancar desde variables de entorno (en `.env` o en el servidor):

```
ADMIN_EMAIL=tu-correo@dominio.mx
ADMIN_PASSWORD=una-contraseña-larga-1
ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXP   # base32; agrégalo a Google Authenticator / Authy
```

Después, desde **Gestión** en el portal de análisis, ese superadmin crea más administradores. El secreto 2FA de cada cuenta nueva se muestra una sola vez. Con `DEMO_MODE=0` se desactivan las cuentas de prueba y los códigos visibles.

## Estructura

```
backend/
  main.py                 FastAPI: /health, routers, cabeceras de seguridad, carga al arrancar
  lib/auth.py             scrypt, JWT HS256 por portal, cookies, CSRF, TOTP, límite de intentos
  lib/data_loader.py      detección, lectura, validación, normalización y reporte de calidad de /data
  lib/analytics.py        estadísticas de equipo, jugadores por área, campo, modelo y comparativo
  lib/mercados.py         mercados y cuotas simuladas (deterministas por tiempo)
  lib/fuentes_externas.py ingesta ESPN con caché, timeout y fecha de consulta
  lib/store.py            almacén en memoria (usuarios, apuestas, accesos)
  routes/                 auth_rutas.py, apuestas.py, admin.py
dashboard/src/
  app/apuestas/           login, registro, mercados, boleto, panel del usuario
  app/admin/              login 2FA y módulos del análisis
  components/charts/      contenedor de gráficas didácticas (Recharts)
  components/field/       campo SVG a escala y plantillas de formación
  lib/                    api, router por hash, preferencias, glosario, cuotas
data/                     archivos de datos (solo lectura)
```

## Seguridad y separación de portales

- Cada portal tiene su cookie de sesión: `gmx_usr_session` o `gmx_adm_session`, con `httpOnly`, `Secure` y `SameSite=Strict`. Los JWT tienen claims `rol` y `aud` distintos y se firman con secretos derivados por portal.
- La autorización está en el servidor (`auth.exigir(portal)`). Un `usuario` que llama a `/api/admin/*` recibe **403** y el frontend lo redirige a `#/apuestas`. Un `admin` que llama a `/api/apuestas/*` (incluido apostar) recibe **403** y vuelve a `#/admin/analisis`.
- CSRF de doble envío: una cookie legible `*_csrf` más la cabecera `X-CSRF-Token` en todo POST autenticado.
- Contraseñas con **scrypt** (`hashlib`). bcrypt y argon2 requieren dependencias fuera del stack del hackathon.
- Tras 5 intentos fallidos en 15 minutos, por correo o por IP, se bloquea el acceso (429). Los accesos e intentos no autorizados quedan en el registro visible en **Gestión**.
- El servidor es efímero: usuarios y apuestas viven en memoria y se reinician con el servidor.

## Archivo de datos

### Detección

Al arrancar, `data_loader` recorre `data/` (o la ruta de `DATA_FILE_PATH`, que puede ser un archivo o una carpeta). Lee CSV y JSON; Excel solo funciona si pandas tiene `openpyxl`, que no está en el stack. Cada archivo se reconoce por sus columnas, no por su nombre. Los archivos `tracking_*.csv` se omiten para que el arranque sea rápido.

### Validación

Para cada archivo revisa las columnas obligatorias y los tipos numéricos, y cuenta los valores inválidos. También lista las columnas no reconocidas y normaliza equipos (`Vikings`, `Minnesota Vikings` → `MIN`; `49ers`, `SFO` → `SF`), posiciones (`HB` → `RB`) y nombres. El reporte de calidad aparece en **Gestión**. Si no hay jugadas válidas, toda la app usa datos de **DEMOSTRACIÓN** con etiqueta visible.

### Esquema esperado

Los alias en español también se aceptan: `partido_id`, `equipo`, `distancia`, `yardas_ganadas`, etc.

| Tabla interna | Columnas obligatorias | Opcionales útiles |
|---|---|---|
| `jugadas` (play-by-play) | `gameId`, `playId`, `possessionTeam`, `down`, `yardsToGo`, `playResult` | `defensiveTeam`, `week`, `passResult` (C/I/S/IN/R), `playDescription`, `yardlineSide`, `yardlineNumber`, `offenseFormation`, `prePenaltyPlayResult` |
| `partidos` | `gameId`, `homeTeamAbbr`, `visitorTeamAbbr` | `week`, `season`, `gameDate` |
| `jugadores` | `nflId`, `displayName` | `officialPosition` |
| `participacion` (PFF) | `gameId`, `playId`, `nflId`, `pff_role` | `pff_positionLinedUp`, `pff_sack`, `pff_hit`, `pff_hurry`, `pff_*Allowed` |
| `estadisticas_jugador` | `nombre`, `equipo`, `posicion` | `yardas_tierra`, `acarreos`, `td`, `fg_hechos`, `fg_intentos`, `yardas_despeje`, `despejes`, `tackleos` |
| `formacion` | `nombre`, `equipo`, `unidad`, `x`, `y` | |

Ejemplo de JSON con varias tablas (también puede ser una lista de registros):

```json
{
  "jugadas": [
    {"partido_id": 1, "jugada_id": 1, "semana": 1, "equipo": "Vikings", "equipo_defensivo": "49ers",
     "down": 3, "distancia": 7, "yardas_ganadas": 12, "resultado": "C",
     "descripcion": "K.Cousins pass short left to J.Jefferson for 12 yards"}
  ],
  "estadisticas_jugador": [
    {"nombre": "RB Ejemplo", "equipo": "MIN", "posicion": "RB", "yardas_tierra": 540, "acarreos": 118, "td": 4}
  ]
}
```

### Qué cubre el archivo incluido

El archivo es el NFL Big Data Bowl de la temporada 2021, semanas 1 a 8, y solo contiene jugadas de pase. Con él se calcula:

- Pase, tercer down, zona roja, jugadas explosivas, penalizaciones y tendencias por semana.
- QB, receptores, línea ofensiva (presión permitida) y defensa: capturas y presiones de PFF; tackleos, intercepciones y pases defendidos (aproximados a partir de la descripción de la jugada).
- Mapa de calor por dirección del pase.

No trae carreras, pateadores, YAC, lesiones ni coordenadas. Esas áreas se marcan **demo** o **plantilla**, y se llenan solas al cargar un archivo que tenga esas columnas. Las ubicaciones del campo salen de plantillas estándar de formación con los jugadores más frecuentes en cada posición (`pff_positionLinedUp`), y se indican como ilustrativas.

## Modelo de probabilidad

El modelo calcula la fuerza de cada equipo como yardas por jugada de pase en ataque menos las permitidas en defensa, comparadas con el promedio de la liga. Esa diferencia se convierte en puntos (aprox. 2.6 puntos por yarda) y se suma una localía designada de +0.6 puntos. Después simula 10,000 partidos: el margen sigue una distribución normal con σ = 13.5 y el total una con σ = 13. El intervalo del 90 % sale de remuestrear partidos. Son estimaciones, no garantías.

## Fuentes externas

`fuentes_externas.py` consulta el récord en ESPN con un timeout de 4 s y una caché de 30 minutos, y guarda la fecha de consulta. Si la consulta falla, la app sigue funcionando con el archivo local. Si el récord no coincide con el número de partidos del archivo, la app lo señala como discrepancia. Se desactiva con `EXTERNAL_SOURCES=0`.

## Desviaciones del prompt original (por las reglas del stack)

- Next.js, Node y PostgreSQL se sustituyen por React + Vite (frontend) y FastAPI + almacenamiento en memoria (backend), que es el stack fijo y el servidor efímero del evento.
- Las rutas usan hash (`#/apuestas`) porque la app se publica en una subruta.
- Las contraseñas usan scrypt en lugar de bcrypt o argon2, y no se envían correos reales: en modo demo el código de verificación aparece en pantalla.
- El PDF se genera con el diálogo de impresión del navegador ("Guardar como PDF").
