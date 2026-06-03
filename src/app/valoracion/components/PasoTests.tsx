'use client'

export default function PasoTests({ testsLib, testsValoracion, setTestsValoracion, testActivo, setTestActivo }: any) {

  function calcularResultadoVal(items: any[], logica: string): string {
    const marcados = items.filter(i=>i.marcado).length
    if (logica==='todos') return marcados===items.length && items.length>0?'positivo':'negativo'
    return marcados>0?'positivo':'negativo'
  }

  return (
    <div>
      {testsValoracion.map((tv:any,ti:number)=>{
        const testLib = testsLib.find((t:any)=>t.id===tv.test_id)
        const isActivo = testActivo===ti
        return (
          <div key={ti} style={{background:tv.resultado==='positivo'?'var(--redl)':tv.resultado==='negativo'?'var(--gl)':'var(--bl)',border:`1px solid ${tv.resultado==='positivo'?'#F5C8C8':tv.resultado==='negativo'?'var(--gm)':'var(--bd)'}`,borderRadius:'var(--rl)',padding:'11px 13px',marginBottom:7}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:isActivo?10:0}}>
              {testLib?.imagen_url&&<img src={testLib.imagen_url} alt={tv.nombre} style={{width:36,height:36,objectFit:'cover',borderRadius:4,flexShrink:0}}/>}
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{tv.nombre} · <span style={{fontSize:9,color:'var(--grl)'}}>{tv.lado}</span></div>
                <div style={{fontSize:9,color:tv.resultado==='positivo'?'var(--red)':tv.resultado==='negativo'?'var(--gd)':'var(--grl)',fontWeight:500}}>
                  {tv.resultado==='positivo'?'+ Positivo':tv.resultado==='negativo'?'− Negativo':'Sin resultado'}
                </div>
              </div>
              <button className="btn btn-t btn-sm" onClick={()=>setTestActivo(isActivo?null:ti)}>{isActivo?'▲ Cerrar':'✎ Editar'}</button>
              <button onClick={()=>setTestsValoracion((prev:any[])=>prev.filter((_:any,i:number)=>i!==ti))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer',padding:'2px 5px'}}>✕</button>
            </div>
            {isActivo&&(
              <div>
                <div className="g2" style={{marginBottom:8}}>
                  <div className="field"><label>Lado</label>
                    <select className="input" value={tv.lado} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],lado:e.target.value};setTestsValoracion(tv2)}}>
                      <option value="bilateral">Bilateral</option><option value="derecho">Derecho</option><option value="izquierdo">Izquierdo</option>
                    </select>
                  </div>
                </div>
                {tv.items_resultado.length>0?(
                  <div style={{marginBottom:8}}>
                    {tv.items_resultado.map((item:any,ii:number)=>(
                      <div key={ii} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 9px',background:item.marcado?'var(--redl)':'var(--w)',borderRadius:5,border:`1px solid ${item.marcado?'#F5C8C8':'var(--bd)'}`,marginBottom:3}}>
                        <input type="checkbox" checked={item.marcado} onChange={e=>{const tv2=[...testsValoracion];const its=[...tv2[ti].items_resultado];its[ii]={...its[ii],marcado:e.target.checked};tv2[ti]={...tv2[ti],items_resultado:its,resultado:calcularResultadoVal(its,testLib?.logica)};setTestsValoracion(tv2)}} style={{width:16,height:16,accentColor:'var(--red)',cursor:'pointer'}}/>
                        <span style={{flex:1,fontSize:11,color:'var(--n)',fontWeight:item.marcado?400:300}}>{item.nombre}</span>
                        {item.tiene_grados&&item.marcado&&(
                          <div style={{display:'flex',alignItems:'center',gap:4}}>
                            <input type="number" value={item.grados||''} onChange={e=>{const tv2=[...testsValoracion];const its=[...tv2[ti].items_resultado];its[ii]={...its[ii],grados:e.target.value};tv2[ti]={...tv2[ti],items_resultado:its};setTestsValoracion(tv2)}} style={{width:50,fontSize:11,padding:'2px 4px',border:'1px solid var(--red)',borderRadius:3,background:'var(--redl)',textAlign:'center',fontFamily:'system-ui'}} placeholder="0"/>
                            <span style={{fontSize:10,color:'var(--red)'}}>°</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{padding:'6px 10px',borderRadius:5,background:tv.resultado==='positivo'?'var(--redl)':'var(--gl)',border:`1px solid ${tv.resultado==='positivo'?'var(--red)':'var(--gm)'}`,fontSize:10,fontWeight:500,color:tv.resultado==='positivo'?'var(--red)':'var(--gd)',marginTop:6}}>
                      {tv.resultado==='positivo'?'+ Positivo':'− Negativo'} · calculado automáticamente
                    </div>
                  </div>
                ):(
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    {(['positivo','negativo'] as const).map(v=>(
                      <div key={v} onClick={()=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],resultado:v};setTestsValoracion(tv2)}} style={{flex:1,padding:'8px',borderRadius:'var(--rl)',border:`2px solid ${tv.resultado===v?(v==='positivo'?'var(--red)':'var(--g)'):'var(--bd)'}`,background:tv.resultado===v?(v==='positivo'?'var(--redl)':'var(--gl)'):'var(--w)',cursor:'pointer',textAlign:'center'}}>
                        <div style={{fontSize:11,fontWeight:500,color:tv.resultado===v?(v==='positivo'?'var(--red)':'var(--gd)'):'var(--grl)'}}>{v==='positivo'?'+ Positivo':'− Negativo'}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="field"><label>Observaciones</label><textarea className="input" value={tv.observaciones} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],observaciones:e.target.value};setTestsValoracion(tv2)}} style={{minHeight:44}} placeholder="Notas..."/></div>
                <div className="field"><label>Fecha de revisión</label><input type="date" className="input" value={tv.fecha_repeticion} onChange={e=>{const tv2=[...testsValoracion];tv2[ti]={...tv2[ti],fecha_repeticion:e.target.value};setTestsValoracion(tv2)}} min={new Date().toISOString().split('T')[0]}/></div>
              </div>
            )}
          </div>
        )
      })}
      <div style={{background:'var(--bl)',border:'1.5px dashed var(--bm)',borderRadius:'var(--rl)',padding:'11px 13px',marginTop:6}}>
        <div style={{fontSize:10,fontWeight:500,color:'var(--n)',marginBottom:8}}>+ Añadir test de la biblioteca</div>
        <select className="input" onChange={e=>{
          if (!e.target.value) return
          const t = testsLib.find((t:any)=>t.id===e.target.value)
          if (!t) return
          const hoy = new Date(); hoy.setMonth(hoy.getMonth()+(t.frecuencia_meses||3))
          setTestsValoracion((prev:any[])=>[...prev,{test_id:t.id,nombre:t.nombre,lado:'bilateral',items_resultado:(t.items||[]).map((item:any)=>({...item,marcado:false,grados:''})),resultado:'sin_realizar',observaciones:'',fecha_repeticion:hoy.toISOString().split('T')[0],frecuencia_meses:t.frecuencia_meses||3}])
          setTestActivo(testsValoracion.length)
          e.target.value=''
        }}>
          <option value="">Seleccionar test...</option>
          {testsLib.map((t:any)=><option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
    </div>
  )
}
