/**
 * Plantillas estándar de formación. Coordenadas en yardas relativas a la línea de golpeo:
 *  dx: distancia desde la línea (+ hacia el campo rival), y: 0 a 53.3 (ancho del campo).
 * Cada lugar indica el grupo de posición del que se toma el jugador (QB, WR, DE...) y su índice.
 */
export type Lugar = { slot: string; grupo: string; i: number; dx: number; y: number; etiqueta: string }
export type Formacion = { id: string; nombre: string; descripcion: string; lugares: Lugar[] }

const C = 26.65
const linea: Lugar[] = [
  { slot: 'LT', grupo: 'LT', i: 0, dx: -1, y: C - 3.6, etiqueta: 'LT' },
  { slot: 'LG', grupo: 'LG', i: 0, dx: -0.8, y: C - 1.8, etiqueta: 'LG' },
  { slot: 'C', grupo: 'C', i: 0, dx: -0.6, y: C, etiqueta: 'C' },
  { slot: 'RG', grupo: 'RG', i: 0, dx: -0.8, y: C + 1.8, etiqueta: 'RG' },
  { slot: 'RT', grupo: 'RT', i: 0, dx: -1, y: C + 3.6, etiqueta: 'RT' },
]
const L = (slot: string, grupo: string, i: number, dx: number, y: number, etiqueta = grupo): Lugar => ({ slot, grupo, i, dx, y, etiqueta })

export const OFENSIVAS: Formacion[] = [
  { id: 'shotgun', nombre: 'Shotgun', descripcion: 'El QB recibe a 5 yardas de la línea: más tiempo para ver y lanzar.', lugares: [...linea,
    L('QB', 'QB', 0, -5, C), L('RB', 'RB', 0, -5, C + 2.2), L('TE', 'TE', 0, -1.2, C + 5.6), L('WR1', 'WR', 0, -0.8, 5), L('WR2', 'WR', 1, -0.8, 48), L('WR3', 'WR', 2, -1.6, 13)] },
  { id: 'i_form', nombre: 'I-Formation', descripcion: 'QB, fullback y corredor en fila: formación clásica para correr.', lugares: [...linea,
    L('QB', 'QB', 0, -1.3, C), L('WR3', 'FB', 0, -4, C, 'FB'), L('RB', 'RB', 0, -7, C), L('TE', 'TE', 0, -1.2, C + 5.6), L('WR1', 'WR', 0, -0.8, 6), L('WR2', 'WR', 1, -0.8, 47)] },
  { id: 'singleback', nombre: 'Singleback', descripcion: 'Un solo corredor detrás del QB; equilibrio entre pase y carrera.', lugares: [...linea,
    L('QB', 'QB', 0, -1.3, C), L('RB', 'RB', 0, -6.5, C), L('TE', 'TE', 0, -1.2, C + 5.6), L('WR1', 'WR', 0, -0.8, 5), L('WR2', 'WR', 1, -0.8, 48), L('WR3', 'WR', 2, -1.6, 14)] },
  { id: 'spread', nombre: 'Spread / Empty', descripcion: 'Cinco receptores abiertos a lo ancho: estira a la defensa para pasar.', lugares: [...linea,
    L('QB', 'QB', 0, -5, C), L('RB', 'WR', 3, -1.6, 40, 'WR'), L('TE', 'TE', 0, -1.6, C + 7), L('WR1', 'WR', 0, -0.8, 4), L('WR2', 'WR', 1, -0.8, 49), L('WR3', 'WR', 2, -1.6, 12)] },
  { id: 'pistol', nombre: 'Pistol', descripcion: 'QB a 4 yardas y corredor justo detrás: permite engañar con carrera o pase.', lugares: [...linea,
    L('QB', 'QB', 0, -3.8, C), L('RB', 'RB', 0, -7, C), L('TE', 'TE', 0, -1.2, C - 5.6), L('WR1', 'WR', 0, -0.8, 6), L('WR2', 'WR', 1, -0.8, 47), L('WR3', 'WR', 2, -1.6, 39)] },
]

