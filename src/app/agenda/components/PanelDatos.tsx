'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']

export default function PanelDatos({ panelPac, editandoCita, setEditandoCita, guardando, guardarEdicionCita, cambiarEstado, horas }: any) {
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  const [modalNota, setModalNota] = useState(false)
  const [modalAviso, setModalAviso] = useState(false)
  const [textoNota, setTextoNota] = useState('')
  const [tipoNota, setTipoNota] = useState('info')
  const [evaRapido, setEvaRapido] = useState(5)
  const [textoAviso, setTextoAviso] = useState('')
  const [fechaAviso, setFechaAviso] = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)

  const bonoLabel: Record<string,string> = {esencial:'Esencial · 2d/sem',progreso:'Progreso · 3d/sem',avanzado:'Avanzado · 4d/sem',avanzado_mas1:'Avanzado+1 · 5d/sem',individual:'Individual'}
  const pagoColor: Record<string,string> = {pagado:'var(--g)',pendiente:'var(--red)',parcial:'var(--amb)'}

  async function guardarNotaRapida() {
    if (!textoNota.trim()) return
    setGuardandoNota(true)
    const texto = tipoNota==='molestia' ? `🤕 Molestia (EVA ${evaRapido}/10): ${textoNota}` : textoNota
    await supabase.from('notas').insert({ paciente_id: panelPac.paciente_id, texto, tipo: 'info', fecha: new Date().toISOString().split('T')[0], visible_agenda: false })
    setTextoNota(''); setModalNota(false); setGuardandoNota(false)
    alert('✓ Nota guardada en el historial del paciente')
  }

  async function guardarAviso() {
    if (!textoAviso.trim() || !fechaAviso) return
    setGuardandoNota(true)
    await supabase.from('notas').insert({ paciente_id: panelPac.paciente_id, texto: `🔔 ${textoAviso}`, tipo: 'urgente', fecha: fechaAviso, visible_agenda: true })
    setTextoAviso(''); setFechaAviso(''); setModalAviso(false); setGuardandoNota(false)
    alert('✓ Aviso guardado')
  }

  const esPasada = panelPac.fecha <= new Date().toISOString().split('T')[0]
  const estado = panelPac.estado

  return (
    <div style={{padding:11}}>
      {/* DATOS CONTACTO */}
      {panelPac.pacientes?.telefono&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>📞 {panelPac.pacientes.telefono}</div>}
      {panelPac.pacientes?.email&&<div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:6}}>✉️ {panelPac.pacientes.email}</div>}
      <div style={{fontSize:11,color:'var(--n)',fontWeight:300,marginBottom:12}}>🏷 {panelPac.pacientes?.tipo_clase||'—'}</div>

      {/* BONO */}
      {panelPac.bono_info&&(
        <div style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',marginBottom:12,border:'1px solid var(--bd)'}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:4}}>Bono</div>
          <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{bonoLabel[panelPac.bono_info.tipo]||panelPac.bono_info.tipo}</div>
          <div style={{fontSize:10,fontWeight:500,color:pagoColor[panelPac.bono_info.estado_pago]||'var(--grl)',marginTop:2}}>
            {panelPac.bono_info.estado_pago==='pagado'?'✓ Pagado':panelPac.bono_info.estado_pago==='pendiente'?'⚠ Pendiente':'◑ Parcial'}
          </div>
        </div>
      )}

      {/* BOTONES NOTA RÁPIDA Y AVISO */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        <button onClick={()=>setModalNota(true)} style={{flex:1,fontSize:10,padding:'7px 8px',borderRadius:'var(--r)',border:'1px solid var(--bd)',background:'var(--bl)',color:'var(--n)',cursor:'pointer',fontFamily:'system-ui',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
          📝 Nota rápida
        </button>
        <button onClick={()=>setModalAviso(true)} style={{flex:1,fontSize:10,padding:'7px 8px',borderRadius:'var(--r)',border:'1px solid var(--amb)',background:'var(--ambl)',color:'#7A5800',cursor:'pointer',fontFamily:'system-ui',display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
          🔔 Aviso
        </button>
      </div>

      {/* EDITAR CITA */}
      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        Datos de la cita
        <button className="btn btn-t btn-sm" onClick={()=>setEditandoCita(editandoCita?null:{...panelPac})}>{editandoCita?'Cancelar':'✎ Editar'}</button>
      </div>
      {editandoCita?(
        <div style={{marginBottom:12}}>
          <div className="field"><label>Hora</label>
            <select className="input" value={editandoCita.hora?.slice(0,5)||''} onChange={e=>setEditandoCita((p:any)=>({...p,hora:e.target.value+':00'}))}>
              {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="field"><label>Sala</label>
            <select className="input" value={editandoCita.sala||''} onChange={e=>setEditandoCita((p:any)=>({...p,sala:e.target.value}))}>
              <option value="A">Sala A</option><option value="B">Sala B</option>
            </select>
          </div>
          <div className="field"><label>Tipo</label>
            <select className="input" value={editandoCita.tipo||''} onChange={e=>setEditandoCita((p:any)=>({...p,tipo:e.target.value}))}>
              <option value="clase">Clase grupal</option>
              <option value="individual">Individual</option>
              <option value="valoracion">Valoración</option>
              <option value="revaloracion">Revaloración</option>
            </select>
          </div>
          <div className="field"><label>Notas</label>
            <input className="input" value={editandoCita.notas||''} onChange={e=>setEditandoCita((p:any)=>({...p,notas:e.target.value}))} placeholder="Notas sobre esta cita..."/>
          </div>
          <button className="btn btn-p" style={{width:'100%',justifyContent:'center'}} onClick={guardarEdicionCita} disabled={guardando}>
            {guardando?'⏳ Guardando...':'💾 Guardar cambios'}
          </button>
        </div>
      ):(
        <div style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',marginBottom:12,fontSize:10,color:'var(--n)',fontWeight:300}}>
          <div>{panelPac.hora?.slice(0,5)} · Sala {panelPac.sala} · {panelPac.tipo}</div>
          {panelPac.notas&&<div style={{marginTop:4,color:'var(--gr)'}}>{panelPac.notas}</div>}
        </div>
      )}

      {/* ESTADO */}
      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:7}}>Estado de la cita</div>
      <div style={{marginBottom:12}}>
        <div style={{padding:'6px 10px',borderRadius:5,marginBottom:8,background:estado==='realizada'?'var(--gl)':estado==='falta'?'var(--redl)':estado==='cancelada'?'var(--bm)':'var(--ambl)',border:`1px solid ${estado==='realizada'?'var(--gm)':estado==='falta'?'#F5C8C8':estado==='cancelada'?'var(--bd)':'var(--amb)'}`,fontSize:10,fontWeight:500,color:estado==='realizada'?'var(--gd)':estado==='falta'?'var(--red)':estado==='cancelada'?'var(--gr)':'#7A5800'}}>
          {estado==='realizada'?'✓ Realizada':estado==='falta'?'✗ Falta':estado==='cancelada'?'Cancelada':'⏳ Programada'}
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {esPasada&&estado!=='falta'&&estado!=='cancelada'&&<button onClick={()=>cambiarEstado(panelPac.id,'falta')} style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--red)',background:'var(--redl)',color:'var(--red)',cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>✗ Marcar falta</button>}
          {estado==='falta'&&<button onClick={()=>cambiarEstado(panelPac.id,'realizada')} style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>↩ Deshacer falta</button>}
          {estado!=='cancelada'&&<button onClick={()=>cambiarEstado(panelPac.id,'cancelada')} style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>Cancelar cita</button>}
          {estado==='cancelada'&&<button onClick={()=>cambiarEstado(panelPac.id,'programada')} style={{fontSize:10,padding:'5px 12px',borderRadius:'var(--r)',border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui'}}>↩ Reactivar</button>}
        </div>
      </div>

      {/* MODAL NOTA RÁPIDA */}
      {modalNota&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNota(false)}}>
          <div className="modal">
            <div className="modal-title">📝 Nota rápida · {panelPac.pacientes?.nombre}<button className="modal-close" onClick={()=>setModalNota(false)}>✕</button></div>
            <div className="field"><label>Tipo</label>
              <div style={{display:'flex',gap:6,marginTop:4}}>
                {[['info','📋 General'],['molestia','🤕 Molestia']].map(([v,l])=>(
                  <span key={v} onClick={()=>setTipoNota(v)} style={{flex:1,padding:'6px',borderRadius:6,border:`1.5px solid ${tipoNota===v?'var(--g)':'var(--bd)'}`,background:tipoNota===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,color:tipoNota===v?'var(--gd)':'var(--gr)'}}>{l}</span>
                ))}
              </div>
            </div>
            {tipoNota==='molestia'&&(
              <div className="field">
                <label>Intensidad EVA ({evaRapido}/10)</label>
                <input type="range" min={0} max={10} value={evaRapido} onChange={e=>setEvaRapido(parseInt(e.target.value))} style={{width:'100%',accentColor:'var(--red)'}}/>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--grl)'}}><span>0</span><span style={{color:'var(--red)',fontWeight:500}}>{evaRapido}</span><span>10</span></div>
              </div>
            )}
            <div className="field"><label>Nota *</label>
              <textarea className="input" style={{minHeight:80}} value={textoNota} onChange={e=>setTextoNota(e.target.value)} autoFocus placeholder={tipoNota==='molestia'?'ej. Molestia en rodilla derecha al bajar escaleras...':'ej. Comenta que esta semana ha estado muy cargado de trabajo...'}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalNota(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarNotaRapida} disabled={guardandoNota||!textoNota.trim()}>{guardandoNota?'⏳':'💾 Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AVISO */}
      {modalAviso&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalAviso(false)}}>
          <div className="modal">
            <div className="modal-title">🔔 Aviso · {panelPac.pacientes?.nombre}<button className="modal-close" onClick={()=>setModalAviso(false)}>✕</button></div>
            <div className="field"><label>Fecha del aviso *</label>
              <input type="date" className="input" value={fechaAviso} onChange={e=>setFechaAviso(e.target.value)} min={new Date().toISOString().split('T')[0]}/>
            </div>
            <div className="field"><label>Descripción *</label>
              <textarea className="input" style={{minHeight:70}} value={textoAviso} onChange={e=>setTextoAviso(e.target.value)} autoFocus placeholder="ej. Cita con traumatólogo, posible cambio de entreno..."/>
            </div>
            <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>⚡ El aviso aparecerá en la agenda ese día y en el historial del paciente.</div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalAviso(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarAviso} disabled={guardandoNota||!textoAviso.trim()||!fechaAviso}>{guardandoNota?'⏳':'💾 Guardar aviso'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
