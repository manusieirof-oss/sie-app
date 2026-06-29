'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const COLORES = ['#7C9A6B','#6B8F9A','#9A6B8F','#9A8F6B','#C17A54','#54A0A0','#A05454','#6B6B9A']

export default function ObjetivosTab({ objetivos, testsLib, cargar }: any) {
  const [buscar, setBuscar] = useState('')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState<any>({ id:'', nombre:'', descripcion:'', color:COLORES[0], test_id:'' })

  const filtrados = (objetivos||[]).filter((o:any)=>!buscar||o.nombre.toLowerCase().includes(buscar.toLowerCase())||(o.descripcion||'').toLowerCase().includes(buscar.toLowerCase()))

  function abrirNuevo() {
    setForm({ id:'', nombre:'', descripcion:'', color:COLORES[0], test_id:'' })
    setModal(true)
  }
  function abrirEditar(o:any) {
    setForm({ id:o.id, nombre:o.nombre||'', descripcion:o.descripcion||'', color:o.color||COLORES[0], test_id:o.test_id||'' })
    setModal(true)
  }

  async function guardar() {
    if (!form.nombre) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    const payload = { nombre:form.nombre, descripcion:form.descripcion, color:form.color, test_id:form.test_id||null }
    if (form.id) {
      await supabase.from('objetivos').update(payload).eq('id', form.id)
    } else {
      await supabase.from('objetivos').insert(payload)
    }
    setGuardando(false); setModal(false); cargar()
  }

  async function eliminar(o:any) {
    if (!confirm(`¿Eliminar el objetivo "${o.nombre}"? Se quitará de las sesiones y pacientes asociados.`)) return
    await supabase.from('objetivos').delete().eq('id', o.id)
    cargar()
  }

  function nombreTest(id:string) {
    const t = (testsLib||[]).find((t:any)=>t.id===id)
    return t?.nombre || ''
  }

  return (
    <>
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        <input className="input" placeholder="🔍 Buscar objetivo..." value={buscar} onChange={e=>setBuscar(e.target.value)} style={{flex:1,minWidth:200}}/>
        <span style={{fontSize:10,color:'var(--grl)'}}>{filtrados.length} objetivos</span>
        <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo objetivo</button>
      </div>

      {filtrados.length===0?(
        <div style={{textAlign:'center',padding:40,color:'var(--grl)',fontSize:11}}>
          {(objetivos||[]).length===0?'Sin objetivos aún. Crea el primero con + Nuevo objetivo.':'Sin resultados.'}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {filtrados.map((o:any)=>(
            <div key={o.id} className="card" style={{margin:0,display:'flex',flexDirection:'column',gap:8,borderLeft:`3px solid ${o.color||'var(--g)'}`}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:3}}>{o.nombre}</div>
                  {o.descripcion&&<div style={{fontSize:10,color:'var(--gr)',fontWeight:300,lineHeight:1.4}}>{o.descripcion}</div>}
                </div>
              </div>
              {o.test_id&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)',alignSelf:'flex-start'}}>🔍 {nombreTest(o.test_id)}</span>}
              <div style={{display:'flex',gap:5,justifyContent:'flex-end',marginTop:'auto'}}>
                <button className="btn btn-s btn-sm" onClick={()=>abrirEditar(o)}>✏️ Editar</button>
                <button className="btn btn-d btn-sm" onClick={()=>eliminar(o)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)setModal(false)}}>
          <div className="modal">
            <div className="modal-title">{form.id?'Editar objetivo':'Nuevo objetivo'}<button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="field"><label>Nombre *</label>
              <input className="input" value={form.nombre} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))} autoFocus placeholder="ej. Mejorar dorsiflexión tobillo" disabled={guardando}/>
            </div>
            <div className="field"><label>Descripción</label>
              <textarea className="input" value={form.descripcion} onChange={e=>setForm((p:any)=>({...p,descripcion:e.target.value}))} placeholder="Qué se busca conseguir y cómo se mide" disabled={guardando}/>
            </div>
            <div className="field"><label>Color</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                {COLORES.map(c=>(
                  <div key={c} onClick={()=>setForm((p:any)=>({...p,color:c}))} style={{width:26,height:26,borderRadius:'50%',background:c,cursor:'pointer',border:form.color===c?'3px solid var(--n)':'2px solid var(--bd)'}}/>
                ))}
              </div>
            </div>
            <div className="field"><label>Test que lo activa (opcional)</label>
              <select className="input" value={form.test_id} onChange={e=>setForm((p:any)=>({...p,test_id:e.target.value}))} disabled={guardando}>
                <option value="">— Sin test asociado —</option>
                {(testsLib||[]).map((t:any)=><option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>La activación automática por test se configurará más adelante.</div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModal(false)} disabled={guardando}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>{guardando?'⏳ Guardando...':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
