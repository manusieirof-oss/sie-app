'use client'
import { useState } from 'react'
import { contiene } from '@/lib/texto'
import MonedaObjetivo from '@/components/MonedaObjetivo'
import ModalObjetivo from './ModalObjetivo'

// ---------------------------------------------------------------------------
// ELEGIR OBJETIVOS, COMO EN LA BIBLIOTECA
//
// Un objetivo se reconoce por su foto, no por su nombre. En un desplegable solo
// hay nombres, asi que hay que leerlos todos; aqui se ven las monedas, se buscan
// y se marcan varias de una vez.
// ---------------------------------------------------------------------------

export default function SelectorObjetivos({ objetivos, ya = [], titulo = 'Añadir objetivos',
  tests = [], etiquetas = [], onRecargarBiblio, onCerrar, onElegir }: any) {
  const [creando, setCreando] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<string[]>([])

  const alternar = (id: string) =>
    setMarcados(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  // Crear sin salirse: montar las condiciones de una fase y ver que falta un
  // objetivo es lo normal, y volver a la biblioteca pierde lo que llevabas.
  const nacido = (id?: string) => {
    if (id) setMarcados(p => [...p, id])
    onRecargarBiblio?.()
  }

  const lista = (objetivos || [])
    .filter((o: any) => ya.includes(o.id) === false)
    .filter((o: any) => contiene(o.nombre || '', busca))

  return (
    <div className="modal-bg" style={{ zIndex: 150 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
        maxWidth:640, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'var(--sh-md)' }}>

        <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontSize:16, fontWeight:500 }}>{titulo}</div>
          <button className="btn btn-s btn-sm" onClick={() => setCreando(true)}>+ Nuevo objetivo</button>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{ padding:'11px 17px 0' }}>
          <input className="input" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar objetivo…"/>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 17px', display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(112px,1fr))', gap:10 }}>
          {lista.length === 0 && (
            <div className="muted" style={{ gridColumn:'1 / -1' }}>
              {(objetivos || []).length === 0
                ? 'No hay objetivos en la biblioteca todavía.'
                : 'Ninguno coincide, o ya están todos en esta fase.'}
            </div>
          )}
          {lista.map((o: any) => {
            const on = marcados.includes(o.id)
            return (
              <div key={o.id} onClick={() => alternar(o.id)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'10px 6px',
                  borderRadius:9, cursor:'pointer',
                  border:`1px solid ${on ? 'var(--g)' : 'var(--bd)'}`,
                  background: on ? 'var(--gl)' : 'var(--w)' }}>
                <MonedaObjetivo objetivo={o} tam="g"/>
                <span style={{ fontSize:10.5, textAlign:'center', lineHeight:1.3, color:'var(--n)' }}>{o.nombre}</span>
                {on && <span style={{ fontSize:9, color:'var(--gd)' }}>✓ marcado</span>}
              </div>
            )
          })}
        </div>

        <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--gr)' }}>
            {marcados.length === 0 ? 'Ninguno marcado' : `${marcados.length} marcado${marcados.length === 1 ? '' : 's'}`}
          </span>
          <div style={{ flex:1 }}/>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={marcados.length === 0}
            onClick={() => { onElegir(marcados); onCerrar() }}>Añadir</button>
        </div>

        {creando && (
          <ModalObjetivo objetivo={null} tests={tests} etiquetas={etiquetas}
            onGuardado={nacido} onCerrar={() => setCreando(false)}/>
        )}
      </div>
    </div>
  )
}
