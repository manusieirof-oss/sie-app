'use client'
import { useRef, useState } from 'react'

// Lienzo de firma. Estaba escrito en línea dentro de PasoPaciente; ahora lo
// comparten la valoración y la ficha del paciente.
export default function FirmaCanvas({ valor, onCambio, alto = 130 }: {
  /** dataURL de la firma, o '' si no hay. */
  valor: string
  onCambio: (dataUrl: string) => void
  alto?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)

  const punto = (e: any) => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    const escala = c.width / r.width
    const t = e.touches?.[0]
    const cx = t ? t.clientX : e.clientX
    const cy = t ? t.clientY : e.clientY
    return [(cx - r.left) * escala, (cy - r.top) * escala]
  }

  function empezar(e: any) {
    const ctx = ref.current!.getContext('2d')!
    const [x, y] = punto(e)
    ctx.beginPath(); ctx.moveTo(x, y)
    setDibujando(true)
  }

  function mover(e: any) {
    if (!dibujando) return
    const ctx = ref.current!.getContext('2d')!
    const [x, y] = punto(e)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#262825'
    ctx.lineTo(x, y); ctx.stroke()
  }

  // También al salir del lienzo: al firmar de un trazo es fácil soltar fuera,
  // y sin esto la firma se perdía en silencio.
  function terminar() {
    if (!dibujando) return
    setDibujando(false)
    onCambio(ref.current!.toDataURL())
  }

  function borrar() {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    onCambio('')
  }

  return (
    <div>
      <div style={{ position: 'relative', border: `2px solid ${valor ? 'var(--g)' : 'var(--bd)'}`, borderRadius: 'var(--r)', background: 'var(--w)', overflow: 'hidden' }}>
        <canvas ref={ref} width={500} height={alto * 2}
          style={{ display: 'block', width: '100%', height: alto, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={empezar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
          onTouchStart={e => { e.preventDefault(); empezar(e) }}
          onTouchMove={e => { e.preventDefault(); mover(e) }}
          onTouchEnd={e => { e.preventDefault(); terminar() }} />
        {!valor && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 12, color: 'var(--gr)', pointerEvents: 'none' }}>
            Firma aquí con el dedo o el ratón
          </div>
        )}
      </div>
      {valor && <button className="btn btn-t btn-sm" style={{ marginTop: 6 }} onClick={borrar}>Borrar firma</button>}
    </div>
  )
}
