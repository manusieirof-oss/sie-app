'use client'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { indicePlanes, precioBono as precioDeBono } from '@/lib/bonos'
import { Ic } from '@/lib/icons'
import { mesISO } from '@/lib/fechas'

const G='#5A969E', GD='#3E7179', RED='#C25B5B', AMB='#D4A24E', GREY='#9CA3AF'
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// mesRef ('YYYY-MM'): ver un mes distinto al de hoy. Por defecto, el mes en curso.
import type { Factura } from '@/lib/facturado'

/**
 * FACTURADO Y COBRADO NO SON LO MISMO, Y LOS DOS HACEN FALTA.
 *
 *   facturado → lo que has emitido este mes. Dice si el negocio da de sí.
 *   cobrado   → lo que ha entrado de verdad. Dice si llegas a fin de mes.
 *
 * Un negocio puede ser rentable y quedarse sin dinero porque no le pagan a
 * tiempo. Antes esta pestaña enseñaba solo lo devengado y lo llamaba
 * "Ingresos" a secas, mientras Resumen enseñaba lo cobrado con el mismo
 * nombre: dos cifras distintas del mismo mes y ninguna pista de por qué.
 */
export default function RentabilidadTab({ planes, gastos, bonos, ingresos=[], bonosHist=[], facturas=[], mesRef }: any) {
  const eur = (n:number) => `${n>=0?'':'−'}${Math.abs(n).toFixed(0)}€`

  const idxPlanes = indicePlanes(planes)
  const bonosActivos = bonos   // ya filtrados por el mes elegido
  const precioBono = (b:any) => precioDeBono(b, idxPlanes)

  // FOTO DEL MES ACTUAL
  const mesActual = mesRef || mesISO()
  /**
   * Lo que entra y no es una cuota: charlas, alquilar la sala y el histórico de
   * los meses en que todavía no se usaba la app. Sin sumarlo, un año que
   * empezó en enero arranca en septiembre y el beneficio de esos meses sale
   * en negativo aunque hubieras cobrado.
   */
  const otrosMes = ingresos.filter((i:any)=>i.fecha?.slice(0,7)===mesActual)
    .reduce((a:number,i:any)=>a+Number(i.importe||0),0)
  const facturadoMes = bonosActivos.reduce((a:number,b:any)=>a+precioBono(b),0) + otrosMes
  const cobradoFact = (facturas as Factura[])
    .filter((x:any)=>x.fecha_expedicion?.slice(0,7)===mesActual)
    .reduce((a:number,x:any)=>a+Number(x.total||0),0)
  const cobradoMes = cobradoFact + otrosMes
  /** El beneficio se mide sobre lo devengado: es lo que dice si el negocio es rentable. */
  const ingresosMes = facturadoMes
  const pendienteCobro = Math.max(0, facturadoMes - cobradoMes)
  const gastosMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const beneficioMes = ingresosMes - gastosMes
  const margen = ingresosMes>0 ? (beneficioMes/ingresosMes)*100 : 0

  // Gastos fijos MENSUALES -> punto de equilibrio.
  // Antes esto sumaba todos los fijos del histórico entero sin filtrar mes, así
  // que con medio año cargado el objetivo salía multiplicado por seis. Se toma
  // la media de los meses que tienen fijos registrados, que es lo que se repite
  // cada mes; si solo hay un mes, la media es ese mes.
  const fijosPorMes: Record<string, number> = {}
  gastos.filter((g:any)=>g.tipo==='fijo'&&g.fecha).forEach((g:any)=>{
    const m = g.fecha.slice(0,7)
    fijosPorMes[m] = (fijosPorMes[m]||0) + Number(g.importe)
  })
  /**
   * El mes en curso no entra en la media: va a medias por definición.
   * Estando a día 5 con dos recibos cargados, incluirlo bajaba el objetivo y
   * el punto de equilibrio salía más fácil de alcanzar de lo que es.
   */
  const mesesCerrados = Object.keys(fijosPorMes).filter(m => m < mesActual)
  const clavesFijos = mesesCerrados.length ? mesesCerrados : Object.keys(fijosPorMes)
  const mesesConFijos = clavesFijos.length
  const gastosFijos = mesesConFijos ? clavesFijos.reduce((a,m)=>a+fijosPorMes[m],0)/mesesConFijos : 0
  // Ingreso medio por bono activo (para estimar cuántos bonos hacen falta)
  // Solo cuotas: los otros ingresos no salen de tener más pacientes.
  const ingresoMedioBono = bonosActivos.length ? (ingresosMes-otrosMes)/bonosActivos.length : 0
  const bonosParaEquilibrio = ingresoMedioBono>0 ? Math.ceil(gastosFijos/ingresoMedioBono) : 0

  // EVOLUCIÓN MENSUAL (últimos 12 meses)
  const claveMes = (mes:number, anio:number) => `${anio}-${String(mes).padStart(2,'0')}`
  const mesesSet = new Set<string>()
  bonosHist.forEach((b:any)=>{ if(b.mes&&b.anio) mesesSet.add(claveMes(b.mes,b.anio)) })
  gastos.forEach((g:any)=>{ if(g.fecha) mesesSet.add(g.fecha.slice(0,7)) })
  // Un mes que solo tiene ingresos sueltos —el histórico de quien empieza a
  // mitad de año— también existe, aunque no haya bonos ni gastos.
  ingresos.forEach((i:any)=>{ if(i.fecha) mesesSet.add(i.fecha.slice(0,7)) })
  ;(facturas as Factura[]).forEach((x:any)=>{ if(x.fecha_expedicion) mesesSet.add(x.fecha_expedicion.slice(0,7)) })
  const mesesOrden = Array.from(mesesSet).sort().slice(-12)

  const dataEvol = mesesOrden.map((clave)=>{
    const [anio,mes] = clave.split('-').map(Number)
    const bonosMes = bonosHist.filter((b:any)=>b.mes===mes&&b.anio===anio)
    const otros = ingresos.filter((i:any)=>i.fecha?.slice(0,7)===clave)
      .reduce((a:number,i:any)=>a+Number(i.importe||0),0)
    const ingresosDelMes = bonosMes.reduce((a:number,b:any)=>a+precioBono(b),0) + otros
    const gastoMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===clave).reduce((a:number,g:any)=>a+Number(g.importe),0)
    const cobradoDelMes = (facturas as Factura[])
      .filter((x:any)=>x.fecha_expedicion?.slice(0,7)===clave)
      .reduce((a:number,x:any)=>a+Number(x.total||0),0) + otros
    return { mes:`${MESES[mes-1]} ${String(anio).slice(2)}`, Facturado:Math.round(ingresosDelMes),
             Cobrado:Math.round(cobradoDelMes), Gastos:Math.round(gastoMes),
             Beneficio:Math.round(ingresosDelMes-gastoMes) }
  })

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>

      {/* FOTO DEL MES */}
      <div>
        <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Este mes</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12}}>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Facturado</div>
            <div style={{fontSize:26,fontWeight:300,color:G}}>{facturadoMes.toFixed(0)}€</div>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>lo que toca cobrar</div>
          </div>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Cobrado</div>
            <div style={{fontSize:26,fontWeight:300,color:GD}}>{cobradoMes.toFixed(0)}€</div>
            <div style={{fontSize:9,color:pendienteCobro>0?'#7A5800':'var(--grl)',marginTop:2}}>
              {pendienteCobro>0 ? `faltan ${pendienteCobro.toFixed(0)}€` : 'todo cobrado'}
            </div>
          </div>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Gastos</div>
            <div style={{fontSize:26,fontWeight:300,color:RED}}>{gastosMes.toFixed(0)}€</div>
          </div>
          <div className="card" style={{textAlign:'center',margin:0}}>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Beneficio</div>
            <div style={{fontSize:26,fontWeight:300,color:beneficioMes>=0?GD:RED}}>{beneficioMes.toFixed(0)}€</div>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>margen {margen.toFixed(0)}% · sobre facturado</div>
          </div>
        </div>
      </div>

      {/* PUNTO DE EQUILIBRIO */}
      <div className="card" style={{margin:0,background:'var(--gl)',border:'1px solid var(--gm)'}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--gd)',marginBottom:6,display:'flex',alignItems:'center',gap:5}}><Ic name="progreso" size={13}/> Punto de equilibrio</div>
        <div style={{fontSize:10,color:'var(--gr)',lineHeight:1.6}}>
          Tus gastos fijos son <strong>{gastosFijos.toFixed(0)}€/mes</strong>{mesesConFijos>1 && <span style={{color:'var(--grl)'}}> (media de {mesesConFijos} meses)</span>}. Necesitas ingresar al menos esa cantidad para no perder dinero.
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
                <Line type="monotone" dataKey="Facturado" stroke={G} strokeWidth={2.5} dot={{r:3}}/>
                <Line type="monotone" dataKey="Cobrado" stroke={GD} strokeWidth={1.5} strokeDasharray="4 3" dot={false}/>
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