export const DEFENSIVAS: Formacion[] = [
  { id: '43', nombre: '4-3', descripcion: '4 linieros y 3 apoyadores: defensa base equilibrada contra la carrera.', lugares: [
    L('D1', 'DE', 0, 1, C - 4.2), L('D2', 'DT', 0, 1, C - 1.2), L('D3', 'DT', 1, 1, C + 1.2), L('D4', 'DE', 1, 1, C + 4.2),
    L('D5', 'LB', 0, 4.5, C - 4.5), L('D6', 'LB', 1, 4.5, C), L('D7', 'LB', 2, 4.5, C + 4.5),
    L('D8', 'CB', 0, 6, 5), L('D9', 'CB', 1, 6, 48), L('D10', 'FS', 0, 13, C - 6), L('D11', 'SS', 0, 10, C + 7)] },
  { id: '34', nombre: '3-4', descripcion: '3 linieros y 4 apoyadores: más velocidad para presionar desde fuera.', lugares: [
    L('D1', 'DE', 0, 1, C - 2.8), L('D2', 'DT', 0, 1, C), L('D4', 'DE', 1, 1, C + 2.8),
    L('D3', 'DE', 2, 1.5, C - 6.2, 'OLB'), L('D5', 'LB', 0, 4.5, C - 2.2), L('D6', 'LB', 1, 4.5, C + 2.2), L('D7', 'DE', 3, 1.5, C + 6.2, 'OLB'),
    L('D8', 'CB', 0, 6, 5), L('D9', 'CB', 1, 6, 48), L('D10', 'FS', 0, 13, C - 6), L('D11', 'SS', 0, 10, C + 7)] },
  { id: 'nickel', nombre: 'Nickel (4-2-5)', descripcion: 'Cambia un apoyador por un 5.º defensivo (NB) para cubrir más pases.', lugares: [
    L('D1', 'DE', 0, 1, C - 4.2), L('D2', 'DT', 0, 1, C - 1.2), L('D3', 'DT', 1, 1, C + 1.2), L('D4', 'DE', 1, 1, C + 4.2),
    L('D5', 'LB', 0, 4.5, C - 2.5), L('D6', 'LB', 1, 4.5, C + 2.5), L('D7', 'NB', 0, 4, 13, 'NB'),
    L('D8', 'CB', 0, 6, 5), L('D9', 'CB', 1, 6, 48), L('D10', 'FS', 0, 13, C - 6), L('D11', 'SS', 0, 11, C + 7)] },
  { id: 'dime', nombre: 'Dime (4-1-6)', descripcion: 'Seis defensivos de cobertura: se usa cuando se espera un pase largo.', lugares: [
    L('D1', 'DE', 0, 1, C - 4.2), L('D2', 'DT', 0, 1, C - 1.2), L('D3', 'DT', 1, 1, C + 1.2), L('D4', 'DE', 1, 1, C + 4.2),
    L('D5', 'LB', 0, 5, C), L('D6', 'NB', 1, 5, 40, 'NB'), L('D7', 'NB', 0, 4, 13, 'NB'),
    L('D8', 'CB', 0, 7, 5), L('D9', 'CB', 1, 7, 48), L('D10', 'FS', 0, 15, C - 7), L('D11', 'SS', 0, 15, C + 7)] },
]

// Equipos especiales: despeje (equipo que patea) contra regreso. Nombres de K/P/LS no están en el archivo.
export const ESPECIALES_PATEA: Formacion = { id: 'punt', nombre: 'Despeje (punt)', descripcion: 'El equipo patea el balón lejos para alejar al rival de su zona.', lugares: [
  L('LS', 'C', 0, -0.6, C, 'LS'), L('G1', 'LG', 0, -0.8, C - 1.8, 'G'), L('G2', 'RG', 0, -0.8, C + 1.8, 'G'), L('T1', 'LT', 0, -1, C - 3.6, 'T'), L('T2', 'RT', 0, -1, C + 3.6, 'T'),
  L('W1', 'TE', 0, -2, C - 5.2, 'W'), L('W2', 'TE', 1, -2, C + 5.2, 'W'), L('GU1', 'WR', 0, -0.8, 4, 'GUN'), L('GU2', 'WR', 1, -0.8, 49, 'GUN'),
  L('PP', 'RB', 0, -6, C, 'PP'), L('P', '_P', 0, -14, C, 'P')] }
export const ESPECIALES_REGRESA: Formacion = { id: 'retorno', nombre: 'Regreso de despeje', descripcion: 'El equipo que recibe bloquea para que su regresador avance.', lugares: [
  L('R1', 'DE', 0, 1, C - 4), L('R2', 'DT', 0, 1, C - 1.3), L('R3', 'DT', 1, 1, C + 1.3), L('R4', 'DE', 1, 1, C + 4),
  L('R5', 'LB', 0, 5, C - 3), L('R6', 'LB', 1, 5, C + 3), L('R7', 'CB', 0, 1, 5), L('R8', 'CB', 1, 1, 48), L('R9', 'NB', 0, 3, 9), L('R10', 'NB', 1, 3, 44),
  L('R11', '_PR', 0, 40, C, 'PR')] }

/** Qué hace cada posición, para la guía "Cómo leer el campo". */
export const ROLES: Record<string, string> = {
  QB: 'Quarterback: recibe el balón y decide si pasa o lo entrega.', RB: 'Corredor: corre con el balón o atrapa pases cortos.', FB: 'Fullback: bloquea para abrir camino al corredor.',
  WR: 'Receptor: corre rutas para atrapar pases.', TE: 'Ala cerrada: bloquea y también atrapa pases.', LT: 'Tackle izquierdo: protege el lado ciego del QB.',
  LG: 'Guardia izquierdo: bloquea en el centro de la línea.', C: 'Centro: entrega el balón al QB y bloquea.', RG: 'Guardia derecho: bloquea en el centro de la línea.',
  RT: 'Tackle derecho: protege el lado derecho del QB.', DE: 'Ala defensiva: ataca al QB desde fuera.', DT: 'Tackle defensivo: frena la carrera por el centro.',
  OLB: 'Apoyador exterior: presiona al QB o cubre.', LB: 'Apoyador: taclea y cubre pases cortos.', NB: 'Nickelback: defensivo extra que cubre al receptor del centro.',
  CB: 'Esquinero: cubre a los receptores abiertos.', FS: 'Safety libre: protege contra pases largos.', SS: 'Safety fuerte: ayuda contra la carrera y pases medios.',
  LS: 'Centro largo: envía el balón al pateador.', P: 'Despejador: patea el balón lejos.', PP: 'Protector personal del despejador.', GUN: 'Artillero: corre a taclear al regresador.',
  W: 'Ala de protección en el despeje.', G: 'Guardia (equipos especiales).', T: 'Tackle (equipos especiales).', PR: 'Regresador: atrapa el despeje y corre.',
}
