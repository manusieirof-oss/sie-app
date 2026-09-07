'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Devolver a la lista donde estaba, no al principio.
 *
 * Entrar en la ficha de alguien que está en la fila noventa y volver al tope de la lista
 * obliga a buscarlo otra vez cada vez. Con doscientos pacientes eso es la diferencia
 * entre revisar la lista entera y no revisarla.
 *
 * QUÉ SE MIDE. No es la ventana: la aplicación no hace scroll en el `body`. El que se
 * mueve es `.content` (ver `globals.css`), así que es su `scrollTop` lo que hay que
 * guardar. Con `window.scrollY` esto no funcionaba, y no por poco: siempre valía cero.
 *
 * EL ORDEN ES TODO. Next, al cambiar de página, sube el contenido al principio por su
 * cuenta, y lo hace DESPUÉS de montar la lista. La primera versión de esto ponía el
 * oyente de scroll nada más montar, así que ese salto al principio entraba por la misma
 * puerta que un scroll del usuario y guardaba un cero encima de la posición buena, justo
 * antes de que llegara el momento de restaurarla. Se restauraba, sí: a cero.
 *
 * De ahí las dos reglas de abajo:
 *
 *   1. No se guarda nada hasta haber restaurado. Mientras tanto, lo que mueva la
 *      posición no es el usuario.
 *   2. Al restaurar se insiste unos fotogramas, porque el salto de Next puede llegar
 *      después. Se deja de insistir en cuanto el usuario toca la rueda o la pantalla:
 *      a partir de ahí manda él.
 *
 * DÓNDE SE GUARDA. En `sessionStorage`: dura lo que dura la pestaña. Recordar la
 * posición de la semana pasada no es útil, y ocupar `localStorage` con eso, tampoco.
 */
export function useScrollRecordado(clave: string, listo: boolean) {
  /** false hasta que la posición está puesta. Ver la regla 1. */
  const [siguiendo, setSiguiendo] = useState(false)
  const restaurado = useRef(false)
  const k = 'scroll:' + clave

  // 1 · RESTAURAR, y solo cuando los datos ya están pintados. Antes la lista mide una
  //     pantalla, el navegador recorta el `scrollTop` a lo que hay y te quedas arriba.
  useEffect(() => {
    if (!listo || restaurado.current) return
    restaurado.current = true
    const caja = document.querySelector('.content') as HTMLElement | null
    if (!caja) return

    let y = 0
    try { y = parseInt(sessionStorage.getItem(k) || '0', 10) } catch {}
    if (!y || isNaN(y) || y < 0) { setSiguiendo(true); return }

    let id = 0
    let intentos = 0
    const rendirse = () => {
      if (id) cancelAnimationFrame(id)
      id = 0
      caja.removeEventListener('wheel', rendirse)
      caja.removeEventListener('touchstart', rendirse)
      setSiguiendo(true)
    }
    const poner = () => {
      caja.scrollTop = y
      // Diez fotogramas, unos 150 ms. Suficiente para ganarle al salto de Next y lo
      // bastante corto como para que no se note si el usuario ya está moviendo.
      if (++intentos < 10) id = requestAnimationFrame(poner)
      else rendirse()
    }
    caja.addEventListener('wheel', rendirse, { passive: true, once: true })
    caja.addEventListener('touchstart', rendirse, { passive: true, once: true })
    id = requestAnimationFrame(poner)

    return () => {
      if (id) cancelAnimationFrame(id)
      caja.removeEventListener('wheel', rendirse)
      caja.removeEventListener('touchstart', rendirse)
    }
  }, [listo, k])

  // 2 · GUARDAR, ya con la posición puesta y el mando en manos del usuario.
  useEffect(() => {
    if (!siguiendo) return
    const caja = document.querySelector('.content') as HTMLElement | null
    if (!caja) return

    // Se guarda de continuo y no solo al salir: si la pestaña se recarga o el
    // componente se desmonta por un camino que no pasa por la limpieza, lo último
    // que se vio ya está guardado.
    let pendiente = 0
    const guardar = () => { try { sessionStorage.setItem(k, String(caja.scrollTop)) } catch {} }
    const alScroll = () => {
      if (pendiente) return
      pendiente = requestAnimationFrame(() => { pendiente = 0; guardar() })
    }
    caja.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      caja.removeEventListener('scroll', alScroll)
      if (pendiente) cancelAnimationFrame(pendiente)
      guardar()
    }
  }, [siguiendo, k])

  /**
   * Guardar AHORA, sin esperar a nada.
   *
   * Para colgarlo del clic en la fila. La limpieza del efecto de arriba ya guarda al
   * desmontar, pero eso depende de que React desmonte antes de que Next mueva la
   * posición, y ese orden no lo decido yo. El clic sí: cuando ocurre, la lista está
   * quieta y donde el usuario la dejó.
   */
  return () => {
    const caja = document.querySelector('.content') as HTMLElement | null
    if (!caja) return
    try { sessionStorage.setItem(k, String(caja.scrollTop)) } catch {}
  }
}
