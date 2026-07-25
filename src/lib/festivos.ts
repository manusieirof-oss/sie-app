// Festivos calculados por año: nacionales (fijos) + Viernes Santo (Pascua) +
// autonómicos de Galicia. Los LOCALES de Poio (que cambian cada año) y cualquier
// cambio se gestionan desde Ajustes (eventos de calendario).
// tipo: 'nacional' | 'autonomico' | 'local'

export type TipoFestivo = 'nacional' | 'autonomico' | 'local'
export interface Festivo { nombre: string; tipo: TipoFestivo }

export const COLOR_FESTIVO: Record<TipoFestivo, string> = {
  nacional: '#B05A5A',    // rojo
  autonomico: '#C9A84C',  // ámbar
  local: '#9E4E74',       // rosa
}
export const LABEL_FESTIVO: Record<TipoFestivo, string> = {
  nacional: 'Nacional', autonomico: 'Galicia', local: 'Poio',
}

const iso = (y:number,m:number,d:number) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

// Domingo de Pascua (algoritmo de Meeus/Butcher, calendario gregoriano)
function pascua(year:number): { m:number, d:number } {
  const a=year%19, b=Math.floor(year/100), c=year%100, d=Math.floor(b/4), e=b%4
  const f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3), h=(19*a+b-d-g+15)%30
  const i=Math.floor(c/4), k=c%4, l=(32+2*e+2*i-h-k)%7, mm=Math.floor((a+11*h+22*l)/451)
  const month=Math.floor((h+l-7*mm+114)/31), day=((h+l-7*mm+114)%31)+1
  return { m:month, d:day }
}
function viernesSanto(year:number): string {
  const p=pascua(year); const dt=new Date(Date.UTC(year, p.m-1, p.d)); dt.setUTCDate(dt.getUTCDate()-2)
  return dt.toISOString().slice(0,10)
}

function construirAnio(year:number): Record<string, Festivo> {
  const map: Record<string, Festivo> = {}
  // Nacionales (fecha fija)
  map[iso(year,1,1)]   = { nombre:'Año Nuevo', tipo:'nacional' }
  map[iso(year,1,6)]   = { nombre:'Reyes', tipo:'nacional' }
  map[iso(year,5,1)]   = { nombre:'Día del Trabajo', tipo:'nacional' }
  map[iso(year,8,15)]  = { nombre:'Asunción', tipo:'nacional' }
  map[iso(year,10,12)] = { nombre:'Fiesta Nacional', tipo:'nacional' }
  map[iso(year,11,1)]  = { nombre:'Todos los Santos', tipo:'nacional' }
  map[iso(year,12,6)]  = { nombre:'Constitución', tipo:'nacional' }
  map[iso(year,12,8)]  = { nombre:'Inmaculada', tipo:'nacional' }
  map[iso(year,12,25)] = { nombre:'Navidad', tipo:'nacional' }
  // Nacional variable (Semana Santa)
  map[viernesSanto(year)] = { nombre:'Viernes Santo', tipo:'nacional' }
  // Autonómicos de Galicia
  map[iso(year,3,19)]  = { nombre:'San Xosé', tipo:'autonomico' }
  map[iso(year,6,24)]  = { nombre:'San Xoán', tipo:'autonomico' }
  map[iso(year,7,25)]  = { nombre:'Día de Galicia', tipo:'autonomico' }
  return map
}

// Locales de Poio conocidos (opcional; también editables desde Ajustes).
const LOCALES: Record<string, Festivo> = {
  '2026-08-17': { nombre:'Galicia Mártir', tipo:'local' },
  '2026-09-24': { nombre:'Virxe da Mercé', tipo:'local' },
}

const cache: Record<number, Record<string, Festivo>> = {}
function anio(year:number) { if (!cache[year]) cache[year] = construirAnio(year); return cache[year] }

export const festivoDe = (fechaISO: string): Festivo | null => {
  const year = parseInt(fechaISO.slice(0,4))
  if (!year) return null
  return anio(year)[fechaISO] || LOCALES[fechaISO] || null
}
