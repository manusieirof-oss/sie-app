'use client'
import { useRef, useState } from 'react'
import Flotante from './Flotante'
import { Ic } from '@/lib/icons'

// ---------------------------------------------------------------------------
// LAS OTRAS DOS CHAPAS SOBRE LA FOTO
//
// Mismo patron que la de ejecucion: el dato cabe en una chapa y el detalle se
// pide. Los feedbacks y el comentario ocupaban dos bloques de texto bajo cada
// columna para algo que se mira un momento; la foto se queda con el sitio, que
// es lo que de verdad se reconoce en la sala.
// ---------------------------------------------------------------------------

const base = (col: any): any => ({
  position: 'absolute', minWidth: 23, height: 23, borderRadius: 99,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  fontSize: 10, fontWeight: 600, fontFamily: 'inherit', padding: '0 6px',
  border: '2px solid var(--w)', cursor: 'pointer',
  boxShadow: '0 1px 5px rgba(38,40,37,.20)', ...col,
})

const rotulo: any = { fontSize: 8, fontWeight: 600, color: 'var(--grl)', letterSpacing: .5,
  textTransform: 'uppercase' }

/** Cómo hacerlo mejor. Solo se lee, no se marca. */
export function ChapaFeedback({ ej }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const fbs = ej.feedbacks || []
  if (fbs.length === 0) return null
  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title="Cómo hacerlo mejor"
        style={base({ background: 'var(--w)', color: 'var(--gd)', right: 5, top: 5 })}>
        <Ic name="mensaje" size={11}/> {fbs.length}
      </button>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={rotulo}>Cómo hacerlo mejor</span>
          <button onClick={() => setAbierto(false)} style={{ marginLeft: 'auto', fontSize: 12,
            color: 'var(--gr)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>
        {fbs.map((fb: any, fi: number) => (
          <div key={fi} style={{ fontSize: 11, lineHeight: 1.5, padding: '3px 0',
            display: 'flex', gap: 6 }}>
            <span style={{ color: 'var(--gm)' }}>·</span>
            <span>{fb.texto}</span>
          </div>
        ))}
      </Flotante>
    </>
  )
}

/**
 * LAS NOTAS DE ESTE EJERCICIO, EN UN SITIO.
 *
 * Dos cosas distintas que se leen en el mismo momento: lo que se dejo escrito
 * al planificar -"ojo con la rodilla derecha"- y lo que pasa hoy. La primera
 * ocupaba un recuadro ambar bajo la foto y la segunda una chapa; ahora
 * comparten sitio, porque quien mira una quiere ver la otra.
 */
export function ChapaComentario({ pacienteId, ej, ei, setComent }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const nota = String(ej.plan?.nota || '').trim()
  const hoy = String(ej.comentario || '').trim()
  const hay = hoy !== '' || nota !== ''
  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={[nota && 'Plan: ' + nota, hoy && 'Hoy: ' + hoy].filter(Boolean).join('\n') || 'Comentar el ejercicio'}
        style={base(hay
          ? { background: 'var(--amb)', color: '#fff', left: 5, top: 5 }
          : { background: 'var(--w)', color: 'var(--grl)', left: 5, top: 5 })}>
        <Ic name="editar" size={11}/>
      </button>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={rotulo}>Notas</span>
          <button onClick={() => setAbierto(false)} style={{ marginLeft: 'auto', fontSize: 12,
            color: 'var(--gr)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>
        {nota && (
          <div style={{ marginBottom: 9 }}>
            <div style={{ ...rotulo, marginBottom: 3 }}>De la planificación</div>
            <div style={{ fontSize: 11.5, color: '#7A5800', background: 'var(--ambl)',
              border: '1px solid var(--amb)', borderRadius: 6, padding: '6px 9px',
              lineHeight: 1.5, fontStyle: 'italic' }}>{nota}</div>
          </div>
        )}
        {nota && <div style={{ ...rotulo, marginBottom: 3 }}>Hoy</div>}
        <textarea value={ej.comentario || ''} rows={3} autoFocus placeholder="Qué ha pasado hoy…"
          onChange={e => setComent(pacienteId, ei, e.target.value)}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45,
            padding: '6px 8px', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--n)',
            background: 'var(--w)', resize: 'vertical', minHeight: 58 }}/>
        {(ej.comentarios || []).length > 0 && (
          <div style={{ marginTop: 9 }}>
            <div style={{ ...rotulo, marginBottom: 3 }}>Días anteriores</div>
            {(ej.comentarios || []).map((c: any, k: number) => (
              <div key={k} style={{ display: 'flex', gap: 7, alignItems: 'flex-start',
                padding: '3px 0', borderTop: k > 0 ? '1px solid var(--bl)' : 'none' }}>
                <span style={{ fontSize: 9.5, color: 'var(--grl)', flexShrink: 0, width: 46,
                  paddingTop: 1 }}>
                  {c.fecha ? new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-ES',
                    { day: 'numeric', month: 'short' }) : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--gr)', lineHeight: 1.45,
                  fontStyle: 'italic' }}>{c.texto}</span>
              </div>
            ))}
          </div>
        )}
      </Flotante>
    </>
  )
}
