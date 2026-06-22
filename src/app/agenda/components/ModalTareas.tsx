'use client'
import { useState } from 'react'

export default function ModalTareas({ tareas, perfiles, pacientes, userId, crearTarea, completarTarea, borrarTarea, onCerrar }: any) {
  const [titulo, setTitulo] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')
  const [pacienteId, setPacienteId] = useState('')
  const [buscarPac, setBuscarPac] = useState('')
  const [creando, setCreando] = useState(false)
  const [filtroTrab, setFiltroTrab] = useState('todos')
  const [verCompletadas, setVerCompletadas] = useState(false)

  const hoyStr = new Date().toISOString().split('T')[0]

  function nombreTrab(uid) {
    const p = (perfiles||[]).find((x)=>x.user_id===uid)
    return p?p.nombre:'—'
  }
  function nombrePac(pid) {
    const p = (pacientes||[]).find((x)=>x.id===pid)
    return p?`${p.nombre} ${p.apellidos||''}`:''
  }

  const pacFiltrados = buscarPac.trim()
    ? (pacientes||[]).filter((p)=>`${p.nombre} ${p.apellidos||''} ${p.nombre_clinica||''}`.toLowerCase().includes(buscarPac.toLowerCase())).slice(0,5)
    : []

  let lista = (tareas||[]).filter((t)=>verCompletadas?t.completada:!t.completada)
  if (filtroTrab!=='todos') lista = lista.filter((t)=>t.asignado_a===filtroTrab)

  async function guardar() {
    if (!titulo.trim()) return
    setCreando(true)
    await crearTarea(titulo, asignadoA, fechaLimite, pacienteId)
    setTitulo(''); setAsignadoA(''); setFechaLimite(''); setPacienteId(''); setBuscarPac(''); setCreando(false)
  }

  function estadoTarea(t) {
    if (t.completada) return {color:'var(--grl)', label:'completada'}
    if (t.fecha_limite && t.fecha_limite < hoyStr) return {color:'var(--red)', label:'vencida', bg:'var(--redl)', bd:'#F5C8C8'}
    if (t.fecha_limite === hoyStr) return {color:'#7A5800', label:'hoy', bg:'var(--ambl)', bd:'#E8D9A0'}
    return {color:'var(--gr)', label:'', bg:'var(--bl)', bd:'var(--bd)'}
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{width:480,maxHeight:'88vh',overflowY:'auto'}}>
        <div className="modal-title">
          ✓ Tareas del equipo
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.5,textTransform:'uppercase',marginBottom:6}}>Nueva tarea</div>
        <div className="field"><label>Qué hay que hacer</label>
          <input className="input" value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="ej. Llamar a Juan, revisar pagos del mes"/>
        </div>
        <div className="g2">
          <div className="field"><label>Asignar a</label>
            <select className="input" value={asignadoA} onChange={e=>setAsignadoA(e.target.value)}>
              <option value="">Sin asignar</option>
              {(perfiles||[]).map((p)=><option key={p.user_id} value={p.user_id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field"><label>Fecha límite</label>
            <input className="input" type="date" value={fechaLimite} onChange={e=>setFechaLimite(e.target.value)}/>
          </div>
        </div>
        <div className="field"><label>Paciente relacionado (opcional)</label>
          {pacienteId ? (
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,background:'var(--gl)',border:'1px solid var(--gm)'}}>
              <span style={{fontSize:11,flex:1,color:'var(--gd)'}}>{nombrePac(pacienteId)}</span>
              <button onClick={()=>{setPacienteId('');setBuscarPac('')}} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>quitar</button>
            </div>
          ) : (
            <>
              <input className="input" value={buscarPac} onChange={e=>setBuscarPac(e.target.value)} placeholder="Buscar paciente..."/>
              {pacFiltrados.length>0&&(
                <div style={{border:'1px solid var(--bd)',borderRadius:6,marginTop:3,overflow:'hidden'}}>
                  {pacFiltrados.map((p)=>(
                    <div key={p.id} onClick={()=>{setPacienteId(p.id);setBuscarPac('')}} style={{padding:'6px 10px',fontSize:10,cursor:'pointer',borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget).style.background=''}>{p.nombre} {p.apellidos}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
          <button className="btn btn-p" onClick={guardar} disabled={creando||!titulo.trim()}>{creando?'Guardando...':'+ Crear tarea'}</button>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,borderTop:'1px solid var(--bl)',paddingTop:12}}>
          <select className="input" value={filtroTrab} onChange={e=>setFiltroTrab(e.target.value)} style={{flex:1,fontSize:10,padding:'5px 8px'}}>
            <option value="todos">Todos los trabajadores</option>
            {(perfiles||[]).map((p)=><option key={p.user_id} value={p.user_id}>{p.nombre}</option>)}
          </select>
          <button onClick={()=>setVerCompletadas(!verCompletadas)} style={{fontSize:9,padding:'5px 10px',borderRadius:6,border:'1px solid var(--bd)',background:verCompletadas?'var(--gl)':'var(--w)',color:verCompletadas?'var(--gd)':'var(--gr)',cursor:'pointer',whiteSpace:'nowrap'}}>{verCompletadas?'✓ Completadas':'Pendientes'}</button>
        </div>

        {lista.length===0&&<div style={{fontSize:10,color:'var(--grl)',textAlign:'center',padding:'20px',fontStyle:'italic'}}>{verCompletadas?'No hay tareas completadas':'No hay tareas pendientes'}</div>}
        {lista.map((t)=>{
          const est = estadoTarea(t)
          return (
            <div key={t.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 11px',borderRadius:7,border:`1px solid ${est.bd||'var(--bd)'}`,background:est.bg||'var(--bl)',marginBottom:5}}>
              <div onClick={()=>completarTarea(t.id,!t.completada)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${t.completada?'var(--g)':'var(--bm)'}`,background:t.completada?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:1}}>
                {t.completada&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:'var(--n)',fontWeight:400,textDecoration:t.completada?'line-through':'none',opacity:t.completada?.6:1}}>{t.titulo}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:3,fontSize:8,color:'var(--grl)'}}>
                  {t.asignado_a&&<span>👤 {nombreTrab(t.asignado_a)}</span>}
                  {t.fecha_limite&&<span style={{color:est.color,fontWeight:est.label==='vencida'||est.label==='hoy'?600:400}}>📅 {t.fecha_limite}{est.label==='vencida'?' · vencida':est.label==='hoy'?' · hoy':''}</span>}
                  {t.paciente_id&&<span>🔗 {nombrePac(t.paciente_id)}</span>}
                </div>
              </div>
              <button onClick={()=>borrarTarea(t.id)} style={{fontSize:10,color:'var(--grl)',background:'none',border:'none',cursor:'pointer',flexShrink:0,padding:'0 2px'}} title="Eliminar" onMouseOver={e=>(e.currentTarget).style.color='var(--red)'} onMouseOut={e=>(e.currentTarget).style.color='var(--grl)'}>🗑</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
