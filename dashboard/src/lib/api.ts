/**
 * Cliente de la API. Rutas SIEMPRE relativas y sin diagonal inicial ('api/...') porque la app
 * se publica en una subruta. Cada portal envía su propio token CSRF (cookie legible + cabecera).
 */
export type Portal = 'usuario' | 'admin'

export class ErrorApi extends Error {
  constructor(public estado: number, mensaje: string, public redirigir?: string, public datos?: unknown) {
    super(mensaje)
  }
}

function leerCookie(nombre: string): string {
  const m = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

const CSRF: Record<Portal, string> = { usuario: 'gmx_usr_csrf', admin: 'gmx_adm_csrf' }

export async function api<T = any>(ruta: string, opciones: { portal?: Portal; metodo?: string; cuerpo?: unknown; crudo?: BodyInit; cabeceras?: Record<string, string> } = {}): Promise<T> {
  const metodo = opciones.metodo ?? (opciones.cuerpo !== undefined || opciones.crudo !== undefined ? 'POST' : 'GET')
  const cabeceras: Record<string, string> = { ...(opciones.cabeceras ?? {}) }
  if (opciones.cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json'
  if (opciones.portal && metodo !== 'GET') cabeceras['X-CSRF-Token'] = leerCookie(CSRF[opciones.portal])
  let r: Response
  try {
    r = await fetch(`api/${ruta}`, {
      method: metodo, headers: cabeceras, credentials: 'same-origin',
      body: opciones.crudo ?? (opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined),
    })
  } catch {
    throw new ErrorApi(0, 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }
  const tipo = r.headers.get('content-type') ?? ''
  const datos = tipo.includes('json') ? await r.json().catch(() => null) : await r.text()
  if (!r.ok) {
    const det = (datos as any)?.detail
    const mensaje = typeof det === 'string' ? det : det?.mensaje ?? (Array.isArray(det) ? 'Revisa los datos del formulario.' : 'Algo salió mal. Inténtalo de nuevo.')
    throw new ErrorApi(r.status, mensaje, det?.redirigir, det)
  }
  return datos as T
}
