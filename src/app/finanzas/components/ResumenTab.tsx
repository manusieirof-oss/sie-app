'use client'
import { useState } from 'react'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Legend, Cell } from 'recharts'

const G='#5A969E', GD='#3E7179', GL='#EBF4F5', RED='#C25B5B', AMB='#D4A24E', GREY='#9CA3AF'
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function ResumenTab({ planes, gastos, bonos, bonosHist=[] }: any) {
  const [vista, setVista] = useState<'general'|'evolucion'>('general')

  const precioPorTipo: Record<string, number> = {}
  planes.forEach((p: any) => {
    precioPorTipo[p.bono_tipo] = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base * (1 + p.iva/100) * 100) / 100
  })
  const nombrePorTipo: Record<string, string> = {}
  planes.forEach((p: any) => { nombrePorTipo[p.bono_tipo] = p.nombre || p.bono_tipo })

  const bonosActivos = bonos.filter((b: any) => b.activo)

  const ingresosPrevistos = bonosActivos.reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)
  const ingresosCobrados = bonosActivos.filter((b: any) => b.estado_pago === 'pagado').reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)
  const pendiente = bonosActivos.filter((b: any) => b.estado_pago === 'pendiente').reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)
  const impago = bonosActivos.filter((b: any) => b.estado_pago === 'impago').reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)

  const mesActual = new Date().toISOString().slice(0, 7)
  const gastosMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === mesActual).reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosFijosMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === mesActual && g.tipo === 'fijo').reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosVarMes = gastosMes - gastosFijosMes

  const beneficioPrevisto = ingresosPrevistos - gastosMes
  const beneficioReal = ingresosCobrados - gastosMes
  const pctCobrado = ingresosPrevistos > 0 ? Math.round((ingresosCobrados / ingresosPrevistos) * 100) : 0

  const desglose: Record<string, { count: number, total: number }> = {}
  bonosActivos.forEach((b: any) => {
    if (!desglose[b.tipo]) desglose[b.tipo] = { count: 0, total: 0 }
    desglose[b.tipo].count++
    desglose[b.tipo].total += precioPorTipo[b.tipo] || 0
  })
  const dataTipo = Object.entries(desglose)
    .map(([tipo, d]: any) => ({ tipo: nombrePorTipo[tipo] || tipo, total: Math.round(d.total), pacientes: d.count }))
    .sort((a, b) => b.total - a.total)

  const dataDonut = [{ name: 'cobrado', value: pctCobrado, fill: G }]

  const claveMes = (mes: number, anio: number) => `${anio}-${String(mes).padStart(2,'0')}`
  const mesesSet = new Set<string>()
  bonosHist.forEach((b: any) => { if (b.mes && b.anio) mesesSet.add(claveMes(b.mes, b.anio)) })
  gastos.forEach((g: any) => { if (g.fecha) mesesSet.add(g.fecha.slice(0, 7)) })
  const mesesOrden = Array.from(mesesSet).sort().slice(-12)

  const dataEvol = mesesOrden.map((clave) => {
    const [anio, mes] = clave.split('-').map(Number)
    const bonosMes = bonosHist.filter((b: any) => b.mes === mes && b.anio === anio)
    const previsto = bonosMes.reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)
    const cobrado = bonosMes.filter((b: any) => b.estado_pago === 'pagado').reduce((a: number, b: any) => a + (precioPorTipo[b.tipo] || 0), 0)
    const gastoMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === clave).reduce((a: number, g: any) => a + Number(g.importe), 0)
    return {
      mes: `${MESES[mes-1]} ${String(anio).slice(2)}`,
      Previsto: Math.round(previsto),
      Cobrado: Math.round(cobrado),
      Gastos: Math.round(gastoMes),
      Beneficio: Math.round(cobrado - gastoMes),
    }
  })

  const eur = (n: number) => `${n.toFixed(0)}€`

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18}}>
        <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,flex:1,maxWidth:340}}>
          {([['general','📊 General'],['evolucion','📈 Evolución']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)} style={{flex:1,fontSize:10,padding:'6px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',fontWeight:vista===k?500:300,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
          ))}
        </div>
      </div>

      {vista==='general'&&(
        <div style={{display:'flex',flexDirection:'column',gap:22}}>

          <div style={{display:'grid',gridTemplateColumns:'180px 1fr',gap:20,alignItems:'center'}}>
            <div style={{position:'relative',height:160}}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={dataDonut} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0,100]} tick={false}/>
                  <RadialBar background={{fill:'#EFEFEF'}} dataKey="value" cornerRadius={20}/>
                </RadialBarChart>
              </ResponsiveContainer>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center'}}>
                <div style={{fontSize:30,fontWeight:300,color:GD}}>{pctCobrado}%</div>
                <div style={{fontSize:9,color:'var(--grl)'}}>cobrado</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {([['✓ Cobrado',ingresosCobrados,G],['⏳ Pendiente',pendiente,AMB],['⚠ Impago',impago,RED],['🧾 Gastos mes',gastosMes,GREY]] as const).map(([l,v,c])=>(
                <div key={l} style={{textAlign:'center',padding:'4px 0'}}>
                  <div style={{fontSize:24,fontWeight:200,color:c}}>{eur(v)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            <div className="card" style={{textAlign:'center',margin:0}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Previsto / mes</div>
              <div style={{fontSize:28,fontWeight:300,color:G}}>{eur(ingresosPrevistos)}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>{bonosActivos.length} bonos activos</div>
            </div>
            <div className="card" style={{textAlign:'center',margin:0}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Beneficio previsto</div>
              <div style={{fontSize:28,fontWeight:300,color:beneficioPrevisto>=0?G:RED}}>{eur(beneficioPrevisto)}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>si se cobra todo</div>
            </div>
            <div className="card" style={{textAlign:'center',margin:0}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Beneficio real</div>
              <div style={{fontSize:28,fontWeight:300,color:beneficioReal>=0?GD:RED}}>{eur(beneficioReal)}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>cobrado − gastos</div>
            </div>
          </div>

          {dataTipo.length>0&&(
            <div>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Ingresos por tipo de bono</div>
              <ResponsiveContainer width="100%" height={Math.max(120, dataTipo.length*44)}>
                <BarChart data={dataTipo} layout="vertical" margin={{top:0,right:50,left:10,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="tipo" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false} width={90}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any,n:any)=>n==='total'?[`${v}€`,'Ingresos']:[v,'Pacientes']}/>
                  <Bar dataKey="total" fill={G} radius={[0,6,6,0]} barSize={20} label={{position:'right',fontSize:10,fill:GD,formatter:(v:any)=>`${v}€`}}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card" style={{margin:0}}>
            <div className="card-title">Gastos del mes</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'var(--bl)',borderRadius:6,padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:400,color:GD}}>{eur(gastosFijosMes)}</div>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Fijos</div>
              </div>
              <div style={{background:'var(--bl)',borderRadius:6,padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:400,color:AMB}}>{eur(gastosVarMes)}</div>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>Variables</div>
              </div>
            </div>
          </div>

          <div className="card" style={{margin:0}}>
            <div className="card-title">Desglose por tipo de bono</div>
            {dataTipo.length===0 ? (
              <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Sin bonos activos</div>
            ) : dataTipo.map((d)=>(
              <div key={d.tipo} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,background:'var(--bl)',marginBottom:5}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{d.tipo}</div>
                  <div style={{fontSize:9,color:'var(--grl)'}}>{d.pacientes} {d.pacientes===1?'paciente':'pacientes'}</div>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:G}}>{eur(d.total)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vista==='evolucion'&&(
        <div style={{display:'flex',flexDirection:'column',gap:30}}>
          {dataEvol.length===0 ? (
            <div style={{fontSize:11,color:'var(--grl)',padding:20,textAlign:'center'}}>Aún no hay histórico suficiente para mostrar la evolución.</div>
          ) : (
            <>
              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Ingresos cobrados por mes</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                    <defs>
                      <linearGradient id="gCob" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={G} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={G} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                    <Area type="monotone" dataKey="Cobrado" stroke={G} strokeWidth={2.5} fill="url(#gCob)"/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Previsto · Cobrado · Gastos</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Line type="monotone" dataKey="Previsto" stroke={GREY} strokeWidth={1.5} strokeDasharray="4 3" dot={false}/>
                    <Line type="monotone" dataKey="Cobrado" stroke={G} strokeWidth={2.5} dot={{r:3}}/>
                    <Line type="monotone" dataKey="Gastos" stroke={RED} strokeWidth={2} dot={{r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Beneficio por mes</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                    <Bar dataKey="Beneficio" radius={[6,6,0,0]} barSize={28}>
                      {dataEvol.map((d, i) => (
                        <Cell key={i} fill={d.Beneficio>=0?G:RED}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
