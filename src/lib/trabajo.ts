/**
 * CÓMO SE MIDE EL TRABAJO (Ajustes › Entrenador).
 *
 * Para poder decir "este paciente dedica el 30 % al hombro" hace falta una unidad
 * común entre un 3×10 y una plancha de 45 s: los SEGUNDOS DE TRABAJO EFECTIVO.
 *   · Por repeticiones: reps × segundos por repetición. La repetición dura la suma de
 *     sus ejecuciones (concéntrico 2 s + excéntrico 4 s = 6 s), porque son combinables.
 *   · Por tiempo: los segundos de la serie. Si es "aguanta lo que puedas" y no se
 *     apuntó cuánto, se usa el valor por defecto y queda marcado como estimado.
 *   · El descanso no cuenta (se puede encender).
 *
 * Las intensidades dicen PARA QUÉ es el trabajo (fuerza máxima, movilidad, equilibrio…)
 * y con qué reps/tiempo suele hacerse. Las ejecuciones dicen CÓMO se hace.
 * Todo es editable: aquí solo están los valores de partida.
 */

export type FamiliaIntensidad =
  | 'fuerza' | 'potencia' | 'movilidad' | 'estiramiento' | 'equilibrio' | 'control' | 'respiracion' | 'liberacion'

export const FAMILIAS: [FamiliaIntensidad, string][] = [
  ['fuerza', 'Fuerza'], ['potencia', 'Potencia'], ['movilidad', 'Movilidad'], ['estiramiento', 'Estiramiento'],
  ['equilibrio', 'Equilibrio'], ['control', 'Control motor'], ['respiracion', 'Respiración'], ['liberacion', 'Liberación'],
]

export interface Intensidad {
  id: string
  nombre: string
  familia: FamiliaIntensidad
  repsMin?: number | null
  repsMax?: number | null          // vacío = sin tope ("21 o más")
  segMin?: number | null
  segMax?: number | null
  descanso?: number | null         // segundos sugeridos entre series
  carga: boolean                   // si suma como carga en el mapa (un masaje pinta la zona, pero no es carga)
  color: string
}

export interface Ejecucion {
  id: string
  nombre: string
  grupo: 'fuerza' | 'estiramiento'
  segRep: number | null            // segundos por repetición; null = se mide por tiempo
}

export interface ConfigTrabajo {
  v: 1
  intensidades: Intensidad[]
  ejecuciones: Ejecucion[]
  aguantaSeg: number               // "aguanta lo que puedas" sin tiempo apuntado
  segRepDefecto: number            // reps sin ejecución elegida
  contarDescanso: boolean
}

export const CONFIG_DEFECTO: ConfigTrabajo = {
  v: 1,
  // Los cinco primeros son los de capacidades.ts (mismos tramos y descansos), para que
  // lo que ya hay en las sesiones encaje sin tocar nada.
  intensidades: [
    { id: 'fmax', nombre: 'Fuerza máxima', familia: 'fuerza', repsMin: 1, repsMax: 3, descanso: 240, carga: true, color: '#7a1f2b' },
    { id: 'fuerza', nombre: 'Fuerza', familia: 'fuerza', repsMin: 4, repsMax: 6, descanso: 180, carga: true, color: '#b23a3a' },
    { id: 'hiper', nombre: 'Hipertrofia', familia: 'fuerza', repsMin: 7, repsMax: 12, descanso: 90, carga: true, color: '#d9663a' },
    { id: 'fres', nombre: 'Fuerza-resistencia', familia: 'fuerza', repsMin: 13, repsMax: 20, descanso: 60, carga: true, color: '#e8a33d' },
    { id: 'res', nombre: 'Resistencia', familia: 'fuerza', repsMin: 21, repsMax: null, descanso: 30, carga: true, color: '#e6c44a' },
    { id: 'expl', nombre: 'Explosiva', familia: 'potencia', repsMin: 1, repsMax: 6, descanso: 180, carga: true, color: '#8e3fa8' },
    { id: 'mov', nombre: 'Movilidad', familia: 'movilidad', repsMin: 8, repsMax: 15, segMin: 30, segMax: 60, descanso: 30, carga: true, color: '#2f8f83' },
    { id: 'est', nombre: 'Estiramiento', familia: 'estiramiento', segMin: 20, segMax: 60, descanso: 15, carga: true, color: '#4fae6a' },
    { id: 'equi', nombre: 'Equilibrio / propiocepción', familia: 'equilibrio', segMin: 20, segMax: 45, descanso: 30, carga: true, color: '#3a78b2' },
    { id: 'ctrl', nombre: 'Control motor / activación', familia: 'control', repsMin: 8, repsMax: 15, segMin: 10, segMax: 30, descanso: 30, carga: true, color: '#5b8fd9' },
    { id: 'resp', nombre: 'Respiración', familia: 'respiracion', segMin: 60, segMax: 180, descanso: 0, carga: true, color: '#8fb8c9' },
    { id: 'lib', nombre: 'Liberación / masaje', familia: 'liberacion', segMin: 60, segMax: 120, descanso: 0, carga: false, color: '#a7a19a' },
  ],
  // Los nombres de fuerza coinciden con REGIMENES (capacidades.ts): es lo que ya llevan
  // los ejercicios de las sesiones en `regimen`.
  ejecuciones: [
    { id: 'conc', nombre: 'Concéntrico', grupo: 'fuerza', segRep: 2 },
    { id: 'exc', nombre: 'Excéntrico', grupo: 'fuerza', segRep: 4 },
    { id: 'iso', nombre: 'Isométrico', grupo: 'fuerza', segRep: null },
    { id: 'expl', nombre: 'Explosivo', grupo: 'fuerza', segRep: 1 },
    { id: 'plio', nombre: 'Pliométrico', grupo: 'fuerza', segRep: 0.5 },
    { id: 'eest', nombre: 'Estático', grupo: 'estiramiento', segRep: null },
    { id: 'efnp', nombre: 'Isométrico (FNP)', grupo: 'estiramiento', segRep: null },
    { id: 'ebal', nombre: 'Balístico', grupo: 'estiramiento', segRep: 1 },
    { id: 'edin', nombre: 'Dinámico', grupo: 'estiramiento', segRep: 2 },
  ],
  aguantaSeg: 30,
  segRepDefecto: 3,
  contarDescanso: false,
}

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

