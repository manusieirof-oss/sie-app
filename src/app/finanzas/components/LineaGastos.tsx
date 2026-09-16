'use client'
import { useState } from 'react'
import { calcularImpuestos, rangoMes, rangoTrimestre } from '@/lib/impuestos'

const RED='#C25B5B', AMB='#D4A24E', G='#5A969E'

/**
 * CUÁNDO CAE CADA RECIBO.
 *
 * El listado dice cuánto se gasta en el mes; esto dice qué días. No es lo
 * mismo 3.500 € repartidos que 3.500 € cayendo el día 1 junto a las nóminas.
 *
 * Una línea que sube en el día del cargo y vuelve a bajar: cada pico es un
 * recibo, y la altura, su tamaño. No se pintan ingresos —para eso está
 * Resumen—, solo lo que sale y lo que hay que tener apartado para Hacienda.
 */
export default function LineaGastos({ gastos=[], ingresos=[], facturas=[], mesRef }: any) {
  const [vista, setVista] = useState<'mes'|'trimestre'>('mes')
  const mesActual = mesRef || new Date().toISOString().slice(0,7)
  const eur = (n:number) => `${Math.round(n)}€`

  const rTri = rangoTrimestre(mesActual)
  const rango = vista==='mes' ? rangoMes(mesActual) : { desde: rTri.desde, hasta: rTri.hasta }

  /** Un punto por día del periodo, con lo que cae ese día. */
  const dias: { fecha:string, dia:number, mes:number, gasto:number, conceptos:any[] }[] = []
  const d0 = new Date(rango.desde+'T12:00:00'), d1 = new Date(rango.hasta+'T12:00:00')
  for (let d=new Date(d0); d<=d1; d.setDate(d.getDate()+1)) {
    const f = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const gs = gastos.filter((g:any)=>g.fecha===f)
    dias.push({ fecha:f, dia:d.getDate(), mes:d.getMonth()+1,
                gasto: gs.reduce((a:number,g:any)=>a+Number(g.importe||0),0), conceptos: gs })
  }

  const maxG = Math.max(1, ...dias.map(d=>d.gasto))
  const totalPeriodo = dias.reduce((a,d)=>a+d.gasto,0)

  const impTri = calcularImpuestos({ facturas, ingresos, gastos, desde: rTri.desde, hasta: rTri.hasta })
  const impPeriodo = calcularImpuestos({ facturas, ingresos, gastos, ...rango })

  /**
   * APARTAR ES UNA COSA DE CADA MES, AUNQUE SE PAGUE AL CERRAR EL TRIMESTRE.
   *
   * El total del trimestre no dice qué hacer hoy. Partido en dos —lo que suma
   * este mes y lo que ya venía de antes— sí: el primero es lo que hay que
   * separar ahora, el segundo lo que debería estar ya guardado.
   */
  const impMes = calcularImpuestos({ facturas, ingresos, gastos, ...rangoMes(mesActual) })
  const apartarEsteMes = Math.max(0, impMes.total)
  const yaAcumulado = Math.max(0, impTri.total - apartarEsteMes)

  // Geometría del trazo
  /**
   * El margen no es estética: las etiquetas van centradas sobre el pico, así
   * que un recibo el día 1 o el 31 escribía su nombre medio fuera del lienzo.
   * Y el alto deja hueco arriba para el nombre y el importe.
   */
  const W = 1000, H = 172, MARGEN = 70, BASE = H - 26
  const x = (i:number) => dias.length>1 ? (i/(dias.length-1))*(W-MARGEN*2)+MARGEN : W/2
  const y = (v:number) => BASE - (v/maxG)*(BASE-34)

  /**
   * El trazo: un pico por día con gasto y suelo plano entre medias.
   * Los dos puntos pegados al día hacen que suba y baje de golpe, en vez de
   * describir una loma entre recibos.
   */
  let d = `M ${x(0)} ${BASE}`
  dias.forEach((p, i) => {
    if (p.gasto > 0) {
      const xi = x(i), ancho = Math.max(3, (W-MARGEN*2)/dias.length/2)
      d += ` L ${xi-ancho} ${BASE} L ${xi} ${y(p.gasto)} L ${xi+ancho} ${BASE}`
    }
  })
  d += ` L ${x(dias.length-1)} ${BASE}`

  /** Los picos que merecen etiqueta: los que se ven. */
  const picos = dias.map((p,i)=>({...p,i})).filter(p=>p.gasto >= maxG*0.12).sort((a,b)=>b.gasto-a.gasto).slice(0,7)

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3}}>
          {([['mes','Mes'],['trimestre','Trimestre']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)}
              style={{fontSize:10,padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'inherit',
                      background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',
                      fontWeight:vista===k?500:300,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
          ))}
        </div>
        <div style={{fontSize:9,color:'var(--grl)'}}>Cada pico es un día de cargo. Pasa por encima para ver qué cae.</div>
      </div>

      {/* Los números al final de la línea, como el cierre del recorrido: la
          línea cuenta el mes y a la derecha está en lo que acaba. */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 200px',gap:20,alignItems:'center'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
        <line x1={MARGEN-14} y1={BASE} x2={W-MARGEN+14} y2={BASE} stroke="var(--bd)" strokeWidth="1"/>
        {/* HOY. Sin esto la línea no dice si el pico que viene ya ha pasado o
            está por caer, que es justo lo que se mira. */}
        {(() => {
          const hoy = new Date().toISOString().slice(0,10)
          const i = dias.findIndex(p=>p.fecha===hoy)
          if (i < 0) return null
          return (
            <g>
              <line x1={x(i)} y1={10} x2={x(i)} y2={BASE} stroke="var(--g)" strokeWidth="1" strokeDasharray="3 3"/>
              <text x={x(i)} y={8} textAnchor="middle" fontSize="9" fill="var(--g)">hoy</text>
            </g>
          )
        })()}
        {/* EL RESPLANDOR.
            Un halo bajo cada pico: cuanto más alto el recibo, más ancho y más
            opaco. Se ve el mes de un vistazo sin tener que leer las cifras,
            que es para lo que sirve una línea y no una tabla. */}
        <defs>
          <filter id="glowGasto" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="b"/></feMerge>
          </filter>
        </defs>
        {dias.map((p,i)=> p.gasto>0 ? (
          <line key={`glow-${p.fecha}`} x1={x(i)} y1={BASE} x2={x(i)} y2={y(p.gasto)}
            stroke={RED} strokeWidth={2 + (p.gasto/maxG)*7}
            opacity={0.18 + (p.gasto/maxG)*0.5}
            filter="url(#glowGasto)" strokeLinecap="round"/>
        ) : null)}
        <path d={d} fill="none" stroke={RED} strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        {dias.map((p,i)=> p.gasto>0 ? (
          <g key={`pt-${p.fecha}`}>
            {/* El punto también difuminado: marcado con borde duro parecía un
                dato aparte en vez de la punta del mismo trazo. */}
            <circle cx={x(i)} cy={y(p.gasto)} r={3 + (p.gasto/maxG)*6}
              fill={RED} opacity={0.15 + (p.gasto/maxG)*0.35} filter="url(#glowGasto)"/>
            <circle cx={x(i)} cy={y(p.gasto)} r={1 + (p.gasto/maxG)*1.2}
              fill={RED} opacity={0.35 + (p.gasto/maxG)*0.3}/>
          </g>
        ) : null)}
        {picos.map(p=>(
          <g key={p.fecha}>
            <text x={x(p.i)} y={y(p.gasto)-14} textAnchor="middle" fontSize="11" fill="var(--gr)">
              {p.conceptos.length===1 ? p.conceptos[0].concepto : `${p.conceptos.length} recibos`}
            </text>
            <text x={x(p.i)} y={y(p.gasto)-3} textAnchor="middle" fontSize="11" fontWeight="600" fill={RED}>
              {eur(p.gasto)}
            </text>
          </g>
        ))}
        {dias.map((p,i)=> p.gasto>0 ? (
          <g key={p.fecha}>
            <title>{`${p.dia}/${p.mes} · ${eur(p.gasto)}\n${p.conceptos.map((c:any)=>`${c.concepto}: ${Number(c.importe).toFixed(2)}€${c.estimado?' (estimado)':''}`).join('\n')}`}</title>
            <rect x={x(i)-6} y={0} width="12" height={H} fill="transparent"/>
          </g>
        ) : null)}
        {dias.map((p,i)=> (vista==='mes' ? (p.dia%5===0 || p.dia===1) : p.dia===1) ? (
          <text key={p.fecha} x={x(i)} y={H-8} textAnchor="middle" fontSize="10" fill="var(--grl)">
            {vista==='mes' ? p.dia : new Date(p.fecha+'T12:00:00').toLocaleDateString('es-ES',{month:'short'})}
          </text>
        ) : null)}
      </svg>

      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <div style={{fontSize:19,fontWeight:200,color:RED,lineHeight:1.1}}>{eur(totalPeriodo)}</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Pagado {vista==='mes'?'este mes':'este trimestre'}</div>
        </div>
        <div>
          <div style={{fontSize:19,fontWeight:200,color:G,lineHeight:1.1}}>{eur(impPeriodo.ivaSoportado)}</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>IVA de esos gastos</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>te lo deduces, resta de lo que debes</div>
        </div>
        <div>
          <div style={{fontSize:19,fontWeight:200,color:AMB,lineHeight:1.1}}>{eur(apartarEsteMes)}</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Aparta de este mes</div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:3}}>
            {yaAcumulado > 0
              ? <>+ {eur(yaAcumulado)} que ya llevas de meses anteriores</>
              : <>es lo primero del trimestre</>}
          </div>
          <div style={{fontSize:9,color:'var(--n)',marginTop:2,fontWeight:500}}>
            Total {rTri.t}º trimestre: {eur(Math.max(0,impTri.total))}
          </div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
            IVA {eur(Math.max(0,impTri.modelo303))}
            {impTri.modelo130>0 && <> · IRPF {eur(impTri.modelo130)}</>}
            {impTri.modelo111+impTri.modelo115>0 && <> · retenciones {eur(impTri.modelo111+impTri.modelo115)}</>}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
