'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
  colorDe,
  /** Si se elige para un paciente: se puede filtrar por sus objetivos abiertos. */
  pacienteId,
  /** Los objetivos de la FASE a la que se anaden, si los tiene: [{ id, nombre }]. */
  objetivosFase = [] }: any) {
  const [creando, setCreando] = useState(false)
  const [busca, setBusca] = useState('')
  const [marcadas, setMarcadas] = useState<string[]>([])

  /**
   * POR SUS OBJETIVOS. Programando a alguien la pregunta no es "que sesion se llama
   * asi", es "que sesion trabaja lo que tiene abierto". Se leen aqui sus objetivos
   * abiertos y los objetivos de cada sesion, sin depender de que quien abre el
   * selector los traiga: lo abren dos pantallas y cada una trae las sesiones a su modo.
   * Varios marcados = cualquiera de ellos.
   */
  const [objsPac, setObjsPac] = useState<{ id: string, nombre: string }[]>([])
  const [objsSes, setObjsSes] = useState<Record<string, string[]>>({})
  const [filtroObj, setFiltroObj] = useState<string[]>([])
  useEffect(() => {
    if (!pacienteId) { setObjsPac([]); return }
    supabase.from('pacientes_objetivos').select('objetivo_id, nombre, logrado, objetivos(nombre)')
      .eq('paciente_id', pacienteId).then(({ data }) => setObjsPac((data || [])
        .filter((r: any) => !r.logrado && r.objetivo_id)
        .map((r: any) => ({ id: r.objetivo_id, nombre: r.nombre || r.objetivos?.nombre || 'Objetivo' }))))
  }, [pacienteId])
  // Por la lista de ids y no por el array: quien abre el selector puede rehacerlo en
  // cada render, y eso relanzaria la consulta sin que haya cambiado nada.
  const claveIds = (sesiones || []).map((s: any) => s.id).filter(Boolean).join(',')
  const hayFiltro = !!pacienteId || (objetivosFase || []).length > 0
  useEffect(() => {
    if (!hayFiltro) return
    const ids = claveIds ? claveIds.split(',') : []
    if (ids.length === 0) return
    supabase.from('sesiones_objetivos').select('sesion_id, objetivo_id').in('sesion_id', ids).then(({ data }) => {
      const m: Record<string, string[]> = {}
      ;(data || []).forEach((r: any) => { (m[r.sesion_id] = m[r.sesion_id] || []).push(r.objetivo_id) })
      setObjsSes(m)
    })
  }, [hayFiltro, claveIds])
  /**
   * Las dos listas por las que se filtra: la de la FASE (montando un ciclo, lo que esa
   * fase tiene que conseguir) y la del PACIENTE (lo que tiene abierto). En el ciclo de
   * un paciente salen las dos; un objetivo que esta en ambas sale una vez, en la fase.
   */
  const deFase = (objetivosFase || []) as { id: string, nombre: string }[]
  const delPac = objsPac.filter(o => !deFase.some(x => x.id === o.id))
  const susObjs = new Set([...deFase, ...objsPac].map(o => o.id))
  const deSusObjs = (s: any) => (objsSes[s.id] || []).filter(id => susObjs.has(id))

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
    .filter((s: any) => filtroObj.length === 0 || (objsSes[s.id] || []).some(id => filtroObj.includes(id)))

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
          {[['De la fase', deFase], ['Sus objetivos', delPac]].map(([titulo, lista]: any) => lista.length > 0 && (
            <div key={titulo} style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center', marginTop:8 }}>
              <span style={{ fontSize:10, fontWeight:600, color:'var(--grl)', letterSpacing:.5, textTransform:'uppercase' }}>{titulo}</span>
              {lista.map((o: any) => (
                <button key={o.id} type="button"
                  className={`chip-sel ${filtroObj.includes(o.id) ? 'on' : ''}`}
                  onClick={() => setFiltroObj(p => p.includes(o.id) ? p.filter(x => x !== o.id) : [...p, o.id])}>
                  {o.nombre}
                </button>
              ))}
            </div>
          ))}
          {filtroObj.length > 0 && (
            <button type="button" className="btn btn-t btn-sm" style={{ marginTop:6 }} onClick={() => setFiltroObj([])}>Quitar filtro</button>
          )}
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'12px 17px', display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:10 }}>
          {lista.length === 0 && (
            <div className="muted">
              {(sesiones || []).length === 0
                ? 'No hay plantillas en la biblioteca todavía.'
                : filtroObj.length > 0
                ? 'Ninguna sesión trabaja esos objetivos. Puedes crearla con + Nueva sesión.'
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
                  {/* Cuantos de SUS objetivos trabaja: se ve sin filtrar. */}
                  {deSusObjs(s).length > 0 && (
                    <span className="pill pill-o on" title={[...deFase, ...delPac].filter(o => deSusObjs(s).includes(o.id)).map(o => o.nombre).join(' · ')}>
                      ◎ {deSusObjs(s).length} objetivo{deSusObjs(s).length === 1 ? '' : 's'}
                    </span>
                  )}
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
