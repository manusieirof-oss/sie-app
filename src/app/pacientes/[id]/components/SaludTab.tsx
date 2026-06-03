'use client'
import { supabase } from '@/lib/supabase'

export default function SaludTab({ id, molestias, patologias, escalas, medicamentos, tests, cargar, setModalRegistrarTest }: any) {

  async function toggleMolestia(mid: string, activa: boolean) {
    await supabase.from('molestias').update({ activa: !activa }).eq('id', mid)
    cargar()
  }

  return (
    <div className="g2">
      <div>
        <div className="card">
          <div className="card-title">Molestias y dolores <button className="btn btn-s btn-sm" onClick={async()=>{const zona=prompt('Zona / localización:');if(!zona)return;const eva=prompt('Intensidad EVA (0-10):');await supabase.from('molestias').insert({paciente_id:id,zona,tipo:'molestia',eva:parseInt(eva||'5'),activa:true});cargar()}}>+ Añadir</button></div>
          {molestias.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin molestias registradas</div>}
          {molestias.map((m:any)=>(
            <div key={m.id} style={{borderRadius:7,padding:'8px 10px',marginBottom:5,border:'1px solid',borderColor:m.activa?'#F5C8C8':'var(--gm)',backgroundColor:m.activa?'var(--redl)':'var(--gl)'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.zona}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>EVA {m.eva}/10 · {m.tipo?.replace('_',' ')}</div>
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
          <div className="card-title">Patologías <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Nombre de la patología:');if(!nombre)return;await supabase.from('patologias').insert({paciente_id:id,nombre,estado:'activa'});cargar()}}>+ Añadir</button></div>
          {patologias.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin patologías registradas</div>}
          {patologias.map((p:any)=>(
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
          <div className="card-title">Medicamentos <button className="btn btn-s btn-sm" onClick={async()=>{const nombre=prompt('Medicamento:');if(!nombre)return;const freq=prompt('Frecuencia:');await supabase.from('medicamentos').insert({paciente_id:id,nombre,frecuencia:freq||''});cargar()}}>+ Añadir</button></div>
          {medicamentos.length===0&&<div style={{fontSize:10,color:'var(--grl)'}}>Sin medicamentos registrados</div>}
          {medicamentos.map((m:any)=>(
            <div key={m.id} className="ri">
              <div style={{width:7,height:7,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
              <div><div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{m.nombre}</div><div style={{fontSize:9,color:'var(--grl)'}}>{m.frecuencia}</div></div>
            </div>
          ))}
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
    </div>
  )
}
