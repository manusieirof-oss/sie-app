'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SaludTab({ id, pac, deportesPac, molestias, patologias, escalas, medicamentos, alergias, intolerancias, tests, cargar, setModalRegistrarTest }: any) {
  const [molsBiblio, setMolsBiblio] = useState<any[]>([])
  const [patsBiblio, setPatsBiblio] = useState<any[]>([])
  const [buscarMol, setBuscarMol] = useState('')
  const [buscarPat, setBuscarPat] = useState('')
  const [molConfig, setMolConfig] = useState<any>(null)
  const [patConfig, setPatConfig] = useState<any>(null)
  const [medsBiblio, setMedsBiblio] = useState<any[]>([])
  const [buscarMed, setBuscarMed] = useState('')
  const [medConfig, setMedConfig] = useState<any>(null)
  const [algBiblio, setAlgBiblio] = useState<any[]>([])
  const [intolBiblio, setIntolBiblio] = useState<any[]>([])
  const [buscarAlg, setBuscarAlg] = useState('')
  const [buscarIntol, setBuscarIntol] = useState('')
  const [depBiblio, setDepBiblio] = useState<any[]>([])
  const [plantBiblio, setPlantBiblio] = useState<any[]>([])
  const [buscarDep, setBuscarDep] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('molestias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMolsBiblio(data||[]))
    supabase.from('patologias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPatsBiblio(data||[]))
    supabase.from('medicamentos_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setMedsBiblio(data||[]))
    supabase.from('alergias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setAlgBiblio(data||[]))
    supabase.from('intolerancias_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setIntolBiblio(data||[]))
    supabase.from('deportes_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setDepBiblio(data||[]))
    supabase.from('plantillas_biblioteca').select('*').eq('activo',true).order('nombre').then(({data})=>setPlantBiblio(data||[]))
  }, [])

  async function toggleMolestia(mid: string, activa: boolean) {
    await supabase.from('molestias').update({ activa: !activa }).eq('id', mid)
    const mol = (molestias||[]).find((m:any)=>m.id===mid)
    const zona = mol?.zona || 'Molestia'
    if (activa) {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia_resuelta', titulo:`Molestia resuelta: ${zona}`, fecha:new Date().toISOString().split('T')[0] })
    } else {
      await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia reactivada: ${zona}`, fecha:new Date().toISOString().split('T')[0] })
    }
    cargar()
  }

  async function cambiarEstadoPatologia(pid: string, nombre: string, nuevoEstado: string) {
    await supabase.from('patologias').update({ estado:nuevoEstado }).eq('id', pid)
    const lbl: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:nuevoEstado==='resuelta'?'patologia_resuelta':'patologia', titulo:`Patología ${nombre}: ${lbl[nuevoEstado]||nuevoEstado}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }

  async function addDeporte(nombre: string) {
    if (!nombre.trim()) return
    const yaTiene = (deportesPac||[]).length>0
    await supabase.from('deportes_paciente').insert({ paciente_id:id, nombre })
    if (!yaTiene) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Empieza a practicar deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    else await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Nuevo deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    setBuscarDep(''); cargar()
  }
  async function delDeporte(did: string, nombre: string) {
    await supabase.from('deportes_paciente').delete().eq('id', did)
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'deporte', titulo:`Deja el deporte: ${nombre}`, fecha:new Date().toISOString().split('T')[0] })
    cargar()
  }

  async function addAlergia(nombre: string) {
    if (!nombre.trim()) return
    await supabase.from('alergias_paciente').insert({ paciente_id:id, nombre })
    setBuscarAlg(''); cargar()
  }
  async function delAlergia(aid: string) {
    await supabase.from('alergias_paciente').delete().eq('id', aid); cargar()
  }
  async function addIntolerancia(nombre: string) {
    if (!nombre.trim()) return
    await supabase.from('intolerancias_paciente').insert({ paciente_id:id, nombre })
    setBuscarIntol(''); cargar()
  }
  async function delIntolerancia(iid: string) {
    await supabase.from('intolerancias_paciente').delete().eq('id', iid); cargar()
  }

  const [usaPlantillas, setUsaPlantillas] = useState(false)
  const [plantIzq, setPlantIzq] = useState('')
  const [plantDer, setPlantDer] = useState('')
  const [guardandoSalud, setGuardandoSalud] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)

  const LBL_TIPO_MOL: Record<string,string> = { molestia:'Molestia', dolor_agudo:'Dolor agudo', dolor_cronico:'Dolor crónico', rigidez:'Rigidez' }
  const LBL_EST_PAT: Record<string,string> = { activa:'Activa', cronica:'Crónica', resuelta:'Resuelta' }
  const cap = (v:string) => v ? v.charAt(0).toUpperCase()+v.slice(1) : ''

  useEffect(() => {
    if (pac) {
      setUsaPlantillas(!!pac.usa_plantillas)
      setPlantIzq(pac.plantilla_izq||'')
      setPlantDer(pac.plantilla_der||'')
    }
  }, [pac?.id, pac?.usa_plantillas, pac?.plantilla_izq, pac?.plantilla_der])

  async function guardarSalud() {
    setGuardandoSalud(true)
    const antesPlant = !!pac.usa_plantillas
    await supabase.from('pacientes').update({ usa_plantillas:usaPlantillas, plantilla_izq:usaPlantillas?(plantIzq||null):null, plantilla_der:usaPlantillas?(plantDer||null):null }).eq('id', id)
    const hoy = new Date().toISOString().split('T')[0]
    const detalle = [plantIzq?`Izq: ${plantIzq}`:'', plantDer?`Der: ${plantDer}`:''].filter(Boolean).join(' · ')||null
    if (usaPlantillas && !antesPlant) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Empieza a usar plantillas', descripcion:detalle, fecha:hoy })
    if (!usaPlantillas && antesPlant) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Deja de usar plantillas', fecha:hoy })
    if (usaPlantillas && antesPlant && (plantIzq!==(pac.plantilla_izq||'')||plantDer!==(pac.plantilla_der||''))) await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'plantillas', titulo:'Plantillas actualizadas', descripcion:detalle, fecha:hoy })
    setGuardandoSalud(false); cargar()
  }

  async function guardarMedicamento() {
    if (!medConfig) return
    setGuardando(true)
    await supabase.from('medicamentos').insert({ paciente_id:id, nombre:medConfig.nombre, frecuencia:medConfig.frecuencia||'', observaciones:medConfig.observaciones||'' })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'medicamento', titulo:`Medicamento: ${medConfig.nombre}`, descripcion:medConfig.frecuencia?`Frecuencia: ${medConfig.frecuencia}`:null, fecha:new Date().toISOString().split('T')[0] })
    setMedConfig(null); setBuscarMed(''); setGuardando(false); cargar()
  }

  async function guardarMolestia() {
    if (!molConfig) return
    setGuardando(true)
    await supabase.from('molestias').insert({ paciente_id:id, zona:molConfig.zona, tipo:molConfig.tipo, eva:molConfig.eva, lado:molConfig.lado||null, sensacion:molConfig.cuando||null, observaciones:molConfig.observaciones||null, activa:true })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'molestia', titulo:`Molestia: ${molConfig.zona} (EVA ${molConfig.eva}/10)`, descripcion:molConfig.observaciones||null, fecha:new Date().toISOString().split('T')[0] })
    setMolConfig(null); setBuscarMol(''); setGuardando(false); cargar()
  }

  async function guardarPatologia() {
    if (!patConfig) return
    setGuardando(true)
    await supabase.from('patologias').insert({ paciente_id:id, nombre:patConfig.nombre, lado:patConfig.lado||null, estado:patConfig.estado, descripcion:patConfig.observaciones||'', informe_url:patConfig.tiene_informe?'pendiente':null })
    await supabase.from('eventos_paciente').insert({ paciente_id:id, tipo:'patologia', titulo:`Patología: ${patConfig.nombre}`, descripcion:patConfig.observaciones||null, fecha:new Date().toISOString().split('T')[0] })
    setPatConfig(null); setBuscarPat(''); setGuardando(false); cargar()
  }

  return (
    <div className="g2">
      <div>
        <div className="card">
          <div className="card-title">Molestias y dolores</div>
          <input className="input" placeholder="🔍 Buscar para añadir... ej. lumbar, rodilla" value={buscarMol} onChange={e=>setBuscarMol(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarMol&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:160,overflowY:'auto',marginBottom:8}}>{molsBiblio.filter((m:any)=>m.nombre.toLowerCase().includes(buscarMol.toLowerCase())||(m.zona||'').toLowerCase().includes(buscarMol.toLowerCase())).slice(0,10).map((m:any)=><div key={m.id} onClick={()=>{setMolConfig({nombre:m.nombre,zona:m.zona||m.nombre,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''});setBuscarMol('')}} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}><div>{m.nombre}</div>{m.zona&&<div style={{fontSize:8,color:'var(--grl)'}}>{m.zona}</div>}</div>)}{molsBiblio.filter((m:any)=>m.nombre.toLowerCase().includes(buscarMol.toLowerCase())).length===0&&<div onClick={()=>{setMolConfig({nombre:buscarMol,zona:buscarMol,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''});setBuscarMol('')}} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarMol}" como nueva</div>}</div>}
          {molestias.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas</div>}
          {molestias.map((m:any)=>(
            <div key={m.id} style={{borderRadius:7,padding:'8px 10px',marginBottom:5,border:'1px solid',borderColor:m.activa?'#F5C8C8':'var(--gm)',backgroundColor:m.activa?'var(--redl)':'var(--gl)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'molestia',datos:m})}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')} · <span style={{color:'var(--g)'}}>ver detalle</span></div>
                </div>
                <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:m.activa?'var(--redl)':'var(--gl)',color:m.activa?'var(--red)':'var(--gd)'}}>
                  {m.activa?'● Activa':'✓ Resuelta'}
                </span>
                <button className="toggle" style={{background:m.activa?'var(--red)':'var(--g)'}} onClick={()=>toggleMolestia(m.id,m.activa)}/>
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Patologías</div>
          <input className="input" placeholder="🔍 Buscar para añadir... ej. tendinitis, hernia" value={buscarPat} onChange={e=>setBuscarPat(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarPat&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:160,overflowY:'auto',marginBottom:8}}>{patsBiblio.filter((p:any)=>p.nombre.toLowerCase().includes(buscarPat.toLowerCase())||(p.zona||'').toLowerCase().includes(buscarPat.toLowerCase())).slice(0,10).map((p:any)=><div key={p.id} onClick={()=>{setPatConfig({nombre:p.nombre,precauciones:p.precauciones||null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''});setBuscarPat('')}} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}><div>{p.nombre}</div>{(p.zona||p.sistema)&&<div style={{fontSize:8,color:'var(--grl)'}}>{p.zona}{p.sistema?' · '+p.sistema:''}</div>}</div>)}{patsBiblio.filter((p:any)=>p.nombre.toLowerCase().includes(buscarPat.toLowerCase())).length===0&&<div onClick={()=>{setPatConfig({nombre:buscarPat,precauciones:null,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''});setBuscarPat('')}} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarPat}" como nueva</div>}</div>}
          {patologias.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div>}
          {patologias.map((p:any)=>(
            <div key={p.id} className="ri">
              <div style={{width:7,height:7,borderRadius:'50%',background:p.estado==='activa'?'var(--red)':p.estado==='cronica'?'var(--amb)':'var(--g)',flexShrink:0}}/>
              <div style={{flex:1,cursor:'pointer'}} onClick={()=>setDetalle({tipo:'patologia',datos:p})}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{p.nombre}</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>{(p.lado&&p.lado!=='no_aplica')?p.lado+' · ':''}<span style={{color:'var(--g)'}}>ver detalle</span></div>
              </div>
              <select value={p.estado} onChange={e=>cambiarEstadoPatologia(p.id,p.nombre,e.target.value)} style={{fontSize:9,padding:'3px 6px',borderRadius:5,border:'1px solid var(--bd)',background:'var(--w)',color:'var(--gr)',cursor:'pointer',fontFamily:'system-ui'}}>
                <option value="activa">Activa</option>
                <option value="cronica">Crónica</option>
                <option value="resuelta">Resuelta</option>
              </select>
            </div>
          ))}
        </div>

        {/* PLANTILLAS */}
        <div className="card">
          <div className="card-title">🦶 Plantillas</div>
          <div onClick={()=>setUsaPlantillas(!usaPlantillas)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${usaPlantillas?'var(--g)':'var(--bd)'}`,background:usaPlantillas?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:8}}>
            <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${usaPlantillas?'var(--g)':'var(--bd)'}`,background:usaPlantillas?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{usaPlantillas&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div>
            <span style={{fontSize:10,color:'var(--n)'}}>Usa plantillas</span>
          </div>
          {usaPlantillas&&<div className="g2">
            <div className="field"><label>Pie izquierdo</label><select className="input" value={plantIzq} onChange={e=>setPlantIzq(e.target.value)}><option value="">—</option>{plantBiblio.map((t:any)=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}</select></div>
            <div className="field"><label>Pie derecho</label><select className="input" value={plantDer} onChange={e=>setPlantDer(e.target.value)}><option value="">—</option>{plantBiblio.map((t:any)=><option key={t.id} value={t.nombre}>{t.nombre}</option>)}</select></div>
          </div>}
          <button className="btn btn-p btn-sm" onClick={guardarSalud} disabled={guardandoSalud} style={{marginTop:4}}>{guardandoSalud?'⏳':'💾 Guardar plantillas'}</button>
        </div>

        {/* DEPORTES */}
        <div className="card">
          <div className="card-title">🏃 Deportes</div>
          {(deportesPac||[]).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{deportesPac.map((d:any)=><div key={d.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--gl)',border:'1px solid var(--gm)'}}><span style={{fontSize:10,color:'var(--gd)'}}>{d.nombre}</span><button onClick={()=>delDeporte(d.id,d.nombre)} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <input className="input" placeholder="🔍 Buscar para añadir... ej. pádel, natación" value={buscarDep} onChange={e=>setBuscarDep(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarDep&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:140,overflowY:'auto'}}>{depBiblio.filter((d:any)=>d.nombre.toLowerCase().includes(buscarDep.toLowerCase())).slice(0,8).map((d:any)=><div key={d.id} onClick={()=>addDeporte(d.nombre)} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>{d.nombre}</div>)}{depBiblio.filter((d:any)=>d.nombre.toLowerCase().includes(buscarDep.toLowerCase())).length===0&&<div onClick={()=>addDeporte(buscarDep)} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarDep}"</div>}</div>}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="card-title">Escalas Borg y estrés <button className="btn btn-s btn-sm" onClick={async()=>{const borg=prompt('Borg · bienestar (0-10):');const estres=prompt('Estrés (0-10):');if(!borg||!estres)return;await supabase.from('escalas').insert({paciente_id:id,fecha:new Date().toISOString().split('T')[0],borg:parseInt(borg),estres:parseInt(estres)});cargar()}}>+ Hoy</button></div>
          {escalas.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin escalas registradas</div>}
          {escalas.map((e:any)=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
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
        </div>
        <div className="card">
          <div className="card-title">Medicamentos</div>
          <input className="input" placeholder="🔍 Buscar para añadir... ej. ibuprofeno" value={buscarMed} onChange={e=>setBuscarMed(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarMed&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:160,overflowY:'auto',marginBottom:8}}>{medsBiblio.filter((m:any)=>m.nombre.toLowerCase().includes(buscarMed.toLowerCase())).slice(0,10).map((m:any)=><div key={m.id} onClick={()=>{setMedConfig({nombre:m.nombre,frecuencia:'',observaciones:''});setBuscarMed('')}} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}><div>{m.nombre}</div>{m.categoria&&<div style={{fontSize:8,color:'var(--grl)'}}>{m.categoria}</div>}</div>)}{medsBiblio.filter((m:any)=>m.nombre.toLowerCase().includes(buscarMed.toLowerCase())).length===0&&<div onClick={()=>{setMedConfig({nombre:buscarMed,frecuencia:'',observaciones:''});setBuscarMed('')}} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarMed}" como nuevo</div>}</div>}
          {medicamentos.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin medicamentos registrados</div>}
          {medicamentos.map((m:any)=>(
            <div key={m.id} className="ri" style={{cursor:'pointer'}} onClick={()=>setDetalle({tipo:'medicamento',datos:m})}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
              <div><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.nombre}</div><div style={{fontSize:9,color:'var(--grl)'}}>{m.frecuencia||'ver detalle'}</div></div>
            </div>
          ))}
        </div>

        {/* ALERGIAS */}
        <div className="card">
          <div className="card-title">🌿 Alergias</div>
          {(alergias||[]).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{alergias.map((a:any)=><div key={a.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8'}}><span style={{fontSize:10,color:'var(--red)'}}>{a.nombre}</span><button onClick={()=>delAlergia(a.id)} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <input className="input" placeholder="🔍 Buscar para añadir..." value={buscarAlg} onChange={e=>setBuscarAlg(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarAlg&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:140,overflowY:'auto'}}>{algBiblio.filter((a:any)=>a.nombre.toLowerCase().includes(buscarAlg.toLowerCase())).slice(0,8).map((a:any)=><div key={a.id} onClick={()=>addAlergia(a.nombre)} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>{a.nombre}</div>)}{algBiblio.filter((a:any)=>a.nombre.toLowerCase().includes(buscarAlg.toLowerCase())).length===0&&<div onClick={()=>addAlergia(buscarAlg)} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarAlg}"</div>}</div>}
        </div>

        {/* INTOLERANCIAS */}
        <div className="card">
          <div className="card-title">⚠️ Intolerancias</div>
          {(intolerancias||[]).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{intolerancias.map((it:any)=><div key={it.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--ambl)',border:'1px solid var(--amb)'}}><span style={{fontSize:10,color:'#7A5800'}}>{it.nombre}</span><button onClick={()=>delIntolerancia(it.id)} style={{fontSize:10,color:'#7A5800',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <input className="input" placeholder="🔍 Buscar para añadir..." value={buscarIntol} onChange={e=>setBuscarIntol(e.target.value)} style={{marginBottom:6,fontSize:11}}/>
          {buscarIntol&&<div style={{border:'1px solid var(--bd)',borderRadius:6,maxHeight:140,overflowY:'auto'}}>{intolBiblio.filter((a:any)=>a.nombre.toLowerCase().includes(buscarIntol.toLowerCase())).slice(0,8).map((a:any)=><div key={a.id} onClick={()=>addIntolerancia(a.nombre)} style={{padding:'6px 10px',cursor:'pointer',fontSize:10,borderBottom:'1px solid var(--bl)'}} onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'} onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>{a.nombre}</div>)}{intolBiblio.filter((a:any)=>a.nombre.toLowerCase().includes(buscarIntol.toLowerCase())).length===0&&<div onClick={()=>addIntolerancia(buscarIntol)} style={{padding:'6px 10px',fontSize:10,color:'var(--g)',cursor:'pointer'}}>+ Añadir "{buscarIntol}"</div>}</div>}
        </div>
        <div className="card">
          <div className="card-title">Tests funcionales <button className="btn btn-s btn-sm" onClick={()=>setModalRegistrarTest(true)}>+ Registrar test</button></div>
          {tests.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin tests registrados</div>}
          {tests.length>0&&(()=>{
            const grupos: Record<string,any[]> = {}
            tests.forEach((t:any)=>{const key=`${t.test_id}_${t.lado||'bilateral'}`;if(!grupos[key])grupos[key]=[];grupos[key].push(t)})
            const gruposArr = Object.values(grupos)
            const positivos = gruposArr.filter(g=>g[0].resultado==='positivo')
            const negativos = gruposArr.filter(g=>g[0].resultado==='negativo')
            return (
              <div className="g2">
                <div>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--red)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>● Positivos / Activos</div>
                  {positivos.length===0&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests positivos</div>}
                  {positivos.map((grupo:any,gi:number)=>{
                    const t=grupo[0]; const anteriores=grupo.slice(1)
                    return (
                      <div key={gi} style={{padding:'7px 10px',background:'var(--redl)',borderRadius:6,border:'1px solid #F5C8C8',marginBottom:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                            <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {grupo.length} {grupo.length===1?'registro':'registros'}</div>
                          </div>
                          <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--redl)',color:'var(--red)',border:'1px solid var(--red)'}}>+ Positivo</span>
                          <button onClick={async()=>{await supabase.from('resultados_tests').update({resultado:'negativo'}).eq('id',t.id);cargar()}} style={{fontSize:8,padding:'2px 6px',borderRadius:3,border:'1px solid var(--g)',background:'var(--gl)',color:'var(--gd)',cursor:'pointer',fontFamily:'system-ui'}}>→ Negativo</button>
                        </div>
                        {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((item:any,ii:number)=>(
                          <div key={ii} style={{fontSize:9,color:'var(--red)',marginTop:3,display:'flex',alignItems:'center',gap:5}}><span>☑</span><span>{item.nombre}{item.grados?' · '+item.grados+'°':''}</span></div>
                        ))}
                        {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:4,fontStyle:'italic'}}>{t.observaciones}</div>}
                        {t.fecha_repeticion&&<div style={{fontSize:9,color:'var(--amb)',marginTop:2}}>⏰ Revisión: {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>}
                        {anteriores.length>0&&<details style={{marginTop:6}}><summary style={{fontSize:9,color:'var(--grl)',cursor:'pointer',listStyle:'none'}}>▸ Historial ({anteriores.length} anterior{anteriores.length>1?'es':''})</summary><div style={{marginTop:5,paddingLeft:8,borderLeft:'2px solid #F5C8C8'}}>{anteriores.map((ant:any,ai:number)=><div key={ai} style={{marginBottom:5,padding:'5px 8px',background:'rgba(255,255,255,.6)',borderRadius:4}}><div style={{fontSize:9,fontWeight:400,color:'var(--n)',marginBottom:2}}>{new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--g)'}}>{ant.resultado==='positivo'?'+ Positivo':'− Negativo'}</span></div>{ant.observaciones&&<div style={{fontSize:8,color:'var(--grl)',fontStyle:'italic'}}>{ant.observaciones}</div>}</div>)}</div></details>}
                      </div>
                    )
                  })}
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:600,color:'var(--g)',letterSpacing:.4,textTransform:'uppercase',marginBottom:6}}>✓ Negativos / Resueltos</div>
                  {negativos.length===0&&<div style={{fontSize:9,color:'var(--grl)',marginBottom:8}}>Sin tests negativos</div>}
                  {negativos.map((grupo:any,gi:number)=>{
                    const t=grupo[0]; const anteriores=grupo.slice(1)
                    return (
                      <div key={gi} style={{padding:'7px 10px',background:'var(--gl)',borderRadius:6,border:'1px solid var(--gm)',marginBottom:6}}>
                        <div style={{display:'flex',alignItems:'center',gap:7}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{t.tests?.nombre||'Test'}{t.lado&&t.lado!=='bilateral'?' · '+t.lado.charAt(0).toUpperCase()+t.lado.slice(1):''}</div>
                            <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {grupo.length} {grupo.length===1?'registro':'registros'}</div>
                          </div>
                          <span style={{fontSize:8,fontWeight:500,padding:'2px 7px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',border:'1px solid var(--gm)'}}>− Negativo</span>
                        </div>
                        {t.observaciones&&<div style={{fontSize:9,color:'var(--gr)',marginTop:3,fontStyle:'italic'}}>{t.observaciones}</div>}
                        {anteriores.length>0&&<details style={{marginTop:6}}><summary style={{fontSize:9,color:'var(--grl)',cursor:'pointer',listStyle:'none'}}>▸ Historial ({anteriores.length} anterior{anteriores.length>1?'es':''})</summary><div style={{marginTop:5,paddingLeft:8,borderLeft:'2px solid var(--gm)'}}>{anteriores.map((ant:any,ai:number)=><div key={ai} style={{marginBottom:5,padding:'5px 8px',background:'rgba(255,255,255,.6)',borderRadius:4}}><div style={{fontSize:9,fontWeight:400,color:'var(--n)',marginBottom:2}}>{new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--g)'}}>{ant.resultado==='positivo'?'+ Positivo':'− Negativo'}</span></div>{ant.observaciones&&<div style={{fontSize:8,color:'var(--grl)',fontStyle:'italic'}}>{ant.observaciones}</div>}</div>)}</div></details>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* MODAL DETALLE */}
      {detalle&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setDetalle(null)}}><div className="modal"><div className="modal-title">{detalle.tipo==='molestia'?'🤕 '+(detalle.datos.zona||'Molestia'):detalle.tipo==='patologia'?'🩺 '+(detalle.datos.nombre||'Patología'):'💊 '+(detalle.datos.nombre||'Medicamento')}<button className="modal-close" onClick={()=>setDetalle(null)}>✕</button></div>
        {detalle.tipo==='molestia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.activa?'var(--redl)':'var(--gl)',color:detalle.datos.activa?'var(--red)':'var(--gd)',border:`1px solid ${detalle.datos.activa?'#F5C8C8':'var(--gm)'}`}}>{detalle.datos.activa?'● Activa':'✓ Resuelta'}</span>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>EVA {detalle.datos.eva}/10</span>
            {detalle.datos.tipo&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{LBL_TIPO_MOL[detalle.datos.tipo]||detalle.datos.tipo}</span>}
            {detalle.datos.lado&&detalle.datos.lado!=='bilateral'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
          </div>
          {detalle.datos.sensacion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Cuándo aparece</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.sensacion}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          <div style={{fontSize:9,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='patologia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.estado==='activa'?'var(--redl)':detalle.datos.estado==='cronica'?'var(--ambl)':'var(--gl)',color:detalle.datos.estado==='activa'?'var(--red)':detalle.datos.estado==='cronica'?'#7A5800':'var(--gd)'}}>{LBL_EST_PAT[detalle.datos.estado]||detalle.datos.estado}</span>
            {detalle.datos.lado&&detalle.datos.lado!=='no_aplica'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
            {detalle.datos.informe_url&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>📄 Informe {detalle.datos.informe_url==='pendiente'?'pendiente':'disponible'}</span>}
          </div>
          {detalle.datos.descripcion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Descripción / observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.descripcion}</div></div>}
          <div style={{fontSize:9,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='medicamento'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {detalle.datos.frecuencia&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Frecuencia</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.frecuencia}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          {!detalle.datos.frecuencia&&!detalle.datos.observaciones&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin información adicional registrada.</div>}
          <div style={{fontSize:9,color:'var(--grl)'}}>Registrado el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        <div style={{display:'flex',marginTop:12}}><div style={{flex:1}}/><button className="btn btn-d btn-sm" onClick={()=>setDetalle(null)}>Cerrar</button></div>
      </div></div>}

      {/* MODAL CONFIGURAR MEDICAMENTO */}
      {medConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMedConfig(null)}}><div className="modal"><div className="modal-title">{medConfig.nombre}<button className="modal-close" onClick={()=>setMedConfig(null)}>✕</button></div><div className="field"><label>Frecuencia</label><input className="input" value={medConfig.frecuencia} onChange={e=>setMedConfig((p:any)=>({...p,frecuencia:e.target.value}))} placeholder="ej. 1 cada 8h, Diario, Solo si dolor..."/></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={medConfig.observaciones} onChange={e=>setMedConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Dosis, pauta, motivo..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMedConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMedicamento} disabled={guardando}>{guardando?'⏳':'✓ Añadir'}</button></div></div></div>}

      {/* MODAL CONFIGURAR MOLESTIA */}
      {molConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMolConfig(null)}}><div className="modal"><div className="modal-title">{molConfig.nombre}<button className="modal-close" onClick={()=>setMolConfig(null)}>✕</button></div><div className="g2"><div className="field"><label>Tipo</label><select className="input" value={molConfig.tipo} onChange={e=>setMolConfig((p:any)=>({...p,tipo:e.target.value}))}><option value="molestia">Molestia</option><option value="dolor_agudo">Dolor agudo</option><option value="dolor_cronico">Dolor crónico</option><option value="rigidez">Rigidez</option></select></div><div className="field"><label>Lado</label><select className="input" value={molConfig.lado} onChange={e=>setMolConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option></select></div></div><div className="field"><label>EVA ({molConfig.eva}/10)</label><input type="range" min={0} max={10} value={molConfig.eva} onChange={e=>setMolConfig((p:any)=>({...p,eva:parseInt(e.target.value)}))} style={{width:'100%',accentColor:'var(--red)'}}/><div style={{display:'flex',justifyContent:'space-between',fontSize:8,color:'var(--grl)'}}><span>0</span><span style={{fontWeight:500,color:'var(--red)'}}>{molConfig.eva}</span><span>10</span></div></div><div className="field"><label>¿Cuándo aparece?</label><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>{['En reposo','Al moverse','Con carga','Al caminar','Siempre','Al despertar'].map(c=><span key={c} onClick={()=>setMolConfig((p:any)=>({...p,cuando:c}))} style={{fontSize:10,padding:'3px 9px',borderRadius:99,border:`1px solid ${molConfig.cuando===c?'var(--g)':'var(--bd)'}`,background:molConfig.cuando===c?'var(--g)':'var(--w)',color:molConfig.cuando===c?'#fff':'var(--gr)',cursor:'pointer'}}>{c}</span>)}</div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={molConfig.observaciones} onChange={e=>setMolConfig((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Sensación, qué lo provoca..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMolConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarMolestia} disabled={guardando}>{guardando?'⏳':'✓ Añadir'}</button></div></div></div>}

      {/* MODAL CONFIGURAR PATOLOGÍA */}
      {patConfig&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setPatConfig(null)}}><div className="modal"><div className="modal-title">{patConfig.nombre}<button className="modal-close" onClick={()=>setPatConfig(null)}>✕</button></div>{patConfig.precauciones&&<div style={{padding:'6px 9px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800',marginBottom:10}}>⚠️ {patConfig.precauciones}</div>}<div className="g2"><div className="field"><label>Lado</label><select className="input" value={patConfig.lado} onChange={e=>setPatConfig((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="no_aplica">No aplica</option></select></div><div className="field"><label>Estado</label><select className="input" value={patConfig.estado} onChange={e=>setPatConfig((p:any)=>({...p,estado:e.target.value}))}><option value="activa">Activa</option><option value="cronica">Crónica</option><option value="resuelta">Resuelta</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={patConfig.observaciones} onChange={e=>setPatConfig((p:any)=>({...p,observaciones:e.target.value}))}/></div><div onClick={()=>setPatConfig((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${patConfig.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfig.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{patConfig.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:10,color:'var(--n)'}}>📄 Tiene informe médico</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setPatConfig(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={guardarPatologia} disabled={guardando}>{guardando?'⏳':'✓ Añadir'}</button></div></div></div>}
    </div>
  )
}
