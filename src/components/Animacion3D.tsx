'use client'
import { useEffect, useRef, useState } from 'react'
import type { AnimEjercicio } from '@/lib/anim3d/tipos'
import type { Visor, Vista, Acabado } from '@/lib/anim3d/motor'
import { MOVIMIENTOS } from '@/lib/anim3d/movimientos'

/**
 * Visor 3D de un ejercicio: el cuerpo lo hace en bucle mientras la cámara da la
 * vuelta y parpadean los músculos que trabaja. Se puede arrastrar para girarlo.
 *
 * `foto`: si el ejercicio tiene foto, sale en pequeño en una esquina para poder
 * comparar la animación con la foto real (y corregir el movimiento si no cuadra).
 *
 * El motor (three.js) se carga al montar: no entra en el primer render de la página.
 */
const VISTAS: [Vista, string][] = [['giro', '360°'], ['lado', 'Lateral'], ['frente', 'Frontal'], ['arriba', 'Arriba']]
const ACABADOS: [Acabado, string][] = [['corporativo', 'Verde'], ['blanco', 'Blanco'], ['cristal', 'Cristal']]

export default function Animacion3D({ anim, foto, alto = 420, musculos = true }: {
  anim: AnimEjercicio
  foto?: string | null
  alto?: number
  musculos?: boolean
}) {
  const caja = useRef<HTMLDivElement>(null)
  const visor = useRef<Visor | null>(null)
  const faseEl = useRef<HTMLDivElement>(null), repsEl = useRef<HTMLElement>(null), progEl = useRef<HTMLElement>(null)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState('')
  const [vista, setVista] = useState<Vista>('giro')
  const [acabado, setAcabado] = useState<Acabado>('corporativo')
  const [pausa, setPausa] = useState(false)
  const [lento, setLento] = useState(false)
  const [solo, setSolo] = useState<string | null>(null)
  const [fotoGrande, setFotoGrande] = useState(false)

  const def = MOVIMIENTOS[anim.mov]
  const animacion = def ? def.crear(anim.p || {}) : null
  const clave = JSON.stringify(anim)

  // Montar el visor una vez.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { crearVisor } = await import('@/lib/anim3d/motor')
        if (!vivo || !caja.current) return
        const v = await crearVisor(caja.current, {
          // Fase, repeticiones y barra se pintan a mano: van a 60 fps y no deben re-renderizar React.
          fase: t => { if (faseEl.current && faseEl.current.textContent !== t) faseEl.current.textContent = t },
          rep: n => { if (repsEl.current) repsEl.current.textContent = String(Math.max(0, n)) },
          progreso: u => { if (progEl.current) progEl.current.style.width = (u * 100) + '%' },
        })
        if (!vivo) { v.destruir(); return }
        visor.current = v; setListo(true)
      } catch (e: any) { setError(e?.message || 'No se pudo cargar la animación') }
    })()
    return () => { vivo = false; visor.current?.destruir(); visor.current = null }
  }, [])

  // Cambiar de ejercicio (o de parámetros) sin rehacer el visor.
  useEffect(() => {
    if (listo && visor.current && animacion) { visor.current.poner(animacion); setSolo(null); visor.current.soloMusculo(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave])

  if (!animacion) return null
  const btn = (on: boolean): React.CSSProperties => ({
    fontFamily: 'inherit', fontSize: 12, padding: '5px 10px', borderRadius: 99, border: 0, cursor: 'pointer',
    background: on ? 'var(--g)' : 'rgba(255,255,255,.92)', color: on ? '#fff' : 'var(--n)',
  })
  return (
    <div>
      <div ref={caja} style={{ position: 'relative', width: '100%', height: alto, borderRadius: 10, overflow: 'hidden', touchAction: 'none', cursor: 'grab',
        background: 'radial-gradient(circle at 50% 35%,#fff 0%,#EEF3F2 60%,#E1E9E8 100%)', border: '1px solid var(--bd)' }}>
        {!listo && !error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)' }}>Cargando animación…</div>}
        {error && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: 'var(--grl)', padding: 20, textAlign: 'center' }}>{error}</div>}
        <div style={{ position: 'absolute', right: 12, top: 10, textAlign: 'right', pointerEvents: 'none' }}>
          <b ref={repsEl} style={{ fontSize: 24, color: 'var(--gd)', lineHeight: 1 }}>0</b>
          <div style={{ fontSize: 11, color: 'var(--grl)' }}>repeticiones</div>
        </div>
        {foto && (
          // La foto real del ejercicio, para comparar. Tocando se agranda.
          <img src={foto} alt="" onClick={() => setFotoGrande(g => !g)} onPointerDown={e => e.stopPropagation()}
            style={{ position: 'absolute', left: 10, top: 10, width: fotoGrande ? '46%' : 74, aspectRatio: '1', objectFit: 'cover', borderRadius: 8,
              border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.15)', cursor: 'zoom-in', transition: 'width .2s', zIndex: 2 }} title="Foto del ejercicio: toca para agrandar" />
        )}
        <div ref={faseEl} style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)', background: 'rgba(255,255,255,.9)', padding: '5px 12px',
          borderRadius: 99, fontSize: 13, fontWeight: 600, color: 'var(--gd)', pointerEvents: 'none', whiteSpace: 'nowrap' }} />
        <div onPointerDown={e => e.stopPropagation()} style={{ position: 'absolute', left: 8, right: 8, bottom: 10, display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {VISTAS.map(([k, l]) => <button key={k} type="button" style={btn(vista === k)} onClick={() => { setVista(k); visor.current?.vista(k) }}>{l}</button>)}
          <span style={{ width: 6 }} />
          {ACABADOS.map(([k, l]) => <button key={k} type="button" style={btn(acabado === k)} onClick={() => { setAcabado(k); visor.current?.acabado(k) }}>{l}</button>)}
          <span style={{ width: 6 }} />
          <button type="button" style={btn(pausa)} onClick={() => { visor.current?.pausa(!pausa); setPausa(!pausa) }}>{pausa ? '▶ Seguir' : '❚❚ Pausa'}</button>
          <button type="button" style={btn(lento)} onClick={() => { visor.current?.velocidad(lento ? 1 : .5); setLento(!lento) }}>Lento</button>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(62,113,121,.12)' }}>
          <i ref={progEl} style={{ display: 'block', height: '100%', width: 0, background: 'var(--gd)' }} />
        </div>
      </div>
      {musculos && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>Trabaja:</span>
          {animacion.musculos.map(([id, nom], i) => (
            <button key={id} type="button" onClick={() => { const n = solo === id ? null : id; setSolo(n); visor.current?.soloMusculo(n) }}
              style={{ fontFamily: 'inherit', fontSize: 11.5, padding: '3px 9px', borderRadius: 99, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                border: `1px solid ${solo === id ? '#F2784B' : 'var(--bd)'}`, background: solo === id ? '#FDECE8' : 'var(--w)', color: 'var(--n)' }}>
              <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#F2784B', opacity: i < 2 ? 1 : .5 }} />{nom}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
