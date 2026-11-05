import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// MODO PRÁCTICA: SIE con cuatro pacientes inventados (Carmen, Antonio, Laura y
// Javier) para aprender y «fuchicar» sin miedo.
//
// La separación la hace la base de datos (sql/modo-practica.sql): en este modo la app
// manda la cabecera x-sie-practica y solo se ven los inventados; fuera de él, nunca. Por
// eso entrar y salir RECARGA la página: el cliente de Supabase lee el modo al crearse.
// ---------------------------------------------------------------------------

const CLAVE = 'sie_practica'

export function enModoPractica(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}

/** Les pone la clase a la hora de ahora (y borra lo practicado hoy) y abre el taller. */
async function prepararClase(): Promise<string | null> {
  const ahora = new Date()
  const hora = String(ahora.getHours()).padStart(2, '0') + ':00'
  const { error } = await supabase.rpc('practica_hoy', { p_hora: hora })
  return error ? error.message : null
}

export async function entrarPractica(destino = '/taller') {
  try { localStorage.setItem(CLAVE, '1') } catch {}
  // Se prepara la clase ya con la cabecera puesta: hay que recargar primero.
  try { sessionStorage.setItem('sie_practica_preparar', '1') } catch {}
  window.location.href = destino
}

/**
 * LA GUÍA SE HACE SIEMPRE EN MODO PRÁCTICA: así hay un taller con gente a cualquier
 * hora y no se enseña (ni se toca) lo de pacientes reales. Si no se está en práctica,
 * se entra, y al cerrar la guía se sale solo.
 */
export function guiaEnPractica(nivel: 1 | 2): boolean {
  if (enModoPractica()) return false
  try { sessionStorage.setItem('sie_guia_pendiente', String(nivel)); sessionStorage.setItem('sie_guia_salir', '1') } catch {}
  entrarPractica('/hoy')
  return true
}
/** La guía que quedó pendiente al entrar en práctica (y se borra). */
export function guiaPendiente(): 1 | 2 | null {
  try { const v = sessionStorage.getItem('sie_guia_pendiente'); sessionStorage.removeItem('sie_guia_pendiente'); return v === '1' ? 1 : v === '2' ? 2 : null } catch { return null }
}
/** Al cerrar la guía: si fue ella la que metió en práctica, se sale. */
export function salirSiLaGuiaEntro() {
  let salir = false
  try { salir = sessionStorage.getItem('sie_guia_salir') === '1'; sessionStorage.removeItem('sie_guia_salir') } catch {}
  if (salir) salirPractica()
}

export function salirPractica() {
  try { localStorage.removeItem(CLAVE); sessionStorage.removeItem('sie_practica_preparar') } catch {}
  window.location.href = '/hoy'
}

/**
 * Al cargar en modo práctica: si se acaba de entrar (o se pide empezar de nuevo), les
 * pone la clase. `hecho` = se ha preparado (hay que recargar para verla).
 */
export async function prepararSiToca(forzar = false): Promise<{ hecho: boolean, error?: string }> {
  let toca = forzar
  try { toca = toca || sessionStorage.getItem('sie_practica_preparar') === '1'; sessionStorage.removeItem('sie_practica_preparar') } catch {}
  if (!toca) return { hecho: false }
  const error = await prepararClase()
  return error ? { hecho: false, error } : { hecho: true }
}
