'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'

export default function FichaPacientePage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [tab, setTab] = useState('ficha')
  const [pac, setPac] = useState<any>(null)
  const [bono, setBono] = useState<any>(null)
  const [molestias, setMolestias] = useState<any[]>([])
  const [patologias, setPatologias] = useState<any[]>([])
  const [medicamentos, setMedicamentos] = useState<any[]>([])
  const [escalas, setEscalas] = useState<any[]>([])
  const [citas, setCitas] = useState<any[]>([])
  const [sesiones, setSesiones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<any>({})
  const [modalBono, setModalBono] = useState(false)
  const [nuevoBono, setNuevoBono] = useState({ tipo:'esencial', estado_pago:'pendiente' })

  const mes = new Date().getMonth()+1
  const anio = new Date().getFullYear()

  useEffect(() => { if(id) cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: p },{ data: b },{ data: m },{ data: pat },{ data: med },{ data: esc },{ data: c },{ data: s }] = await Promise.all([
      supabase.from('pacientes').select('*').eq('id',id).single(),
      supabase.from('bonos').select('*').eq('paciente_id',id).eq('activo',true).order('created_at',{ascending:false}).limit(1).maybeSingle(),
      supabase.from('molestias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('patologias').select('*').eq('paciente_id',id).order('created_at',{ascending:false}),
      supabase.from('medicamentos').select('*').eq('paciente_id',id),
      supabase.from('escalas').select('*').eq('paciente_id',id).order('fecha',{ascending:false}).limit(5),
      supabase.from('citas').select('*').eq('paciente_id',id).gte('fecha',new Date().toISOString().split('T')[0]).order('fecha').limit(5),
      supabase.from('sesiones').select('*').eq('paciente_id',id).order('created_at',{ascending:false}).limit(5),
    ])
    setPac(p); setBono(b); setMolestias(m||[]); setPatologias(pat||[])
    setMedicamentos(med||[]); setEscalas(esc||[]); setCitas(c||[]); setSesiones(s||[])
    setForm(p||{})
    setLoading(false)
  }

  async function guardarEdicion() {
    await supabase.from('pacientes').update({ nombre:form.nombre, apellidos:form.apellidos, telefono:form.telefono, email:form.email, dni:form.dni, altura_cm:form.altura_cm, peso_kg:form.peso_kg, tipo_clase:form.tipo_clase, notas:form.notas }).eq('id',id)
    setEditando(false); cargar()
  }

  async function toggleMolestia(molId: string, activa: boolean) {
    await supabase.from('molestias').update({ activa:!activa }).eq('id',molId)
    cargar()
  }

  async function crearBono() {
    if (bono) await supabase.from('bonos').update({ activo:false }).eq('id',bono.id)
    const diasMap: Record<string,number> = { esencial:2, progreso:3, avanzado:4, avanzado_mas1:5 }
    await supabase.from('bonos').insert({ paciente_id:id, tipo:nuevoBono.tipo, dias_semana:diasMap[nuevoBono.tipo], estado_pago:nuevoBono.estado_pago, mes, anio, fecha_inicio:new Date().toISOString().split('T')[0], activo:true })
    setModalBono(false); cargar()
  }

  async function cambiarPago(estado: string) {
    if (!bono) return
    await supabase.from('bonos').update({ estado_pago:estado }).eq('id',bono.id)
    cargar()
  }

  const edad = pac?.fecha_nacimiento ? Math.floor((Date.now()-new Date(pac.fecha_nacimiento).getTime())/(1000*60*60*24*365.25)) : null
  const iniciales = pac ? `${pac.nombre?.[0]||''}${pac.apellidos?.[0]||''}`.toUpperCase() : ''
  const bonoLabel: Record<string,string> = { esencial:'Esencial · 2d/sem', progreso:'Progreso · 3d/sem', avanzado:'Avanzado · 4d/sem', avanzado_mas1:'Avanzado +1 · 5d/sem' }
  const pagoBadge: Record<string,string> = { pagado:'badge-g', pendiente:'badge-pen', impago:'badge-imp' }
  const pagoLabel: Record<string,string> = { pagado:'✓ Pagado', pendiente:'⏳ Pendiente', impago:'⚠ Impago' }

  if (loading) return <div className="loading">Cargando ficha...</div>
  if (!pac) return <div className="loading">Paciente no encontrado</div>

  return (
    <>
      {/* CABECERA */}
      <div className="pat-header">
        <div className="pat-avatar">{iniciales}</div>
        <div style={{flex:1}}>
          {editando ? (
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <input className="input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Nombre"/>
              <input className="input" value={form.apellidos||''} onChange={e=>setForm((p:any)=>({...p,apellidos:e.target.value}))} style={{flex:1,minWidth:120,background:'rgba(255,255,255,.1)',color:'#fff',borderColor:'var(--gm)'}} placeholder="Apellidos"/>
            </div>
          ) : (
            <div className="pat-name">{pac.nombre} {pac.apellidos}</div>
          )}
          <div className="pat-meta">{edad ? `${edad} años · ` : ''}{pac.altura_cm ? `${pac.altura_cm} cm · ` : ''}{pac.peso_kg ? `${pac.peso_kg} kg` : ''}</div>
          <div style={{display:'flex',gap:5,marginTop:5,flexWrap:'wrap'}}>
            <span className="badge badge-g">● Activo</span>
            {bono && <span className="badge badge-b">{bonoLabel[bono.tipo]||bono.tipo}</span>}
            {bono && <span className={`badge ${pagoBadge[bono.estado_pago]||'badge-b'}`}>{pagoLabel[bono.estado_pago]}</span>}
          </div>
        </div>
        <div style={{display:'flex',gap:6,flexShrink:0}}>
          <button className="btn btn-s btn-sm" onClick={()=>router.push('/pacientes')}>← Listado</button>
          {editando ? (
            <>
              <button className="btn btn-d btn-sm" onClick={()=>setEditando(false)}>Cancelar</button>
              <button className="btn btn-p btn-sm" onClick={guardarEdicion}>💾 Guardar</button>
            </>
          ) : (
            <button className="btn btn-p btn-sm" onClick={()=>setEditando(true)}>✎ Editar</button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        {[['ficha','📋 Ficha'],['salud','❤️ Salud'],['entreno','🏋 Entrenamiento']].map(([k,l])=>(
          <button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* TAB FICHA */}
      {tab==='ficha' && (
        <div className="g2">
          <div>
            <div className="card">
              <div className="card-title">Datos personales</div>
              {editando ? (
                <div className="g2">
                  {[['dni','DNI'],['telefono','Teléfono'],['email','Email']].map(([k,l])=>(
                    <div key={k} className="field"><label>{l}</label><input className="input" value={form[k]||''} onChange={e=>setForm((p:any)=>({...p,[k]:e.target.value}))}/></div>
                  ))}
                  <div className="field"><label>Altura (cm)</label><input className="input" type="number" value={form.altura_cm||''} onChange={e=>setForm((p:any)=>({...p,altura_cm:e.target.value}))}/></div>
                  <div className="field"><label>Peso (kg)</label><input className="input" type="number" value={form.peso_kg||''} onChange={e=>setForm((p:any)=>({...p,peso_kg:e.target.value}))}/></div>
                  <div className="field" style={{gridColumn:'1/-1'}}><label>Tipo de clase</label>
                    <select className="input" value={form.tipo_clase||''} onChange={e=>setForm((p:any)=>({...p,tipo_clase:e.target.value}))}>
                      <option value="entrenamiento">🏋 Entrenamiento</option>
                      <option value="pilates">🧘 Pilates</option>
                      <option value="rehabilitacion">🏥 Rehabilitación</option>
                    </select>
                  </div>
                  <div className="field" style={{gridColumn:'1/-1'}}><label>Notas internas</label><textarea className="input" value={form.notas||''} onChange={e=>setForm((p:any)=>({...p,notas:e.target.value}))} style={{minHeight:60}}/></div>
                </div>
              ) : (
                <div>
                  {[['DNI',pac.dni],['Teléfono',pac.telefono],['Email',pac.email],['Tipo clase',pac.tipo_clase]].map(([l,v])=>v?(
                    <div key={l} style={{display:'flex',gap:8,marginBottom:5,fontSize:11}}>
                      <span style={{color:'var(--grl)',minWidth:70,fontWeight:300}}>{l}</span>
                      <span style={{fontWeight:400}}>{v}</span>
                    </div>
                  ):null)}
                  {pac.notas && <div style={{marginTop:8,padding:'7px 9px',background:'var(--bl)',borderRadius:5,fontSize:10,color:'var(--n)',fontWeight:300}}>{pac.notas}</div>}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Próximas citas</div>
              {citas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin citas programadas</div>}
              {citas.map(c=>(
                <div key={c.id} className="ri">
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{new Date(c.fecha+'T12:00:00').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'})} · {c.hora?.slice(0,5)}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>Sala {c.sala} · {c.tipo}</div>
                  </div>
                  <span className={`badge ${c.estado==='realizada'?'badge-g':'badge-b'}`}>{c.estado}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="card">
              <div className="card-title">Bono activo <button className="btn btn-s btn-sm" onClick={()=>setModalBono(true)}>{bono?'Cambiar':'+ Asignar'}</button></div>
              {bono ? (
                <>
                  <div style={{background:'var(--bl)',border:'1px solid var(--bm)',borderRadius:7,padding:'9px 11px',marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:400,color:'var(--n)',marginBottom:2}}>{bonoLabel[bono.tipo]||bono.tipo}</div>
                    <div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Mes {mes}/{anio}</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {['pagado','pendiente','impago'].map(estado=>(
                        <button key={estado} className={`btn btn-sm ${bono.estado_pago===estado?'btn-p':'btn-s'}`} onClick={()=>cambiarPago(estado)}>
                          {pagoLabel[estado]}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{fontSize:10,color:'var(--grl)',padding:'8px 0'}}>Sin bono asignado este mes</div>
              )}
            </div>

            <div className="card">
              <div className="card-title">Últimas sesiones</div>
              {sesiones.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin sesiones registradas</div>}
              {sesiones.map(s=>(
                <div key={s.id} className="ri">
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{s.duracion_min} min · {s.estado}</div>
                  </div>
                  <span className={`badge ${s.estado==='realizada'?'badge-g':'badge-b'}`}>{s.estado}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB SALUD */}
      {tab==='salud' && (
        <div className="g2">
          <div>
            <div className="card">
              <div className="card-title">Molestias y dolores <button className="btn btn-s btn-sm" onClick={async()=>{const zona=prompt('Zona / localización:');if(!zona)return;const eva=prompt('Intensidad EVA (0-10):');await supabase.from('molestias').insert({paciente_id:id,zona,tipo:'molestia',eva:parseInt(eva||'5'),activa:true});cargar()}}>+ Añadir</button></div>
              {molestias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas</div>}
              {molestias.map(m=>(
                <div key={m.id} style={{borderRadius:7,padding:'8px 10px',marginBottom:5,border:'1px solid var(--bd)',background:'var(--w)',borderColor:m.activa?'#F5C8C8':'var(--gm)',backgroundColor:m.activa?'var(--redl)':'var(--gl)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                      <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')}</div>
                    </div>
                    <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:m.activa?'var(--redl)':'var(--gl)',color:m.activa?'var(--red)':'var(--gd)'}}>
                      {m.activa?'● Activa':'✓ Resuelta'}
                    </span>
                    <button className="toggle on" style={{background:m.activa?'var(--red)':'var(--g)'}} onClick={()=>toggleMolestia(m.id,m.activa)}/>
                  </div>
                  {m.observaciones && <div style={{fontSize:9,color:'var(--gr)',marginTop:4,fontWeight:300}}>{m.observaciones}</div>}
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title">Patologías <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Nombre de la patología:');if(!nombre)return;await supabase.from('patologias').insert({paciente_id:id,nombre,estado:'activa'});cargar()}}>+ Añadir</button></div>
              {patologias.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div>}
              {patologias.map(p=>(
                <div key={p.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:p.estado==='activa'?'var(--red)':p.estado==='cronica'?'var(--amb)':'var(--g)',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{p.nombre}</div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{p.estado}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="card">
              <div className="card-title">Escalas Borg y estrés <button className="btn btn-s btn-sm" onClick={async()=>{const borg=prompt('Borg · bienestar (0-10):');const estres=prompt('Estrés (0-10):');if(!borg||!estres)return;await supabase.from('escalas').insert({paciente_id:id,fecha:new Date().toISOString().split('T')[0],borg:parseInt(borg),estres:parseInt(estres)});cargar()}}>+ Hoy</button></div>
              {escalas.map(e=>(
                <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <span style={{fontSize:9,color:'var(--grl)',width:50,fontWeight:300}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</span>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Borg</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:'var(--g)',width:`${(e.borg/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.borg}/10</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:9,color:'var(--grl)',width:44}}>Estrés</span>
                      <div style={{flex:1,height:4,background:'var(--bm)',borderRadius:2,overflow:'hidden'}}><div style={{height:'100%',borderRadius:2,background:e.estres>6?'var(--red)':'var(--amb)',width:`${(e.estres/10)*100}%`}}/></div>
                      <span style={{fontSize:9,fontWeight:500,width:24,textAlign:'right'}}>{e.estres}/10</span>
                    </div>
                  </div>
                </div>
              ))}
              {escalas.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin escalas registradas</div>}
            </div>
            <div className="card">
              <div className="card-title">Medicamentos <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Medicamento:');if(!nombre)return;const freq=prompt('Frecuencia:');await supabase.from('medicamentos').insert({paciente_id:id,nombre,frecuencia:freq||''});cargar()}}>+ Añadir</button></div>
              {medicamentos.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin medicamentos registrados</div>}
              {medicamentos.map(m=>(
                <div key={m.id} className="ri">
                  <div style={{width:7,height:7,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
                  <div><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.nombre}</div><div style={{fontSize:9,color:'var(--grl)'}}>{m.frecuencia}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB ENTRENAMIENTO */}
      {tab==='entreno' && (
        <div>
          <div className="info-pill">Las sesiones de entrenamiento se crean desde el módulo Entrenamiento del menú lateral.</div>
          <div className="card">
            <div className="card-title">Sesiones registradas</div>
            {sesiones.length===0 && <div style={{fontSize:10,color:'var(--grl)'}}>Sin sesiones. Ve a 🏋 Entrenamiento para crear la primera.</div>}
            {sesiones.map(s=>(
              <div key={s.id} className="ri">
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:400,color:'var(--n)'}}>{s.nombre}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>{s.duracion_min} min · {new Date(s.created_at).toLocaleDateString('es-ES')}</div>
                </div>
                <span className={`badge ${s.estado==='realizada'?'badge-g':s.estado==='lista'?'badge-pen':'badge-b'}`}>{s.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL BONO */}
      {modalBono && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalBono(false)}}>
          <div className="modal">
            <div className="modal-title">Asignar bono<button className="modal-close" onClick={()=>setModalBono(false)}>✕</button></div>
            <div className="field"><label>Tipo de bono</label>
              <select className="input" value={nuevoBono.tipo} onChange={e=>setNuevoBono(p=>({...p,tipo:e.target.value}))}>
                <option value="esencial">Esencial · 2 días/semana</option>
                <option value="progreso">Progreso · 3 días/semana</option>
                <option value="avanzado">Avanzado · 4 días/semana</option>
                <option value="avanzado_mas1">Avanzado +1 · 5 días/semana</option>
              </select>
            </div>
            <div className="field"><label>Estado de pago</label>
              <select className="input" value={nuevoBono.estado_pago} onChange={e=>setNuevoBono(p=>({...p,estado_pago:e.target.value}))}>
                <option value="pendiente">⏳ Pendiente</option>
                <option value="pagado">✓ Pagado</option>
                <option value="impago">⚠ Impago</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalBono(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearBono}>✓ Asignar bono</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
