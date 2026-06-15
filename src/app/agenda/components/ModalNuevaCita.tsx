'use client'
import { useState } from 'react'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb']

export default function ModalNuevaCita({ fechaDisplay, pacientes, nuevaCita, setNuevaCita, guardando, recuperacionesPaciente, cargarRecuperaciones, crearCita, onCerrar, SesionSelector, horas }: any) {
  const [busquedaPac, setBusquedaPac] = useState('')
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  function toggleDia(dia: string) {
    setNuevaCita((p: any) => ({...p, dias_repetir: p.dias_repetir.includes(dia) ? p.dias_repetir.filter((d: string) => d !== dia) : [...p.dias_repetir, dia]}))
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget&&!guardando)onCerrar()}}>
      <div className="modal" style={{width:460}}>
        <div className="modal-title">
          Nueva cita
          <button className="modal-close" onClick={()=>{if(!guardando)onCerrar()}}>✕</button>
        </div>
        <div className="field"><label>Día de la cita *</label>
          <input type="date" className="input" value={nuevaCita.fecha||''} onChange={e=>setNuevaCita((p:any)=>({...p,fecha:e.target.value}))} disabled={guardando}/>
        </div>
        <div className="field"><label>Paciente *</label>
          {nuevaCita.paciente_id ? (
            (() => {
              const sel = pacientes.find((p:any)=>p.id===nuevaCita.paciente_id)
              return (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',borderRadius:6,border:'1.5px solid var(--g)',background:'var(--gl)'}}>
                  <span style={{flex:1,fontSize:12,color:'var(--n)',fontWeight:500}}>{sel?`${sel.nombre} ${sel.apellidos}`:'Paciente'}</span>
                  <button onClick={()=>{setNuevaCita((p:any)=>({...p,paciente_id:'',es_recuperacion:false,recuperacion_id:''}));setBusquedaPac('')}} disabled={guardando} style={{fontSize:10,color:'var(--g)',background:'none',border:'none',cursor:'pointer'}}>Cambiar</button>
                </div>
              )
            })()
          ) : (
            <>
              <input className="input" value={busquedaPac} onChange={e=>setBusquedaPac(e.target.value)} placeholder="🔍 Buscar paciente por nombre..." disabled={guardando} autoFocus/>
              {busquedaPac && (
                <div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:200,overflowY:'auto',marginTop:4}}>
                  {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPac.toLowerCase())).slice(0,30).map((p:any)=>(
                    <div key={p.id} onClick={()=>{setNuevaCita((prev:any)=>({...prev,paciente_id:p.id,es_recuperacion:false,recuperacion_id:''}));cargarRecuperaciones(p.id);setBusquedaPac('')}} style={{padding:'8px 11px',cursor:'pointer',fontSize:11,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                      {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--grl)',fontSize:9}}> · {p.nombre_clinica}</span>:null}
                    </div>
                  ))}
                  {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPac.toLowerCase())).length===0 && (
                    <div style={{padding:'8px 11px',fontSize:10,color:'var(--grl)'}}>Sin pacientes que coincidan</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div className="field"><label>Hora</label>
            <select className="input" value={nuevaCita.hora} onChange={e=>setNuevaCita((p:any)=>({...p,hora:e.target.value}))} disabled={guardando}>
              <option value="">Elegir hora...</option>
              {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="field"><label>Sala</label>
            <select className="input" value={nuevaCita.sala} onChange={e=>setNuevaCita((p:any)=>({...p,sala:e.target.value}))} disabled={guardando}>
              <option value="A">Sala A</option>
              <option value="B">Sala B</option>
            </select>
          </div>
        </div>
        <div className="field"><label>Tipo</label>
          <select className="input" value={nuevaCita.tipo} onChange={e=>setNuevaCita((p:any)=>({...p,tipo:e.target.value}))} disabled={guardando}>
            <option value="clase">Clase grupal</option>
            <option value="individual">Individual / Pareja</option>
            <option value="valoracion">Valoración inicial (60 min)</option>
            <option value="revaloracion">Revaloración (60 min)</option>
          </select>
        </div>
        <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:'10px 12px',marginBottom:10}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:nuevaCita.repetir?10:0}}>
            <div>
              <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>¿Repetir esta cita?</div>
              <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Crear citas recurrentes automáticamente</div>
            </div>
            <button className="toggle" style={{background:nuevaCita.repetir?'var(--g)':'var(--bm)'}} onClick={()=>setNuevaCita((p:any)=>({...p,repetir:!p.repetir}))}/>
          </div>
          {nuevaCita.repetir&&(
            <>
              <div className="field"><label>Días de la semana</label>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
                  {DIAS_SEMANA.map(d=>(
                    <button key={d} onClick={()=>toggleDia(d)}
                      style={{fontSize:10,padding:'4px 9px',borderRadius:99,border:`1px solid ${nuevaCita.dias_repetir.includes(d)?'var(--g)':'var(--bd)'}`,background:nuevaCita.dias_repetir.includes(d)?'var(--g)':'var(--w)',color:nuevaCita.dias_repetir.includes(d)?'#fff':'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field"><label>Hasta cuándo</label>
                <select className="input" value={nuevaCita.periodo} onChange={e=>setNuevaCita((p:any)=>({...p,periodo:e.target.value,fecha_fin:''}))} disabled={guardando}>
                  <option value="1mes">1 mes</option>
                  <option value="3meses">3 meses</option>
                  <option value="6meses">6 meses</option>
                  <option value="1anio">1 año</option>
                  <option value="personalizado">Fecha personalizada</option>
                </select>
              </div>
              {nuevaCita.periodo==='personalizado'&&(
                <div className="field"><label>Fecha fin</label>
                  <input type="date" className="input" value={nuevaCita.fecha_fin} onChange={e=>setNuevaCita((p:any)=>({...p,fecha_fin:e.target.value}))} disabled={guardando}/>
                </div>
              )}
              <div style={{background:'var(--gl)',borderRadius:5,padding:'6px 9px',fontSize:9,color:'var(--gd)'}}>✓ Se crearán todas las citas automáticamente</div>
            </>
          )}
        </div>
        {nuevaCita.paciente_id && recuperacionesPaciente.length>0 && (
          <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:'var(--rl)',padding:'10px 12px',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:nuevaCita.es_recuperacion?8:0}}>
              <div>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>¿Es clase de recuperación?</div>
                <div style={{fontSize:9,color:'#7A5800',fontWeight:300}}>{recuperacionesPaciente.length} falta{recuperacionesPaciente.length>1?'s':''} pendiente{recuperacionesPaciente.length>1?'s':''}</div>
              </div>
              <button className="toggle" style={{background:nuevaCita.es_recuperacion?'var(--g)':'var(--bm)'}} onClick={()=>setNuevaCita((p:any)=>({...p,es_recuperacion:!p.es_recuperacion,recuperacion_id:''}))}/>
            </div>
            {nuevaCita.es_recuperacion && (
              <select className="input" value={nuevaCita.recuperacion_id} onChange={e=>setNuevaCita((p:any)=>({...p,recuperacion_id:e.target.value}))}>
                <option value="">Seleccionar falta...</option>
                {recuperacionesPaciente.map((r:any)=>(
                  <option key={r.id} value={r.id}>
                    Falta del {new Date(r.fecha_falta+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})} · vence {new Date(r.fecha_limite+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        <div className="field"><label>Notas (opcional)</label>
          <input className="input" value={nuevaCita.notas} onChange={e=>setNuevaCita((p:any)=>({...p,notas:e.target.value}))} placeholder="ej. Molestia lumbar, precaución..." disabled={guardando}/>
        </div>
        {nuevaCita.paciente_id && (
          <div className="field">
            <label>Sesión de entrenamiento (opcional)</label>
            <SesionSelector pacienteId={nuevaCita.paciente_id} sesionId={nuevaCita.sesion_id} onChange={(id:string)=>setNuevaCita((p:any)=>({...p,sesion_id:id}))}/>
          </div>
        )}
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={()=>{if(!guardando)onCerrar()}} disabled={guardando}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={crearCita} disabled={guardando}>
            {guardando?'⏳ Creando...':'✓ Crear cita'}
          </button>
        </div>
      </div>
    </div>
  )
}
