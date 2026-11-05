// La GUÍA INTERACTIVA espera a que se haga de verdad lo que pide (apuntar una serie,
// poner una alerta…). Cada sitio de la app avisa con un nombre al hacerlo; si no hay
// guía abierta, el aviso no hace nada.
export function avisarGuia(nombre: string) {
  try { window.dispatchEvent(new CustomEvent('sie-guia', { detail: nombre })) } catch {}
}
