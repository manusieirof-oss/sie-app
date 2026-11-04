// ---------------------------------------------------------------------------
// VERSIÓN NUEVA PUBLICADA CON LA APP ABIERTA.
//
// Cada "git push" publica una versión nueva en Vercel. Quien tenía SIE abierto sigue
// con la vieja, y al cambiar de pantalla el navegador pide trozos de código que ya no
// existen: la pantalla se rompía y parecía que la app "se cerraba sola". Si el fallo
// es ese, se recarga la página una vez (con lo de la nueva versión) en vez de romper.
// ---------------------------------------------------------------------------

export const esFalloDeVersion = (e: any) =>
  /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i
    .test(String(e?.name || '') + ' ' + String(e?.message || e || ''))

const CLAVE = 'sie_recarga_version'

/** Recarga una vez; si ya se recargó hace menos de un minuto, no (para no entrar en bucle). */
export function recargarPorVersion(): boolean {
  try {
    const t = Number(sessionStorage.getItem(CLAVE) || 0)
    if (Date.now() - t < 60_000) return false
    sessionStorage.setItem(CLAVE, String(Date.now()))
  } catch {}
  window.location.reload()
  return true
}
