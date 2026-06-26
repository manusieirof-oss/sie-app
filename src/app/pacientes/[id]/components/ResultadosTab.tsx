'use client'
import { useState } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'

const G='#5A969E', GD='#3E7179', GL='#EBF4F5', RED='#C25B5B', AMB='#D4A24E', GREY='#9CA3AF'

export default function ResultadosTab({ citas, escalas, tests, recuperaciones, pac, generarPDF }: any) {
  const [vista, setVista] = useState<'analisis'|'paciente'>('analisis')
  const realizadas = citas.filter((c:any)=>c.estado==='realizada').length
  const faltas = citas.filter((c:any)=>c.estado==='falta').length
  const canceladas = citas.filter((c:any)=>c.estado==='cancelada').length
  const recuperadas = recuperaciones.filter((r:any)=>r.estado==='recuperada').length
  const total = realizadas + faltas
  const pctAsistencia = total>0 ? Math.round((realizadas/total)*100) : 0

  // Datos mensuales
  const mesesMap: Record<string,{realizadas:number,faltas:number}> = {}
  citas.forEach((c:any)=>{
    const mes = c.fecha?.slice(0,7); if (!mes) return
    if (!mesesMap[mes]) mesesMap[mes] = {realizadas:0,faltas:0}
    if (c.estado==='realizada') mesesMap[mes].realizadas++
    if (c.estado==='falta') mesesMap[mes].faltas++
  })
  const dataMeses = Object.entries(mesesMap).sort(([a],[b])=>a.localeCompare(b)).slice(-6).map(([mes,v])=>{
    const [anio,m]=mes.split('-')
    return { mes:new Date(parseInt(anio),parseInt(m)-1,1).toLocaleDateString('es-ES',{month:'short'}), Realizadas:v.realizadas, Faltas:v.faltas }
  })

  // Datos escalas
  const dataEscalas = [...escalas].reverse().slice(-8).map((e:any)=>({
    fecha:new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'}),
    Borg:e.borg, Estrés:e.estres
  }))

  const imc = pac?.peso_kg&&pac?.altura_cm ? Math.round(pac.peso_kg/Math.pow(pac.altura_cm/100,2)*10)/10 : null
  const dataDonut = [{ name:'Asistencia', value:pctAsistencia, fill:G }]

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18}}>
        <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,flex:1}}>
          {([['analisis','📊 Análisis'],['paciente','😊 Para el paciente']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)} style={{flex:1,fontSize:10,padding:'6px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',fontWeight:vista===k?500:300,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
          ))}
        </div>
        <button className="btn btn-p btn-sm" onClick={generarPDF}>📄 PDF</button>
      </div>

      {vista==='analisis'&&(
        <div style={{display:'flex',flexDirection:'column',gap:30}}>

          {/* ASISTENCIA: donut + numeros */}
          <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:20,alignItems:'center'}}>
            <div style={{position:'relative',height:160}}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={dataDonut} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                  <RadialBar background={{fill:'#EFEFEF'}} dataKey="value" cornerRadius={20}/>
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                <div style={{fontSize:30,fontWeight:300,color:GD}}>{pctAsistencia}%</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>asistencia</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Realizadas',realizadas,G],['Faltas',faltas,RED],['Canceladas',canceladas,GREY],['Recuperadas',recuperadas,AMB]].map(([l,v,c])=>(
                <div key={String(l)} style={{textAlign:'center',padding:'4px 0'}}>
                  <div style={{fontSize:26,fontWeight:200,color:c as string}}>{v}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ASISTENCIA POR MES - AREA */}
          {dataMeses.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Asistencia por mes</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dataMeses} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={G} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={G} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Area type="monotone" dataKey="Realizadas" stroke={G} strokeWidth={2} fill="url(#gR)"/>
                  <Area type="monotone" dataKey="Faltas" stroke={RED} strokeWidth={1.5} fill="none" strokeDasharray="4 3"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ESCALAS - LINEAS */}
          {dataEscalas.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Evolución de escalas</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dataEscalas} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="fecha" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,10]} tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Line type="monotone" dataKey="Borg" stroke={G} strokeWidth={2} dot={{r:3}}/>
                  <Line type="monotone" dataKey="Estrés" stroke={AMB} strokeWidth={2} dot={{r:3}}/>
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:4}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:2,background:G}}/><span style={{fontSize:9,color:'var(--grl)'}}>Borg (bienestar)</span></div>
                <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:2,background:AMB}}/><span style={{fontSize:9,color:'var(--grl)'}}>Estrés</span></div>
              </div>
            </div>
          )}

          {/* DATOS FISICOS */}
          {pac?.peso_kg&&(
            <div>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Datos físicos actuales</div>
              <div style={{display:'flex',gap:30,justifyContent:'center'}}>
                {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm'],['IMC',imc,'']].map(([l,v,u])=>v?(
                  <div key={String(l)} style={{textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:300,color:'var(--n)'}}>{v}<span style={{fontSize:11,color:'var(--grl)'}}>{u as string}</span></div>
                    <div style={{fontSize:9,color:'var(--grl)'}}>{l}</div>
                  </div>
                ):null)}
              </div>
            </div>
          )}

          {/* TESTS */}
          {tests.length>0&&(()=>{
            const grupos: Record<string,any[]>={}
            tests.forEach((t:any)=>{const key=`${t.test_id}_${t.lado||'bilateral'}`;if(!grupos[key])grupos[key]=[];grupos[key].push(t)})
            return (
              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Evolución de tests funcionales</div>
                {Object.values(grupos).map((grupo:any[],gi:number)=>{
                  const sorted=[...grupo].sort((a,b)=>a.fecha.localeCompare(b.fecha))
                  const ultimo=sorted[sorted.length-1], primero=sorted[0]
                  const mejoro=primero.resultado==='positivo'&&ultimo.resultado==='negativo'
                  const empeoro=primero.resultado==='negativo'&&ultimo.resultado==='positivo'
                  const ladoStr=ultimo.lado&&ultimo.lado!=='bilateral'?' · '+ultimo.lado.charAt(0).toUpperCase()+ultimo.lado.slice(1):''
                  return (
                    <div key={gi} style={{marginBottom:12,paddingBottom:10,borderBottom:'1px solid var(--bl)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11,fontWeight:400,color:'var(--n)'}}>{ultimo.tests?.nombre||'Test'}{ladoStr}</div>
                          <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{sorted.length} {sorted.length===1?'registro':'registros'}</div>
                        </div>
                        {mejoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:GL,color:GD,fontWeight:500}}>✓ Mejorado</span>}
                        {empeoro&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'#FBEAEA',color:RED,fontWeight:500}}>⚠ Empeorado</span>}
                        <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:ultimo.resultado==='positivo'?'#FBEAEA':GL,color:ultimo.resultado==='positivo'?RED:GD,fontWeight:500}}>
                          {ultimo.resultado==='positivo'?'+ Positivo':'− Negativo'}
                        </span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:2,overflowX:'auto',paddingBottom:2}}>
                        {sorted.map((t:any,ti:number)=>(
                          <div key={t.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                            <div style={{textAlign:'center'}}>
                              <div style={{width:10,height:10,borderRadius:'50%',background:t.resultado==='positivo'?RED:G,margin:'0 auto 2px'}}/>
                              <div style={{fontSize:7,color:'var(--grl)',whiteSpace:'nowrap'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
                            </div>
                            {ti<sorted.length-1&&<div style={{width:16,height:1,background:'var(--bm)',flexShrink:0}}/>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div style={{fontSize:9,color:'var(--grl)',textAlign:'center',fontWeight:300}}>ℹ️ Las citas se actualizan a las 00:00</div>
        </div>
      )}

      {vista==='paciente'&&(
        <div style={{padding:'10px 4px'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:13,color:'var(--grl)',fontWeight:300}}>Tu progreso</div>
            <div style={{fontSize:15,fontWeight:400,color:'var(--n)',marginTop:2}}>{pac?.nombre} {pac?.apellidos}</div>
          </div>
          <div style={{textAlign:'center',marginBottom:30}}>
            <div style={{position:'relative',width:180,height:180,margin:'0 auto'}}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={dataDonut} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                  <RadialBar background={{fill:'#EFEFEF'}} dataKey="value" cornerRadius={20}/>
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                <div style={{fontSize:36,fontWeight:300,color:G}}>{pctAsistencia}%</div>
                <div style={{fontSize:10,color:'var(--grl)'}}>asistencia</div>
              </div>
            </div>
            <div style={{fontSize:12,color:'var(--n)',fontWeight:300,marginTop:14}}>
              {pctAsistencia>=80?'¡Excelente constancia! 💪':pctAsistencia>=60?'¡Buen ritmo, sigue así! 👏':'Cada sesión cuenta, ¡a por ello! 🌱'}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:30,marginBottom:30,flexWrap:'wrap'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:40,fontWeight:200,color:G}}>{realizadas}</div>
              <div style={{fontSize:10,color:'var(--grl)'}}>sesiones completadas</div>
            </div>
            {recuperadas>0&&(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:40,fontWeight:200,color:AMB}}>{recuperadas}</div>
                <div style={{fontSize:10,color:'var(--grl)'}}>clases recuperadas</div>
              </div>
            )}
          </div>
          {pac?.peso_kg&&(
            <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:30,flexWrap:'wrap'}}>
              {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm'],['IMC',imc,'']].map(([l,v,u])=>v?(
                <div key={String(l)} style={{textAlign:'center'}}>
                  <div style={{fontSize:26,fontWeight:300,color:'var(--n)'}}>{v}<span style={{fontSize:11,color:'var(--grl)'}}>{u as string}</span></div>
                  <div style={{fontSize:10,color:'var(--grl)'}}>{l}</div>
                </div>
              ):null)}
            </div>
          )}
          {dataMeses.length>0&&(
            <div>
              <div style={{fontSize:11,color:'var(--grl)',textAlign:'center',marginBottom:12,fontWeight:300}}>Tu asistencia mes a mes</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dataMeses} margin={{top:5,right:20,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={G} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={G} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}}/>
                  <Area type="monotone" dataKey="Realizadas" stroke={G} strokeWidth={2.5} fill="url(#gP)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
