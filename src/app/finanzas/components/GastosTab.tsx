'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import LineaGastos from './LineaGastos'
import ModalBajaSerie from './ModalBajaSerie'
import ModalConfirmarGasto from './ModalConfirmarGasto'
import ModalGasto from './ModalGasto'
import { hoyISO, mesISO } from '@/lib/fechas'
import { CADENCIAS, fechasDeSerie, mediaDeConcepto, crearSerie, confirmarGasto,
         estimadosVencidos, MODOS_ESTIMACION, modoPorDefecto,
         ultimoImporteDe, contarPendientes, actualizarEstimadosPendientes,
         darDeBajaSerie, CATEGORIAS_GASTO, ayudaDeCategoria } from '@/lib/gastos'

/**
 * El trimestre de una fecha, SOLO si ya pasó. null si es del trimestre en curso.
 *
 * Sirve para avisar al corregir: mientras el trimestre está abierto, cambiar un
 * gasto no tiene consecuencias. En cuanto se ha presentado, sí las tiene.
 */
function trimestrePasado(fecha?: string | null): string | null {
  if (!fecha) return null
  const [a, m] = fecha.split('-').map(Number)
  if (!a || !m) return null
  const t = Math.floor((m - 1) / 3) + 1
  const hoy = new Date()
  const tHoy = Math.floor(hoy.getMonth() / 3) + 1
  const pasado = a < hoy.getFullYear() || (a === hoy.getFullYear() && t < tHoy)
  return pasado ? `${t}T ${a}` : null
}

