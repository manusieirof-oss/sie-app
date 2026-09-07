'use client'
import { useEffect, useRef } from 'react'

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
 * CUÁNDO SE RESTAURA. Solo cuando los datos ya están pintados. Si se restaura antes, la
 * lista todavía mide una pantalla, el navegador recorta el `scrollTop` a lo que hay, y
 * al llegar las filas te quedas arriba igual. Por eso hace falta `listo`.
 *
 * DÓNDE SE GUARDA. En `sessionStorage`: dura lo que dura la pestaña. Recordar la
 * posición de la semana pasada no es útil, y ocupar `localStorage` con eso, tampoco.
 */
export function useScrollRecordado(clave: string, listo: boolean) {
  const restaurado = useRef(false)

  useEffect(() => {
    const caja = document.querySelector('.content') as HTMLElement | null
    if (!caja) return

    // Guardar es continuo, no solo al salir: si la pestaña se recarga o el componente
    // se desmonta por un camino que no pasa por la limpieza, lo último visto ya está.
    let pendiente = 0
    const alScroll = () => {
      if (pendiente) return
      pendiente = requestAnimationFrame(() => {
        pendiente = 0
        try { sessionStorage.setItem('scroll:' + clave, String(caja.scrollTop)) } catch {}
      })
    }
    caja.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      caja.removeEventListener('scroll', alScroll)
      if (pendiente) cancelAnimationFrame(pendiente)
      try { sessionStorage.setItem('scroll:' + clave, String(caja.scrollTop)) } catch {}
    }
  }, [clave])

  useEffect(() => {
    if (!listo || restaurado.current) return
    restaurado.current = true
    const caja = document.querySelector('.content') as HTMLElement | null
    if (!caja) return
    let y = 0
    try { y = parseInt(sessionStorage.getItem('scroll:' + clave) || '0', 10) } catch {}
    if (!y || isNaN(y)) return
    // Dos intentos: el primero en cuanto React ha pintado, el segundo un fotograma
    // después por si algo de la fila (una imagen, un badge) cambia el alto al llegar.
    caja.scrollTop = y
    requestAnimationFrame(() => { if (caja.scrollTop < y) caja.scrollTop = y })
  }, [clave, listo])
}
