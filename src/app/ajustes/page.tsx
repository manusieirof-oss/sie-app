'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AjustesPage() {
  const [tab, setTab] = useState<'clinica'|'valoracion'|'bonos'|'recuperaciones'>('clinica')
  const [ajustes, setAjustes] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [comoNosConocio, setComoNosConocio] = useState<string[]>([])
  const [tiposJornada, setTiposJornada] = useState<string[]>([])
  const [tiposPlantilla, setTiposPlantilla] = useState<string[]>([])
  const [deportesLista, setDeportesLista] = useState<string[]>([])
  const [nuevoJornada, setNuevoJornada] = useState('')
  const [nuevoPlantilla, setNuevoPlantilla] = useState('')
  const [nuevoDeporte, setNuevoDeporte] = useState('')
  const [tiposClase, setTiposClase] = useState<{valor:string,icono:string,nombre:string}[]>([])
  const [bonos, setBonos] = useState<{id:string,nombre:string,dias:number,descripcion:string}[]>([])
  const [nuevoComoNos, setNuevoComoNos] = useState('')
  const [nuevoBono, setNuevoBono] = useState({nombre:'',dias:2,descripcion:''})
  const [modalBono, setModalBono] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('ajustes').select('clave,valor')
    if (data) {
      const map: Record<string,string> = {}
      data.forEach(a => { map[a.clave] = a.valor||'' })
      setAjustes(map)
      if (map.como_nos_conocio) setComoNosConocio(JSON.parse(map.como_nos_conocio))
      else setComoNosConocio(['Recomendación de un conocido','Instagram','Google','Facebook','Pasó por aquí','Otro'])
      if (map.tipos_jornada) setTiposJornada(JSON.parse(map.tipos_jornada))
      else setTiposJornada(['Sentado','Sedentario','De pie','Mixto','Esfuerzo físico','Conductor','Pantallas','Trabajo manual'])
      if (map.tipos_plantilla) setTiposPlantilla(JSON.parse(map.tipos_plantilla))
      else setTiposPlantilla(['Rígida','Semirrígida','Blanda','Descarga metatarsal','Propioceptiva','Personalizada'])
      if (map.deportes_lista) setDeportesLista(JSON.parse(map.deportes_lista))
      else setDeportesLista(['Fútbol','Pádel','Tenis','Natación','Ciclismo','Running','CrossFit','Yoga','Pilates','Gimnasio','Golf','Baloncesto','Senderismo','Otro'])
      if (map.tipos_clase) setTiposClase(JSON.parse(map.tipos_clase))
      else setTiposClase([
        {valor:'entrenamiento',icono:'🏋',nombre:'Entrenamiento'},
        {valor:'pilates',icono:'🧘',nombre:'Pilates'},
        {valor:'rehabilitacion',icono:'🏥',nombre:'Rehabilitación'},
        {valor:'individual',icono:'👤',nombre:'Individual'},
        {valor:'embarazadas',icono:'🤰',nombre:'Embarazadas'},
      ])
      if (map.bonos_config) setBonos(JSON.parse(map.bonos_config))
      else setBonos([
        {id:'esencial',nombre:'Esencial',dias:2,descripcion:'2 días/semana'},
        {id:'progreso',nombre:'Progreso',dias:3,descripcion:'3 días/semana'},
        {id:'avanzado',nombre:'Avanzado',dias:4,descripcion:'4 días/semana'},
        {id:'avanzado_mas1',nombre:'Avanzado +1',dias:5,descripcion:'5 días/semana'},
        {id:'individual',nombre:'Individual',dias:1,descripcion:'Sesiones individuales'},
      ])
    }
    setLoading(false)
  }

  async function guardar() {
    setGuardando(true)
    const toSave = {
      ...ajustes,
      como_nos_conocio: JSON.stringify(comoNosConocio),
      tipos_jornada: JSON.stringify(tiposJornada),
      tipos_plantilla: JSON.stringify(tiposPlantilla),
      deportes_lista: JSON.stringify(deportesLista),
      tipos_clase: JSON.stringify(tiposClase),
      bonos_config: JSON.stringify(bonos),
    }
    for (const [clave, valor] of Object.entries(toSave)) {
      await supabase.from('ajustes').upsert({ clave, valor }, { onConflict: 'clave' })
    }
    setGuardando(false)
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2000)
  }

  function set(clave: string, valor: string) {
    setAjustes(p => ({ ...p, [clave]: valor }))
  }

  if (loading) return <div className="loading">Cargando ajustes...</div>

  return (
    <div style={{maxWidth:860,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:300,color:'var(--n)'}}>⚙️ Ajustes</div>
          <div style={{fontSize:10,color:'var(--grl)',fontWeight:300}}>Configuración de la clínica</div>
        </div>
        <button className="btn btn-p" onClick={guardar} disabled={guardando}>
          {guardando?'⏳ Guardando...':guardado?'✓ Guardado':'💾 Guardar cambios'}
        </button>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:16,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3}}>
        {([['clinica','🏥 Clínica'],['valoracion','📋 Valoración'],['bonos','🎫 Bonos'],['recuperaciones','🔄 Recuperaciones']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,fontSize:10,padding:'7px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:tab===k?'var(--w)':'transparent',color:tab===k?'var(--n)':'var(--grl)',fontWeight:tab===k?500:300,boxShadow:tab===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>
            {l}
          </button>
        ))}
      </div>

      {tab==='clinica' && (
        <div className="card">
          <div className="card-title">🏥 Datos de la clínica</div>
          <div className="g2">
            <div className="field" style={{gridColumn:'1/-1'}}>
              <label>Nombre de la clínica</label>
              <input className="input" value={ajustes.clinica_nombre||''} onChange={e=>set('clinica_nombre',e.target.value)} placeholder="SIE Clínica"/>
            </div>
            <div className="field">
              <label>Hora de apertura</label>
              <input className="input" type="time" value={ajustes.clinica_horario_inicio||'08:30'} onChange={e=>set('clinica_horario_inicio',e.target.value)}/>
            </div>
            <div className="field">
              <label>Hora de cierre</label>
              <input className="input" type="time" value={ajustes.clinica_horario_fin||'21:30'} onChange={e=>set('clinica_horario_fin',e.target.value)}/>
            </div>
            <div className="field">
              <label>Duración de la clase (minutos)</label>
              <input className="input" type="number" value={ajustes.clinica_duracion_clase||'50'} onChange={e=>set('clinica_duracion_clase',e.target.value)}/>
            </div>
            <div className="field">
              <label>Tiempo de cambio entre grupos (minutos)</label>
              <input className="input" type="number" value={ajustes.clinica_tiempo_cambio||'10'} onChange={e=>set('clinica_tiempo_cambio',e.target.value)}/>
            </div>
            <div className="field">
              <label>Máximo personas por sala</label>
              <input className="input" type="number" value={ajustes.clinica_max_personas_sala||'6'} onChange={e=>set('clinica_max_personas_sala',e.target.value)}/>
            </div>
            <div className="field">
              <label>Pausa mediodía — inicio</label>
              <input className="input" type="time" value={ajustes.clinica_pausa_inicio||'12:30'} onChange={e=>set('clinica_pausa_inicio',e.target.value)}/>
            </div>
            <div className="field">
              <label>Pausa mediodía — fin</label>
              <input className="input" type="time" value={ajustes.clinica_pausa_fin||'15:30'} onChange={e=>set('clinica_pausa_fin',e.target.value)}/>
            </div>
          </div>
        </div>
      )}

      {tab==='valoracion' && (
        <div>
          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🔍 ¿Cómo nos conoció?</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones que aparecen en el paso 1 de la valoración</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
              {comoNosConocio.map((op,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
                  <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
                  <button onClick={()=>setComoNosConocio(p=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input className="input" value={nuevoComoNos} onChange={e=>setNuevoComoNos(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
                onKeyDown={e=>{if(e.key==='Enter'&&nuevoComoNos){setComoNosConocio(p=>[...p,nuevoComoNos]);setNuevoComoNos('')}}}/>
              <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoComoNos){setComoNosConocio(p=>[...p,nuevoComoNos]);setNuevoComoNos('')}}}>+ Añadir</button>
            </div>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🏋 Tipos de clase</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones disponibles en valoración y ficha del paciente</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {tiposClase.map((tc,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,background:'var(--bl)',border:'1px solid var(--bd)'}}>
                  <span style={{fontSize:14}}>{tc.icono}</span>
                  <span style={{fontSize:10,color:'var(--n)'}}>{tc.nombre}</span>
                  <button onClick={()=>setTiposClase(p=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <input className="input" placeholder="Icono ej. 🤸" style={{width:70,fontSize:11}} id="nuevo-tipo-icono"/>
              <input className="input" placeholder="Nombre ej. CrossFit" style={{flex:1,fontSize:11}} id="nuevo-tipo-nombre"/>
              <button className="btn btn-p btn-sm" onClick={()=>{
                const ic = (document.getElementById('nuevo-tipo-icono') as HTMLInputElement).value
                const nm = (document.getElementById('nuevo-tipo-nombre') as HTMLInputElement).value
                if(nm){
                  setTiposClase(p=>[...p,{valor:nm.toLowerCase().replace(/\s/g,'_'),icono:ic||'📌',nombre:nm}])
                  ;(document.getElementById('nuevo-tipo-icono') as HTMLInputElement).value=''
                  ;(document.getElementById('nuevo-tipo-nombre') as HTMLInputElement).value=''
                }
              }}>+ Añadir</button>
            </div>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🏃 Tipos de jornada laboral</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones del selector de tipo de jornada en la valoración</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
              {tiposJornada.map((op,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
                  <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
                  <button onClick={()=>setTiposJornada(p=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input className="input" value={nuevoJornada} onChange={e=>setNuevoJornada(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
                onKeyDown={e=>{if(e.key==='Enter'&&nuevoJornada){setTiposJornada(p=>[...p,nuevoJornada]);setNuevoJornada('')}}}/>
              <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoJornada){setTiposJornada(p=>[...p,nuevoJornada]);setNuevoJornada('')}}}>+ Añadir</button>
            </div>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🦶 Tipos de plantilla</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Opciones del selector de tipo de plantilla</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
              {tiposPlantilla.map((op,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
                  <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
                  <button onClick={()=>setTiposPlantilla(p=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input className="input" value={nuevoPlantilla} onChange={e=>setNuevoPlantilla(e.target.value)} placeholder="Nueva opción..." style={{flex:1,fontSize:11}}
                onKeyDown={e=>{if(e.key==='Enter'&&nuevoPlantilla){setTiposPlantilla(p=>[...p,nuevoPlantilla]);setNuevoPlantilla('')}}}/>
              <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoPlantilla){setTiposPlantilla(p=>[...p,nuevoPlantilla]);setNuevoPlantilla('')}}}>+ Añadir</button>
            </div>
          </div>

          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🏃 Deportes</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Lista de deportes disponibles en la valoración</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
              {deportesLista.map((op,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)'}}>
                  <span style={{fontSize:10,color:'var(--n)'}}>{op}</span>
                  <button onClick={()=>setDeportesLista(p=>p.filter((_,j)=>j!==i))} style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:6}}>
              <input className="input" value={nuevoDeporte} onChange={e=>setNuevoDeporte(e.target.value)} placeholder="Nuevo deporte..." style={{flex:1,fontSize:11}}
                onKeyDown={e=>{if(e.key==='Enter'&&nuevoDeporte){setDeportesLista(p=>[...p,nuevoDeporte]);setNuevoDeporte('')}}}/>
              <button className="btn btn-p btn-sm" onClick={()=>{if(nuevoDeporte){setDeportesLista(p=>[...p,nuevoDeporte]);setNuevoDeporte('')}}}>+ Añadir</button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">✍️ Consentimiento y firma</div>
            <div style={{fontSize:10,color:'var(--grl)',marginBottom:10}}>Configura cómo se recoge el consentimiento en la valoración</div>
            {(['firma_canvas','firma_checkbox'] as const).map((clave)=>(
              <div key={clave} onClick={()=>set(clave, ajustes[clave]==='true'?'false':'true')}
                style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:`1px solid ${ajustes[clave]==='true'?'var(--g)':'var(--bd)'}`,background:ajustes[clave]==='true'?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:6}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${ajustes[clave]==='true'?'var(--g)':'var(--bd)'}`,background:ajustes[clave]==='true'?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {ajustes[clave]==='true'&&<span style={{color:'#fff',fontSize:11,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:11,color:'var(--n)'}}>{clave==='firma_canvas'?'Firma con el dedo / ratón (canvas)':'Checkbox de aceptación'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==='bonos' && (
        <div>
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div className="card-title" style={{margin:0}}>🎫 Tipos de bono</div>
              <button className="btn btn-p btn-sm" onClick={()=>setModalBono(true)}>+ Nuevo bono</button>
            </div>
            {bonos.map((b,i)=>(
              <div key={b.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:6,background:'var(--bl)'}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{b.nombre}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>{b.descripcion} · {b.dias} día{b.dias!==1?'s':''}/semana</div>
                </div>
                <button onClick={()=>setBonos(p=>p.filter((_,j)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>🗑</button>
              </div>
            ))}
          </div>
          {modalBono&&(
            <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBono(false)}}>
              <div className="modal">
                <div className="modal-title">Nuevo bono<button className="modal-close" onClick={()=>setModalBono(false)}>✕</button></div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoBono.nombre} onChange={e=>setNuevoBono(p=>({...p,nombre:e.target.value}))} autoFocus placeholder="ej. Premium"/></div>
                <div className="field"><label>Días por semana</label><input className="input" type="number" value={nuevoBono.dias} onChange={e=>setNuevoBono(p=>({...p,dias:parseInt(e.target.value)||1}))}/></div>
                <div className="field"><label>Descripción</label><input className="input" value={nuevoBono.descripcion} onChange={e=>setNuevoBono(p=>({...p,descripcion:e.target.value}))} placeholder="ej. 3 días/semana + 1 individual"/></div>
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setModalBono(false)}>Cancelar</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p" onClick={()=>{
                    if(!nuevoBono.nombre) return
                    setBonos(p=>[...p,{id:nuevoBono.nombre.toLowerCase().replace(/\s/g,'_'),nombre:nuevoBono.nombre,dias:nuevoBono.dias,descripcion:nuevoBono.descripcion}])
                    setNuevoBono({nombre:'',dias:2,descripcion:''})
                    setModalBono(false)
                  }}>💾 Añadir bono</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='recuperaciones' && (
        <div className="card">
          <div className="card-title">🔄 Política de recuperaciones</div>
          <div style={{marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--bl)',borderRadius:'var(--rl)',border:'1px solid var(--bd)'}}>
              <div>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>Permitir recuperaciones</div>
                <div style={{fontSize:9,color:'var(--grl)',fontWeight:300}}>Los pacientes pueden recuperar clases perdidas</div>
              </div>
              <button onClick={()=>set('recuperaciones_activas',ajustes.recuperaciones_activas==='true'?'false':'true')}
                style={{width:40,height:22,borderRadius:99,background:ajustes.recuperaciones_activas==='true'?'var(--g)':'var(--bm)',border:'none',cursor:'pointer',transition:'background .2s',position:'relative'}}>
                <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'left .2s',left:ajustes.recuperaciones_activas==='true'?'21px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
              </button>
            </div>
          </div>
          {ajustes.recuperaciones_activas==='true' && (
            <div className="g2">
              <div className="field">
                <label>Plazo máximo para recuperar (días)</label>
                <input className="input" type="number" value={ajustes.recuperaciones_plazo_dias||'30'} onChange={e=>set('recuperaciones_plazo_dias',e.target.value)}/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>Si el paciente se da de baja, pierde las recuperaciones pendientes</div>
              </div>
              <div className="field">
                <label>Máximo recuperaciones por mes</label>
                <input className="input" type="number" value={ajustes.recuperaciones_max_mes||'0'} onChange={e=>set('recuperaciones_max_mes',e.target.value)}/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = sin límite</div>
              </div>
              <div className="field" style={{gridColumn:'1/-1'}}>
                <label>Aviso mínimo para que la falta sea recuperable (horas)</label>
                <input className="input" type="number" value={ajustes.recuperaciones_aviso_horas||'0'} onChange={e=>set('recuperaciones_aviso_horas',e.target.value)}/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>0 = siempre recuperable independientemente del aviso</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
