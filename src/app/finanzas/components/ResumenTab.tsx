'use client'
import React, { useState } from 'react'
import { indicePlanes, precioBono as precioDeBono, precioFinalPlan, esVentaPuntual } from '@/lib/bonos'
import { Ic } from '@/lib/icons'
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis, Legend, Cell } from 'recharts'
import { mesISO } from '@/lib/fechas'
import { delMes, sumar, type Factura } from '@/lib/facturado'
import { calcularImpuestos, rangoMes, rangoTrimestre } from '@/lib/impuestos'

const G='#5A969E', GD='#3E7179', GL='#EBF4F5', RED='#C25B5B', AMB='#D4A24E', GREY='#9CA3AF'
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// mesRef ('YYYY-MM') existe para poder mirar un mes que no sea el de hoy, que es
// lo que necesita el banco de pruebas. Por defecto es el mes en curso.
export default function ResumenTab({ planes, gastos, bonos, bonosHist=[], mesRef, facturas=[], ingresos=[] }: any) {
  const [vista, setVista] = useState<'general'|'evolucion'>('general')

  const idxPlanes = indicePlanes(planes)
  const nombrePorTipo: Record<string, string> = {}
  planes.forEach((p: any) => { nombrePorTipo[p.bono_tipo] = p.nombre || p.bono_tipo })

  // Ya viene filtrada por el mes elegido desde la página. Volver a filtrar por
  // `activo` aquí dejaría vacío cualquier mes ya cerrado, porque la renovación
  // desactiva las cuotas del mes anterior al crear las del siguiente.
  const bonosActivos = bonos
  const precioBono = (b: any) => precioDeBono(b, idxPlanes)
  const nVentas = bonosActivos.filter(esVentaPuntual).length
  const nCuotas = bonosActivos.length - nVentas

  const ingresosPrevistosCuotas = bonosActivos.reduce((a: number, b: any) => a + precioBono(b), 0)
  const totalDescuentos = bonosActivos.reduce((a: number, b: any) => a + (precioFinalPlan(idxPlanes[b.tipo]) - precioBono(b)), 0)
  const mesActual = mesRef || mesISO()
  const [anioSel, mesSel] = mesActual.split('-').map(Number)

  /**
   * COBRADO SALE DE LAS FACTURAS, no de `bonos.estado_pago`.
   *
   * Ese campo dejó de escribirse cuando los cobros pasaron a su propia tabla, así
   * que aquí salía 0 € cobrado por muchas facturas que hubieras emitido: Cobros
   * decía una cosa y Finanzas otra del mismo mes.
   *
   * Las rectificativas vienen dentro y restan, que es lo correcto: una factura
   * anulada y su rectificativa suman cero.
   */
  const facturado = delMes(facturas as Factura[], anioSel, mesSel)
  /**
   * Lo cobrado fuera de una cuota: charlas, alquiler de sala y el histórico de
   * meses anteriores a usar la app. Ya está cobrado, así que suma tanto a lo
   * previsto como a lo cobrado; si solo sumara a lo previsto, el porcentaje
   * cobrado del mes se hundiría por dinero que sí está en el banco.
   */
  const claveMesSel = `${anioSel}-${String(mesSel).padStart(2,'0')}`
  const otrosDelMes = ingresos.filter((i:any)=>i.fecha?.slice(0,7)===claveMesSel)
  const otrosIngresos = otrosDelMes.reduce((a:number,i:any)=>a+Number(i.importe||0),0)
  const otrosIngresosBase = otrosDelMes.reduce((a:number,i:any)=>a+Number(i.base_imponible ?? i.importe ?? 0),0)
  const ingresosCobrados = facturado.total + otrosIngresos

  /**
   * PENDIENTE = lo que toca cobrar MENOS lo ya facturado.
   *
   * Antes se sumaban los bonos con `estado_pago = 'pendiente'`, y como ese campo
   * no cambia al cobrar, el pendiente no bajaba nunca. Restando se corrige solo.
   *
   * Nunca negativo: si has facturado de más —un extra, una valoración suelta— eso
   * no significa que te deban dinero en contra.
   */
  const ingresosPrevistos = ingresosPrevistosCuotas + otrosIngresos
  const pendiente = Math.max(0, ingresosPrevistos - ingresosCobrados)

  /** Impago sigue siendo un JUICIO tuyo sobre lo que no se ha cobrado, no un hecho. */
  const impago = bonosActivos
    .filter((b: any) => b.estado_pago === 'impago')
    .reduce((a: number, b: any) => a + precioBono(b), 0)

  /**
   * LOS GASTOS DEL MES INCLUYEN PREVISIONES, Y HAY QUE DECIRLO.
   *
   * Un gasto estimado es un cálculo: la luz de noviembre cuando aún no ha
   * llegado la factura. Cuenta para saber lo que va a costar el mes, pero no
   * es dinero gastado. Aquí se sumaba sin distinguir, así que el beneficio se
   * medía contra facturas que todavía no existen y salía peor de lo real.
   */
  const gastosDelMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === mesActual)
  const gastosMes = gastosDelMes.reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosEstimadosMes = gastosDelMes.filter((g: any) => g.estimado).reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosConfirmadosMes = gastosMes - gastosEstimadosMes
  const gastosConfDelMes = gastosDelMes.filter((g: any) => !g.estimado)
  const gastosConfFijos = gastosConfDelMes.filter((g: any) => g.tipo === 'fijo').reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosConfVar = gastosConfirmadosMes - gastosConfFijos
  const gastosFijosMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === mesActual && g.tipo === 'fijo').reduce((a: number, g: any) => a + Number(g.importe), 0)
  const gastosVarMes = gastosMes - gastosFijosMes

  /**
   * LO QUE HAY QUE APARTAR PARA HACIENDA.
   *
   * No es dinero tuyo aunque esté en tu cuenta. Verlo junto al beneficio evita
   * la trampa de mirar el saldo del banco y creer que eso es lo que has ganado.
   *
   * El mes dice cuánto aporta este mes; el trimestre, lo que se paga de verdad,
   * porque los modelos se liquidan por trimestre, no por mes.
   */
  const rMes = rangoMes(mesActual)
  const rTri = rangoTrimestre(mesActual)
  const comun = { facturas: facturas as Factura[], ingresos, gastos }
  const impMesReal = calcularImpuestos({ ...comun, ...rMes })
  const impMesPrev = calcularImpuestos({ ...comun, ...rMes, previsto: true, bonos: bonosActivos, precioBono })

  const beneficioPrevisto = ingresosPrevistos - gastosMes

  /**
   * EL BENEFICIO DE CAJA, SIN IVA Y SIN PREVISIONES.
   *
   * Restar cobrado menos gastos a pelo daba un número inflado por dos motivos:
   *
   *   · Las dos cifras llevan IVA dentro. Repercutes mucho más del que
   *     soportas, y esa diferencia no es tuya: la ingresas en el 303. Metida
   *     en el beneficio, parecía dinero ganado.
   *   · Los gastos incluyen previsiones. Descontaba facturas que aún no han
   *     llegado, así que el mismo número salía inflado por arriba y hundido
   *     por abajo a la vez.
   *
   * Se mide sobre bases imponibles y solo con lo confirmado, que es lo que de
   * verdad te queda.
   */
  const gastosConfirmadosBase = gastosDelMes
    .filter((g: any) => !g.estimado)
    .reduce((a: number, g: any) => a + Number(g.base_imponible ?? g.importe ?? 0), 0)
  const beneficioAntesImpuestos = (facturado.base + otrosIngresosBase) - gastosConfirmadosBase
  // El 130 sale de tu bolsillo, así que no es beneficio. El 303 ya está fuera
  // al medir sobre bases, y el 111 y el 115 viven dentro de la nómina y del
  // alquiler: restarlos aquí sería contarlos dos veces.
  const beneficioReal = beneficioAntesImpuestos - impMesReal.modelo130
  const pctCobrado = ingresosPrevistos > 0 ? Math.round((ingresosCobrados / ingresosPrevistos) * 100) : 0


  const impTriReal = calcularImpuestos({ ...comun, ...rTri })
  const impTriPrev = calcularImpuestos({ ...comun, ...rTri, previsto: true, bonos: bonosActivos, precioBono })

  const desglose: Record<string, { count: number, total: number }> = {}
  bonosActivos.forEach((b: any) => {
    if (!desglose[b.tipo]) desglose[b.tipo] = { count: 0, total: 0 }
    desglose[b.tipo].count++
    desglose[b.tipo].total += precioBono(b)
  })
  const dataTipo = Object.entries(desglose)
    .map(([tipo, d]: any) => ({ tipo: nombrePorTipo[tipo] || tipo, total: Math.round(d.total), pacientes: d.count }))
    .sort((a, b) => b.total - a.total)

  const dataDonut = [{ name: 'cobrado', value: pctCobrado, fill: G }]

  const claveMes = (mes: number, anio: number) => `${anio}-${String(mes).padStart(2,'0')}`
  const mesesSet = new Set<string>()
  bonosHist.forEach((b: any) => { if (b.mes && b.anio) mesesSet.add(claveMes(b.mes, b.anio)) })
  gastos.forEach((g: any) => { if (g.fecha) mesesSet.add(g.fecha.slice(0, 7)) })
  // Un mes que solo tiene ingresos sueltos también existe.
  ingresos.forEach((i: any) => { if (i.fecha) mesesSet.add(i.fecha.slice(0, 7)) })
  const mesesOrden = Array.from(mesesSet).sort().slice(-12)

  const dataEvol = mesesOrden.map((clave) => {
    const [anio, mes] = clave.split('-').map(Number)
    const bonosMes = bonosHist.filter((b: any) => b.mes === mes && b.anio === anio)
    // Con descuento, igual que la foto del mes actual. Sin esto, el mismo mes
    // salía con dos cifras distintas en dos gráficas de esta misma pestaña.
    const previsto = bonosMes.reduce((a: number, b: any) => a + precioBono(b), 0)
    // Cobrado desde las FACTURAS de ese mes, igual que la foto de arriba. Con
    // `estado_pago` la línea de cobrado salía plana en cero y el beneficio con
    // ella: parecía que la clínica no ingresaba nada.
    const otrosEse = ingresos.filter((i:any)=>i.fecha?.slice(0,7)===`${anio}-${String(mes).padStart(2,'0')}`)
      .reduce((a:number,i:any)=>a+Number(i.importe||0),0)
    const cobrado = delMes(facturas as Factura[], anio, mes).total + otrosEse
    const gastoMes = gastos.filter((g: any) => g.fecha?.slice(0, 7) === clave).reduce((a: number, g: any) => a + Number(g.importe), 0)
    /**
     * EL BENEFICIO DEL MES, IGUAL QUE EN LA VISTA GENERAL.
     *
     * Antes era cobrado − gastos, con IVA por los dos lados y contando
     * previsiones. Salía una cifra y la de arriba otra, en la misma pestaña.
     *
     * Se mide sobre bases —el IVA no es tuyo— y se le quita el modelo 130, que
     * es lo único de Hacienda que sale de tu bolsillo. El 303 ya está fuera al
     * usar bases; el 111 y el 115 son retenciones que viven dentro de la
     * nómina y del alquiler, y restarlas otra vez sería contarlas dos veces.
     */
    const imp = calcularImpuestos({ facturas: facturas as Factura[], ingresos, gastos, ...rangoMes(clave) })
    const beneficioMes = imp.beneficio - imp.modelo130
    return {
      mes: `${MESES[mes-1]} ${String(anio).slice(2)}`,
      // El previsto también cuenta lo cobrado fuera de cuota: sin ello la línea
      // salía a cero en los meses de histórico mientras la de cobrado subía.
      Previsto: Math.round(previsto + otrosEse),
      Cobrado: Math.round(cobrado),
      Gastos: Math.round(gastoMes),
      Beneficio: Math.round(beneficioMes),
    }
  })

  const eur = (n: number) => `${n.toFixed(0)}€`

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18}}>
        <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,flex:1,maxWidth:340}}>
          {([['general','progreso','General'],['evolucion','sube','Evolución']] as const).map(([k,ic,l])=>(
            <button key={k} onClick={()=>setVista(k)} style={{flex:1,fontSize:11,padding:'7px 8px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'system-ui',background:vista===k?'var(--w)':'transparent',color:vista===k?'var(--n)':'var(--grl)',fontWeight:vista===k?500:400,boxShadow:vista===k?'0 1px 3px rgba(0,0,0,.08)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><Ic name={ic} size={13}/> {l}</button>
          ))}
        </div>
      </div>

      {vista==='general'&&(
        <div style={{display:'flex',flexDirection:'column',gap:22}}>

          <div style={{display:'grid',gridTemplateColumns:'150px 1fr 260px',gap:18,alignItems:'start'}}>
            {/* El donut y el pendiente son UNA celda del grid. Sueltos, el
                pendiente se colaba como celda propia y descolocaba el resto. */}
            <div>
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
              {/* Ni real ni previsto: es lo que falta por entrar. El impago va
                  dentro, no al lado, porque ya está contado aquí. */}
              {pendiente > 0 && (
                <div style={{textAlign:'center',marginTop:-8}}>
                  <div style={{fontSize:22,fontWeight:200,color:AMB}}>{eur(pendiente)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Pendiente de cobro</div>
                  {impago > 0 && (
                    <div style={{fontSize:9,color:RED,marginTop:2}}>
                      de los que {eur(impago)} impago ({Math.round((impago/pendiente)*100)}%)
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* DOS BLOQUES, NO SEIS CIFRAS SUELTAS.
                Antes había cuatro números arriba y tres cajas blancas debajo,
                y entre ellas se repetían: "Beneficio real" y "Beneficio de
                caja" eran el mismo dato con dos nombres. Puestos en fila sin
                decir cuál es real y cuál es una previsión, no había forma de
                saber qué estabas mirando.

                Arriba lo que ya ha pasado. Abajo lo que se espera del mes. */}
            <div>
              <div style={{fontSize:9,fontWeight:600,color:'var(--gd)',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Real · lo que ya ha pasado</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:G}}>{eur(ingresosCobrados)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Cobrado</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:GREY}}>{eur(gastosConfirmadosMes)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Gastos confirmados</div>
                  {gastosConfirmadosMes > 0 && (
                    <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{eur(gastosConfFijos)} fijos · {eur(gastosConfVar)} variables</div>
                  )}
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:beneficioReal>=0?GD:RED}}>{eur(beneficioReal)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Beneficio real</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>sin IVA ni IRPF</div>
                </div>
              </div>

              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.5,marginBottom:8}}>Previsto · si se cumple el mes</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:G}}>{eur(ingresosPrevistos)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Ingresos</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
                    {nCuotas} cuota{nCuotas!==1?'s':''}
                    {nVentas > 0 && <> · {nVentas} venta{nVentas!==1?'s':''}</>}
                  </div>
                  {totalDescuentos > 0 && <div style={{fontSize:9,color:'#8A6410',marginTop:2}}>−{totalDescuentos.toFixed(0)}€ en descuentos</div>}
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:GREY}}>{eur(gastosMes)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Gastos</div>
                  {gastosMes > 0 && (
                    <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{eur(gastosFijosMes)} fijos · {eur(gastosVarMes)} variables</div>
                  )}
                  {gastosEstimadosMes > 0 && (
                    <div style={{fontSize:9,color:'#7A5800',marginTop:2}}>de los que {eur(gastosEstimadosMes)} sin confirmar</div>
                  )}
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:22,fontWeight:200,color:beneficioPrevisto>=0?G:RED}}>{eur(beneficioPrevisto)}</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Beneficio previsto</div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>si se cobra todo</div>
                </div>
              </div>

            </div>

            {/* PARA HACIENDA. Ni ingreso ni gasto: dinero que custodias.

                El acumulado era una lista de siglas con dos cifras separadas
                por una barra. Ahora es una tabla: cada modelo en su fila, el
                mes en una columna y el trimestre en otra, que es la pregunta
                real —cuánto aparto este mes y cuánto llevo para la liquidación. */}
            <div style={{background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:8,padding:'11px 13px'}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.5,marginBottom:2}}>Para Hacienda</div>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:9}}>Está en tu cuenta, pero no es tuyo.</div>

              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:1}}>
                <span style={{color:'var(--grl)'}}>IVA cobrado este mes</span>
                <span style={{color:'var(--n)'}}>{eur(impMesReal.ivaRepercutido)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:2}}>
                <span style={{color:'var(--grl)'}}>IVA pagado en gastos</span>
                <span style={{color:'var(--n)'}}>−{eur(impMesReal.ivaSoportado)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,fontWeight:600,color:'var(--n)',paddingTop:3,borderTop:'1px solid var(--bd)'}}>
                <span>Le debes a Hacienda</span><span>{eur(impMesReal.modelo303)}</span>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:'0 10px',marginTop:12,alignItems:'baseline'}}>
                <span style={{fontSize:8,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>Modelo</span>
                <span style={{fontSize:8,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,textAlign:'right'}}>Mes</span>
                <span style={{fontSize:8,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,textAlign:'right'}}>{rTri.t}T</span>
                {([['303', impMesReal.modelo303, impTriReal.modelo303],
                   ['130', impMesReal.modelo130, impTriReal.modelo130],
                   ['111', impMesReal.modelo111, impTriReal.modelo111],
                   ['115', impMesReal.modelo115, impTriReal.modelo115]] as const)
                  .filter(([,m,t])=>m!==0||t!==0)
                  .map(([l,m,t])=>(
                    <React.Fragment key={l}>
                      <span style={{fontSize:10,color:'var(--gr)',paddingTop:3}}>{l}</span>
                      <span style={{fontSize:10,color:'var(--grl)',textAlign:'right',paddingTop:3}}>{eur(m)}</span>
                      <span style={{fontSize:10,color:'var(--n)',textAlign:'right',paddingTop:3}}>{eur(t)}</span>
                    </React.Fragment>
                ))}
                <span style={{fontSize:11,fontWeight:700,color:RED,paddingTop:5,borderTop:'1px solid var(--bd)',marginTop:3}}>A apartar</span>
                <span style={{fontSize:11,fontWeight:700,color:RED,textAlign:'right',paddingTop:5,borderTop:'1px solid var(--bd)',marginTop:3}}>{eur(impMesReal.total)}</span>
                <span style={{fontSize:11,fontWeight:700,color:RED,textAlign:'right',paddingTop:5,borderTop:'1px solid var(--bd)',marginTop:3}}>{eur(impTriReal.total)}</span>
              </div>

              <div style={{fontSize:8,color:'var(--grl)',marginTop:8,lineHeight:1.5}}>
                Se liquida al cerrar el trimestre. Estimación orientativa.
              </div>
            </div>
          </div>


          <div className="card" style={{margin:0}}>
            <div className="card-title">Desglose por tipo de bono</div>
            {dataTipo.length===0 ? (
              <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Sin bonos activos</div>
            ) : dataTipo.map((d)=>(
              /* Antes esto estaba dos veces: una como barras y otra como lista,
                 con el mismo dataTipo. La barra va dentro de la fila y así se
                 ve la proporción sin repetir la información. */
              <div key={d.tipo} style={{marginBottom:9}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:3}}>
                  <span style={{fontSize:11,fontWeight:500,color:'var(--n)',flex:1}}>{d.tipo}</span>
                  <span style={{fontSize:9,color:'var(--grl)'}}>{d.pacientes} {d.pacientes===1?'paciente':'pacientes'}</span>
                  <span style={{fontSize:12,fontWeight:600,color:G}}>{eur(d.total)}</span>
                </div>
                <div style={{height:6,borderRadius:99,background:'var(--bm)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(d.total/dataTipo[0].total)*100}%`,background:G,borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>

          {/* QUÉ ESTÁS MIRANDO. La misma idea que en Evolución: dos bloques de
              cifras de dinero no se distinguen solos. */}
          <div style={{background:'var(--bl)',borderRadius:8,padding:'11px 14px',fontSize:9,color:'var(--grl)',lineHeight:1.7}}>
            <div style={{fontWeight:600,color:'var(--gr)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Cómo leer estos números</div>
            <div><strong style={{color:'var(--n)'}}>Real</strong> es lo que ya ha pasado: facturas emitidas y gastos con su factura encima de la mesa.</div>
            <div><strong style={{color:'var(--n)'}}>Previsto</strong> es el mes entero si se cumple: incluye las cuotas aún sin facturar y los gastos que todavía son una estimación.</div>
            <div style={{marginTop:5}}>El <strong style={{color:'var(--n)'}}>beneficio</strong> se mide sobre bases, sin IVA, y con el modelo 130 ya descontado: es lo que de verdad te queda. Las cifras de cobrado y gastos sí llevan IVA, porque son el dinero que se mueve.</div>
            <div style={{marginTop:5}}>El <strong style={{color:'var(--n)'}}>pendiente de cobro</strong> es lo previsto menos lo ya facturado. Lo marcado como impago va dentro, no aparte.</div>
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
                <div style={{fontSize:11,fontWeight:500,color:'var(--n)',marginBottom:10}}>Previsto · Cobrado · Gastos</div>
                {/* Antes eran dos gráficas: un área con el cobrado y debajo una
                    de líneas que ya llevaba esa misma serie dentro. Una sola,
                    con el relleno del área para las tres. */}
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dataEvol} margin={{top:5,right:10,left:-10,bottom:0}}>
                    <defs>
                      <linearGradient id="gCob" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={G} stopOpacity={0.35}/>
                        <stop offset="95%" stopColor={G} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gGas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={RED} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={RED} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    <XAxis dataKey="mes" tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:GREY}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #eee'}} formatter={(v:any)=>`${v}€`}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Area type="monotone" dataKey="Cobrado" stroke={G} strokeWidth={2.5} fill="url(#gCob)"/>
                    <Area type="monotone" dataKey="Gastos" stroke={RED} strokeWidth={2} fill="url(#gGas)"/>
                    <Area type="monotone" dataKey="Previsto" stroke={GREY} strokeWidth={1.5} strokeDasharray="4 3" fill="none"/>
                  </AreaChart>
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

              {/* QUÉ ESTÁS MIRANDO. Sin esto, tres gráficas de dinero parecen
                  decir lo mismo y no hay forma de saber por qué no cuadran
                  entre sí. */}
              <div style={{background:'var(--bl)',borderRadius:8,padding:'11px 14px',fontSize:9,color:'var(--grl)',lineHeight:1.7}}>
                <div style={{fontWeight:600,color:'var(--gr)',marginBottom:5,textTransform:'uppercase',letterSpacing:.4}}>Qué entra en estas gráficas</div>
                <div><strong style={{color:'var(--n)'}}>Previsto</strong>: las cuotas y ventas de cada mes más lo cobrado fuera de cuota. Con IVA.</div>
                <div><strong style={{color:'var(--n)'}}>Cobrado</strong>: las facturas emitidas ese mes más los otros ingresos. Con IVA. Las rectificativas restan.</div>
                <div><strong style={{color:'var(--n)'}}>Gastos</strong>: todo lo del mes, incluidas las previsiones sin confirmar. Con IVA.</div>
                <div style={{marginTop:5}}><strong style={{color:'var(--n)'}}>Beneficio</strong>: lo que de verdad queda. Se mide sobre bases —el IVA no es tuyo, lo ingresas en el 303— y se le descuenta el modelo 130. No se le restan el 111 ni el 115 porque ya están dentro de las nóminas y del alquiler.</div>
                <div style={{marginTop:6,color:'#7A5800'}}>
                  Los modelos se liquidan cada trimestre, pero el dinero se gana cada mes: en el Resumen tienes lo que llevas acumulado para ir apartándolo y que la liquidación no sea un susto.
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
