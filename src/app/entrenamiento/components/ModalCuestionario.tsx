'use client'
import { useState } from 'react'
import { FORMATOS, guardarCuestionario, preguntasDe } from '@/lib/cuestionarios'

// ---------------------------------------------------------------------------
// CREAR Y EDITAR UN CUESTIONARIO
//
// El formato manda en lo que se le pide a cada pregunta: las opciones solo
// existen cuando hay que elegir, y por eso no salen si no hacen falta.
// ---------------------------------------------------------------------------

export default function ModalCuestionario({ cuestionario, onCerrar, onGuardado }: {
  cuestionario?: any | null
  onCerrar: () => void
  onGuardado: (id?: string) => void
}) {
  const [nombre, setNombre] = useState(cuestionario?.nombre || '')
  const [descripcion, setDescripcion] = useState(cuestionario?.descripcion || '')
  const [preguntas, setPreguntas] = useState<any[]>(
    cuestionario ? preguntasDe(cuestionario) : [])
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [arrastra, setArrastra] = useState<number | null>(null)
  const [sobre, setSobre] = useState<number | null>(null)

  const setP = (i: number, campos: any) =>
    setPreguntas(p => p.map((x, j) => j === i ? { ...x, ...campos } : x))

  const anadir = () => setPreguntas(p => [...p, { nombre: '', formato: 'si_no', opciones: [] }])
  const quitar = (i: number) => setPreguntas(p => p.filter((_, j) => j !== i))
  const mover = (desde: number, hasta: number) =>
    setPreguntas(p => { const c = [...p]; const [x] = c.splice(desde, 1); c.splice(hasta, 0, x); return c })

  async function guardar() {
    setError(''); setGuardando(true)
    const r = await guardarCuestionario({ id: cuestionario?.id, nombre, descripcion, preguntas })
    setGuardando(false)
    if (r.ok === false) { setError(r.error || 'No se pudo guardar.'); return }
    onGuardado(r.id); onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background:'var(--w)', border:'1px solid var(--bd)', borderRadius:14, width:'94vw',
        maxWidth:760, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden',
        boxShadow:'var(--sh-md)' }}>

        <div style={{ padding:'13px 17px', borderBottom:'1px solid var(--bd)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, fontSize:16, fontWeight:500 }}>
            {cuestionario ? 'Editar cuestionario' : 'Nuevo cuestionario'}
          </div>
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          <div className="field"><label>Nombre</label>
            <input className="input" value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Adherencia, dolor percibido, hábitos…"/>
          </div>
          <div className="field"><label>Descripción</label>
            <input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Para qué sirve y cuándo se pasa"/>
          </div>

          <div style={{ borderTop:'1px solid var(--bd)', marginTop:14, paddingTop:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
              <label style={{ flex:1, fontSize:10, fontWeight:500, color:'var(--gr)',
                letterSpacing:'.5px', textTransform:'uppercase' }}>Preguntas</label>
              <button className="btn btn-s btn-sm" onClick={anadir}>+ Añadir pregunta</button>
            </div>

            {preguntas.length === 0 && (
              <div style={{ fontSize:11, color:'var(--gr)' }}>
                Sin preguntas todavía. Empieza por la que de verdad quieres saber.
              </div>
            )}

            {preguntas.map((p, i) => (
              <div key={i}
                onDragOver={e => { if (arrastra === null) return; e.preventDefault(); if (sobre !== i) setSobre(i) }}
                onDragLeave={() => { if (sobre === i) setSobre(null) }}
                onDrop={e => { if (arrastra === null) return; e.preventDefault(); mover(arrastra, i); setArrastra(null); setSobre(null) }}
                style={{ border:'1px solid var(--bd)', borderRadius:7, padding:11, marginBottom:8,
                  opacity: arrastra === i ? .4 : 1,
                  boxShadow: (sobre === i && arrastra !== null && arrastra !== i) ? 'inset 3px 0 0 var(--gd)' : undefined }}>

                <div style={{ display:'flex', gap:7, alignItems:'center' }}>
                  <span draggable title="Arrastra para cambiar el orden"
                    onDragStart={() => setArrastra(i)}
                    onDragEnd={() => { setArrastra(null); setSobre(null) }}
                    style={{ cursor: arrastra !== null ? 'grabbing' : 'grab', color:'var(--grl)', fontSize:17,
                      lineHeight:1, flexShrink:0, userSelect:'none', padding:'2px 3px' }}>⠿</span>
                  <span style={{ fontSize:11, color:'var(--grl)', width:14, textAlign:'right', flexShrink:0 }}>{i + 1}</span>
                  <input className="input" style={{ flex:1 }} value={p.nombre}
                    onChange={e => setP(i, { nombre: e.target.value })} placeholder="¿Qué le preguntas?"/>
                  <select className="input" style={{ width:150 }} value={p.formato}
                    onChange={e => setP(i, { formato: e.target.value })}>
                    {FORMATOS.map(f => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
                  </select>
                  <button className="btn btn-s btn-sm" title="Quitar" onClick={() => quitar(i)}>✕</button>
                </div>

                {/* Las opciones solo existen cuando hay que elegir. */}
                {(p.formato === 'una' || p.formato === 'varias') && (
                  <div style={{ marginTop:8, marginLeft:38 }}>
                    <div style={{ fontSize:10, fontWeight:500, color:'var(--gr)', letterSpacing:'.5px',
                      textTransform:'uppercase', marginBottom:5 }}>Opciones</div>
                    {(p.opciones || []).map((o: string, k: number) => (
                      <div key={k} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:5 }}>
                        <input className="input" style={{ flex:1 }} value={o}
                          onChange={e => setP(i, { opciones: (p.opciones || []).map((y: string, m: number) => m === k ? e.target.value : y) })}
                          placeholder={`Opción ${k + 1}`}/>
                        <button className="btn btn-s btn-sm"
                          onClick={() => setP(i, { opciones: (p.opciones || []).filter((_: string, m: number) => m !== k) })}>✕</button>
                      </div>
                    ))}
                    <button className="btn btn-t btn-sm"
                      onClick={() => setP(i, { opciones: [...(p.opciones || []), ''] })}>+ Opción</button>
                  </div>
                )}

                <div style={{ fontSize:10, color:'var(--grl)', marginTop:6, marginLeft:38 }}>
                  {FORMATOS.find(f => f.valor === p.formato)?.ayuda}
                </div>
              </div>
            ))}
          </div>

          {error && <div style={{ fontSize:12, color:'var(--red)', marginTop:10 }}>{error}</div>}
        </div>

        <div style={{ padding:'12px 17px', borderTop:'1px solid var(--bd)', display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-s" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cuestionario'}
          </button>
        </div>
      </div>
    </div>
  )
}
