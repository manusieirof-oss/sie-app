'use client'
import { useEffect, useState } from 'react'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { Ic } from '@/lib/icons'
import ResumenVolumen from '@/components/ResumenVolumen'

import { COLOR, asistencia, porMes, evaPorZona } from '@/lib/resultados'
import ProgresionEjercicios from './ProgresionEjercicios'
import DynamoVald from './DynamoVald'
import dynamic from 'next/dynamic'
// El mapa lleva el cuerpo 3D (three.js): solo se carga al abrir su pestaña.
const MapaTrabajo = dynamic(() => import('@/components/MapaTrabajo'), { ssr: false })
import { ajustesMedida } from '@/lib/medida'

// Alias cortos: las gráficas los usan mucho y `COLOR.g` en cada propiedad no se lee.
const G = COLOR.g, GD = COLOR.gd, GL = COLOR.gl, RED = COLOR.red, AMB = COLOR.amb, GREY = COLOR.gris

export default function ResultadosTab({ citas, escalas, tests, recuperaciones, pac, molestias=[], patologias=[], deportesPac=[], registros=[], generarPDF }: any) {
  const [vista, setVista] = useState<'analisis'|'paciente'|'progreso'|'mapa'|'vald'>('analisis')

  // Un solo sitio calcula las cifras. Antes se repetían aquí, en la vista del paciente
  // y en generarPDF, cada una por su cuenta.
  const a = asistencia(citas, recuperaciones)
  const { realizadas, faltas, canceladas, recuperadas, pctAsistencia, base } =
    { ...a, pctAsistencia: a.pct }

  const dataMeses = porMes(citas)
  const dataDonut = [{ name:'Asistencia', value:pctAsistencia, fill:G }]

  const dataEscalas = [...escalas].reverse().slice(-8).map((e:any)=>({
    fecha:new Date(e.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'}),
    Borg:e.borg, Estrés:e.estres
  }))

  // Una serie POR ZONA. Antes se unían todas en una línea y enlazaba el dolor de
  // rodilla con el de hombro, dibujando una evolución que no existía.
  const zonasEva = evaPorZona(molestias)
  // La escala de bandas de Ajustes: sin ella una banda no tiene "más" ni "menos".
  const [bandas, setBandas] = useState<string[]>([])
  useEffect(() => { ajustesMedida().then(a => setBandas(a.bandas)) }, [])

  // Patologias por estado
  const patEstados = { activa:0, cronica:0, resuelta:0 } as Record<string,number>
  patologias.forEach((p:any)=>{ if(patEstados[p.estado]!==undefined) patEstados[p.estado]++ })
  const dataPat = [
    { estado:'Activas', n:patEstados.activa, fill:RED },
    { estado:'Crónicas', n:patEstados.cronica, fill:AMB },
    { estado:'Resueltas', n:patEstados.resuelta, fill:G },
  ].filter(d=>d.n>0)
  const totalPat = patEstados.activa+patEstados.cronica+patEstados.resuelta

  // Distribucion por tipo de clase (de las citas)
  const tipoMap: Record<string,number> = {}
  citas.forEach((c:any)=>{ const t=c.tipo||'otro'; tipoMap[t]=(tipoMap[t]||0)+1 })
  const dataTipo = Object.entries(tipoMap).sort(([,a],[,b])=>b-a).map(([t,n])=>({ tipo:t.charAt(0).toUpperCase()+t.slice(1), n }))
  const maxTipo = Math.max(...dataTipo.map(d=>d.n), 1)

  return (
    <div>
      {/* Mismo conmutador que el resto de la app. Era el quinto estilo de pestañas. */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div className="vista-sw" style={{marginBottom:0}}>
          {([['analisis','progreso','Análisis'],['progreso','fuerza','Progresión'],['mapa','objetivo','Mapa'],['vald','fuerza','DynaMo'],['paciente','usuario','Para el paciente']] as const).map(([k,ic,l])=>(
            <button key={k} className={`vista-b ${vista===k?'on':''}`} onClick={()=>setVista(k)}>
              <Ic name={ic} size={13}/> {l}
            </button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button className="btn btn-p btn-sm" onClick={generarPDF}><Ic name="informe" size={12}/> PDF</button>
      </div>

      {/* Un ejercicio, una tarjeta: carga, técnica y esfuerzo juntos. Ver ProgresionEjercicios. */}
      {vista==='mapa'&&pac?.id&&<MapaTrabajo pacienteId={pac.id}/>}
      {/* Tests del DynaMo traidos de VALD Hub. Ver DynamoVald y /api/vald. */}
      {vista==='vald'&&pac?.id&&<DynamoVald pac={pac}/>}
      {vista==='progreso'&&<ProgresionEjercicios registros={registros} bandas={bandas} pacienteId={pac?.id} pesoKg={parseFloat(pac?.peso_kg)||null}/>}

      {vista==='analisis'&&(
        /* EN TARJETAS, COMO EL TORNO Y LA PROGRESIÓN. Antes era una columna de gráficas
           sueltas separadas por aire, y no se sabía dónde acababa una y empezaba otra. Cada
           bloque es ahora una tarjeta blanca; las pequeñas van de dos en dos y las anchas
           (asistencia, trabajo, dolor, tests) ocupan la fila. */
        <div className="res-grid">
          <style>{`.res-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;align-items:start}
            .res-grid>div{background:#fff;border-radius:16px;padding:16px 18px;box-shadow:0 2px 12px rgba(38,40,37,.07);min-width:0}
            .res-grid>.ancha{grid-column:1/-1}
            .res-grid>.nota{background:none;box-shadow:none;padding:0}`}</style>

          {/* ASISTENCIA: donut + numeros */}
          <div className="ancha" style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:20,alignItems:'center'}}>
            <div style={{position:'relative',height:160}}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={dataDonut} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                  <RadialBar background={{fill:'#EFEFEF'}} dataKey="value" cornerRadius={20}/>
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                <div style={{fontSize:30,fontWeight:300,color:GD}}>{pctAsistencia}%</div>
                <div style={{fontSize:12,color:'var(--gr)'}}>asistencia</div>
                {/* El denominador, que nunca se veía: el número no dice nada sin él. */}
                <div style={{fontSize:11,color:'var(--gr)'}}>de {base}</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Realizadas',realizadas,G],['Faltas',faltas,RED],['Canceladas',canceladas,GREY],['Recuperadas',recuperadas,AMB]].map(([l,v,c])=>(
                <div key={String(l)} style={{textAlign:'center',padding:'4px 0'}}>
                  <div style={{fontSize:26,fontWeight:200,color:c as string}}>{v}</div>
                  <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ASISTENCIA POR MES - AREA */}
          {dataMeses.length>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Asistencia por mes</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={dataMeses} margin={{top:5,right:10,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={G} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={G} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="mes" tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{fontSize:13,borderRadius:8,border:'1px solid #eee'}}/>
                  <Area type="monotone" dataKey="Realizadas" stroke={G} strokeWidth={2} fill="url(#gR)"/>
                  <Area type="monotone" dataKey="Faltas" stroke={RED} strokeWidth={1.5} fill="none" strokeDasharray="4 3"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ESCALAS - LINEAS */}
          {dataEscalas.length>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Evolución de escalas</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dataEscalas} margin={{top:5,right:10,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  <XAxis dataKey="fecha" tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,10]} tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{fontSize:13,borderRadius:8,border:'1px solid #eee'}}/>
                  <Line type="monotone" dataKey="Borg" stroke={G} strokeWidth={2} dot={{r:3}}/>
                  <Line type="monotone" dataKey="Estrés" stroke={AMB} strokeWidth={2} dot={{r:3}}/>
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:4}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:2,background:G}}/><span style={{fontSize:12,color:'var(--gr)'}}>Borg (bienestar)</span></div>
                <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:10,height:2,background:AMB}}/><span style={{fontSize:12,color:'var(--gr)'}}>Estrés</span></div>
              </div>
            </div>
          )}

          {/* QUÉ HA ENTRENADO. Va antes que las gráficas de dolor y de carga porque es
              la pregunta con la que se llega a revalorar: no cómo va lo que hace, sino
              qué se está quedando sin hacer. */}
          {pac?.id && (
            <div className="sec ancha">
              <div className="sec-h">
                <span className="sh-l"><span className="ct-l">Trabajo realizado</span></span>
                <span className="sh-r">series por zona y por patrón</span>
              </div>
              <ResumenVolumen pacienteId={pac.id} />
            </div>
          )}

          {/* EVA POR ZONA. Una gráfica por zona, no una línea que las une todas:
              cada zona es una medida distinta y juntarlas inventaba evoluciones. */}
          {zonasEva.length>0&&(
            <div className="sec ancha">
              <div className="sec-h">
                <span className="sh-l"><span className="ct-l">Dolor percibido · EVA</span></span>
                <span className="sh-r">Una línea por zona</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}}>
                {zonasEva.map(z=>(
                  <div key={z.zona}>
                    <div style={{fontSize:13,color:'var(--n)',marginBottom:4}}>
                      {z.zona}
                      {z.puntos.length===1 && <span style={{fontSize:12,color:'var(--gr)'}}> · un solo registro</span>}
                    </div>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={z.puntos} margin={{top:5,right:12,left:0,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                        <XAxis dataKey="fecha" tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                        <YAxis domain={[0,10]} tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{fontSize:13,borderRadius:8,border:'1px solid #eee'}}/>
                        <Line type="monotone" dataKey="EVA" stroke={RED} strokeWidth={2} dot={{r:3}}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PATOLOGIAS POR ESTADO */}
          {totalPat>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Patologías por estado</div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {dataPat.map(d=>(
                  <div key={d.estado} style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{fontSize:12,color:'var(--gr)',width:64,textAlign:'right'}}>{d.estado}</div>
                    <div style={{flex:1,height:18,background:'var(--bl)',borderRadius:99,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${Math.round((d.n/totalPat)*100)}%`,background:d.fill,borderRadius:99,minWidth:18,transition:'width .4s'}}/>
                    </div>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--n)',width:20}}>{d.n}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TIPOS DE CLASE */}
          {dataTipo.length>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Distribución por tipo de clase</div>
              <ResponsiveContainer width="100%" height={Math.max(120, dataTipo.length*38)}>
                <BarChart data={dataTipo} layout="vertical" margin={{top:0,right:20,left:10,bottom:0}}>
                  <XAxis type="number" hide allowDecimals={false}/>
                  <YAxis type="category" dataKey="tipo" tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false} width={80}/>
                  <Tooltip contentStyle={{fontSize:13,borderRadius:8,border:'1px solid #eee'}} cursor={{fill:'#F7F7F7'}}/>
                  <Bar dataKey="n" fill={G} radius={[0,6,6,0]} barSize={18}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* DEPORTES */}
          {deportesPac.length>0&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Deportes que practica</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {deportesPac.map((d:any)=><span key={d.id} style={{fontSize:13,padding:'5px 12px',borderRadius:99,background:GL,color:GD,fontWeight:400}}>{d.nombre}</span>)}
              </div>
            </div>
          )}

          {/* DATOS FISICOS */}
          {pac?.peso_kg&&(
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Datos físicos actuales</div>
              <div style={{display:'flex',gap:30,justifyContent:'center'}}>
                {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm']].map(([l,v,u])=>v?(
                  <div key={String(l)} style={{textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:300,color:'var(--n)'}}>{v}<span style={{fontSize:13,color:'var(--gr)'}}>{u as string}</span></div>
                    <div style={{fontSize:12,color:'var(--gr)'}}>{l}</div>
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
              <div className="ancha">
                <div style={{fontSize:13,fontWeight:500,color:'var(--n)',marginBottom:10}}>Evolución de tests funcionales</div>
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
                          <div style={{fontSize:13,fontWeight:400,color:'var(--n)'}}>{ultimo.tests?.nombre||'Test'}{ladoStr}</div>
                          <div style={{fontSize:12,color:'var(--gr)',marginTop:1}}>{sorted.length} {sorted.length===1?'registro':'registros'}</div>
                        </div>
                        {mejoro&&<span style={{fontSize:12,padding:'2px 8px',borderRadius:99,background:GL,color:GD,fontWeight:500}}><Ic name='sube' size={11}/> Mejorado</span>}
                        {empeoro&&<span style={{fontSize:12,padding:'2px 8px',borderRadius:99,background:'#FBEAEA',color:RED,fontWeight:500,display:'inline-flex',alignItems:'center',gap:3}}><Ic name="baja" size={10}/> Empeorado</span>}
                        <span style={{fontSize:12,padding:'2px 8px',borderRadius:99,background:ultimo.resultado==='positivo'?'#FBEAEA':GL,color:ultimo.resultado==='positivo'?RED:GD,fontWeight:500}}>
                          {ultimo.resultado==='positivo'?'Positivo':'Negativo'}
                        </span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:2,overflowX:'auto',paddingBottom:2}}>
                        {sorted.map((t:any,ti:number)=>(
                          <div key={t.id} style={{display:'flex',alignItems:'center',gap:2,flexShrink:0}}>
                            <div style={{textAlign:'center'}}>
                              <div style={{width:10,height:10,borderRadius:'50%',background:t.resultado==='positivo'?RED:G,margin:'0 auto 2px'}}/>
                              <div style={{fontSize:11,color:'var(--gr)',whiteSpace:'nowrap'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</div>
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

          <div className="ancha nota" style={{fontSize:12,color:'var(--gr)',textAlign:'center',fontWeight:400,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}><Ic name="info" size={11}/> Las citas se actualizan a las 00:00</div>
        </div>
      )}

      {vista==='paciente'&&(
        <div style={{padding:'10px 4px'}}>
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:13,color:'var(--gr)',fontWeight:300}}>Tu progreso</div>
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
                <div style={{fontSize:12,color:'var(--gr)'}}>asistencia</div>
                {/* El denominador, que nunca se veía: el número no dice nada sin él. */}
                <div style={{fontSize:11,color:'var(--gr)'}}>de {base}</div>
              </div>
            </div>
            <div style={{fontSize:12,color:'var(--n)',fontWeight:300,marginTop:14}}>
              {pctAsistencia>=80?'¡Excelente constancia!':pctAsistencia>=60?'¡Buen ritmo, sigue así!':'Cada sesión cuenta, ¡a por ello!'}
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:30,marginBottom:30,flexWrap:'wrap'}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:40,fontWeight:200,color:G}}>{realizadas}</div>
              <div style={{fontSize:12,color:'var(--gr)'}}>sesiones completadas</div>
            </div>
            {recuperadas>0&&(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:40,fontWeight:200,color:AMB}}>{recuperadas}</div>
                <div style={{fontSize:12,color:'var(--gr)'}}>clases recuperadas</div>
              </div>
            )}
          </div>
          {pac?.peso_kg&&(
            <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:30,flexWrap:'wrap'}}>
              {[['Peso',pac.peso_kg,'kg'],['Altura',pac.altura_cm,'cm']].map(([l,v,u])=>v?(
                <div key={String(l)} style={{textAlign:'center'}}>
                  <div style={{fontSize:26,fontWeight:300,color:'var(--n)'}}>{v}<span style={{fontSize:13,color:'var(--gr)'}}>{u as string}</span></div>
                  <div style={{fontSize:12,color:'var(--gr)'}}>{l}</div>
                </div>
              ):null)}
            </div>
          )}
          {dataMeses.length>0&&(
            <div>
              <div style={{fontSize:13,color:'var(--gr)',textAlign:'center',marginBottom:12,fontWeight:300}}>Tu asistencia mes a mes</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dataMeses} margin={{top:5,right:20,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={G} stopOpacity={0.5}/>
                      <stop offset="95%" stopColor={G} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{fontSize:12,fill:GREY}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{fontSize:13,borderRadius:8,border:'1px solid #eee'}}/>
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
