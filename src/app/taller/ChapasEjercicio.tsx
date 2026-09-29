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

/** Lo que pasó hoy. Ámbar en cuanto hay algo escrito. */
export function ChapaComentario({ pacienteId, ej, ei, setComent }: any) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  const hay = String(ej.comentario || '').trim() !== ''
  return (
    <>
      <button ref={ancla} onClick={e => { e.stopPropagation(); setAbierto(v => v === false) }}
        title={hay ? ej.comentario : 'Comentar el ejercicio'}
        style={base(hay
          ? { background: 'var(--amb)', color: '#fff', left: 5, top: 5 }
          : { background: 'var(--w)', color: 'var(--grl)', left: 5, top: 5 })}>
        <Ic name="editar" size={11}/>
      </button>
      <Flotante abierto={abierto} ancla={ancla} onCerrar={() => setAbierto(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <span style={rotulo}>Comentario</span>
          <button onClick={() => setAbierto(false)} style={{ marginLeft: 'auto', fontSize: 12,
            color: 'var(--gr)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕</button>
        </div>
        <textarea value={ej.comentario || ''} rows={3} autoFocus placeholder="Qué ha pasado hoy…"
          onChange={e => setComent(pacienteId, ei, e.target.value)}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.45,
            padding: '6px 8px', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--n)',
            background: 'var(--w)', resize: 'vertical', minHeight: 58 }}/>
        {ej.ultimoComent && (
          <div style={{ fontSize: 10, color: 'var(--g)', marginTop: 6, fontStyle: 'italic',
            lineHeight: 1.45 }}>última vez: {ej.ultimoComent}</div>
        )}
      </Flotante>
    </>
  )
}
