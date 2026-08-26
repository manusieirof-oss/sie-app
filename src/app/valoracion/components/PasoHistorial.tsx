'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import EscalaSlider from '@/components/EscalaSlider'
import ModalItemClinico, { type ConfigItemClinico } from '@/components/ModalItemClinico'

/**
 * Lo que el paciente ya tiene registrado, en gris y sin poder tocarlo.
 *
 * Va pegado al buscador de cada lista y no en un panel aparte: el momento en que
 * hace falta saber que la artrosis ya está apuntada es justo antes de volver a
 * apuntarla. En la valoración inicial no hay nada que enseñar y no se pinta.
 */
function Ya({ lista }: { lista?: string[] }) {
  if (!lista || lista.length === 0) return null
  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:9,color:'var(--grl)',marginBottom:4}}>Ya en su ficha</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
        {lista.map((t:string,i:number)=>(
          <span key={i} style={{fontSize:10,padding:'3px 8px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)',color:'var(--grl)'}}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export default function PasoHistorial({ form, up, etiquetasLib=[], medsBiblio, alergiasBiblio, intolBiblio, opsBiblio, patsBiblio, molsBiblio, setMedsBiblio, setAlergiasBiblio, setIntolBiblio, setOpsBiblio, setPatsBiblio, setMolsBiblio, yaTiene = {} }: any) {
  const [opConfigurando, setOpConfigurando] = useState<any>(null)
  const [patConfigurando, setPatConfigurando] = useState<any>(null)
  const [molConfigurando, setMolConfigurando] = useState<any>(null)
  /**
   * Dar de alta en el catálogo lo que no está.
   *
   * Eran seis modales escritos a mano, uno por lista, que creaban la entrada con
   * `zona:'Otros'` y sin descripción ni etiquetas — y el de medicación pedía la
   * frecuencia con un `prompt()`, la caja negra del navegador. Ahora es el mismo modal de
   * la pestaña Clínico.
   */
  const [altaClinica, setAltaClinica] = useState<{config:ConfigItemClinico,valor:any,luego:(fila:any)=>void}|null>(null)

  return (
    <div>
      <div className="g3" style={{marginBottom:10}}>
        {/* MEDICACIÓN */}
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="medicamento"/> Medicación</span></div>
          {form.medicacion.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{form.medicacion.map((m:any,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--gl)',border:'1px solid var(--gm)'}}><span style={{fontSize:10,color:'var(--n)'}}>{m.nombre}</span>{m.frecuencia&&<span style={{fontSize:9,color:'var(--grl)'}}>· {m.frecuencia}</span>}<button onClick={()=>up('medicacion',form.medicacion.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <Ya lista={yaTiene.medicacion}/>
          <BuscadorBiblioteca items={medsBiblio} placeholder="Buscar medicación..." max={8}
            subtitulo={(m:any)=>m.categoria}
            onElegir={(m:any)=>up('medicacion',[...form.medicacion,{nombre:m.nombre,frecuencia:''}])}
            onNuevo={(t:string)=>setAltaClinica({config:{tabla:'medicamentos_biblioteca',tipo:'medicamento',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setMedsBiblio((p:any)=>[...p,f]);up('medicacion',[...form.medicacion,{nombre:f.nombre,frecuencia:''}])}})}/>
        </div>
        {/* ALERGIAS */}
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="alergia"/> Alergias</span></div>
          {form.alergias.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{form.alergias.map((a:string,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8'}}><span style={{fontSize:10,color:'var(--red)'}}>{a}</span><button onClick={()=>up('alergias',form.alergias.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <Ya lista={yaTiene.alergias}/>
          <BuscadorBiblioteca items={alergiasBiblio} placeholder="Buscar alergia..." max={8}
            onElegir={(a:any)=>{if(!form.alergias.includes(a.nombre))up('alergias',[...form.alergias,a.nombre])}}
            onNuevo={(t:string)=>setAltaClinica({config:{tabla:'alergias_biblioteca',tipo:'alergia',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setAlergiasBiblio((p:any)=>[...p,f]);up('alergias',[...form.alergias,f.nombre])}})}/>
        </div>
        {/* INTOLERANCIAS */}
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="intolerancia"/> Intolerancias</span></div>
          {form.intolerancias.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>{form.intolerancias.map((a:string,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:99,background:'var(--ambl)',border:'1px solid var(--amb)'}}><span style={{fontSize:10,color:'#7A5800'}}>{a}</span><button onClick={()=>up('intolerancias',form.intolerancias.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'#7A5800',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <Ya lista={yaTiene.intolerancias}/>
          <BuscadorBiblioteca items={intolBiblio} placeholder="Buscar intolerancia..." max={8}
            onElegir={(a:any)=>{if(!form.intolerancias.includes(a.nombre))up('intolerancias',[...form.intolerancias,a.nombre])}}
            onNuevo={(t:string)=>setAltaClinica({config:{tabla:'intolerancias_biblioteca',tipo:'intolerancia',campoGrupo:'categoria'},valor:{nombre:t},luego:(f:any)=>{setIntolBiblio((p:any)=>[...p,f]);up('intolerancias',[...form.intolerancias,f.nombre])}})}/>
        </div>
      </div>
      <div className="g2" style={{marginBottom:10}}>
        {/* OPERACIONES */}
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="cruz"/> Operaciones</span></div>
          {form.operaciones.length>0&&<div style={{marginBottom:8}}>{form.operaciones.map((op:any,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:6,background:'var(--bl)',border:'1px solid var(--bd)',marginBottom:4}}><div style={{flex:1}}><div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{op.nombre}</div><div style={{fontSize:8,color:'var(--grl)'}}>{op.lado&&op.lado!=='no_aplica'?op.lado+' · ':''}{op.anio&&op.anio+' · '}{op.tiene_informe&&'· con informe'}</div></div><button onClick={()=>up('operaciones',form.operaciones.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <Ya lista={yaTiene.operaciones}/>
          <BuscadorBiblioteca items={opsBiblio} placeholder="Buscar operación..." max={8}
            buscarEn={(o:any)=>[o.nombre,o.zona]} subtitulo={(o:any)=>o.zona}
            /* `biblioteca_id` explícito y no confiando en el `...op`: el spread trae `id`,
               pero al llegar a la fila del paciente `id` significa otra cosa y se pisaría. */
            onElegir={(op:any)=>setOpConfigurando({...op,biblioteca_id:op.id,anio:'',lado:'no_aplica',tiene_informe:false,observaciones:''})}
            onNuevo={(t:string)=>setAltaClinica({config:{tabla:'operaciones_biblioteca',tipo:'operación',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setOpsBiblio((p:any)=>[...p,f]);setOpConfigurando({nombre:f.nombre,anio:'',lado:'no_aplica',tiene_informe:false,observaciones:''})}})}/>
        </div>
        {/* PATOLOGÍAS */}
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="patologia"/> Patologías</span></div>
          {form.patologias.length>0&&<div style={{marginBottom:8}}>{form.patologias.map((p:any,i:number)=><div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 8px',borderRadius:6,background:p.estado==='activa'?'var(--redl)':p.estado==='cronica'?'var(--ambl)':'var(--gl)',border:`1px solid ${p.estado==='activa'?'#F5C8C8':p.estado==='cronica'?'var(--amb)':'var(--gm)'}`,marginBottom:4}}><div style={{flex:1}}><div style={{fontSize:10,fontWeight:400,color:'var(--n)'}}>{p.nombre}</div><div style={{fontSize:8,color:'var(--grl)'}}>{p.lado} · {p.estado}{p.tiene_informe&&' · con informe'}</div></div><button onClick={()=>up('patologias',form.patologias.filter((_:any,j:number)=>j!==i))} style={{fontSize:10,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button></div>)}</div>}
          <Ya lista={yaTiene.patologias}/>
          <BuscadorBiblioteca items={patsBiblio} placeholder="Buscar patología..." max={8}
            buscarEn={(p:any)=>[p.nombre,p.zona,p.sistema]} subtitulo={(p:any)=>[p.zona,p.sistema].filter(Boolean).join(' · ')}
            onElegir={(p:any)=>setPatConfigurando({...p,biblioteca_id:p.id,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}
            onNuevo={(t:string)=>setAltaClinica({config:{tabla:'patologias_biblioteca',tipo:'patología',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setPatsBiblio((p:any)=>[...p,f]);setPatConfigurando({nombre:f.nombre,lado:'bilateral',estado:'activa',tiene_informe:false,observaciones:''})}})}/>
        </div>
      </div>
      {/* MOLESTIAS */}
      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="molestia"/> Molestias</span></div>
        {form.molestias.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>{form.molestias.map((m:any,i:number)=>{/* Sin EVA no se colorea: pintarla de verde diría "molestia leve", que es justo lo que no sabemos. */const sinEva=m.eva===null||m.eva===undefined;const color=sinEva?'var(--gr)':m.eva>=7?'var(--red)':m.eva>=4?'#7A5800':'var(--gd)';const bg=sinEva?'var(--bl)':m.eva>=7?'var(--redl)':m.eva>=4?'var(--ambl)':'var(--gl)';const border=sinEva?'var(--bd)':m.eva>=7?'#F5C8C8':m.eva>=4?'var(--amb)':'var(--gm)';return <div key={i} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:99,background:bg,border:`1px solid ${border}`}}><span style={{fontSize:10,color,fontWeight:400}}>{m.zona}</span><span style={{fontSize:8,color}}>EVA {sinEva?"?":m.eva}</span>{m.lado&&m.lado!=='bilateral'&&<span style={{fontSize:8,color}}>· {m.lado}</span>}<button onClick={()=>up('molestias',form.molestias.filter((_:any,j:number)=>j!==i))} style={{fontSize:9,color,background:'none',border:'none',cursor:'pointer'}}>✕</button></div>})}</div>}
        <Ya lista={yaTiene.molestias}/>
        <BuscadorBiblioteca items={molsBiblio} placeholder="ej. Dolor lumbar, rodilla..." max={10}
          buscarEn={(m:any)=>[m.nombre,m.zona]} subtitulo={(m:any)=>m.zona}
          onElegir={(m:any)=>setMolConfigurando({nombre:m.nombre,zona:m.zona,biblioteca_id:m.id,tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}
          onNuevo={(t:string)=>setAltaClinica({config:{tabla:'molestias_biblioteca',tipo:'molestia',campoGrupo:'zona'},valor:{nombre:t},luego:(f:any)=>{setMolsBiblio((p:any)=>[...p,f]);setMolConfigurando({nombre:f.nombre,zona:f.zona||'Otros',tipo:'molestia',eva:5,lado:'bilateral',cuando:'Al moverse',observaciones:''})}})}/>
      </div>

      {/* MODALES CONFIGURAR */}
      {patConfigurando&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setPatConfigurando(null)}}><div className="modal"><div className="modal-title">{patConfigurando.nombre}<button className="modal-close" onClick={()=>setPatConfigurando(null)}>✕</button></div>{patConfigurando.precauciones&&<div style={{padding:'6px 9px',background:'var(--ambl)',borderRadius:5,border:'1px solid var(--amb)',fontSize:9,color:'#7A5800',marginBottom:10,display:'flex',alignItems:'flex-start',gap:6}}><Ic name="alerta" size={12} style={{marginTop:1}}/> {patConfigurando.precauciones}</div>}<div className="g2"><div className="field"><label>Lado</label><select className="input" value={patConfigurando.lado} onChange={e=>setPatConfigurando((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="no_aplica">No aplica</option></select></div><div className="field"><label>Estado</label><select className="input" value={patConfigurando.estado} onChange={e=>setPatConfigurando((p:any)=>({...p,estado:e.target.value}))}><option value="activa">Activa</option><option value="cronica">Crónica</option><option value="resuelta">Resuelta</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={patConfigurando.observaciones} onChange={e=>setPatConfigurando((p:any)=>({...p,observaciones:e.target.value}))}/></div><div onClick={()=>setPatConfigurando((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${patConfigurando.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfigurando.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${patConfigurando.tiene_informe?'var(--g)':'var(--bd)'}`,background:patConfigurando.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{patConfigurando.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:10,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={12}/> Tiene informe médico</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setPatConfigurando(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={()=>{up('patologias',[...form.patologias,{nombre:patConfigurando.nombre,biblioteca_id:patConfigurando.biblioteca_id||null,lado:patConfigurando.lado,estado:patConfigurando.estado,tiene_informe:patConfigurando.tiene_informe,observaciones:patConfigurando.observaciones}]);setPatConfigurando(null)}}>✓ Añadir</button></div></div></div>}
      {opConfigurando&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setOpConfigurando(null)}}><div className="modal"><div className="modal-title">{opConfigurando.nombre}<button className="modal-close" onClick={()=>setOpConfigurando(null)}>✕</button></div><div className="g2"><div className="field"><label>Año</label><input className="input" value={opConfigurando.anio} onChange={e=>setOpConfigurando((p:any)=>({...p,anio:e.target.value}))} placeholder="ej. 2020"/></div><div className="field"><label>Lado</label><select className="input" value={opConfigurando.lado} onChange={e=>setOpConfigurando((p:any)=>({...p,lado:e.target.value}))}><option value="no_aplica">No aplica</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option><option value="bilateral">Bilateral</option></select></div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={opConfigurando.observaciones} onChange={e=>setOpConfigurando((p:any)=>({...p,observaciones:e.target.value}))}/></div><div onClick={()=>setOpConfigurando((p:any)=>({...p,tiene_informe:!p.tiene_informe}))} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:6,border:`1px solid ${opConfigurando.tiene_informe?'var(--g)':'var(--bd)'}`,background:opConfigurando.tiene_informe?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}><div style={{width:16,height:16,borderRadius:3,border:`2px solid ${opConfigurando.tiene_informe?'var(--g)':'var(--bd)'}`,background:opConfigurando.tiene_informe?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{opConfigurando.tiene_informe&&<span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}</div><span style={{fontSize:10,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={12}/> Tiene informe</span></div><div style={{display:'flex',gap:8}}><button className="btn btn-d btn-sm" onClick={()=>setOpConfigurando(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={()=>{up('operaciones',[...form.operaciones,{nombre:opConfigurando.nombre,biblioteca_id:opConfigurando.biblioteca_id||null,anio:opConfigurando.anio,lado:opConfigurando.lado,tiene_informe:opConfigurando.tiene_informe,observaciones:opConfigurando.observaciones}]);setOpConfigurando(null)}}>✓ Añadir</button></div></div></div>}
      {molConfigurando&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setMolConfigurando(null)}}><div className="modal"><div className="modal-title">{molConfigurando.nombre}<button className="modal-close" onClick={()=>setMolConfigurando(null)}>✕</button></div><div className="g2"><div className="field"><label>Tipo</label><select className="input" value={molConfigurando.tipo} onChange={e=>setMolConfigurando((p:any)=>({...p,tipo:e.target.value}))}><option value="molestia">Molestia</option><option value="dolor_agudo">Dolor agudo</option><option value="dolor_cronico">Dolor crónico</option><option value="rigidez">Rigidez</option></select></div><div className="field"><label>Lado</label><select className="input" value={molConfigurando.lado} onChange={e=>setMolConfigurando((p:any)=>({...p,lado:e.target.value}))}><option value="bilateral">Bilateral</option><option value="izquierdo">Izquierdo</option><option value="derecho">Derecho</option></select></div></div><EscalaSlider label="EVA · intensidad" valor={molConfigurando.eva} color="var(--red)" izquierda="0 Nada" derecha="10 Insoportable" onCambio={v=>setMolConfigurando((p:any)=>({...p,eva:v}))}/><div className="field"><label>¿Cuándo aparece?</label><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>{['En reposo','Al moverse','Con carga','Al caminar','Siempre','Al despertar'].map(c=><span key={c} onClick={()=>setMolConfigurando((p:any)=>({...p,cuando:c}))} style={{fontSize:10,padding:'3px 9px',borderRadius:99,border:`1px solid ${molConfigurando.cuando===c?'var(--g)':'var(--bd)'}`,background:molConfigurando.cuando===c?'var(--g)':'var(--w)',color:molConfigurando.cuando===c?'#fff':'var(--gr)',cursor:'pointer'}}>{c}</span>)}</div></div><div className="field"><label>Observaciones</label><textarea className="input" style={{minHeight:60}} value={molConfigurando.observaciones} onChange={e=>setMolConfigurando((p:any)=>({...p,observaciones:e.target.value}))} placeholder="Sensación, qué lo provoca..."/></div><div style={{display:'flex',gap:8,marginTop:8}}><button className="btn btn-d btn-sm" onClick={()=>setMolConfigurando(null)}>Cancelar</button><div style={{flex:1}}/><button className="btn btn-p" onClick={()=>{up('molestias',[...form.molestias,{zona:molConfigurando.nombre,biblioteca_id:molConfigurando.biblioteca_id||null,tipo:molConfigurando.tipo,eva:molConfigurando.eva,lado:molConfigurando.lado,cuando:molConfigurando.cuando,observaciones:molConfigurando.observaciones}]);setMolConfigurando(null)}}>✓ Añadir</button></div></div></div>}

      {altaClinica && (
        <ModalItemClinico
          config={altaClinica.config} valor={altaClinica.valor} etiquetas={etiquetasLib}
          onGuardado={(fila:any)=>{ const f=altaClinica.luego; setAltaClinica(null); f(fila) }}
          onCerrar={()=>setAltaClinica(null)}/>
      )}

    </div>
  )
}
