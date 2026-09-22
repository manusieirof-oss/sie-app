'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { contiene } from '@/lib/texto'
import { cargarCuestionarios, borrarCuestionario, preguntasDe, textoFormato } from '@/lib/cuestionarios'
import ModalCuestionario from './ModalCuestionario'

// ---------------------------------------------------------------------------
// CUESTIONARIOS
//
// Viven en la misma tabla que los tests pero en su propia pestana: lo que se
// hace con ellos es distinto —se responden, no se miden— y mezclarlos en la
// lista obligaria a mirar cada ficha para saber cual es cual.
// ---------------------------------------------------------------------------

export default function CuestionariosTab() {
  const [lista, setLista] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<any>(undefined)

  useEffect(() => { cargar() }, [])
  async function cargar() {
    setCargando(true)
    setLista(await cargarCuestionarios())
    setCargando(false)
  }

  async function eliminar(c: any) {
    if (confirm(`¿Borrar «${c.nombre}»? Las respuestas ya registradas se quedan.`) === false) return
    const r = await borrarCuestionario(c.id)
    if (r.ok === false) { alert(r.error); return }
    cargar()
  }

  const filtrados = lista.filter(c =>
    contiene(c.nombre || '', busca) || contiene(c.descripcion || '', busca))

  return (
    <div className="panel">
      <div className="sec">
        <div className="sec-h">
          <span className="sh-l">
            <span className="ct-l"><Ic name="nota" size={13}/> Cuestionarios</span>
            <button className="btn btn-p btn-sm" onClick={() => setEditando(null)}>+ Nuevo</button>
          </span>
          <span className="sh-r">{cargando ? 'Cargando…' : `${lista.length} en total`}</span>
        </div>

        {lista.length > 0 && (
          <input className="input" style={{ maxWidth: 330, marginBottom: 12 }}
            value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cuestionario…"/>
        )}

        {cargando === false && lista.length === 0 && (
          <div className="muted">
            Ninguno todavía. Un cuestionario son preguntas con respuesta corta, de elegir
            una o varias, o de sí y no. A diferencia de un test, no mide: recoge lo que
            dice el paciente.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 11 }}>
          {filtrados.map(c => {
            const pregs = preguntasDe(c)
            const formatos = Array.from(new Set(pregs.map(p => p.formato)))
            return (
              <div key={c.id} className="test-clic" onClick={() => setEditando(c)}
                style={{ border: '1px solid var(--bd)', borderRadius: 7, padding: '11px 12px', background: 'var(--w)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--n)' }}>{c.nombre}</div>
                  <button className="btn btn-s btn-sm" title="Borrar"
                    onClick={e => { e.stopPropagation(); eliminar(c) }}>✕</button>
                </div>
                {c.descripcion && (
                  <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 4, lineHeight: 1.4 }}>
                    {c.descripcion.slice(0, 80)}{c.descripcion.length > 80 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 7 }}>
                  {pregs.length} pregunta{pregs.length === 1 ? '' : 's'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {formatos.map(f => <span key={f} className="pill pill-soft">{textoFormato(f)}</span>)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editando !== undefined && (
        <ModalCuestionario cuestionario={editando}
          onCerrar={() => setEditando(undefined)} onGuardado={cargar}/>
      )}
    </div>
  )
}
