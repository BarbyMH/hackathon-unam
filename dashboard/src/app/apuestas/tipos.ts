export type Opcion = { id: string; etiqueta: string; sub: string; cuota: number; tendencia: 'sube' | 'baja' | null }
export type Mercado = { id: string; cat: string; titulo: string; ayuda: string; termino: string; mejorado: boolean; opciones: Opcion[] }
export type Seleccion = { id: string; mercadoId: string; mercado: string; etiqueta: string; cuota: number }
export type Apuesta = { id: string; selecciones: { etiqueta: string; mercado: string; cuota: number }[]; tipo: string; monto: number; cuota_decimal: number; pago_potencial: number; estado: string; creada: number }
export type Cuenta = {
  nombre: string; saldo: number; limite_deposito_diario: number; depositado_hoy: number; autoexcluido_hasta: number | null
  apuestas: Apuesta[]; movimientos: { t: number; tipo: string; monto: number }[]
}
