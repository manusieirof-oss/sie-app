'use client'
import BuscadorPacientes from '@/components/BuscadorPacientes'
import { AvisoBonoEnCita } from '@/components/SesionesBono'
import { planDeFechas, planDeFechasAlterno, finDePeriodo, type Periodo } from '@/lib/citas'

const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb']

export default function ModalNuevaCita({ fechaDisplay, pacientes, nuevaCita, setNuevaCita, guardando, recuperacionesPaciente, cargarRecuperaciones, crearCita, onCerrar, SesionSelector, horas, tiposCita=[], tiposClase=[], salas=['A','B'] }: any) {
  const HORAS = horas && horas.length > 0 ? horas : ['08:30','09:30','10:30','11:30','15:30','16:30','17:30','18:30','19:30','20:30','21:30']
  // Cuántas citas se van a crear de verdad, con la misma función que las crea.
  // Contarlas aquí por otro camino sería una segunda cuenta que podría no
  // coincidir con la primera.
  let nCitas = 1
  if (nuevaCita.repetir && nuevaCita.fecha) {
    const fin = nuevaCita.fecha_fin || finDePeriodo(nuevaCita.fecha, nuevaCita.periodo as Periodo)
    if (nuevaCita.alterno) {
      const { fechasA, fechasB } = planDeFechasAlterno(nuevaCita.fecha, fin, nuevaCita.dias_repetir||[], nuevaCita.dias_repetir_b||[])
      nCitas = fechasA.length + fechasB.length
    } else if (nuevaCita.dias_repetir?.length) {
      nCitas = planDeFechas(nuevaCita.fecha, fin, nuevaCita.dias_repetir).length
    } else nCitas = 0
  }

  function toggleDia(dia: string, key: string = 'dias_repetir') {
    setNuevaCita((p: any) => { const arr = p[key]||[]; return {...p, [key]: arr.includes(dia) ? arr.filter((d: string) => d !== dia) : [...arr, dia]} })
  }
  const chipsDias = (key: string) => (
    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}>
      {DIAS_SEMANA.map(d=>{ const on=(nuevaCita[key]||[]).includes(d); return (
        <button key={d} onClick={()=>toggleDia(d,key)}
          style={{fontSize:10,padding:'4px 9px',borderRadius:99,border:`1px solid ${on?'var(--g)':'var(--bd)'}`,background:on?'var(--g)':'var(--w)',color:on?'#fff':'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>{d}</button>
      )})}
    </div>
  )

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
          <div style={{display:'flex',gap:2,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:2,marginBottom:7,width:'fit-content'}}>
            {[{v:false,l:'Existente'},{v:true,l:'Nuevo'}].map(({v,l})=>(
              <button key={String(v)} onClick={()=>setNuevaCita((p:any)=>({...p,nuevo:v,...(v?{paciente_id:'',es_recuperacion:false,recuperacion_id:''}:{nuevo_nombre:'',nuevo_telefono:''})}))} disabled={guardando}
                style={{fontSize:10,padding:'4px 12px',borderRadius:4,border:'none',cursor:'pointer',fontFamily:'system-ui',background:!!nuevaCita.nuevo===v?'var(--g)':'transparent',color:!!nuevaCita.nuevo===v?'#fff':'var(--grl)',fontWeight:!!nuevaCita.nuevo===v?500:300}}>{l}</button>
            ))}
          </div>
          {nuevaCita.nuevo ? (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <input className="input" value={nuevaCita.nuevo_nombre||''} onChange={e=>setNuevaCita((p:any)=>({...p,nuevo_nombre:e.target.value}))} placeholder="Nombre y apellidos" disabled={guardando} autoFocus/>
                <input className="input" value={nuevaCita.nuevo_telefono||''} onChange={e=>setNuevaCita((p:any)=>({...p,nuevo_telefono:e.target.value}))} placeholder="Teléfono" disabled={guardando}/>
              </div>
              <div style={{fontSize:9,color:'var(--gd)',background:'var(--gl)',borderRadius:5,padding:'6px 9px',marginTop:6,display:'flex',alignItems:'center',gap:5}}><span>ℹ</span> Se crea como <b style={{fontWeight:600}}>pendiente de valoración</b>; completas sus datos al hacer la valoración.</div>
            </>
          ) : (
            <BuscadorPacientes
              pacientes={pacientes}
              valor={nuevaCita.paciente_id}
              disabled={guardando}
              autoFocus
              onElegir={(p:any)=>{
                setNuevaCita((prev:any)=>({...prev,paciente_id:p.id,es_recuperacion:false,recuperacion_id:'',
                  ...(p.tipo_clase&&tiposClase.some((t:any)=>t.valor===p.tipo_clase)?{tipo:p.tipo_clase}:{})}))
                cargarRecuperaciones(p.id)
              }}
              onLimpiar={()=>setNuevaCita((p:any)=>({...p,paciente_id:'',es_recuperacion:false,recuperacion_id:''}))}/>
          )}
        </div>
        {!(nuevaCita.repetir && nuevaCita.alterno) && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field"><label>Hora</label>
              <select className="input" value={nuevaCita.hora} onChange={e=>setNuevaCita((p:any)=>({...p,hora:e.target.value}))} disabled={guardando}>
                <option value="">Elegir hora...</option>
                {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="field"><label>Sala</label>
              <select className="input" value={nuevaCita.sala} onChange={e=>setNuevaCita((p:any)=>({...p,sala:e.target.value}))} disabled={guardando}>
                {salas.map((s:string)=><option key={s} value={s}>Sala {s}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="field"><label>Tipo</label>
          <select className="input" value={nuevaCita.tipo} onChange={e=>setNuevaCita((p:any)=>({...p,tipo:e.target.value}))} disabled={guardando}>
            {tiposClase.map((t:any)=><option key={t.valor} value={t.valor}>{t.nombre} ({t.duracion} min)</option>)}
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
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:8,marginBottom:10}}>
                <div>
                  <div style={{fontSize:11,color:'var(--n)'}}>Horario alterno</div>
                  <div style={{fontSize:9,color:'var(--gd)'}}>Cambia hora, sala y días cada semana</div>
                </div>
                <button className="toggle" style={{background:nuevaCita.alterno?'var(--g)':'var(--bm)'}} onClick={()=>setNuevaCita((p:any)=>({...p,alterno:!p.alterno,...(!p.alterno?{hora_b:p.hora_b||p.hora,sala_b:p.sala_b||p.sala,dias_repetir_b:(p.dias_repetir_b&&p.dias_repetir_b.length)?p.dias_repetir_b:[...(p.dias_repetir||[])]}:{})}))}/>
              </div>

              {!nuevaCita.alterno ? (
                <div className="field"><label>Días de la semana</label>{chipsDias('dias_repetir')}</div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
                  {[
                    {t:'Semana de inicio', kd:'dias_repetir', kh:'hora', ks:'sala'},
                    {t:'Semana alterna', kd:'dias_repetir_b', kh:'hora_b', ks:'sala_b'},
                  ].map(b=>(
                    <div key={b.t} style={{background:'var(--w)',border:'1px solid var(--bd)',borderRadius:8,padding:'8px 9px'}}>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--gd)',letterSpacing:.3,textTransform:'uppercase',marginBottom:5}}>{b.t}</div>
                      {chipsDias(b.kd)}
                      <div style={{fontSize:9,color:'var(--grl)',margin:'7px 0 2px'}}>Hora</div>
                      <select className="input" value={nuevaCita[b.kh]||''} onChange={e=>setNuevaCita((p:any)=>({...p,[b.kh]:e.target.value}))} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}>
                        <option value="">Elegir…</option>
                        {HORAS.map(h=><option key={h} value={h}>{h}</option>)}
                      </select>
                      <div style={{fontSize:9,color:'var(--grl)',margin:'6px 0 2px'}}>Sala</div>
                      <select className="input" value={nuevaCita[b.ks]||''} onChange={e=>setNuevaCita((p:any)=>({...p,[b.ks]:e.target.value}))} disabled={guardando} style={{fontSize:11,padding:'5px 7px'}}>
                        {salas.map((s:string)=><option key={s} value={s}>Sala {s}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

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
              <div style={{background:'var(--gl)',borderRadius:5,padding:'6px 9px',fontSize:9,color:'var(--gd)'}}>✓ Se crearán <b style={{fontWeight:600}}>{nCitas}</b> citas{nuevaCita.alterno?' · horario alterno por semanas':''}</div>
            </>
          )}
        </div>
        {/* Antes de crear, no después: si le quedan dos sesiones y estás citando
            ocho, este es el momento de saberlo. */}
        {!nuevaCita.nuevo && <AvisoBonoEnCita pacienteId={nuevaCita.paciente_id} nCitas={nCitas}/>}

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
            {guardando?'Creando…':'✓ Crear cita'}
          </button>
        </div>
      </div>
    </div>
  )
}
