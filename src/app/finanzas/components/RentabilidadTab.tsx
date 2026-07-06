'use client'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { precioConDescuento } from '@/lib/bonos'

const G='#5A969E', GD='#3E7179', RED='#C25B5B', AMB='#D4A24E', GREY='#9CA3AF'
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function RentabilidadTab({ planes, gastos, bonos, bonosHist=[] }: any) {
  const eur = (n:number) => `${n>=0?'':'−'}${Math.abs(n).toFixed(0)}€`

  // Precio final por tipo de bono
  const precioPorTipo: Record<string, number> = {}
  planes.forEach((p:any)=>{ precioPorTipo[p.bono_tipo] = p.precio_final != null ? Number(p.precio_final) : Math.round(p.precio_base*(1+p.iva/100)*100)/100 })

  const bonosActivos = bonos.filter((b:any)=>b.activo)
  const precioBono = (b:any) => precioConDescuento(precioPorTipo[b.tipo]||0, b)

  // FOTO DEL MES ACTUAL
  const mesActual = new Date().toISOString().slice(0,7)
  const ingresosMes = bonosActivos.reduce((a:number,b:any)=>a+precioBono(b),0)
  const gastosMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const beneficioMes = ingresosMes - gastosMes
  const margen = ingresosMes>0 ? (beneficioMes/ingresosMes)*100 : 0

  // Gastos fijos mensuales -> punto de equilibrio
  const gastosFijos = gastos.filter((g:any)=>g.tipo==='fijo').reduce((a:number,g:any)=>a+Number(g.importe),0)
  // Ingreso medio por bono activo (para estimar cuántos bonos hacen falta)
  const ingresoMedioBono = bonosActivos.length ? ingresosMes/bonosActivos.length : 0
  const bonosParaEquilibrio = ingresoMedioBono>0 ? Math.ceil(gastosFijos/ingresoMedioBono) : 0

  // EVOLUCIÓN MENSUAL (últimos 12 meses)
  const claveMes = (mes:number, anio:number) => `${anio}-${String(mes).padStart(2,'0')}`
  const mesesSet = new Set<string>()
  bonosHist.forEach((b:any)=>{ if(b.mes&&b.anio) mesesSet.add(claveMes(b.mes,b.anio)) })
  gastos.forEach((g:any)=>{ if(g.fecha) mesesSet.add(g.fecha.slice(0,7)) })
  const mesesOrden = Array.from(mesesSet).sort().slice(-12)

  const dataEvol = mesesOrden.map((clave)=>{
    const [anio,mes] = clave.split('-').map(Number)
    const bonosMes = bonosHist.filter((b:any)=>b.mes===mes&&b.anio===anio)
    const ingresos = bonosMes.reduce((a:number,b:any)=>a+(precioPorTipo[b.tipo]||0),0)
    const gastoMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===clave).reduce((a:number,g:any)=>a+Number(g.importe),0)
    return { mes:`${MESES[mes-1]} ${String(anio).slice(2)}`, Ingresos:Math.round(ingresos), Gastos:Math.round(gastoMes), Beneficio:Math.round(ingresos-gastoMes) }
  })

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>

      {/* FOTO DEL MES */}
      <div>
        <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Este mes</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Ingresos</div>
            <div style={{fontSize:26,fontWeight:300,color:G}}>{ingresosMes.toFixed(0)}€</div>
          </div>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Gastos</div>
            <div style={{fontSize:26,fontWeight:300,color:RED}}>{gastosMes.toFixed(0)}€</div>
          </div>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Beneficio</div>
            <div style={{fontSize:26,fontWeight:300,color:beneficioMes>=0?GD:RED}}>{beneficioMes.toFixed(0)}€</div>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>margen {margen.toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* PUNTO DE EQUILIBRIO */}
      <div className="card" style={{margin:0,background:'var(--gl)',border:'1px solid var(--gm)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--gd)',marginBottom:6}}>⚖️ Punto de equilibrio</div>
        <div style={{fontSize:10,color:'var(--gr)',lineHeight:1.6}}>
          Tus gastos fijos son <strong>{gastosFijos.toFixed(0)}€/mes</strong>. Necesitas ingresar al menos esa cantidad para no perder dinero.
          {ingresoMedioBono>0 && <> Con un ingreso medio de <strong>{ingresoMedioBono.toFixed(0)}€</strong> por bono, eso equivale a unos <strong>{bonosParaEquilibrio} bonos</strong> activos.</>}
        </div>
        <div style={{marginTop:10}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'var(--grl)',marginBottom:3}}>
            <span>Ingresos actuales: {ingresosMes.toFixed(0)}€</span>
            <span>Objetivo: {gastosFijos.toFixed(0)}€</span>
          </div>
          <div style={{height:8,borderRadius:99,background:'var(--bm)',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${Math.min(100, gastosFijos>0?(ingresosMes/gastosFijos)*100:100)}%`,background:ingresosMes>=gastosFijos?G:AMB,borderRadius:99}}/>
          </div>
          <div style={{fontSize:9,color:ingresosMes>=gastosFijos?'var(--gd)':'#7A5800',marginTop:4}}>
            {ingresosMes>=gastosFijos ? '✓ Cubres tus gastos fijos' : `Te faltan ${(gastosFijos-ingresosMes).toFixed(0)}€ para cubrir los fijos`}
          </div>
        </div>
      </div>

      {/* EVOLUCIÓN */}
      {dataEvol.length>0 && (
        <>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Ingresos vs Gastos por mes</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                <Legend wrapperStyle={{fontSize:10}}/>
                <Line type="monotone" dataKey="Ingresos" stroke={G} strokeWidth={2.5} dot={{r:3}}/>
                <Line type="monotone" dataKey="Gastos" stroke={RED} strokeWidth={2} dot={{r:3}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Beneficio por mes</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                <defs>
                  <linearGradient id="gBen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={G} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={G} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                <Area type="monotone" dataKey="Beneficio" stroke={G} strokeWidth={2.5} fill="url(#gBen)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