export const CLAVE_AJUSTE = 'trabajo_config'

/** Lo guardado en ajustes, completado con los valores de partida si falta algo. */
export function leerConfigTrabajo(ajustes: Record<string, string> | null | undefined): ConfigTrabajo {
  let g: any = null
  try { g = ajustes?.[CLAVE_AJUSTE] ? JSON.parse(ajustes[CLAVE_AJUSTE]) : null } catch { g = null }
  if (!g) return clonar(CONFIG_DEFECTO)
  return {
    ...clonar(CONFIG_DEFECTO),
    ...g,
    intensidades: Array.isArray(g.intensidades) ? g.intensidades : clonar(CONFIG_DEFECTO.intensidades),
    ejecuciones: Array.isArray(g.ejecuciones) ? g.ejecuciones : clonar(CONFIG_DEFECTO.ejecuciones),
  }
}

/** Busca por id o por nombre (las sesiones antiguas guardan el nombre: "Excéntrico"). */
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
export function ejecucionDe(cfg: ConfigTrabajo, clave: string) {
  return cfg.ejecuciones.find(e => e.id === clave) || cfg.ejecuciones.find(e => norm(e.nombre) === norm(clave)) || null
}
export function intensidadDe(cfg: ConfigTrabajo, clave: string) {
  return cfg.intensidades.find(e => e.id === clave) || cfg.intensidades.find(e => norm(e.nombre) === norm(clave)) || null
}

/** Intensidad que corresponde a unas reps, solo entre las de fuerza (como capacidadPorReps). */
export function intensidadPorReps(cfg: ConfigTrabajo, reps: number): Intensidad | null {
  if (!reps || reps < 1) return null
  return cfg.intensidades.find(i => i.familia === 'fuerza' && i.repsMin != null && reps >= i.repsMin && (i.repsMax == null || reps <= i.repsMax)) || null
}

/** Segundos que dura una repetición con esas ejecuciones (se suman: son fases). */
export function segundosPorRep(cfg: ConfigTrabajo, ejecuciones: string[]): number {
  const s = (ejecuciones || []).map(e => ejecucionDe(cfg, e)?.segRep).filter((x): x is number => typeof x === 'number' && x > 0)
  return s.length ? s.reduce((a, b) => a + b, 0) : cfg.segRepDefecto
}

/**
 * Segundos de trabajo efectivo de UNA serie.
 *  · `segundos` > 0: es por tiempo y manda lo apuntado.
 *  · `aguanta`: por tiempo sin apuntar → el valor por defecto, estimado.
 *  · si no, reps × segundos por repetición.
 */
export function segundosSerie(cfg: ConfigTrabajo, s: { reps?: number | string | null, segundos?: number | string | null, aguanta?: boolean, ejecuciones?: string[], descanso?: number | null }): { seg: number, estimado: boolean } {
  const seg = Number(s.segundos) || 0
  const reps = Number(s.reps) || 0
  let total = 0, estimado = false
  if (seg > 0) total = seg
  else if (s.aguanta) { total = cfg.aguantaSeg; estimado = true }
  else if (reps > 0) total = reps * segundosPorRep(cfg, s.ejecuciones || [])
  if (cfg.contarDescanso && total > 0) total += Number(s.descanso) || 0
  return { seg: total, estimado }
}

/** 95 -> "1:35", 40 -> "40 s". */
export function textoSegundos(n: number): string {
  if (!n) return '0 s'
  const r = Math.round(n)
  if (r < 60) return `${r} s`
  const m = Math.floor(r / 60), s = r % 60
  return s ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`
}
