'use client'
import { useEffect, useRef, useState } from 'react'
import { Ic } from '@/lib/icons'

/**
 * Lienzo de firma. Estaba escrito en línea dentro de PasoPaciente; ahora lo
 * comparten la valoración y la ficha del paciente.
 *
 * El hueco embebido se firma con el ratón sin problema, pero en tablet es
 * estrecho y la firma sale apretada. Por eso hay dos lienzos —el del hueco y
 * uno a pantalla completa— y UN SOLO dato: el dataURL. El grande no es otro
 * campo, es el mismo escrito con más sitio.
 */

/** Un lienzo. Pinta lo que le llega por `valor` y devuelve lo dibujado. */
function Lienzo({ valor, onCambio, ancho, alto, cssAlto, grosor = 2 }: {
  valor: string
  onCambio: (dataUrl: string) => void
  /** Resolución interna del canvas. */
  ancho: number
  alto: number
  /** Alto en pantalla; el ancho siempre es el del contenedor. */
  cssAlto: number | string
  grosor?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [dibujando, setDibujando] = useState(false)
  // Lo último que ha emitido ESTE lienzo. Sin esto, el useEffect de abajo
  // repinta el trazo que acabamos de hacer y parpadea a cada movimiento.
  const propio = useRef('')

  // Trae la firma de fuera: al abrir el lienzo grande hay que ver lo que ya
  // había, y al cerrarlo el hueco pequeño tiene que enterarse de lo nuevo.
  useEffect(() => {
    const c = ref.current
    if (!c) return
    if (valor === propio.current) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    if (!valor) return
    const img = new Image()
    img.onload = () => {
      // Se escala sin deformar: los dos lienzos tienen proporciones distintas y
      // una firma estirada a lo ancho no es la firma de nadie.
      const k = Math.min(c.width / img.width, c.height / img.height)
      const w = img.width * k, h = img.height * k
      ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h)
    }
    img.src = valor
  }, [valor])

  const punto = (e: any) => {
    const c = ref.current!
    const r = c.getBoundingClientRect()
    const t = e.touches?.[0]
    const cx = t ? t.clientX : e.clientX
    const cy = t ? t.clientY : e.clientY
    return [(cx - r.left) * (c.width / r.width), (cy - r.top) * (c.height / r.height)]
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
    ctx.lineWidth = grosor; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#262825'
    ctx.lineTo(x, y); ctx.stroke()
  }

  // También al salir del lienzo: al firmar de un trazo es fácil soltar fuera,
  // y sin esto la firma se perdía en silencio.
  function terminar() {
    if (!dibujando) return
    setDibujando(false)
    const dataUrl = ref.current!.toDataURL()
    propio.current = dataUrl
    onCambio(dataUrl)
  }

  return (
    <canvas ref={ref} width={ancho} height={alto}
      style={{ display: 'block', width: '100%', height: cssAlto, cursor: 'crosshair', touchAction: 'none' }}
      onMouseDown={empezar} onMouseMove={mover} onMouseUp={terminar} onMouseLeave={terminar}
      onTouchStart={e => { e.preventDefault(); empezar(e) }}
      onTouchMove={e => { e.preventDefault(); mover(e) }}
      onTouchEnd={e => { e.preventDefault(); terminar() }} />
  )
}

export default function FirmaCanvas({ valor, onCambio, alto = 200 }: {
  /** dataURL de la firma, o '' si no hay. */
  valor: string
  onCambio: (dataUrl: string) => void
  alto?: number
}) {
  const [pleno, setPleno] = useState(false)
  // La firma a pantalla completa se confirma o se descarta: mientras está
  // abierta se trabaja sobre un borrador, y solo "Hecho" lo sube. Cerrar sin
  // querer no puede llevarse por delante la firma que ya había.
  const [borrador, setBorrador] = useState('')
  const [medida, setMedida] = useState({ w: 1400, h: 700 })

  useEffect(() => {
    if (!pleno) return
    const medir = () => setMedida({ w: Math.round(window.innerWidth * 2), h: Math.round((window.innerHeight - 150) * 2) })
    medir()
    window.addEventListener('resize', medir)
    // Firmar es lo único que se hace en esta pantalla: Esc sale sin guardar.
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setPleno(false) }
    window.addEventListener('keydown', tecla)
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('keydown', tecla) }
  }, [pleno])

  function abrir() {
    setBorrador(valor)
    setPleno(true)
  }

  return (
    <div>
      <div style={{ position: 'relative', border: `2px solid ${valor ? 'var(--g)' : 'var(--bd)'}`, borderRadius: 'var(--r)', background: 'var(--w)', overflow: 'hidden' }}>
        <Lienzo valor={valor} onCambio={onCambio} ancho={800} alto={alto * 2} cssAlto={alto} grosor={3} />
        {!valor && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 12, color: 'var(--gr)', pointerEvents: 'none', textAlign: 'center' }}>
            Firma aquí con el dedo o el ratón
          </div>
        )}
        <button onClick={abrir} title="Firmar a pantalla completa"
          style={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '4px 9px', borderRadius: 99, border: '1px solid var(--bd)', background: 'var(--w)', color: 'var(--gr)', cursor: 'pointer', fontFamily: 'inherit' }}>
          <Ic name="firmar" size={12} /> Ampliar
        </button>
      </div>
      {valor && <button className="btn btn-t btn-sm" style={{ marginTop: 6 }} onClick={() => onCambio('')}>Borrar firma</button>}

      {/* PANTALLA COMPLETA · para firmar en la tablet con sitio de sobra */}
      {pleno && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--w)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--n)' }}>Firma del paciente</div>
            <button className="modal-close" onClick={() => setPleno(false)}><Ic name="cerrar" size={18} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', margin: 14, border: `2px solid ${borrador ? 'var(--g)' : 'var(--bd)'}`, borderRadius: 'var(--rl)', overflow: 'hidden' }}>
            <Lienzo valor={borrador} onCambio={setBorrador} ancho={medida.w} alto={medida.h} cssAlto="100%" grosor={Math.max(4, Math.round(medida.w / 220))} />
            {!borrador && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 15, color: 'var(--gr)', pointerEvents: 'none' }}>
                Firma aquí con el dedo
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', padding: '0 18px 16px', flexShrink: 0 }}>
            <button className="btn btn-t" onClick={() => setBorrador('')} style={{ visibility: borrador ? 'visible' : 'hidden' }}>Borrar</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-d" onClick={() => setPleno(false)}>Cancelar</button>
              <button className="btn btn-p" onClick={() => { onCambio(borrador); setPleno(false) }}>Hecho</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
