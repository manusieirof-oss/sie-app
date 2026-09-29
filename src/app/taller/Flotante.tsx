'use client'
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

// ---------------------------------------------------------------------------
// EL DESPLEGABLE DE UNA CHAPA
//
// Va en `position: fixed` anclado al boton, no dentro de su columna. Dentro se
// recortaba con el ancho de la rejilla y las columnas de al lado lo tapaban
// segun el orden en que estuvieran escritas, que es un motivo absurdo para no
// poder leer algo.
//
// Y se mantiene dentro de la pantalla: en la ultima columna se abre hacia la
// izquierda solo, sin que nadie tenga que calcular nada.
// ---------------------------------------------------------------------------

export default function Flotante({ abierto, ancla, onCerrar, ancho = 236, children }: {
  abierto: boolean
  ancla: RefObject<HTMLElement | null>
  onCerrar: () => void
  ancho?: number
  children: ReactNode
}) {
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!abierto) { setPos(null); return }
    const colocar = () => {
      /* MIENTRAS SE ESCRIBE, NO SE MUEVE. En tablet, al abrirse el teclado
         cambia la altura de la ventana y el panel saltaba a media frase. */
      if (panel.current && panel.current.contains(document.activeElement)) return
      const r = ancla.current?.getBoundingClientRect()
      if (!r) return
      const margen = 8
      const centro = r.left + r.width / 2 - ancho / 2
      const left = Math.max(margen, Math.min(centro, window.innerWidth - ancho - margen))
      // Si abajo no cabe, hacia arriba: en la ultima fila de la pantalla el
      // desplegable se salia y no habia forma de llegar a el.
      const abajo = window.innerHeight - r.bottom
      const top = abajo > 260 ? r.bottom + 8 : Math.max(margen, r.top - 268)
      setPos({ top, left })
    }
    colocar()
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    return () => {
      window.removeEventListener('scroll', colocar, true)
      window.removeEventListener('resize', colocar)
    }
  }, [abierto, ancho, ancla])

  if (!abierto || pos == null) return null

  return (
    <>
      <span onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 80 }}/>
      <div ref={panel} style={{ position: 'fixed', top: pos.top, left: pos.left, width: ancho,
        background: 'var(--w)', border: '1px solid var(--bd)', borderRadius: 9,
        boxShadow: '0 10px 28px rgba(38,40,37,.18)', padding: '11px 12px', zIndex: 81,
        textAlign: 'left', maxHeight: '60vh', overflowY: 'auto' }}>
        {children}
      </div>
    </>
  )
}
