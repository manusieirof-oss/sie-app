'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { CAPACIDADES, REGIMENES, capacidadPorReps, repsPorCapacidad } from '@/lib/capacidades'
import { MODOS_PARTE, TIPOS_TIEMPO, modoParte, registrarSesion } from '@/lib/sesiones'

export default function ModalEditarSesion({ sesion, ejercicios, onGuardado, onCerrar, pacientes }: {
  sesion: any
  ejercicios: any[]
  onGuardado: () => void
  onCerrar: () => void
  pacientes?: any[]
}) {
  const [pacienteSel, setPacienteSel] = useState(sesion.paciente_id || '')
  const [busquedaPacModal, setBusquedaPacModal] = useState('')
  const [formSesion, setFormSesion] = useState({
    nombre: sesion.nombre || '',
    descripcion: sesion.descripcion || '',
    partes: sesion.partes || [],
  })
  const [parteActiva, setParteActiva] = useState(0)
  const [buscarEj, setBuscarEj] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [objetivosDisp, setObjetivosDisp] = useState<any[]>([])
  const [objetivosSel, setObjetivosSel] = useState<string[]>([])
  const [buscarObj, setBuscarObj] = useState('')

  useEffect(() => {
    (async () => {
      const { data: objs } = await supabase.from('objetivos').select('id,nombre,color').eq('activo',true).order('nombre')
      setObjetivosDisp(objs||[])
      if (sesion.id) {
        const { data: rel } = await supabase.from('sesiones_objetivos').select('objetivo_id').eq('sesion_id', sesion.id)
        setObjetivosSel((rel||[]).map((r:any)=>r.objetivo_id))
      }
    })()
  }, [sesion.id])

  const ejFiltrados = ejercicios.filter(e => !buscarEj || e.nombre.toLowerCase().includes(buscarEj.toLowerCase()))
  const parte = formSesion.partes[parteActiva]

  function editarParte(cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteActiva] = { ...partes[parteActiva], ...cambios }
      return { ...prev, partes }
    })
  }

  function editarEjercicio(ei: number, cambios: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const ejercicios = [...(partes[parteActiva].ejercicios||[])]
      ejercicios[ei] = { ...ejercicios[ei], ...cambios }
      partes[parteActiva] = { ...partes[parteActiva], ejercicios }
      return { ...prev, partes }
    })
  }

  function addEjercicio(ej: any) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      const configEj = { ejercicio_id:ej.id, nombre:ej.nombre, variante:'Bilateral', capacidad:'', regimen:'', series:'3', reps:'', peso:'', tiempo:'', nota:'', imagen_url:ej.imagen_url||'', variantes_disp:ej.variantes||[] }
      partes[parteActiva] = { ...partes[parteActiva], ejercicios: [...(partes[parteActiva].ejercicios||[]), configEj] }
      return { ...prev, partes }
    })
  }

  function quitarEjercicio(parteIdx: number, ejIdx: number) {
    setFormSesion(prev => {
      const partes = [...prev.partes]
      partes[parteIdx] = { ...partes[parteIdx], ejercicios: partes[parteIdx].ejercicios.filter((_:any, i:number) => i !== ejIdx) }
      return { ...prev, partes }
    })
  }

  async function guardarSesion() {
    if (!formSesion.nombre) { alert('El nombre es obligatorio'); return }
    const esNueva = !sesion.id
    const pid = sesion.paciente_id || pacienteSel || null
    setGuardando(true)
    let sesionId = sesion.id
    const campos = {
      nombre: formSesion.nombre, descripcion: formSesion.descripcion,
      partes: formSesion.partes,
    }
    if (esNueva) {
      const { data, error } = await supabase.from('sesiones')
        .insert({ ...campos, paciente_id:pid, estado:'lista' })
        .select('id').single()
      if (error || !data) { alert('Error al crear la sesión'); setGuardando(false); return }
      sesionId = data.id
      // Crear desde aquí dejaba la sesión sin evento, mientras que crearla desde la
      // ficha sí lo registraba: el historial dependía de por dónde hubieras entrado.
      if (pid) await registrarSesion(pid, `Sesión creada: ${formSesion.nombre}`)
    } else {
      const { error } = await supabase.from('sesiones').update(campos).eq('id', sesionId)
      if (error) { alert('No se pudo guardar la sesión: '+error.message); setGuardando(false); return }
    }

    // Objetivos: se calcula la diferencia en vez de borrar todo y reinsertar. Si el
    // insert fallaba después del delete, la sesión se quedaba sin ningún objetivo y
    // nadie se enteraba. Ahora un fallo deja lo que ya había.
    const { data: actuales } = await supabase.from('sesiones_objetivos')
      .select('objetivo_id').eq('sesion_id', sesionId)
    const previos: string[] = (actuales||[]).map((r:any)=>r.objetivo_id)
    const aAnadir = objetivosSel.filter(id=>!previos.includes(id))
    const aQuitar = previos.filter(id=>!objetivosSel.includes(id))

    if (aAnadir.length>0) {
      const { error } = await supabase.from('sesiones_objetivos')
        .insert(aAnadir.map(oid=>({ sesion_id:sesionId, objetivo_id:oid })))
      if (error) { alert('La sesión se guardó, pero sus objetivos no: '+error.message); setGuardando(false); onGuardado(); onCerrar(); return }
    }
    if (aQuitar.length>0) {
      await supabase.from('sesiones_objetivos').delete().eq('sesion_id', sesionId).in('objetivo_id', aQuitar)
    }

    setGuardando(false)
    onGuardado()
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'90vw',maxWidth:900,maxHeight:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.15)'}}>
        {/* CABECERA */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid var(--bd)',display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            {!sesion.id && !sesion.paciente_id && pacientes && (
              <div style={{position:'relative',marginBottom:6}}>
                {pacienteSel ? (() => {
                  const p = pacientes.find((x:any)=>x.id===pacienteSel)
                  return (
                    <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 9px',border:'1px solid var(--bd)',borderRadius:6,background:'var(--bl)',fontSize:13}}>
                      <span style={{flex:1,color:'var(--n)'}}>{p?.nombre} {p?.apellidos}{p?.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}</span>
                      <button title="Quitar el paciente" onClick={()=>{setPacienteSel('');setBusquedaPacModal('')}} style={{color:'var(--gr)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="cerrar" size={13}/></button>
                    </div>
                  )
                })() : (
                  <>
                    <input className="input" value={busquedaPacModal} onChange={e=>setBusquedaPacModal(e.target.value)} placeholder="Paciente (opcional · vacío = plantilla)" style={{width:'100%'}}/>
                    {busquedaPacModal && (
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:30,marginTop:4,border:'1px solid var(--bd)',borderRadius:6,maxHeight:200,overflowY:'auto',background:'var(--w)',boxShadow:'0 4px 16px rgba(0,0,0,.1)'}}>
                        {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPacModal.toLowerCase())).slice(0,20).map((p:any)=>(
                          <div key={p.id} onClick={()=>{setPacienteSel(p.id);setBusquedaPacModal('')}} style={{padding:'7px 10px',cursor:'pointer',fontSize:13,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                            {p.nombre} {p.apellidos}{p.nombre_clinica?<span style={{color:'var(--gr)',fontSize:12}}> · {p.nombre_clinica}</span>:null}
                          </div>
                        ))}
                        {pacientes.filter((p:any)=>`${p.nombre} ${p.apellidos} ${p.nombre_clinica||''}`.toLowerCase().includes(busquedaPacModal.toLowerCase())).length===0 && (
                          <div style={{padding:'7px 10px',fontSize:12,color:'var(--gr)'}}>Sin resultados</div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <input className="input" value={formSesion.nombre} onChange={e=>setFormSesion(p=>({...p,nombre:e.target.value}))} placeholder="Nombre de la sesión *" style={{fontSize:14,fontWeight:400,border:'none',background:'transparent',padding:'0',outline:'none',width:'100%'}} autoFocus/>
            <input className="input" value={formSesion.descripcion} onChange={e=>setFormSesion(p=>({...p,descripcion:e.target.value}))} placeholder="Descripción / objetivo (opcional)" style={{fontSize:13,color:'var(--gr)',border:'none',background:'transparent',padding:'0',outline:'none',width:'100%',marginTop:3}}/>
          </div>
          <button className="btn btn-p" onClick={guardarSesion} disabled={guardando}>{guardando?'Guardando…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
          <button className="modal-close" onClick={onCerrar} aria-label="Cerrar"><Ic name="cerrar" size={14}/></button>
        </div>

        {/* OBJETIVOS */}
        <div style={{padding:'10px 18px',borderBottom:'1px solid var(--bd)',background:'var(--bl)'}}>
          {objetivosDisp.length>0&&(
            <>
              <div className="et-mini" style={{marginBottom:6}}>
                <Ic name="objetivo" size={12}/> Objetivos que cubre
                {objetivosSel.length>0 && <span style={{color:'var(--gd)',fontWeight:400}}> · {objetivosSel.length}</span>}
              </div>
              {/* Con muchos objetivos activos esto era un muro de chips. Se filtran
                  al escribir y los ya elegidos se quedan siempre visibles. */}
              {objetivosDisp.length>12 && (
                <input className="input" value={buscarObj} onChange={e=>setBuscarObj(e.target.value)}
                  placeholder="Filtrar objetivos…" style={{marginBottom:6,maxWidth:280}}/>
              )}
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {objetivosDisp
                  .filter((o:any)=>objetivosSel.includes(o.id) || !buscarObj || (o.nombre||'').toLowerCase().includes(buscarObj.toLowerCase()))
                  .map((o:any)=>{
                    const sel = objetivosSel.includes(o.id)
                    return (
                      <button key={o.id} type="button" className="chip-obj"
                        onClick={()=>setObjetivosSel(prev=>prev.includes(o.id)?prev.filter(x=>x!==o.id):[...prev,o.id])}
                        style={sel?{borderColor:o.color||'var(--g)',background:o.color||'var(--g)',color:'#fff'}:undefined}>
                        {sel&&<Ic name="check" size={11} style={{verticalAlign:'-1px',marginRight:4}}/>}{o.nombre}
                      </button>
                    )
                  })}
              </div>
            </>
          )}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 320px',flex:1,overflow:'hidden'}}>
          {/* IZQUIERDA — PARTES */}
          <div style={{overflowY:'auto',padding:14,borderRight:'1px solid var(--bd)'}}>
            <div style={{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
              {formSesion.partes.map((p:any,i:number)=>(
                <button key={i} onClick={()=>setParteActiva(i)}
                  className={`chip-obj ${parteActiva===i?'on':''}`} style={parteActiva===i?{borderColor:'var(--g)',background:'var(--g)',color:'#fff'}:undefined}>
                  {p.nombre} <span style={{opacity:.7}}>({(p.ejercicios||[]).length})</span>
                </button>
              ))}
              <button onClick={()=>{setFormSesion(p=>({...p,partes:[...p.partes,{nombre:`Parte ${p.partes.length+1}`,ejercicios:[]}]}));setParteActiva(formSesion.partes.length)}}
                className="chip-obj" style={{borderStyle:'dashed'}}>
                + Parte
              </button>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <input className="input" value={parte?.nombre||''}
                onChange={e=>editarParte({nombre:e.target.value})}
                style={{fontWeight:500,flex:1,minWidth:140}}/>
              {formSesion.partes.length>1&&(
                <button onClick={()=>{setFormSesion(prev=>({...prev,partes:prev.partes.filter((_:any,i:number)=>i!==parteActiva)}));setParteActiva(Math.max(0,parteActiva-1))}}
                  className="btn btn-d btn-sm"><Ic name="papelera" size={12}/> Eliminar parte</button>
              )}
            </div>

            {/* CÓMO SE RECORRE ESTA PARTE. El modo vive aquí y no en la sesión porque
                un entrenamiento normal mezcla: calentamiento suelto, bloque principal
                en circuito, accesorios sueltos otra vez. */}
            {formSesion.partes.length>0 && (
              <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--r)',padding:'9px 11px',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span className="et-mini"><Ic name="cambio" size={12}/> Cómo se recorre</span>
                  <div className="vista-sw" style={{marginBottom:0}}>
                    {MODOS_PARTE.map(m=>(
                      <button key={m.id} type="button" title={m.ayuda}
                        className={`vista-b ${(parte?.modo||'ejercicio')===m.id?'on':''}`}
                        onClick={()=>editarParte({modo:m.id})}>
                        <Ic name={m.icono} size={13}/> {m.nombre}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:7}}>
                  <span style={{fontSize:12,color:'var(--gr)',flex:1,minWidth:170}}>{modoParte(parte?.modo).ayuda}</span>

                  {parte?.modo==='circuito' && (
                    <label style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{fontSize:12,color:'var(--gr)'}}>Vueltas</span>
                      <input type="number" min={1} className="input" style={{width:64,textAlign:'center'}}
                        value={parte?.vueltas||''} placeholder="—"
                        onChange={e=>editarParte({vueltas:e.target.value})}/>
                    </label>
                  )}

                  {parte?.modo==='tiempo' && (
                    <>
                      <select className="input" style={{width:130}} value={parte?.tipo_tiempo||'emom'}
                        onChange={e=>editarParte({tipo_tiempo:e.target.value})}>
                        {TIPOS_TIEMPO.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                      <label style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:12,color:'var(--gr)'}}>Minutos</span>
                        <input type="number" min={1} className="input" style={{width:64,textAlign:'center'}}
                          value={parte?.minutos||''} placeholder="—"
                          onChange={e=>editarParte({minutos:e.target.value})}/>
                      </label>
                      {parte?.tipo_tiempo==='intervalos' && (
                        <label style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{fontSize:12,color:'var(--gr)'}}>Trabajo / descanso (s)</span>
                          <input className="input" style={{width:86,textAlign:'center'}}
                            value={parte?.intervalo||''} placeholder="40/20"
                            onChange={e=>editarParte({intervalo:e.target.value})}/>
                        </label>
                      )}
                    </>
                  )}
                </div>

                {parte?.modo==='superserie' && (
                  <div style={{fontSize:12,color:'var(--gr)',marginTop:6}}>
                    Marca el grupo de cada ejercicio abajo. Los que compartan letra se hacen seguidos.
                  </div>
                )}
              </div>
            )}
            {(formSesion.partes[parteActiva]?.ejercicios||[]).length===0?(
              <div style={{textAlign:'center',padding:30,color:'var(--gr)',fontSize:13,border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)'}}>
                Añade ejercicios desde la biblioteca de la derecha
              </div>
            ):(
              (formSesion.partes[parteActiva]?.ejercicios||[]).map((ej:any,ei:number)=>(
                <div key={ei} style={{background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)',marginBottom:6,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px'}}>
                    {ej.imagen_url?<img src={ej.imagen_url} alt={ej.nombre} style={{width:38,height:38,objectFit:'cover',borderRadius:5,flexShrink:0}}/>:<div style={{width:38,height:38,background:'var(--bm)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)',flexShrink:0}}><Ic name="fuerza" size={16}/></div>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:'var(--n)'}}>{ej.nombre}</div>
                      <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                        {ej.variante&&<span className="pill pill-o on">{ej.variante}</span>}
                        {ej.capacidad&&<span className="pill pill-a">{ej.capacidad}</span>}
                        {ej.regimen&&<span className="pill pill-soft">{ej.regimen}</span>}
                      </div>
                    </div>
                    <button title="Quitar el ejercicio" className="fila-x" style={{opacity:1}}
                      onClick={()=>quitarEjercicio(parteActiva,ei)}><Ic name="cerrar" size={13}/></button>
                  </div>
                  <div style={{padding:'5px 9px 8px',borderTop:'1px solid var(--bm)',display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    {/* Grupo de superserie: los que comparten letra se hacen seguidos. */}
                    {parte?.modo==='superserie' && (
                      <div style={{display:'flex',alignItems:'center',gap:3}}>
                        <span style={{fontSize:12,color:'var(--gr)'}}>Grupo</span>
                        <select value={ej.grupo||'A'} onChange={e=>editarEjercicio(ei,{grupo:e.target.value})}
                          className="input" style={{width:56,padding:'2px 4px'}}>
                          {['A','B','C','D','E'].map(g=><option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    )}
                    {(ej.variantes_disp||[]).length>0 && (
                      <div style={{display:'flex',alignItems:'center',gap:3}}>
                        <span style={{fontSize:12,color:'var(--gr)'}}>Variante</span>
                        <select value={ej.variante||'Bilateral'} onChange={e=>{
                          setFormSesion(prev=>{
                            const partes=[...prev.partes]
                            const ejercicios=[...partes[parteActiva].ejercicios]
                            ejercicios[ei]={...ejercicios[ei],variante:e.target.value}
                            partes[parteActiva]={...partes[parteActiva],ejercicios}
                            return{...prev,partes}
                          })
                        }} className="input" style={{padding:'3px 5px'}}>
                          <option value="Bilateral">Bilateral</option>
                          {(ej.variantes_disp||[]).map((v:any,vi:number)=><option key={vi} value={v.nombre}>{v.nombre}</option>)}
                        </select>
                      </div>
                    )}
                    {[['series','Series',40],['peso','Kg',40],['tiempo','Seg',40]].map(([k,l,w]:any)=>(
                      <div key={k} style={{display:'flex',alignItems:'center',gap:3}}>
                        <span style={{fontSize:12,color:'var(--gr)'}}>{l}</span>
                        <input type="number" value={(ej as any)[k]||''} onChange={e=>{
                          setFormSesion(prev=>{
                            const partes=[...prev.partes]
                            const ejercicios=[...partes[parteActiva].ejercicios]
                            ejercicios[ei]={...ejercicios[ei],[k]:e.target.value}
                            partes[parteActiva]={...partes[parteActiva],ejercicios}
                            return{...prev,partes}
                          })
                        }} className="input" style={{width:w,textAlign:'center',padding:'3px 5px'}} placeholder="—"/>
                      </div>
                    ))}
                    {/* Reps con logica bidireccional */}
                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                      <span style={{fontSize:12,color:'var(--gr)'}}>Reps</span>
                      <input type="number" value={ej.reps||''} onChange={e=>{
                        const val=e.target.value
                        const cap=capacidadPorReps(val)
                        setFormSesion(prev=>{
                          const partes=[...prev.partes]
                          const ejercicios=[...partes[parteActiva].ejercicios]
                          ejercicios[ei]={...ejercicios[ei],reps:val,...(cap?{capacidad:cap}:{})}
                          partes[parteActiva]={...partes[parteActiva],ejercicios}
                          return{...prev,partes}
                        })
                      }} className="input" style={{width:52,textAlign:'center',padding:'3px 5px'}} placeholder="—"/>
                    </div>
                    {/* Capacidad: sugiere reps */}
                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                      <span style={{fontSize:12,color:'var(--gr)'}}>Capacidad</span>
                      <select value={ej.capacidad||''} onChange={e=>{
                        const cap=e.target.value
                        const rep=repsPorCapacidad(cap)
                        setFormSesion(prev=>{
                          const partes=[...prev.partes]
                          const ejercicios=[...partes[parteActiva].ejercicios]
                          ejercicios[ei]={...ejercicios[ei],capacidad:cap,...(rep?{reps:rep}:{})}
                          partes[parteActiva]={...partes[parteActiva],ejercicios}
                          return{...prev,partes}
                        })
                      }} className="input" style={{padding:'3px 5px'}}>
                        <option value="">—</option>
                        {CAPACIDADES.map(c=><option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                    </div>
                    {/* Regimen */}
                    <div style={{display:'flex',alignItems:'center',gap:3}}>
                      <span style={{fontSize:12,color:'var(--gr)'}}>Régimen</span>
                      <select value={ej.regimen||''} onChange={e=>{
                        const val=e.target.value
                        setFormSesion(prev=>{
                          const partes=[...prev.partes]
                          const ejercicios=[...partes[parteActiva].ejercicios]
                          ejercicios[ei]={...ejercicios[ei],regimen:val}
                          partes[parteActiva]={...partes[parteActiva],ejercicios}
                          return{...prev,partes}
                        })
                      }} className="input" style={{padding:'3px 5px'}}>
                        <option value="">—</option>
                        {REGIMENES.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <input value={ej.nota||''} onChange={e=>{
                      setFormSesion(prev=>{
                        const partes=[...prev.partes]
                        const ejercicios=[...partes[parteActiva].ejercicios]
                        ejercicios[ei]={...ejercicios[ei],nota:e.target.value}
                        partes[parteActiva]={...partes[parteActiva],ejercicios}
                        return{...prev,partes}
                      })
                    }} className="input" style={{flex:1,minWidth:90,padding:'3px 7px'}} placeholder="Nota…"/>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DERECHA — BIBLIOTECA */}
          <div style={{overflowY:'auto',padding:10,background:'var(--bl)'}}>
            <div className="et-mini" style={{marginBottom:7}}>Biblioteca de ejercicios</div>
            <input className="input" placeholder="Buscar ejercicio…" value={buscarEj} onChange={e=>setBuscarEj(e.target.value)} style={{marginBottom:8}}/>
            {ejFiltrados.map((e:any)=>(
              <div key={e.id} onClick={()=>addEjercicio(e)}
                style={{display:'flex',alignItems:'center',gap:7,padding:'6px 8px',background:'var(--w)',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer'}}
                onMouseOver={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--g)'}
                onMouseOut={el=>(el.currentTarget as HTMLElement).style.borderColor='var(--bd)'}>
                {e.imagen_url?<img src={e.imagen_url} alt={e.nombre} style={{width:28,height:28,objectFit:'cover',borderRadius:3,flexShrink:0}}/>:<div style={{width:28,height:28,background:'var(--bm)',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)',flexShrink:0}}><Ic name="fuerza" size={13}/></div>}
                <span style={{fontSize:13,color:'var(--n)',flex:1}}>{e.nombre}</span>
                <span style={{color:'var(--g)',display:'inline-flex',flexShrink:0}}><Ic name="mas" size={14}/></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
