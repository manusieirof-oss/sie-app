'use client'
import { useState } from 'react'
import { contiene } from '@/lib/texto'
import { modoDeSesion } from '@/lib/sesiones'
import { tinte } from '@/lib/sistemas'
import ModalEditarSesion from './ModalEditarSesion'

// ---------------------------------------------------------------------------
// ELEGIR SESIONES, COMO EN LA BIBLIOTECA
//
// Un desplegable de nombres no deja reconocer una sesion: lo que la distingue
// es de cuantas partes es, en que modo va y cuantos ejercicios tiene. Aqui se
// ven en tarjeta, se buscan por nombre y se marcan varias de una vez, que es
// como se monta una fase: no de una en una.
// ---------------------------------------------------------------------------

export default function SelectorSesiones({ sesiones, ya = [], titulo = 'Añadir sesiones',
  ejercicios = [], etiquetas = [], onRecargarBiblio, onCerrar, onElegir,
  /** De que color va cada sesion. Se reconoce el sistema del que salio sin leer. */
  colorDe }: any) {
  const [creando, setCreando] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<string[]>([])

  const alternar = (id: string) =>
    setMarcadas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  // Crear sin salirse: montar la fase y darte cuenta de que falta una sesion es
  // lo normal, y volver a la biblioteca a por ella pierde lo que llevabas marcado.
  const nacida = (id?: string) => {
    if (id) setMarcadas(p => [...p, id])
    onRecargarBiblio?.()
  }

  const lista = (sesiones || [])
    .filter((s: any) => ya.includes(s.id) === false)
    .filter((s: any) => contiene(s.nombre || '', busca) || contiene(s.descripcion || '', busca))

  return (
    <div className="modal-bg" style={{ zIndex: 150 }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
        maxWidth:700, maxHeight:'88vh', display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'var(--sh-md)' }}>

        <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontSize:16, fontWeight:500 }}>{titulo}</div>
          <button className="btn btn-s btn-sm" onClick={() => setCreando(true)}>+ Nueva sesión</button>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{ padding:'11px 17px 0' }}>
          <input className="input" autoFocus value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar sesión…"/>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 17px', display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:10 }}>
          {lista.length === 0 && (
            <div className="muted">
              {(sesiones || []).length === 0
                ? 'No hay plantillas en la biblioteca todavía.'
                : 'Ninguna coincide, o ya están todas en esta fase.'}
            </div>
          )}
          {lista.map((s: any) => {
            const nEj = (s.partes || []).reduce((a: number, p: any) => a + (p.ejercicios || []).length, 0)
            const nP = (s.partes || []).length
            const on = marcadas.includes(s.id)
              const col = colorDe ? colorDe(s) : null
              return (
              <div key={s.id} onClick={() => alternar(s.id)}
                style={{ borderRadius:8, padding:'10px 12px', cursor:'pointer',
                  border:`1px solid ${on ? 'var(--g)' : (col ? tinte(col,.45) : 'var(--bd)')}`,
                  background: on ? 'var(--gl)' : (col ? tinte(col,.12) : 'var(--w)'),
                  display:'flex', flexDirection:'column', gap:7 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <span style={{ width:17, height:17, borderRadius:5, flexShrink:0, marginTop:1,
                    border:`1.5px solid ${on ? 'var(--g)' : 'var(--bd)'}`, background: on ? 'var(--g)' : 'transparent',
                    color:'#fff', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {on ? '✓' : ''}
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:'var(--n)' }}>{s.nombre}</div>
                    {s.descripcion && (
                      <div style={{ fontSize:10, color:'var(--gr)', lineHeight:1.4, marginTop:2 }}>
                        {s.descripcion.slice(0,70)}{s.descripcion.length > 70 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {nEj > 0 && <span className="pill pill-o on">{modoDeSesion(s.partes || []).nombre}</span>}
                  <span className="pill pill-soft">{nP} {nP === 1 ? 'parte' : 'partes'}</span>
                  <span className="pill pill-soft">{nEj} {nEj === 1 ? 'ejercicio' : 'ejercicios'}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--gr)' }}>
            {marcadas.length === 0 ? 'Ninguna marcada' : `${marcadas.length} marcada${marcadas.length === 1 ? '' : 's'}`}
          </span>
          <div style={{ flex:1 }}/>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" disabled={marcadas.length === 0}
            onClick={() => { onElegir(marcadas); onCerrar() }}>Añadir</button>
        </div>

        {creando && (
          <ModalEditarSesion sesion={{ nombre: '', partes: [] }}
            ejercicios={ejercicios} etiquetas={etiquetas}
            onGuardado={nacida} onCerrar={() => setCreando(false)}/>
        )}
      </div>
    </div>
  )
}