export default function GastosTab({ gastos, ingresos=[], facturas=[], recargar, mesRef }: any) {
  /** Lista de gastos o línea de tiempo. La lista dice cuánto; la línea, cuándo. */
  const [subtab, setSubtab] = useState<'lista'|'linea'>('lista')
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)
  /**
   * La media de este concepto en gastos REALES anteriores. Es lo que se usa para
   * los meses que aún no han llegado: la luz cambia cada mes y repetir doce
   * veces la de septiembre no se parecería a nada.
   *
   * null mientras no se sepa o cuando no hay histórico; entonces se repite el
   * importe que se esté tecleando, que es lo único honesto que se puede hacer.
   */
  /** El último importe real del concepto. Es lo que usa el modo "siempre igual". */

  /**
   * CONFIRMAR UNA PREVISIÓN.
   *
   * Sí hace falta preguntar el importe: una previsión es un cálculo, y lo que
   * decide el IVA que te deduces es el papel, no el cálculo. Si se confirmara
   * sin mirar, estarías declarando el número que se inventó la app.
   *
   * Lo que no hacía falta era el cuadro negro del navegador. Y encima venían
   * encadenados: primero el importe, luego otro preguntando por las previsiones
   * que quedan. Ahora es una sola pantalla que enseña las dos cosas a la vez.
   */
  const [conf, setConf] = useState<any|null>(null)
  /** Igual que al crear: qué número estás copiando del papel. */
  /** La parte sin IVA de ESTA factura. Puede cambiar entre un recibo y otro. */
  /** Nóminas: la SS de empresa y la retención de ESTE mes. */
  /** Préstamos: el capital amortizado de ESTE recibo. Cambia cada mes. */

  /** El gasto cuya serie se está dando de baja, y desde cuándo. */
  const [baja, setBaja] = useState<any|null>(null)

  /**
   * EL GASTO QUE SE ESTÁ EDITANDO. null = se está creando uno nuevo.
   *
   * Un gasto no es una factura tuya. Las que emites son inmutables por ley y por
   * eso se corrigen con una rectificativa; esto es tu apunte de la factura de
   * OTRO, así que si te equivocaste tecleando, lo que toca es arreglarlo.
   *
   * Se reaprovecha el mismo formulario: los mismos campos, la misma cuenta y el
   * mismo desglose. Un segundo formulario "de editar" acabaría calculando la
   * base de otra manera que el de crear, y ahí es donde salen los descuadres.
   */
  const [editando, setEditando] = useState<any|null>(null)

  /**
   * EL DESGLOSE, A PARTIR DEL NÚMERO QUE TENGAS A MANO.
   *
   * Antes solo se podía meter el total y la base salía de dividir entre 1+IVA.
   * Eso vale cuando el total es base + IVA, y deja de valer en cuanto hay
   * RETENCIÓN: en una factura de alquiler el total ya lleva el IRPF restado.
   *
   *   Alquiler:  655,00 base + 137,55 IVA − 124,45 IRPF = 668,10 total
   *   La app:    668,10 / 1,21 = 552,15 de base  ← 102,85 € de menos
   *
   * Y no era un número feo en pantalla: con esa base te deducías 21,60 € menos
   * de IVA soportado cada mes y declarabas 19,54 € menos de retención en el 115.
   *
   * La solución no es adivinar cuál de los dos casos es. Es preguntar qué número
   * estás copiando de la factura, que es algo que quien la tiene delante sabe
   * sin dudar. Con retención, lo natural es teclear la BASE.
   */
  function abrirNuevo() { setEditando(null); setModal(true) }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: errDel } = await supabase.from('gastos').delete().eq('id', id)
    if (errDel) { setError(`No se ha podido eliminar el gasto: ${errDel.message}`); return }
    recargar()
  }

  const mesActual = mesRef || mesISO()
  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState<string>(mesActual)
  const delMes = mesFiltro ? gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesFiltro) : gastos
  const totalMes = delMes.reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  /**
   * Cuánto del total del mes es todavía una previsión.
   *
   * El total las incluye, para ver lo que va a costar el mes. Pero decir 1.200 €
   * sin más, cuando 340 son un cálculo, es dar por cerrado algo que no lo está.
   */
  const estimadoMes = delMes.filter((g:any)=>g.estimado).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const sinConfirmar = estimadosVencidos(gastos, hoyISO())
  /**
   * LOS FIJOS DE ESTE MES, NO LOS DE TODO EL AÑO.
   *
   * Antes sumaba los gastos fijos de TODO el histórico y lo llamaba "Total
   * gastos fijos". Con nueve meses cargados decía nueve veces lo que pagas cada
   * mes, justo al lado de la media mensual correcta: dos cifras del mismo
   * concepto y una de ellas sin ningún significado.
   */
  const totalFijos = delMes.filter((g:any)=>g.tipo==='fijo').reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  const totalVariables = totalMes - totalFijos

  // Fijos POR MES. El mismo dato se enseñaba abajo como "Fijos esperados/mes"
  // siendo el acumulado de todo el histórico, así que con medio año cargado
  // decía seis veces lo que toca pagar cada mes.
  const fijosPorMes: Record<string, number> = {}
  gastos.filter((g:any)=>g.tipo==='fijo'&&g.fecha).forEach((g:any)=>{
    const m = g.fecha.slice(0,7); fijosPorMes[m] = (fijosPorMes[m]||0) + Number(g.importe)
  })
  // El mes en curso va a medias por definición: incluirlo baja la media y hace
  // creer que los fijos son más bajos de lo que son.
  const mesesFijosCerrados = Object.keys(fijosPorMes).filter(m => m < mesActual)
  const clavesFijos = mesesFijosCerrados.length ? mesesFijosCerrados : Object.keys(fijosPorMes)
  const nMesesFijos = clavesFijos.length
  const fijosMedios = nMesesFijos ? clavesFijos.reduce((a,m)=>a+fijosPorMes[m],0)/nMesesFijos : 0

  // Media mensual de los últimos 3 meses (excluyendo el mes actual incompleto)
  const hoy = mesRef ? new Date(`${mesRef}-01T12:00:00`) : new Date()
  const mesesRef: string[] = []
  for (let i=1; i<=3; i++) { const d=new Date(hoy.getFullYear(), hoy.getMonth()-i, 1); mesesRef.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  /**
   * MEDIAS POR TRIMESTRE Y DEL AÑO.
   *
   * "Últimos tres meses" era una ventana móvil que no coincide con nada: ni con
   * los trimestres que declaras ni con el año. Y bastaba un mes con una compra
   * grande para que la media dijera que gastas 5.500 € al mes cuando lo normal
   * son 3.800.
   *
   * Solo cuentan meses CERRADOS: el mes en curso va a medias y el futuro es
   * todo previsión.
   */
  const anioRef = mesActual.slice(0,4)
  const mediaDe = (meses: string[]) => {
    const conDatos = meses.filter(m => m < mesActual && gastos.some((g:any)=>g.fecha?.slice(0,7)===m))
    if (!conDatos.length) return { media: 0, fijos: 0, variables: 0, n: 0 }
    const delRango = gastos.filter((g:any)=>conDatos.includes(g.fecha?.slice(0,7)))
    const total = delRango.reduce((a:number,g:any)=>a+Number(g.importe),0)
    const fijos = delRango.filter((g:any)=>g.tipo==='fijo').reduce((a:number,g:any)=>a+Number(g.importe),0)
    return {
      media: total/conDatos.length,
      fijos: fijos/conDatos.length,
      variables: (total-fijos)/conDatos.length,
      n: conDatos.length,
    }
  }
  const mesesDeTrim = (t: number) => [0,1,2].map(i => `${anioRef}-${String((t-1)*3+1+i).padStart(2,'0')}`)
  const trimActual = Math.ceil(Number(mesActual.slice(5,7))/3)
  const mTrimActual = mediaDe(mesesDeTrim(trimActual))
  const mTrimAnterior = trimActual > 1 ? mediaDe(mesesDeTrim(trimActual-1)) : { media: 0, n: 0 }
  const mAnio = mediaDe(Array.from({length:12},(_,i)=>`${anioRef}-${String(i+1).padStart(2,'0')}`))
  const mediaMensual = mAnio.media

  // ---------------------------------------------------------------------------
  // BUSCAR EN LA LISTA
  //
  // Filtra LO QUE SE PINTA, no lo que se cuenta. Los totales de arriba, la media
  // y el desglose por categoría siguen mirando todos los gastos: si buscar
  // "alquiler" cambiara el total del mes, la pantalla estaría diciendo que ese
  // mes gastaste 655 €.
  //
  // Lo único que se recalcula es el resumen de la propia búsqueda, que va justo
  // encima de los resultados y dice de qué está hablando.
  // ---------------------------------------------------------------------------
  /** Cómo se ordena lo que se ve. No toca los totales, solo la lista. */
  const [orden, setOrden] = useState('fecha-desc')

  /** Los meses que existen de verdad en los datos, del más nuevo al más viejo. */
  const mesesConGastos = Array.from(new Set(
    gastos.map((g:any)=>g.fecha?.slice(0,7)).filter(Boolean) as string[]
  )).sort().reverse()

  /** Largo para los títulos, corto para los desplegables: "septiembre de
   *  2026" no cabe en un select y se cortaba a media palabra. */
  const nombreMes = (m: string) =>
    new Date(m + '-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})
  const mesCorto = (m: string) =>
    new Date(m + '-01T12:00:00').toLocaleDateString('es-ES',{month:'short',year:'numeric'}).replace('.','')

  const q = busca.trim().toLowerCase()
  const filtrados = gastos.filter((g:any) => {
    if (mesFiltro && g.fecha?.slice(0,7) !== mesFiltro) return false
    if (!q) return true
    // Concepto, categoría y notas: los tres sitios donde uno escribe de qué era.
    return [g.concepto, g.categoria, g.notas].some((c:any)=>String(c||'').toLowerCase().includes(q))
  })
  const ordenados = [...filtrados].sort((a:any,b:any)=>{
    if (orden === 'fecha-asc')  return String(a.fecha).localeCompare(String(b.fecha))
    if (orden === 'concepto')   return String(a.concepto||'').localeCompare(String(b.concepto||''), 'es')
    if (orden === 'importe')    return Number(b.importe) - Number(a.importe)
    return String(b.fecha).localeCompare(String(a.fecha)) // fecha-desc, por defecto
  })

  const hayFiltro = !!q || mesFiltro !== mesActual
  const totalFiltrado = filtrados.reduce((a:number,g:any)=>a+Number(g.importe),0)
  const estimadoFiltrado = filtrados.filter((g:any)=>g.estimado).reduce((a:number,g:any)=>a+Number(g.importe),0)

  // Desglose por categoría (todos los gastos)
  const porCat: Record<string, number> = {}
  // De lo que se está mirando, no del histórico entero: filtrabas por
  // septiembre y las barras seguían enseñando el año completo.
  const baseCategorias = q ? filtrados : delMes
  baseCategorias.forEach((g:any)=>{ const c=g.categoria||'Sin categoría'; porCat[c]=(porCat[c]||0)+Number(g.importe) })
  const catList = Object.entries(porCat).map(([cat,total]:any)=>({cat,total})).sort((a,b)=>b.total-a.total)
  const maxCat = catList.length ? catList[0].total : 1

  return (
    // La línea de tiempo va sobre el fondo, sin caja: es un trazo, no una
    // ficha, y metida en una card competía con el propio dibujo.
    <div className={subtab==='linea' ? undefined : 'card'}>
      <div style={{display:'flex',gap:4,background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:'var(--rl)',padding:3,marginBottom:12,width:'fit-content'}}>
        {([['lista','Lista'],['linea','Cuándo se paga']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setSubtab(k)}
            style={{fontSize:10,padding:'6px 14px',borderRadius:6,border:'none',cursor:'pointer',fontFamily:'inherit',
                    background:subtab===k?'var(--w)':'transparent',color:subtab===k?'var(--n)':'var(--grl)',
                    fontWeight:subtab===k?500:300,boxShadow:subtab===k?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{l}</button>
        ))}
      </div>

      {subtab==='linea' ? (
        <LineaGastos gastos={gastos} ingresos={ingresos} facturas={facturas} mesRef={mesRef}/>
      ) : (<>

      <div className="card-title" style={{marginBottom:10}}><span className="ct-l"><Ic name="recibo"/> Gastos</span></div>

      {error && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
        </div>
      )}

      {/* Ya pasó la fecha y siguen sin factura. O llegó y nadie la metió, o
          hay que quitar la previsión: en cualquier caso, no puede quedarse
          contando como gasto para siempre sin que nadie lo mire. */}
      {/* ESTE MES arriba, MEDIAS abajo y dicho de dónde salen.
          Antes estaban mezcladas cuatro cifras sin decir cuál era de septiembre
          y cuál un promedio de ocho meses, así que no había forma de saber por
          qué la media mensual (5.527 €) era más alta que el gasto del mes. */}
      {/* TRES COLUMNAS: el mes, la media de lo ya cerrado y los trimestres.
          Las mismas tres cifras en cada una —total, fijos y variables— para
          poder leerlas en horizontal: lo de este mes contra lo normal. */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:22,marginBottom:18}}>

        <div>
          <div style={{fontSize:9,fontWeight:600,color:'var(--gd)',textTransform:'uppercase',letterSpacing:.5,marginBottom:9}}>
            {mesFiltro ? nombreMes(mesFiltro) : 'Todos los meses'}
          </div>
          {([['Total', totalMes, 'var(--red)'],
             ['Fijos', totalFijos, '#7A5800'],
             ['Variables o puntuales', totalVariables, 'var(--gr)']] as const).map(([l,v,c])=>(
            <div key={l} style={{marginBottom:9}}>
              <div style={{fontSize:19,fontWeight:200,color:c,lineHeight:1.1}}>{v.toFixed(0)}€</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
            </div>
          ))}
          {estimadoMes > 0 && (
            <div style={{fontSize:9,color:'#7A5800',marginTop:2}}>de los que {estimadoMes.toFixed(0)}€ sin confirmar</div>
          )}
        </div>

        <div>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.5,marginBottom:9}}>
            Media de meses anteriores
          </div>
          {([['Total', mAnio.media],
             ['Fijos', mAnio.fijos],
             ['Variables o puntuales', mAnio.variables]] as const).map(([l,v])=>(
            <div key={l} style={{marginBottom:9}}>
              <div style={{fontSize:19,fontWeight:200,color:'var(--n)',lineHeight:1.1}}>{mAnio.n?`${v.toFixed(0)}€`:'—'}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
            </div>
          ))}
          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
            {mAnio.n ? `${mAnio.n} ${mAnio.n===1?'mes cerrado':'meses cerrados'} de ${anioRef}` : 'sin meses cerrados'}
          </div>
        </div>

        <div>
          <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.5,marginBottom:9}}>
            Media por trimestre
          </div>
          {([[`${trimActual}º trimestre`, mTrimActual],
             [trimActual>1?`${trimActual-1}º trimestre`:'Anterior', mTrimAnterior]] as const).map(([l,d])=>(
            <div key={l} style={{marginBottom:9}}>
              <div style={{fontSize:19,fontWeight:200,color:'var(--n)',lineHeight:1.1}}>{d.n?`${d.media.toFixed(0)}€`:'—'}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>{l}</div>
            </div>
          ))}
          <div style={{marginBottom:9}}>
            <div style={{fontSize:19,fontWeight:200,color:'#7A5800',lineHeight:1.1}}>{fijosMedios.toFixed(0)}€</div>
            <div style={{fontSize:9,color:'var(--grl)',marginTop:1}}>Fijos al mes</div>
          </div>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
            Solo meses ya cerrados: el actual va a medias.
          </div>
        </div>
      </div>

      <div>
        {catList.length>0 && (
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:8}}>
              Por categoría
              <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--grl)'}}>
                {' · '}{q ? 'de la búsqueda' : mesFiltro ? nombreMes(mesFiltro) : 'todo el histórico'}
              </span>
            </div>
            {catList.map(({cat,total})=>(
              <div key={cat} style={{marginBottom:7}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:2}}>
                  <span style={{color:'var(--n)'}}>{cat}</span>
                  <span style={{fontWeight:600,color:'var(--gd)'}}>{total.toFixed(2)}€</span>
                </div>
                <div style={{height:6,borderRadius:99,background:'var(--bm)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(total/maxCat)*100}%`,background:'#5A969E',borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BUSCADOR. Con doce meses de recurrentes cargados la lista pasa de
          treinta líneas a más de cien, y encontrar "el recibo del agua de mayo"
          a base de rueda del ratón deja de ser viable. */}
      {gastos.length > 0 && (
        <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
          <input className="input" value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar por concepto, categoría o notas…"
            style={{flex:'1 1 180px',minWidth:0}}/>
          <select className="input" value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)}
            style={{flex:'0 1 160px'}}>
            <option value="">Todos los meses</option>
            {mesesConGastos.map(m=><option key={m} value={m}>{mesCorto(m)}</option>)}
          </select>
          <select className="input" value={orden} onChange={e=>setOrden(e.target.value)}
            style={{flex:'0 1 150px'}}>
            <option value="fecha-desc">Recientes antes</option>
            <option value="fecha-asc">Antiguos antes</option>
            <option value="concepto">Concepto A-Z</option>
            <option value="importe">Mayor importe</option>
          </select>
          {hayFiltro && (
            <button className="btn btn-d btn-sm" onClick={()=>{setBusca('');setMesFiltro(mesActual)}}>Quitar</button>
          )}
          {/* Junto al buscador: es donde está la lista, y donde uno se da
              cuenta de que falta un gasto por meter. */}
          <button className="btn btn-p btn-sm" style={{marginLeft:'auto'}} onClick={abrirNuevo}>+ Nuevo gasto</button>
        </div>
      )}

      {sinConfirmar.length > 0 && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,
                     padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>{sinConfirmar.length}</strong> {sinConfirmar.length===1?'gasto estimado ya pasó su fecha':'gastos estimados ya pasaron su fecha'}
          {' '}y {sinConfirmar.length===1?'sigue':'siguen'} sin confirmar. Hasta que pongas el importe de la
          factura no cuentan para el IVA ni para las retenciones.
        </div>
      )}


      {/* De qué está hablando lo de abajo. Los totales de arriba NO cambian:
          son los del mes entero, y que una búsqueda los moviera sería mentir. */}
      {hayFiltro && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,
                     background:'var(--bl)',borderRadius:6,padding:'7px 11px',marginBottom:8,fontSize:10}}>
          <span style={{color:'var(--grl)'}}>
            {filtrados.length===0 ? 'Ningún gasto'
              : `${filtrados.length} ${filtrados.length===1?'gasto':'gastos'}`}
            {mesFiltro && ` · ${nombreMes(mesFiltro)}`}
            {q && ` · "${busca.trim()}"`}
          </span>
          {filtrados.length>0 && (
            <span style={{fontWeight:600,color:'var(--n)',whiteSpace:'nowrap'}}>
              {totalFiltrado.toFixed(2)} €
              {estimadoFiltrado>0 && <span style={{fontWeight:400,color:'var(--grl)'}}> · {estimadoFiltrado.toFixed(0)} € estimados</span>}
            </span>
          )}
        </div>
      )}

      {gastos.length===0 ? (
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin gastos registrados</div>
      ) : filtrados.length===0 ? (
        <div style={{textAlign:'center',padding:24,color:'var(--grl)',fontSize:11,lineHeight:1.6}}>
          No hay ningún gasto que encaje.<br/>
          <span style={{fontSize:10}}>Hay {gastos.length} en total: prueba a quitar el filtro.</span>
        </div>
      ) : (
        ordenados.map((g:any) => (
          <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,opacity:g.estimado?.72:1,border:g.estimado?'1px dashed var(--bd)':'1px solid var(--bd)',marginBottom:5,background:'var(--bl)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:g.tipo==='fijo'?'var(--amb)':'var(--grl)',flexShrink:0}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:500,color:'var(--n)',display:'flex',alignItems:'center',gap:6}}>
                {g.concepto}
                {/* Una estimación tiene que verse a simple vista. Si parece una
                    factura más, se acaba dando por buena y se declara. */}
                {g.estimado && (
                  <span style={{fontSize:8,fontWeight:600,padding:'1px 6px',borderRadius:99,
                                background:'var(--bl)',border:'1px dashed var(--bd)',color:'var(--grl)'}}>
                    estimado
                  </span>
                )}
              </div>
              <div style={{fontSize:9,color:'var(--grl)'}}>
                {new Date(g.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
                {g.categoria && ' · '+g.categoria}
                {' · '+(g.tipo==='fijo'?'Fijo':'Variable')}
                {g.tiene_factura && ' · con factura'}
              </div>
              {(g.iva_pct>0 || g.irpf_pct>0) && (
                <div style={{fontSize:8,color:'var(--grl)',marginTop:1}}>
                  Base {Number(g.base_imponible||0).toFixed(2)}€
                  {g.iva_pct>0 && ` · IVA ${g.iva_pct}% (${(Number(g.importe)-Number(g.base_imponible||0)).toFixed(2)}€)`}
                  {g.irpf_pct>0 && ` · IRPF ${g.irpf_pct}%`}
                </div>
              )}
            </div>
            <div style={{fontSize:13,fontWeight:600,color:g.estimado?'var(--grl)':'var(--red)',
                         fontStyle:g.estimado?'italic':'normal'}}>
              {Number(g.importe).toFixed(2)}€
            </div>
            {g.estimado && (
              <button className="btn btn-s btn-sm" onClick={()=>setConf(g)}
                title="Ha llegado la factura: poner el importe real">
                Confirmar
              </button>
            )}
            {/* Antes había DOS papeleras: una borraba esta fila y la otra todas
                las previsiones de la serie. Dos dibujos iguales que hacen cosas
                distintas es una trampa, y encima la segunda ya no hace falta:
                "Dar de baja" desde la primera fecha pendiente hace exactamente
                lo mismo, diciendo lo que hace. */}
            {g.estimado && g.serie_id && (
              <button className="btn btn-t btn-sm"
                onClick={()=>setBaja(g)}
                title="Ya no tienes este servicio: quitar las previsiones desde una fecha"
                style={{color:'var(--grl)'}}>
                Dar de baja
              </button>
            )}
            {/* Corregir una errata. Un gasto es tu apunte de la factura de otro,
                no una factura tuya: si te equivocaste al teclear, se arregla. */}
            <button onClick={()=>{setEditando(g);setModal(true)}} title="Corregir este gasto"
              style={{color:'var(--grl)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="editar" size={13}/></button>
            <button onClick={()=>eliminar(g.id)}
              title={g.estimado ? 'Borrar solo esta previsión' : 'Borrar este gasto'}
              style={{color:'var(--red)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="papelera" size={13}/></button>
          </div>
        ))
      )}

      {modal && (
        <ModalGasto editando={editando} onCerrar={()=>{setModal(false);setEditando(null)}} onHecho={recargar}/>
      )}

      {conf && (
        <ModalConfirmarGasto gasto={conf} onCerrar={()=>setConf(null)} onHecho={recargar} onError={setError}/>
      )}

      {baja && (
        <ModalBajaSerie gasto={baja} onCerrar={()=>setBaja(null)} onHecho={recargar} onError={setError}/>
      )}

      </>)}
    </div>
  )
}
