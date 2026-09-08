'use client'
import { useEffect } from 'react'

/**
 * Volver a la lista y encontrar a la persona que estabas mirando.
 *
 * Entrar en la ficha de alguien que está en la fila noventa y volver al principio de la
 * lista obliga a buscarlo otra vez cada vez. Con doscientos pacientes eso es la
 * diferencia entre revisar la lista entera y no revisarla.
 *
 * SE RECUERDA LA FILA, NO LA ALTURA. Tres intentos anteriores guardaban el `scrollTop`
 * de `.content` y ninguno funcionó, por dos motivos que no se arreglan insistiendo:
 *
 *   - Poner `scrollTop = 4000` cuando la lista todavía mide una pantalla no hace nada:
 *     el navegador lo recorta a lo que hay. Y la lista no tiene su alto definitivo hasta
 *     que llegan seis consultas, que tardan lo que tardan.
 *   - Daba por hecho que el elemento que hace scroll es `.content`. Es una suposición, y
 *     todo el mecanismo colgaba de ella.
 *
 * Guardando el id de la fila desaparecen las dos. `scrollIntoView` busca solo cuál es el
 * antecesor que hace scroll, así que no hay que acertar; y si la fila todavía no está
 * pintada, no es que se recorte el resultado: es que no hay elemento, se ve que no lo
 * hay, y se reintenta. Además sigue funcionando si al volver la lista trae un paciente
 * más, o está ordenada de otra forma.
 *
 * SE VIGILA, NO SE INTENTA UNA VEZ. Hay tres cosas que mueven la posición y ninguna
 * avisa: Next sube el contenido al principio al cambiar de página y no en un momento
 * fijo; la lista crece según van llegando los datos; y en desarrollo React monta,
 * desmonta y vuelve a montar. Así que cada fotograma se comprueba si la fila está a la
 * vista y, si no, se la trae. Se para cuando lleva tres fotogramas seguidos en su sitio,
 * cuando el usuario toca la rueda, la pantalla, el teclado o la barra de scroll, o a los
 * cinco segundos.
 */

/** La última fila abierta de cada lista. En memoria: sobrevive al cambio de página. */
const ultima = new Map<string, string>()
const VIGILAR_MS = 5000
const QUIETA = 3

/** El id del elemento de la fila. La lista tiene que ponerlo en cada fila. */
export const idFila = (clave: string, id: string) => `fila-${clave}-${id}`

export function useVolverALaFila(clave: string) {
  useEffect(() => {
    const id = ultima.get(clave) || (() => {
      try { return sessionStorage.getItem('fila:' + clave) || '' } catch { return '' }
    })()
    if (!id) return

    let vivo = true
    let marco = 0
    let quieta = 0
    const desde = Date.now()

    const parar = () => {
      if (!vivo) return
      vivo = false
      if (marco) cancelAnimationFrame(marco)
      window.removeEventListener('wheel', parar)
      window.removeEventListener('touchstart', parar)
      window.removeEventListener('mousedown', parar)
      window.removeEventListener('keydown', parar)
    }

    const vigilar = () => {
      if (!vivo) return
      const el = document.getElementById(idFila(clave, id))
      if (!el) {
        // Todavía no está pintada. No es un fallo: es que faltan datos por llegar.
        quieta = 0
      } else {
        const r = el.getBoundingClientRect()
        // Con margen por arriba y por abajo: dejarla pegada al borde no es "verla".
        const aLaVista = r.top >= 70 && r.bottom <= window.innerHeight - 24
        if (aLaVista) quieta++
        else { el.scrollIntoView({ block: 'center' }); quieta = 0 }
      }
      if (quieta >= QUIETA || Date.now() - desde > VIGILAR_MS) { parar(); return }
      marco = requestAnimationFrame(vigilar)
    }

    // El usuario manda: en cuanto mueve él, se deja de insistir. El `mousedown` cubre
    // arrastrar la barra de scroll, que no dispara `wheel`.
    window.addEventListener('wheel', parar, { passive: true })
    window.addEventListener('touchstart', parar, { passive: true })
    window.addEventListener('mousedown', parar)
    window.addEventListener('keydown', parar)
    marco = requestAnimationFrame(vigilar)

    return parar
  }, [clave])

  /** Cuélgalo del `onMouseDown` de la fila: es cuando se sabe a quién se está abriendo. */
  return (id: string) => {
    ultima.set(clave, id)
    try { sessionStorage.setItem('fila:' + clave, id) } catch {}
  }
}
