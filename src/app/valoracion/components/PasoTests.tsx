'use client'
import { useState } from 'react'

export default function PasoTests({ testsLib, etiquetasLib=[], testsValoracion, setTestsValoracion, testActivo, setTestActivo }: any) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<string>('')

  const LADOS_BILATERAL = [['bilateral','Bilateral']] as const
  const LADOS_LATERAL = [['izquierdo','Izquierdo'],['derecho','Derecho']] as const
  function ladosDeTest(testLib:any){ return (testLib?.tipo_lado==='lateral') ? LADOS_LATERAL : LADOS_BILATERAL }

  function calcularResultado(items:any[], logica:string):string {
    const marcados = items.filter(i=>i.marcado).length
    if (logica==='todos') return marcados===items.length && items.length>0?'positivo':'negativo'
    return marcados>0?'positivo':'negativo'
  }

  // Asegura que un test tenga la estructura de lados
  function ladoData(tv:any, lado:string){
    return tv.lados?.[lado] || { items_resultado:[], resultado:'sin_realizar', observaciones:'', fecha_repeticion:'' }
  }

  function updateLado(ti:number, lado:string, cambios:any){
    const tv2=[...testsValoracion]
    const actual = ladoData(tv2[ti], lado)
    const nuevoLado = {...actual, ...cambios}
    tv2[ti] = {...tv2[ti], lados:{...(tv2[ti].lados||{}), [lado]:nuevoLado}}
    setTestsValoracion(tv2)
  }

  // Resumen breve de qué lados tienen resultado (para la miniatura)
  const NOMBRE_LADO:Record<string,string> = {bilateral:'Bilateral',izquierdo:'Izquierdo',derecho:'Derecho'}
  function resumenLados(tv:any){
    const r:string[]=[]
    Object.keys(tv.lados||{}).forEach((k)=>{
      const d = tv.lados?.[k]
      if (d && d.resultado && d.resultado!=='sin_realizar') r.push(`${NOMBRE_LADO[k]||k}: ${d.resultado==='positivo'?'+':'−'}`)
    })
    return r
  }

  return (
    <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
      {/* COLUMNA PRINCIPAL */}
      <div style={{flex:1,minWidth:0}}>
        {testsValoracion.map((tv:any,ti:number)=>{
          const testLib = testsLib.find((t:any)=>t.id===tv.test_id)
          const isActivo = testActivo===ti
          const ladoActivo = tv.ladoActivo || 'bilateral'
          const d = ladoData(tv, ladoActivo)
          const resumen = resumenLados(tv)
          return (
            <div key={ti} style={{background:'var(--w)',border:`1px solid var(--bd)`,borderRadius:'var(--rl)',padding:'12px 14px',marginBottom:8,boxShadow:isActivo?'0 2px 8px rgba(0,0,0,.06)':'none'}}>
              {/* CABECERA */}
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {testLib?.imagen_url
                  ? <img src={testLib.imagen_url} alt={tv.nombre} style={{width:isActivo?54:38,height:isActivo?54:38,objectFit:'cover',borderRadius:6,flexShrink:0}}/>
                  : <div style={{width:isActivo?54:38,height:isActivo?54:38,borderRadius:6,background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🧪</div>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--n)'}}>{tv.nombre}</div>
                  {isActivo && testLib?.descripcion && <div style={{fontSize:10,color:'var(--grl)',marginTop:2,lineHeight:1.4}}>{testLib.descripcion}</div>}
                  {!isActivo && (
                    <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
                      {resumen.length>0 ? resumen.join(' · ') : 'Sin resultado'}
                    </div>
                  )}
                  {isActivo && testLib?.video_url && <a href={testLib.video_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:'var(--g)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3,marginTop:3}}>▶ Ver vídeo del test</a>}
                </div>
                <button className="btn btn-t btn-sm" onClick={()=>setTestActivo(isActivo?null:ti)}>{isActivo?'▲ Cerrar':'✎ Realizar'}</button>
                <button onClick={()=>setTestsValoracion((prev:any[])=>prev.filter((_:any,i:number)=>i!==ti))} style={{fontSize:12,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
              </div>

              {isActivo && (
                <div style={{marginTop:12}}>
                  {/* PESTAÑAS DE LADO */}
                  <div style={{display:'flex',gap:3,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,marginBottom:12,width:'fit-content'}}>
                    {ladosDeTest(testLib).map(([k,l])=>{
                      const tiene = tv.lados?.[k] && tv.lados[k].resultado!=='sin_realizar'
                      return (
                        <button key={k} onClick={()=>{const tv2=[...testsValoracion];const ex=tv2[ti].lados?.[k];const fh=new Date();fh.setMonth(fh.getMonth()+(tv2[ti].frecuencia_meses||3));const init=ex||{items_resultado:(testLib?.items||[]).map((it:any)=>({...it,marcado:false,grados:''})),resultado:'sin_realizar',observaciones:'',fecha_repeticion:fh.toISOString().split('T')[0]};tv2[ti]={...tv2[ti],ladoActivo:k,lados:{...(tv2[ti].lados||{}),[k]:init}};setTestsValoracion(tv2)}}
                          style={{fontSize:10,padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:ladoActivo===k?'var(--w)':'transparent',color:ladoActivo===k?'var(--n)':'var(--grl)',fontWeight:ladoActivo===k?500:300,boxShadow:ladoActivo===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',gap:5}}>
                          {l}{tiene&&<span style={{width:6,height:6,borderRadius:'50%',background:tv.lados[k].resultado==='positivo'?'var(--red)':'var(--g)'}}/>}
                        </button>
                      )
                    })}
                  </div>

                  {/* ITEMS DEL LADO ACTIVO */}
                  {(testLib?.items||[]).length>0 ? (
                    <div style={{marginBottom:10}}>
                      {(d.items_resultado.length?d.items_resultado:(testLib.items||[]).map((item:any)=>({...item,marcado:false,grados:''}))).map((item:any,ii:number)=>{
                        const baseItems = d.items_resultado.length?d.items_resultado:(testLib.items||[]).map((it:any)=>({...it,marcado:false,grados:''}))
                        return (
                          <div key={ii} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',background:item.marcado?'var(--redl)':'var(--w)',borderRadius:6,border:`1px solid ${item.marcado?'#F5C8C8':'var(--bd)'}`,marginBottom:4}}>
                            <input type="checkbox" checked={!!item.marcado} onChange={e=>{
                              const its=[...baseItems]; its[ii]={...its[ii],marcado:e.target.checked}
                              updateLado(ti,ladoActivo,{items_resultado:its,resultado:calcularResultado(its,testLib?.logica)})
                            }} style={{width:17,height:17,accentColor:'var(--red)',cursor:'pointer'}}/>
                            <span style={{flex:1,fontSize:11,color:'var(--n)',fontWeight:item.marcado?400:300}}>{item.nombre}</span>
                            {item.tiene_grados&&item.marcado&&(
                              <div style={{display:'flex',alignItems:'center',gap:4}}>
                                <input type="number" value={item.grados||''} onChange={e=>{
                                  const its=[...baseItems]; its[ii]={...its[ii],grados:e.target.value}
                                  updateLado(ti,ladoActivo,{items_resultado:its})
                                }} style={{width:54,fontSize:11,padding:'3px 5px',border:'1px solid var(--red)',borderRadius:4,background:'var(--redl)',textAlign:'center',fontFamily:'system-ui'}} placeholder="0"/>
                                <span style={{fontSize:10,color:'var(--red)'}}>°</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div style={{padding:'7px 11px',borderRadius:6,background:d.resultado==='positivo'?'var(--redl)':'var(--gl)',border:`1px solid ${d.resultado==='positivo'?'var(--red)':'var(--gm)'}`,fontSize:10,fontWeight:500,color:d.resultado==='positivo'?'var(--red)':'var(--gd)',marginTop:6}}>
                        {d.resultado==='positivo'?'+ Positivo':d.resultado==='negativo'?'− Negativo':'Marca los ítems observados'} {d.resultado!=='sin_realizar'&&'· calculado automáticamente'}
                      </div>
                      {(d.items_resultado||[]).filter((it:any)=>it.marcado).length===0 && (
                        <div onClick={()=>updateLado(ti,ladoActivo,{resultado:d.resultado==='negativo'?'sin_realizar':'negativo'})} style={{marginTop:6,padding:'6px 10px',borderRadius:6,border:`1.5px solid ${d.resultado==='negativo'?'var(--g)':'var(--bd)'}`,background:d.resultado==='negativo'?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:10,fontWeight:500,color:d.resultado==='negativo'?'var(--gd)':'var(--grl)'}}>
                          {d.resultado==='negativo'?'✓ Marcado como negativo':'Sin hallazgos · marcar como − Negativo'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{display:'flex',gap:6,marginBottom:10}}>
                      {(['positivo','negativo'] as const).map(v=>(
                        <div key={v} onClick={()=>updateLado(ti,ladoActivo,{resultado:d.resultado===v?'sin_realizar':v})} style={{flex:1,padding:'9px',borderRadius:'var(--rl)',border:`2px solid ${d.resultado===v?(v==='positivo'?'var(--red)':'var(--g)'):'var(--bd)'}`,background:d.resultado===v?(v==='positivo'?'var(--redl)':'var(--gl)'):'var(--w)',cursor:'pointer',textAlign:'center'}}>
                          <div style={{fontSize:11,fontWeight:500,color:d.resultado===v?(v==='positivo'?'var(--red)':'var(--gd)'):'var(--grl)'}}>{v==='positivo'?'+ Positivo':'− Negativo'}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="field"><label>Observaciones · {NOMBRE_LADO[ladoActivo]||ladoActivo}</label><textarea className="input" value={d.observaciones} onChange={e=>updateLado(ti,ladoActivo,{observaciones:e.target.value})} style={{minHeight:44}} placeholder="Notas..."/></div>
                  <div className="field"><label>Fecha de revisión</label><input type="date" className="input" value={d.fecha_repeticion} onChange={e=>updateLado(ti,ladoActivo,{fecha_repeticion:e.target.value})} min={new Date().toISOString().split('T')[0]}/></div>
                </div>
              )}
            </div>
          )
        })}

        {/* AÑADIR TEST · BUSCADOR CON FILTROS */}
        <div style={{background:'var(--bl)',border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)',padding:'11px 13px',marginTop:6}}>
          <div style={{fontSize:10,fontWeight:500,color:'var(--n)',marginBottom:8}}>+ Añadir test de la biblioteca</div>
          <input className="input" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="🔍 Buscar test por nombre..." style={{marginBottom:8}}/>
          {/* CHIPS DE ETIQUETAS (las que tienen los tests) */}
          {(() => {
            const idsUsados = Array.from(new Set(testsLib.flatMap((t:any)=>t.etiquetas_relacionadas||[])))
            const etiquetasUsadas = etiquetasLib.filter((e:any)=>idsUsados.includes(e.id))
            if (!etiquetasUsadas.length) return null
            return (
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                <button onClick={()=>setFiltroEtiqueta('')} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',background:filtroEtiqueta===''?'var(--g)':'var(--w)',color:filtroEtiqueta===''?'#fff':'var(--grl)',cursor:'pointer',fontFamily:'system-ui'}}>Todas</button>
                {etiquetasUsadas.map((e:any)=>(
                  <button key={e.id} onClick={()=>setFiltroEtiqueta(filtroEtiqueta===e.id?'':e.id)} style={{fontSize:9,padding:'3px 9px',borderRadius:99,border:'1px solid var(--bd)',background:filtroEtiqueta===e.id?'var(--g)':'var(--w)',color:filtroEtiqueta===e.id?'#fff':'var(--grl)',cursor:'pointer',fontFamily:'system-ui'}}>{e.nombre}</button>
                ))}
              </div>
            )
          })()}
          {/* LISTA FILTRADA */}
          <div style={{maxHeight:220,overflowY:'auto'}}>
            {(() => {
              const yaAnadidos = testsValoracion.map((tv:any)=>tv.test_id)
              const filtrados = testsLib.filter((t:any)=>{
                if (yaAnadidos.includes(t.id)) return false
                if (busqueda && !t.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
                if (filtroEtiqueta && !(t.etiquetas_relacionadas||[]).includes(filtroEtiqueta)) return false
                return true
              })
              if (!filtrados.length) return <div style={{fontSize:10,color:'var(--grl)',padding:'8px 4px'}}>Sin tests que coincidan</div>
              return filtrados.map((t:any)=>(
                <div key={t.id} onClick={()=>{
                  const hoy=new Date();hoy.setMonth(hoy.getMonth()+(t.frecuencia_meses||3))
                  const fechaRev=hoy.toISOString().split('T')[0]
                  const ladoVacio=()=>({items_resultado:(t.items||[]).map((item:any)=>({...item,marcado:false,grados:''})),resultado:'sin_realizar',observaciones:'',fecha_repeticion:fechaRev})
                  const ladoIni=t.tipo_lado==='lateral'?'izquierdo':'bilateral'
                  setTestsValoracion((prev:any[])=>[...prev,{test_id:t.id,nombre:t.nombre,ladoActivo:ladoIni,frecuencia_meses:t.frecuencia_meses||3,lados:{[ladoIni]:ladoVacio()}}])
                  setTestActivo(testsValoracion.length)
                  setBusqueda('')
                }} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:4,cursor:'pointer',background:'var(--w)'}}>
                  {t.imagen_url?<img src={t.imagen_url} alt={t.nombre} style={{width:28,height:28,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:28,height:28,borderRadius:4,background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,flexShrink:0}}>🧪</div>}
                  <span style={{flex:1,fontSize:11,color:'var(--n)'}}>{t.nombre}</span>
                  {t.tipo_lado==='lateral'&&<span style={{fontSize:8,color:'var(--grl)'}}>I/D</span>}
                  <span style={{fontSize:14,color:'var(--g)'}}>+</span>
                </div>
              ))
            })()}
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA · TESTS RELACIONADOS */}
      <div style={{width:200,flexShrink:0}}>
        <div className="card" style={{padding:'12px'}}>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Tests relacionados</div>
          {(() => {
            const activo = testActivo!=null ? testsValoracion[testActivo] : null
            const testLibActivo = activo ? testsLib.find((t:any)=>t.id===activo.test_id) : null
            const rel = testLibActivo?.etiquetas_relacionadas || []
            const yaAnadidos = testsValoracion.map((tv:any)=>tv.test_id)
            const relacionados = testsLib.filter((t:any)=>{
              if (yaAnadidos.includes(t.id)) return false
              if (!rel.length) return false
              const et = t.etiquetas_relacionadas || []
              return et.some((e:any)=>rel.includes(e))
            }).slice(0,6)
            if (!activo) return <div style={{fontSize:10,color:'var(--grl)'}}>Selecciona un test para ver relacionados</div>
            if (!relacionados.length) return <div style={{fontSize:10,color:'var(--grl)'}}>Sin tests relacionados</div>
            return relacionados.map((t:any)=>(
              <div key={t.id} onClick={()=>{
                const hoy=new Date();hoy.setMonth(hoy.getMonth()+(t.frecuencia_meses||3))
                const fechaRev=hoy.toISOString().split('T')[0]
                const ladoVacio=()=>({items_resultado:(t.items||[]).map((item:any)=>({...item,marcado:false,grados:''})),resultado:'sin_realizar',observaciones:'',fecha_repeticion:fechaRev})
                const ladoIni=t.tipo_lado==='lateral'?'izquierdo':'bilateral';setTestsValoracion((prev:any[])=>[...prev,{test_id:t.id,nombre:t.nombre,ladoActivo:ladoIni,frecuencia_meses:t.frecuencia_meses||3,lados:{[ladoIni]:ladoVacio()}}])
                setTestActivo(testsValoracion.length)
              }} style={{display:'flex',alignItems:'center',gap:7,padding:'7px 8px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:5,cursor:'pointer',background:'var(--w)'}}>
                {t.imagen_url?<img src={t.imagen_url} alt={t.nombre} style={{width:26,height:26,objectFit:'cover',borderRadius:4,flexShrink:0}}/>:<div style={{width:26,height:26,borderRadius:4,background:'var(--bl)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,flexShrink:0}}>🧪</div>}
                <span style={{fontSize:10,color:'var(--n)',flex:1}}>{t.nombre}</span>
                <span style={{fontSize:13,color:'var(--g)'}}>+</span>
              </div>
            ))
          })()}
        </div>
      </div>
    </div>
  )
}
