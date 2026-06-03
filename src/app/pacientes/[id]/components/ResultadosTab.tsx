'use client'

export default function ResultadosTab({ citas, escalas, tests, recuperaciones, pac, generarPDF }: any) {
  const realizadas = citas.filter((c:any)=>c.estado==='realizada').length
  const faltas = citas.filter((c:any)=>c.estado==='falta').length
  const canceladas = citas.filter((c:any)=>c.estado==='cancelada').length
  const total = realizadas + faltas
  const pctAsistencia = total>0 ? Math.round((realizadas/total)*100) : 0

  const mesesMap: Record<string,{realizadas:number,faltas:number}> = {}
  citas.forEach((c:any)=>{
    const mes = c.fecha?.slice(0,7)
    if (!mes) return
    if (!mesesMap[mes]) mesesMap[mes] = {realizadas:0,faltas:0}
    if (c.estado==='realizada') mesesMap[mes].realizadas++
    if (c.estado==='falta') mesesMap[mes].faltas++
  })
  const meses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6)
  const maxMes = Math.max(...meses.map(([,v])=>v.realizadas+v.faltas), 1)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:10}}>
        <button className="btn btn-p btn-sm" onClick={generarPDF}>📄 Imprimir / Guardar PDF</button>
      </div>

      {/* DONUT ASISTENCIA */}
      <div className="g2" style={{marginBottom:16}}>
        <div className="card" style={{textAlign:'center'}}>
          <div className="card-title">Asistencia global</div>
          <div style={{position:'relative',width:120,height:120,margin:'10px auto'}}>
            <svg viewBox="0 0 36 36" style={{width:120,height:120,transform:'rotate(-90deg)'}}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bm)" strokeWidth="3"/>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--g)" strokeWidth="3"
                strokeDasharray={`${pctAsistencia} ${100-pctAsistencia}`} strokeDashoffset="0" strokeLinecap="round"/>
              {faltas>0&&<circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--red)" strokeWidth="3"
                strokeDasharray={`${Math.round((faltas/total)*100)} ${100-Math.round((faltas/total)*100)}`}
                strokeDashoffset={`${-pctAsistencia}`} strokeLinecap="round"/>}
            </svg>
            <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
              <div style={{fontSize:20,fontWeight:300,color:'var(--n)'}}>{pctAsistencia}%</div>
              <div style={{fontSize:8,color:'var(--grl)'}}>asistencia</div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:12,marginTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'var(--g)'}}/><span style={{fontSize:9,color:'var(--grl)'}}>{realizadas} realizadas</span></div>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,borderRadius:'50%',background:'var(--red)'}}/><span style={{fontSize:9,color:'var(--grl)'}}>{faltas} faltas</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Resumen</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[['Realizadas',realizadas,'var(--g)'],['Faltas',faltas,'var(--red)'],['Canceladas',canceladas,'var(--grl)'],['Recuperadas',recuperaciones.filter((r:any)=>r.estado==='recuperada').length,'var(--amb)']].map(([l,v,c])=>(
              <div key={String(l)} style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:300,color:c as string}}>{v}</div>
                <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BARRAS POR MES */}
      <div className="card" style={{marginBottom:16}}>
        <div className="card-title">Asistencia por mes</div>
        {meses.length===0?<div style={{fontSize:10,color:'var(--grl)'}}>Sin datos suficientes</div>:(
          <div style={{display:'flex',alignItems:'flex-end',gap:8,height:100,padding:'10px 0'}}>
            {meses.map(([mes,datos])=>{
              const pct=Math.round((datos.realizadas/(datos.realizadas+datos.faltas||1))*100)
              const alturaR=Math.round((datos.realizadas/maxMes)*80)
              const alturaF=Math.round((datos.faltas/maxMes)*80)
              const [anio,m]=mes.split('-')
              const nombreMes=new Date(parseInt(anio),parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'})
              return (
                <div key={mes} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{fontSize:8,color:'var(--grl)',marginBottom:2}}>{pct}%</div>
                  <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:80,gap:1}}>
                    {datos.faltas>0&&<div style={{width:'70%',height:alturaF,background:'var(--red)',borderRadius:'2px 2px 0 0',opacity:.7}}/>}
                    <div style={{width:'70%',height:alturaR,background:'var(--g)',borderRadius:'2px 2px 0 0'}}/>
                  </div>
                  <div style={{fontSize:8,color:'var(--grl)',marginTop:2,textTransform:'capitalize'}}>{nombreMes}</div>
                </div>
              )
            })}
          </div>
        )}
        <div style={{display:'flex',gap:12,marginTop:6}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--g)',borderRadius:1}}/><span style={{fontSize:8,color:'var(--grl)'}}>Realizadas</span></div>
          <div style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:8,height:8,background:'var(--red)',borderRadius:1,opacity:.7}}/><span style={{fontSize:8,color:'var(--grl)'}}>Faltas</span></div>
        </div>
      </div>

      <div style={{fontSize:9,color:'var(--grl)',textAlign:'center',fontWeight:300}}>ℹ️ Las citas se actualizan a las 00:00</div>

      {/* ESCALAS */}
      {escalas.length>0&&(
        <div className="card" style={{marginTop:16,marginBottom:16}}>
          <div className="card-title">Evolución escalas</div>
          <div className="g2">
            <div>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Esfuerzo percibido (Borg)</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
                {[...escalas].reverse().slice(-6).map((e:any)=>(
                  <div key={e.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <div style={{fontSize:7,color:'var(--n)',fontWeight:500}}>{e.borg}</div>
                    <div style={{width:'80%',height:Math.round((e.borg/10)*70),background:'var(--g)',borderRadius:'2px 2px 0 0',minHeight:4}}/>
                    <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:8}}>Nivel de estrés</div>
              <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
                {[...escalas].reverse().slice(-6).map((e:any)=>(
                  <div key={e.id} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <div style={{fontSize:7,color:'var(--n)',fontWeight:500}}>{e.estres}</div>
                    <div style={{width:'80%',height:Math.round((e.estres/10)*70),background:'var(--amb)',borderRadius:'2px 2px 0 0',minHeight:4}}/>
                    <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DATOS FÍSICOS */}
      {pac?.peso_kg&&(
        <div className="card" style={{marginBottom:16}}>
          <div className="card-title">Datos físicos actuales</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,textAlign:'center'}}>
            {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm'],['IMC',pac.peso_kg&&pac.altura_cm?Math.round(pac.peso_kg/Math.pow(pac.altura_cm/100,2)*10)/10:'—','']].map(([l,v,u])=>(
              <div key={String(l)} style={{background:'var(--bl)',borderRadius:6,padding:'8px 10px'}}>
                <div style={{fontSize:20,fontWeight:300,color:'var(--n)'}}>{v}{u&&<span style={{fontSize:10,color:'var(--grl)',marginLeft:2}}>{u}</span>}</div>
                <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TESTS */}
      {tests.length>0&&(
        <div className="card" style={{marginTop:16}}>
          <div className="card-title">Evolución de tests funcionales</div>
          {(()=>{
            const grupos: Record<string,any[]>={}
            tests.forEach((t:any)=>{const key=`${t.test_id}_${t.lado||'bilateral'}`;if(!grupos[key])grupos[key]=[];grupos[key].push(t)})
            return Object.values(grupos).map((grupo:any[],gi:number)=>{
              const sorted=[...grupo].sort((a,b)=>a.fecha.localeCompare(b.fecha))
              const ultimo=sorted[sorted.length-1]
              const primero=sorted[0]
              const mejoro=primero.resultado==='positivo'&&ultimo.resultado==='negativo'
              const empeoro=primero.resultado==='negativo'&&ultimo.resultado==='positivo'
              const ladoStr=ultimo.lado&&ultimo.lado!=='bilateral'?' · '+ultimo.lado.charAt(0).toUpperCase()+ultimo.lado.slice(1):''
              return (
                <div key={gi} style={{marginBottom:10,padding:'9px 11px',background:'var(--bl)',borderRadius:7,border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ultimo.tests?.nombre||'Test'}{ladoStr}</div>
                      <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{sorted.length} {sorted.length===1?'registro':'registros'}</div>
                    </div>
                    {mejoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',fontWeight:500}}>✓ Mejorado</span>}
                    {empeoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--redl)',color:'var(--red)',fontWeight:500}}>⚠ Empeorado</span>}
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:ultimo.resultado==='positivo'?'var(--redl)':'var(--gl)',color:ultimo.resultado==='positivo'?'var(--red)':'var(--gd)',fontWeight:500}}>
                      {ultimo.resultado==='positivo'?'+ Positivo':'− Negativo'}
                    </span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:2,overflowX:'auto',paddingBottom:2}}>
                    {sorted.map((t:any,ti:number)=>(
                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                        <div style={{textAlign:'center'}}>
                          <div style={{width:10,height:10,borderRadius:'50%',background:t.resultado==='positivo'?'var(--red)':'var(--g)',margin:'0 auto 2px'}}/>
                          <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                        </div>
                        {ti<sorted.length-1&&<div style={{width:16,height:1,background:'var(--bm)',flexShrink:0}}/>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
