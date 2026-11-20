/** Módulos 8 y 9 · Exportación y gestión: calidad de datos, carga de archivo, usuarios, actividad y accesos. */
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api, ErrorApi } from '../../lib/api'
import { pesos } from '../../lib/cuotas'
import { usePrefs } from '../../lib/preferencias'
import { Cargando, VerMas } from '../../components/ui'

export function ModExportar() {
  const { avisar } = usePrefs()
  return (
    <section id="exportar" aria-labelledby="t-exp" className="no-imprimir scroll-mt-20 space-y-3">
      <h2 id="t-exp" className="titular text-3xl text-nfl-navy">8 · Exportación</h2>
      <div className="tarjeta flex flex-wrap items-center gap-3 p-5">
        <a className="btn-navy" href="api/admin/exportar.csv" download onClick={() => avisar('Descargando CSV…', 'info')}><span aria-hidden>⬇</span> Descargar CSV</a>
        <button className="btn-rojo" onClick={() => window.print()}><span aria-hidden>🖨</span> Descargar PDF</button>
        <p className="text-sm text-slate-600">El PDF usa el diálogo de impresión del navegador: elige "Guardar como PDF".</p>
      </div>
    </section>
  )
}

export function ModGestion({ superadmin, alCambiarDatos }: { superadmin: boolean; alCambiarDatos: () => void }) {
  const { avisar } = usePrefs()
  const [calidad, setCalidad] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<any>(null)
  const [actividad, setActividad] = useState<any>(null)
  const [accesos, setAccesos] = useState<any[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', password: '' })
  const [secreto, setSecreto] = useState('')

  const cargar = useCallback(async () => {
    try {
      const [c, u, ac, lg] = await Promise.all([api('admin/calidad-datos'), api('admin/usuarios'), api('admin/actividad'), api('admin/accesos')])
      setCalidad(c); setUsuarios(u); setActividad(ac); setAccesos(lg.registros)
    } catch (e) { avisar((e as ErrorApi).message, 'error') }
  }, [avisar])
  useEffect(() => { cargar() }, [cargar])

  const subir = async (archivo: File) => {
    setSubiendo(true)
    try {
      const r = await api('admin/datos', { portal: 'admin', crudo: archivo, cabeceras: { 'X-Nombre-Archivo': encodeURIComponent(archivo.name), 'Content-Type': 'application/octet-stream' } })
      setCalidad(r); alCambiarDatos(); avisar(r.es_demo ? 'El archivo no tiene jugadas válidas: se usan datos de demostración.' : 'Archivo cargado y validado.', r.es_demo ? 'error' : 'exito')
    } catch (e) { avisar((e as ErrorApi).message, 'error') } finally { setSubiendo(false) }
  }
  const recargar = async () => {
    try { setCalidad(await api('admin/datos/recargar', { portal: 'admin', metodo: 'POST' })); alCambiarDatos(); avisar('Datos de /data recargados.', 'exito') }
    catch (e) { avisar((e as ErrorApi).message, 'error') }
  }
  const crearAdmin = async (e: FormEvent) => {
    e.preventDefault()
    try { const r = await api('admin/administradores', { portal: 'admin', cuerpo: nuevo }); setSecreto(r.totp_secreto); setNuevo({ nombre: '', email: '', password: '' }); cargar() }
    catch (err) { avisar((err as ErrorApi).message, 'error') }
  }

  if (!calidad) return <Cargando texto="Cargando gestión…" />
  return (
    <section id="gestion" aria-labelledby="t-gestion" className="no-imprimir scroll-mt-20 space-y-4">
      <h2 id="t-gestion" className="titular text-3xl text-nfl-navy">9 · Gestión</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="tarjeta p-5">
          <p className="titular text-xl text-nfl-navy">Calidad de datos</p>
          {calidad.es_demo && <p role="alert" className="mt-2 rounded-lg border border-nfl-red bg-red-50 p-3 text-sm font-semibold text-nfl-red">⚠ No hay un archivo de datos válido. Se usan datos de DEMOSTRACIÓN.</p>}
          {calidad.avisos?.map((x: string) => <p key={x} className="mt-2 text-sm text-amber-900">⚠ {x}</p>)}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-nfl-light p-2"><dt className="text-xs text-slate-600">Filas leídas</dt><dd className="font-mono text-lg font-bold">{calidad.filas_totales.toLocaleString('es-MX')}</dd></div>
            <div className="rounded-lg bg-nfl-light p-2"><dt className="text-xs text-slate-600">Errores</dt><dd className="font-mono text-lg font-bold">{calidad.errores_totales}</dd></div>
            <div className="rounded-lg bg-nfl-light p-2"><dt className="text-xs text-slate-600">Archivos</dt><dd className="font-mono text-lg font-bold">{calidad.archivos.length}</dd></div>
          </dl>
          <p className="mt-3 text-sm font-bold text-nfl-navy">Módulos</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">{Object.entries(calidad.modulos).map(([k, v]) => <li key={k} className={`rounded-md px-2 py-0.5 font-mono text-xs ${v === 'archivo' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>{v === 'archivo' ? '✓' : '⚠'} {k}: {String(v)}</li>)}</ul>
          <VerMas etiqueta="Ver detalle por archivo">
            <table className="w-full text-xs"><thead><tr className="text-left font-mono uppercase text-nfl-navy"><th>Archivo</th><th>Tabla</th><th>Filas</th><th>Notas</th></tr></thead>
              <tbody className="divide-y divide-nfl-border">{calidad.archivos.map((x: any) => <tr key={x.archivo + x.tabla}><td className="break-all py-1 font-mono">{x.archivo}</td><td>{x.tabla ?? '—'}</td><td className="font-mono">{x.filas ?? '—'}</td>
                <td>{[...(x.errores ?? []), ...(x.columnas_faltantes?.length ? [`Faltan: ${x.columnas_faltantes.join(', ')}`] : []), ...(x.columnas_no_reconocidas?.length ? [`No reconocidas: ${x.columnas_no_reconocidas.slice(0, 6).join(', ')}`] : []), x.nota].filter(Boolean).join(' · ') || 'OK'}</td></tr>)}</tbody></table>
          </VerMas>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="btn-navy cursor-pointer text-sm">{subiendo ? 'Procesando…' : 'Cargar archivo (CSV/JSON)'}
              <input type="file" accept=".csv,.json,.xlsx" className="sr-only" disabled={subiendo} onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = '' }} /></label>
            <button className="btn-claro text-sm" onClick={recargar}>Recargar /data</button>
          </div>
          <p className="mt-2 text-xs text-slate-600">El archivo cargado reemplaza los datos en memoria (no se guarda en disco). "Recargar /data" vuelve a los archivos del proyecto.</p>
        </div>

        <div className="tarjeta p-5">
          <p className="titular text-xl text-nfl-navy">Actividad de apuestas (agregada)</p>
          {actividad && <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[['Apuestas', actividad.apuestas], ['Monto total', pesos(actividad.monto_total)], ['Combinadas', actividad.combinadas], ['Usuarios activos', actividad.usuarios_activos]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-nfl-light p-2"><dt className="text-xs text-slate-600">{k}</dt><dd className="font-mono font-bold">{v}</dd></div>)}
          </dl>}
          <p className="mt-3 text-sm font-bold text-nfl-navy">Selecciones más populares</p>
          <ul className="mt-1 text-sm">{actividad?.selecciones_populares.length ? actividad.selecciones_populares.map((s: any) => <li key={s.seleccion} className="flex justify-between border-b border-nfl-border py-1"><span>{s.seleccion}</span><span className="font-mono">{s.veces}</span></li>) : <li className="text-slate-600">Aún no hay apuestas.</li>}</ul>
          <button className="btn-claro mt-3 text-sm" onClick={cargar}>Actualizar</button>
        </div>

        <div className="tarjeta p-5">
          <p className="titular text-xl text-nfl-navy">Usuarios de la plataforma</p>
          <div className="mt-2 max-h-64 overflow-y-auto"><table className="w-full text-sm"><thead><tr className="text-left font-mono text-[11px] uppercase text-nfl-navy"><th>Nombre</th><th>Correo</th><th>Verificado</th><th>Saldo</th></tr></thead>
            <tbody className="divide-y divide-nfl-border">{usuarios?.usuarios.map((u: any) => <tr key={u.id}><td className="py-1">{u.nombre}{u.autoexcluido && <span className="ml-1 rounded bg-red-100 px-1 text-xs text-nfl-red">autoexcluido</span>}</td><td className="break-all">{u.email}</td><td>{u.verificado ? '✓ Sí' : '✗ No'}</td><td className="font-mono">{pesos(u.saldo)}</td></tr>)}</tbody></table></div>
          <p className="mt-3 text-sm font-bold text-nfl-navy">Administradores</p>
          <ul className="text-sm">{usuarios?.administradores.map((a: any) => <li key={a.id}>{a.nombre} · {a.email}{a.superadmin ? ' · superadmin' : ''}</li>)}</ul>
          {superadmin && (
            <form onSubmit={crearAdmin} className="mt-3 grid gap-2 rounded-xl bg-nfl-light p-3">
              <p className="text-sm font-bold">Crear administrador (solo superadmin)</p>
              <label className="sr-only" htmlFor="na-n">Nombre</label><input id="na-n" required placeholder="Nombre" className="campo-form" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
              <label className="sr-only" htmlFor="na-e">Correo</label><input id="na-e" required type="email" placeholder="Correo" className="campo-form" value={nuevo.email} onChange={e => setNuevo({ ...nuevo, email: e.target.value })} />
              <label className="sr-only" htmlFor="na-p">Contraseña</label><input id="na-p" required type="password" minLength={10} placeholder="Contraseña (mín. 10)" className="campo-form" value={nuevo.password} onChange={e => setNuevo({ ...nuevo, password: e.target.value })} />
              <button className="btn-navy text-sm">Crear</button>
              {secreto && <p className="rounded-lg border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900">Secreto 2FA (se muestra una sola vez): <code className="break-all font-mono">{secreto}</code></p>}
            </form>
          )}
        </div>

        <div className="tarjeta p-5">
          <p className="titular text-xl text-nfl-navy">Registro de accesos</p>
          <div className="mt-2 max-h-80 overflow-y-auto"><table className="w-full text-xs"><thead><tr className="text-left font-mono uppercase text-nfl-navy"><th>Hora</th><th>Portal</th><th>Evento</th><th>Correo / detalle</th></tr></thead>
            <tbody className="divide-y divide-nfl-border">{accesos.map((x, i) => <tr key={i} className={x.ok ? '' : 'bg-red-50'}><td className="py-1 font-mono">{new Date(x.t * 1000).toLocaleTimeString('es-MX')}</td><td>{x.portal}</td><td>{x.ok ? '✓' : '⚠'} {x.evento}</td><td className="break-all">{x.email || x.detalle}</td></tr>)}</tbody></table></div>
        </div>
      </div>
    </section>
  )
}
