'use client'
import { useEffect, useRef, useState } from 'react'
import { Ic } from '@/lib/icons'

/**
 * LA ANAMNESIS VIAJA CON LOS PASOS.
 *
 * Siempre acaban contando algo tarde ("ah, y hace años me operaron..."), y para
 * apuntarlo habia que volver al paso 2. Fuera de ese paso queda como una pastilla
 * pequeña que se arrastra a donde moleste menos; al tocarla se abre una nota con el
 * mismo texto. Es el mismo campo, no una copia.
 */
const CLAVE_POS = 'valoracion-nota-pos'

export default function NotaAnamnesis({ valor, onCambio }: { valor: string, onCambio: (v: string) => void }) {
  const [abierta, setAbierta] = useState(false)
  const [pos, setPos] = useState<{ x: number, y: number } | null>(null)
  const arrastre = useRef<{ dx: number, dy: number, movido: boolean } | null>(null)

  useEffect(() => {
    let p: any = null
    try { p = JSON.parse(localStorage.getItem(CLAVE_POS) || 'null') } catch {}
    setPos(p && p.x >= 0 && p.y >= 0 && p.x < window.innerWidth - 60 && p.y < window.innerHeight - 40
      ? p : { x: window.innerWidth - 360, y: window.innerHeight - 90 })
  }, [])

  const empezar = (e: React.PointerEvent) => {
    if (!pos) return
    arrastre.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, movido: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const mover = (e: React.PointerEvent) => {
    const a = arrastre.current
    if (!a) return
    const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - a.dx))
    const y = Math.max(0, Math.min(window.innerHeight - 44, e.clientY - a.dy))
    if (pos && (Math.abs(x - pos.x) > 3 || Math.abs(y - pos.y) > 3)) a.movido = true
    setPos({ x, y })
  }
  /** Si no se ha movido, era un toque: abre o cierra. */
  const soltar = (alTocar?: () => void) => () => {
    const a = arrastre.current
    arrastre.current = null
    if (a?.movido) { try { localStorage.setItem(CLAVE_POS, JSON.stringify(pos)) } catch {} }
    else alTocar?.()
  }
  if (!pos) return null
  // Abierta, que no se salga por abajo ni por la derecha.
  const x = abierta ? Math.min(pos.x, window.innerWidth - 340) : pos.x
  const y = abierta ? Math.min(pos.y, window.innerHeight - 260) : pos.y

  return (
    <div className={`nota-an ${abierta ? 'abierta' : ''}`} style={{ left: x, top: y }}>
      <div className="nota-an-cab" onPointerDown={empezar} onPointerMove={mover} onPointerUp={soltar(() => setAbierta(v => !v))}>
        <Ic name="informe" size={14}/>
        <span style={{ flex: 1 }}>Anamnesis{!abierta && valor ? <span className="nota-an-n"> · {valor.trim().split(/\s+/).length} palabras</span> : null}</span>
        <span className="nota-an-btn">{abierta ? '–' : '+'}</span>
      </div>
      {abierta && (
        <textarea className="input" autoFocus value={valor} onChange={e => onCambio(e.target.value)}
          placeholder="Lo que cuente tarde, apúntalo aquí…"/>
      )}
    </div>
  )
}
