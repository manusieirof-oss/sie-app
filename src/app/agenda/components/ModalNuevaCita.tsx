'use client'

const HORAS = ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb']

export default function ModalNuevaCita({ fechaDisplay, pacientes, nuevaCita, setNuevaCita, guardando, recuperacionesPaciente, cargarRecuperaciones, crearCita, onCerrar, SesionSelector }: any) {
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
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,fontWeight:300}}>{fechaDisplay}</div>
        <div className="field"><label>Paciente *</label>
          <select className="input" value={nuevaCita.paciente_id} onChange={e=>{setNuevaCita((p:any)=>({...p,paciente_id:e.target.value,es_recuperacion:false,recuperacion_id:''}));cargarRecuperaciones(e.target.value)}} disabled={guardando}>
            <option value="">Seleccionar paciente...</option>
            {pacientes.map((p:any)=>(<option key={p.id} value={p.id}>{p.nombre} {p.apellidos}</option>))}
          </select>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div className="field"><label>Hora</label>
            <select className="input" value={nuevaCita.hora} onChange={e=>setNuevaCita((p:any)=>({...p,hora:e.target.value}))} disabled={guardando}>
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
