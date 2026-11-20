/** Datos fijos del único evento de la plataforma. */
export const EVENTO = {
  nombre: 'NFL Mexico City Game 2026',
  visitante: { abrev: 'MIN', nombre: 'Minnesota Vikings', corto: 'Vikings' },
  local: { abrev: 'SF', nombre: 'San Francisco 49ers', corto: '49ers' },
  // Domingo 22 de noviembre de 2026, 7:20 p.m. hora CDMX (UTC-6) = 8:20 p.m. ET
  kickoff: new Date('2026-11-22T19:20:00-06:00'),
  sede: 'Estadio Banorte (Estadio Azteca), Ciudad de México',
  detalle: 'Semana 11 · Sunday Night Football',
}

export const COLOR_EQUIPO: Record<string, { base: string; acento: string; nombre: string }> = {
  MIN: { base: '#4F2683', acento: '#FFC62F', nombre: 'Vikings' },
  SF: { base: '#AA0000', acento: '#B3995D', nombre: '49ers' },
}
