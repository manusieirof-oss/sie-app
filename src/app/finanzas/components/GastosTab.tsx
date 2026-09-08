'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
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

export default function GastosTab({ gastos, recargar, mesRef }: any) {
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
  const [media, setMedia] = useState<{ base: number, n: number }|null>(null)
  /** El último importe real del concepto. Es lo que usa el modo "siempre igual". */
  const [ultimo, setUltimo] = useState<number|null>(null)
  const [form, setForm] = useState({ concepto:'', importe:'', metodo:'total', repetir:false, cadencia:'mensual', modoEst:'media', iva_pct:'21', irpf_pct:'0', irpf_modelo:'111', tipo:'variable', categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' })

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
  const [confBase, setConfBase] = useState('')
  const [confPend, setConfPend] = useState(0)
  const [confPropagar, setConfPropagar] = useState(false)

  /** El gasto cuya serie se está dando de baja, y desde cuándo. */
  const [baja, setBaja] = useState<any|null>(null)
  const [bajaDesde, setBajaDesde] = useState('')

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
  const ivaPct = parseFloat(form.iva_pct) || 0
  const irpfPct = parseFloat(form.irpf_pct) || 0
  const importe = parseFloat(form.importe) || 0

  const base = form.metodo === 'base' ? importe
    : ivaPct > 0 ? importe / (1 + ivaPct/100)
    : importe
  const ivaImporte = base * (ivaPct/100)
  const irpfImporte = base * (irpfPct/100)
  /** Lo que sale de la cuenta: base + IVA − retención. Es lo que pagas de verdad. */
  const total = base + ivaImporte - irpfImporte

  /** Las fechas que se van a crear, para poder decirlo ANTES de crearlas. */
  const fechasSerie = form.repetir ? fechasDeSerie(form.fecha, form.cadencia) : [form.fecha]

  /**
   * La base que llevarán los meses que aún no han llegado.
   *
   * Manda la media de los reales anteriores. Si no hay histórico se repite lo
   * que estás tecleando: no hay nada mejor, y fingir una media a partir de un
   * solo dato sería inventar precisión.
   */
  const baseEstimada = form.modoEst === 'fijo'
    ? (ultimo ?? base)
    : (media?.base ?? base)

  /** Se busca la media al salir del campo, no en cada tecla. */
  async function buscarMedia() {
    if (!form.concepto.trim()) { setMedia(null); setUltimo(null); return }
    const [rm, ru] = await Promise.all([
      mediaDeConcepto(form.concepto),
      ultimoImporteDe(form.concepto),
    ])
    setMedia(rm.media != null ? { base: rm.media, n: rm.n } : null)
    setUltimo(ru.base)
  }

  /**
   * Abrir el formulario con un gasto ya guardado dentro.
   *
   * Se rellena con la BASE, no con el total: la base es lo que está guardado y
   * es exacta. Reconstruir el total para volver a dividirlo entre 1+IVA daría
   * céntimos de diferencia cada vez que abrieras la ficha sin tocar nada.
   */
  function abrirEditar(g: any) {
    setEditando(g)
    setError(null)
    /**
     * LOS GASTOS VIEJOS NO TIENEN BASE.
     *
     * `base_imponible` se empezó a guardar después, así que todo lo que se
     * cargó antes la tiene a null. Al abrirlos para editar el campo salía
     * VACÍO, y el formulario exige importe: dabas a guardar y no pasaba nada.
     *
     * Y como el aviso se pintaba detrás del modal, el botón parecía roto.
     *
     * Con base guardada se rellena esa, que es exacta. Sin ella se rellena el
     * total y se cambia la pregunta a "el total pagado", que es de donde viene
     * ese número. No se inventa una base dividiendo: con retención saldría mal.
     */
    const tieneBase = g.base_imponible != null && Number(g.base_imponible) > 0
    setForm({
      concepto: g.concepto || '',
      importe: String(tieneBase ? g.base_imponible : (g.importe ?? '')),
      metodo: tieneBase ? 'base' : 'total',
      repetir: false,
      cadencia: 'mensual',
      modoEst: 'media',
      iva_pct: String(g.iva_pct ?? 0),
      irpf_pct: String(g.irpf_pct ?? 0),
      irpf_modelo: g.irpf_modelo || '111',
      tipo: g.tipo || 'variable',
      categoria: g.categoria || '',
      fecha: g.fecha,
      tiene_factura: !!g.tiene_factura,
      notas: g.notas || '',
    })
    setMedia(null); setUltimo(null)
    setModal(true)
  }

  function abrirNuevo() {
    setEditando(null)
    setError(null)
    setForm(p => ({ ...p, concepto:'', importe:'', metodo:'total', repetir:false,
                    categoria:'', fecha:hoyISO(), tiene_factura:false, notas:'' }))
    setMedia(null); setUltimo(null)
    setModal(true)
  }

  async function crear() {
    if (!form.concepto) { setError('Falta el concepto.'); return }
    if (!form.importe) { setError('Falta el importe. Escribe el número que pone la factura.'); return }
    setGuardando(true)
    setError(null)

    const plantilla = {
      concepto: form.concepto,
      base: Math.round(base*100)/100,
      iva_pct: ivaPct,
      irpf_pct: irpfPct,
      irpf_modelo: form.irpf_modelo,
      tipo: form.tipo,
      categoria: form.categoria || null,
      notas: form.notas || null,
    }

    if (editando) {
      // Corregir un apunte. NO se toca `estimado`: si estaba confirmado sigue
      // confirmado, y si es una previsión sigue siéndolo. Confirmar es decir
      // "ha llegado el papel", y eso se hace en su sitio, no de refilón al
      // arreglar una errata.
      /**
       * EL `.select()` NO ES DECORACIÓN, ES EL AVISO.
       *
       * Sin él, un UPDATE que no toca ninguna fila devuelve exactamente lo mismo
       * que uno que fue bien: sin error y sin datos. Es lo que pasa cuando la
       * política RLS de la tabla no permite actualizar — la fila no se bloquea
       * con un mensaje, es que para el UPDATE deja de existir.
       *
       * Resultado: el modal se cerraba tan contento y el gasto seguía igual. Un
       * fallo que se presenta como un éxito es peor que un fallo.
       */
      const { data: filas, error: errUpd } = await supabase.from('gastos').update({
        ...plantilla,
        importe: total,
        base_imponible: plantilla.base,
        irpf_modelo: irpfPct > 0 ? form.irpf_modelo : null,
        fecha: form.fecha,
        tiene_factura: form.tiene_factura,
      }).eq('id', editando.id).select('id')
      setGuardando(false)
      if (errUpd) { setError(`No se ha podido guardar el cambio: ${errUpd.message}`); return }
      if (!filas || filas.length === 0) {
        setError('El cambio no se ha guardado: la base de datos no ha modificado ninguna fila. ' +
                 'Suele ser que a la tabla de gastos le falta el permiso de actualizar (RLS).')
        return
      }
    } else if (form.repetir) {
      // La serie entera. El primero es real —la factura que tienes delante— y
      // el resto quedan como estimados hasta que llegue cada papel.
      const r = await crearSerie({ plantilla, desde: form.fecha, cadencia: form.cadencia, baseEstimada })
      setGuardando(false)
      if (!r.ok) { setError(`No se ha podido crear la serie: ${r.error}`); return }
    } else {
      const { error: errIns } = await supabase.from('gastos').insert({
        ...plantilla,
        importe: total,
        base_imponible: plantilla.base,
        irpf_modelo: irpfPct > 0 ? form.irpf_modelo : null,
        fecha: form.fecha,
        estimado: false,
        tiene_factura: form.tiene_factura,
      })
      setGuardando(false)
      // Cerrar el modal sin mirar el error daba un gasto "guardado" que no existía.
      if (errIns) { setError(`No se ha podido guardar el gasto: ${errIns.message}`); return }
    }

    setForm(p => ({ ...p, concepto:'', importe:'', repetir:false, categoria:'', tiene_factura:false, notas:'' }))
    setMedia(null)
    setEditando(null)
    setModal(false)
    recargar()
  }

  /**
   * Abrir la confirmación. Se cuenta ANTES cuántas previsiones quedan, para
   * poder ofrecer lo de propagar el precio en la misma pantalla en vez de
   * soltarlo en un segundo cuadro cuando ya has guardado.
   */
  async function abrirConfirmar(g: any) {
    setConf(g)
    setConfBase(String(g.base_imponible ?? ''))
    setConfPropagar(false)
    setConfPend(0)
    if (g.serie_id) {
      const p = await contarPendientes(g.serie_id, g.fecha)
      if (p.ok) setConfPend(p.n)
    }
  }

  /** Llegó la factura: se pone el importe real y deja de ser una estimación. */
  async function guardarConfirmacion() {
    const g = conf
    if (!g) return
    const nueva = parseFloat(confBase.replace(',', '.'))
    if (isNaN(nueva) || nueva < 0) { setError('Ese importe no es válido'); return }
    setGuardando(true)
    const r = await confirmarGasto(g.id, nueva, Number(g.iva_pct||0), Number(g.irpf_pct||0))
    if (!r.ok) { setGuardando(false); setError(`No se ha podido confirmar: ${r.error}`); return }

    /**
     * SI EL PRECIO HA CAMBIADO, APLICARLO A LO QUE QUEDA.
     *
     * Es el caso de "en abril me suben la cuota": las previsiones de mayo a
     * diciembre siguen con el precio viejo, y corregirlas una a una son ocho
     * ediciones que nadie hace.
     *
     * Va marcado por ti, no automático: una factura más alta un mes puede ser
     * una subida permanente o una regularización puntual, y eso solo lo sabes tú.
     */
    if (confPropagar && g.serie_id) {
      const u = await actualizarEstimadosPendientes(
        g.serie_id, g.fecha, nueva, Number(g.iva_pct||0), Number(g.irpf_pct||0))
      if (!u.ok) setError(`El gasto se confirmó, pero no se han podido actualizar las previsiones: ${u.error}`)
    }
    setGuardando(false)
    setConf(null)
    recargar()
  }

  /**
   * Dar de baja el servicio: quita las previsiones a partir de una fecha.
   *
   * Dejaste la limpieza en junio y tienes previsiones hasta diciembre. Esas seis
   * no van a existir nunca, y mientras estén ahí inflan el gasto de cada mes y
   * ensucian la media del concepto para siempre.
   *
   * Lo ya confirmado no se toca: son facturas que pagaste y siguen siendo gasto
   * deducible aunque el servicio se haya acabado.
   */
  async function darDeBaja() {
    if (!baja || !bajaDesde) return
    setGuardando(true)
    const r = await darDeBajaSerie(baja.serie_id, bajaDesde)
    setGuardando(false)
    if (!r.ok) { setError(`No se ha podido dar de baja: ${r.error}`); return }
    setBaja(null)
    if (r.borrados === 0) setError('No había ninguna previsión a partir de esa fecha.')
    recargar()
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: errDel } = await supabase.from('gastos').delete().eq('id', id)
    if (errDel) { setError(`No se ha podido eliminar el gasto: ${errDel.message}`); return }
    recargar()
  }

  const mesActual = mesRef || mesISO()
  const delMes = gastos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual)
  const totalMes = delMes.reduce((acc:number,g:any)=>acc+Number(g.importe),0)
  /**
   * Cuánto del total del mes es todavía una previsión.
   *
   * El total las incluye, para ver lo que va a costar el mes. Pero decir 1.200 €
   * sin más, cuando 340 son un cálculo, es dar por cerrado algo que no lo está.
   */
  const estimadoMes = delMes.filter((g:any)=>g.estimado).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const sinConfirmar = estimadosVencidos(gastos, hoyISO())
  const totalFijos = gastos.filter((g:any)=>g.tipo==='fijo').reduce((acc:number,g:any)=>acc+Number(g.importe),0)

  // Fijos POR MES. El mismo dato se enseñaba abajo como "Fijos esperados/mes"
  // siendo el acumulado de todo el histórico, así que con medio año cargado
  // decía seis veces lo que toca pagar cada mes.
  const fijosPorMes: Record<string, number> = {}
  gastos.filter((g:any)=>g.tipo==='fijo'&&g.fecha).forEach((g:any)=>{
    const m = g.fecha.slice(0,7); fijosPorMes[m] = (fijosPorMes[m]||0) + Number(g.importe)
  })
  const nMesesFijos = Object.keys(fijosPorMes).length
  const fijosMedios = nMesesFijos ? Object.values(fijosPorMes).reduce((a,b)=>a+b,0)/nMesesFijos : 0

  // Media mensual de los últimos 3 meses (excluyendo el mes actual incompleto)
  const hoy = mesRef ? new Date(`${mesRef}-01T12:00:00`) : new Date()
  const mesesRef: string[] = []
  for (let i=1; i<=3; i++) { const d=new Date(hoy.getFullYear(), hoy.getMonth()-i, 1); mesesRef.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`) }
  const totalUlt3 = gastos.filter((g:any)=>mesesRef.includes(g.fecha?.slice(0,7))).reduce((a:number,g:any)=>a+Number(g.importe),0)
  const mediaMensual = totalUlt3/3

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
  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState('')

  /** Los meses que existen de verdad en los datos, del más nuevo al más viejo. */
  const mesesConGastos = Array.from(new Set(
    gastos.map((g:any)=>g.fecha?.slice(0,7)).filter(Boolean) as string[]
  )).sort().reverse()

  const nombreMes = (m: string) =>
    new Date(m + '-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})

  const q = busca.trim().toLowerCase()
  const filtrados = gastos.filter((g:any) => {
    if (mesFiltro && g.fecha?.slice(0,7) !== mesFiltro) return false
    if (!q) return true
    // Concepto, categoría y notas: los tres sitios donde uno escribe de qué era.
    return [g.concepto, g.categoria, g.notas].some((c:any)=>String(c||'').toLowerCase().includes(q))
  })
  const hayFiltro = !!q || !!mesFiltro
  const totalFiltrado = filtrados.reduce((a:number,g:any)=>a+Number(g.importe),0)
  const estimadoFiltrado = filtrados.filter((g:any)=>g.estimado).reduce((a:number,g:any)=>a+Number(g.importe),0)

  // Desglose por categoría (todos los gastos)
  const porCat: Record<string, number> = {}
  gastos.forEach((g:any)=>{ const c=g.categoria||'Sin categoría'; porCat[c]=(porCat[c]||0)+Number(g.importe) })
  const catList = Object.entries(porCat).map(([cat,total]:any)=>({cat,total})).sort((a,b)=>b.total-a.total)
  const maxCat = catList.length ? catList[0].total : 1

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div className="card-title" style={{margin:0}}><span className="ct-l"><Ic name="recibo"/> Gastos</span></div>
        <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo gasto</button>
      </div>

      {error && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
        </div>
      )}

      {/* Ya pasó la fecha y siguen sin factura. O llegó y nadie la metió, o
          hay que quitar la previsión: en cualquier caso, no puede quedarse
          contando como gasto para siempre sin que nadie lo mire. */}
      {sinConfirmar.length > 0 && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,
                     padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>{sinConfirmar.length}</strong> {sinConfirmar.length===1?'gasto estimado ya pasó su fecha':'gastos estimados ya pasaron su fecha'}
          {' '}y {sinConfirmar.length===1?'sigue':'siguen'} sin confirmar. Hasta que pongas el importe de la
          factura no cuentan para el IVA ni para las retenciones.
        </div>
      )}

      <div className="g2" style={{marginBottom:14}}>
        <div style={{background:'var(--redl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'var(--red)'}}>{totalMes.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>
            Gastos este mes
            {estimadoMes > 0 && <><br/>incluye {estimadoMes.toFixed(0)}€ estimados</>}
          </div>
        </div>
        <div style={{background:'var(--ambl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'#7A5800'}}>{totalFijos.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>Total gastos fijos</div>
        </div>
      </div>

      {/* ESTADÍSTICAS */}
      <div style={{background:'var(--bl)',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
        <div style={{display:'flex',gap:16,marginBottom:catList.length?12:0,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:18,fontWeight:300,color:'var(--n)'}}>{mediaMensual.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)'}}>Media mensual (últ. 3 meses)</div>
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:300,color:'#7A5800'}}>{fijosMedios.toFixed(0)}€</div>
            <div style={{fontSize:8,color:'var(--grl)'}}>Fijos esperados/mes{nMesesFijos>1?` (media de ${nMesesFijos})`:''}</div>
          </div>
        </div>
        {catList.length>0 && (
          <div>
            <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4,marginBottom:8}}>Por categoría</div>
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
            {mesesConGastos.map(m=><option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          {hayFiltro && (
            <button className="btn btn-d btn-sm" onClick={()=>{setBusca('');setMesFiltro('')}}>Quitar</button>
          )}
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
        filtrados.map((g:any) => (
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
              <button className="btn btn-s btn-sm" onClick={()=>abrirConfirmar(g)}
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
                onClick={()=>{ setBaja(g); setBajaDesde(g.fecha) }}
                title="Ya no tienes este servicio: quitar las previsiones desde una fecha"
                style={{color:'var(--grl)'}}>
                Dar de baja
              </button>
            )}
            {/* Corregir una errata. Un gasto es tu apunte de la factura de otro,
                no una factura tuya: si te equivocaste al teclear, se arregla. */}
            <button onClick={()=>abrirEditar(g)} title="Corregir este gasto"
              style={{color:'var(--grl)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="editar" size={13}/></button>
            <button onClick={()=>eliminar(g.id)}
              title={g.estimado ? 'Borrar solo esta previsión' : 'Borrar este gasto'}
              style={{color:'var(--red)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="papelera" size={13}/></button>
          </div>
        ))
      )}

      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(false);setEditando(null)}}}>
          <div className="modal">
            <div className="modal-title">
              {editando ? 'Corregir gasto' : 'Nuevo gasto'}
              <button className="modal-close" onClick={()=>{setModal(false);setEditando(null)}}>✕</button>
            </div>

            {/* SI EL TRIMESTRE YA ESTÁ PRESENTADO, ESTO NO LO CORRIGE.
                La app pasará a decir el número bueno, pero el 303 que entregaste
                sigue diciendo el viejo. Eso se arregla en Hacienda, no aquí, y
                más vale saberlo antes de dar a guardar que en la próxima
                declaración. */}
            {editando && trimestrePasado(editando.fecha) && (
              <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,
                           padding:'8px 11px',marginBottom:10,fontSize:9.5,color:'#7A5800',lineHeight:1.6}}>
                <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>
                Este gasto es del <strong>{trimestrePasado(editando.fecha)}</strong>. Si ya presentaste
                ese trimestre, cambiarlo aquí corrige lo que ve la app pero no lo que entregaste:
                eso se arregla con una complementaria o en la siguiente declaración. Coméntalo con la gestoría.
              </div>
            )}
            {/* El aviso de error vivía SOLO al principio de la página, o sea
                detrás del modal. Si guardar fallaba, el mensaje se pintaba donde
                no se veía y desde aquí parecía que no había pasado nada. */}
            {error && (
              <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,
                           padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)',lineHeight:1.55}}>
                <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
              </div>
            )}

            <div className="field"><label>Concepto *</label><input className="input" value={form.concepto} onChange={e=>setForm(p=>({...p,concepto:e.target.value}))} placeholder="ej. Alquiler local" autoFocus onBlur={buscarMedia}/></div>
            <div className="g2">
              <div className="field">
                <label>{form.metodo === 'base' ? 'Base imponible (€) *' : 'Total pagado (€) *'}</label>
                <input className="input" type="number" value={form.importe} onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/>
              </div>
              {/* SIGUE HACIENDO FALTA, PERO NO ES LO MISMO QUE LO DE ABAJO.
                  En esta pantalla la palabra "fijo" aparecía en tres sitios
                  distintos queriendo decir tres cosas:
                    · "Se repite durante el año" → cada cuánto llega la factura.
                    · "Siempre el mismo importe" → si el importe cambia o no.
                    · esto                       → si lo pagas venga gente o no.
                  Solo la tercera da sentido al dato de "gastos fijos al mes",
                  que es lo que te cuesta abrir la puerta y por tanto cuántas
                  cuotas necesitas para no perder dinero. Así que se queda, pero
                  preguntando lo que de verdad pregunta. */}
              <div className="field"><label>¿Lo pagas aunque no venga nadie?</label>
                <select className="input" value={form.tipo}
                  onChange={e=>setForm(p=>({...p, tipo:e.target.value, modoEst:modoPorDefecto(e.target.value)}))}>
                  <option value="variable">No · depende de la actividad</option>
                  <option value="fijo">Sí · lo pago igual</option>
                </select>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                  {form.tipo === 'fijo'
                    ? 'Alquiler, gestoría, seguro. Suma en «gastos fijos al mes», el suelo que tienes que cubrir cada mes.'
                    : 'Material, publicidad, un pedido puntual. Sube y baja con lo que trabajes.'}
                </div>
              </div>
            </div>
            {/* QUÉ NÚMERO ESTÁS COPIANDO. Con retención el total no es base+IVA
                —lleva el IRPF restado— así que no se puede deducir la base a
                partir de él. Se pregunta en vez de adivinar. */}
            <div className="field">
              <label>¿Qué importe vas a escribir?</label>
              <div style={{display:'flex',gap:6}}>
                {[['total','El total pagado'],['base','La base imponible']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(p=>({...p,metodo:v}))}
                    style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            border:`1.5px solid ${form.metodo===v?'var(--g)':'var(--bd)'}`,
                            background:form.metodo===v?'var(--g)':'var(--w)',
                            color:form.metodo===v?'#fff':'var(--gr)'}}>{l}</button>
                ))}
              </div>
              {irpfPct > 0 && form.metodo === 'total' && (
                <div style={{fontSize:9,color:'var(--amb)',marginTop:5,lineHeight:1.5,display:'flex',gap:4}}>
                  <Ic name="alerta" size={11}/>
                  <span>Con retención, el total ya lleva el IRPF restado y la base no se puede
                  calcular desde él. Pon <strong>la base imponible</strong>, que en tu factura
                  es el importe de la renta.</span>
                </div>
              )}
            </div>

            <div className="g2">
              <div className="field"><label>IVA (%)</label>
                <select className="input" value={form.iva_pct} onChange={e=>setForm(p=>({...p,iva_pct:e.target.value}))}>
                  <option value="21">21%</option>
                  <option value="10">10%</option>
                  <option value="4">4%</option>
                  <option value="0">Sin IVA (0%)</option>
                </select>
              </div>
              <div className="field"><label>IRPF (%)</label><input className="input" type="number" value={form.irpf_pct} onChange={e=>setForm(p=>({...p,irpf_pct:e.target.value}))} placeholder="0"/></div>
            </div>
            {irpfPct > 0 && (
              <div className="field"><label>¿Qué retención es? (modelo)</label>
                <select className="input" value={form.irpf_modelo} onChange={e=>setForm(p=>({...p,irpf_modelo:e.target.value}))}>
                  <option value="111">111 · Profesional / trabajador</option>
                  <option value="115">115 · Alquiler del local</option>
                </select>
              </div>
            )}

            {/* El desglose completo, con el mismo orden y los mismos signos que
                la factura, para poder compararlo línea a línea antes de guardar.
                El TOTAL estaba antes en la etiqueta del campo, así que al meter
                la base no había forma de comprobar que salía lo que pone abajo
                del papel. */}
            {/* REPETIR DURANTE EL AÑO
                El primero es real; los siguientes quedan como ESTIMADOS y no
                cuentan para el 303 ni el 115 hasta que confirmes cada factura.
                Ver lib/gastos: deducir IVA de un papel que no existe no es un
                número feo, es una declaración mal hecha. */}
            {/* Solo al crear. Editando, "se repite" no querría decir nada: la
                serie ya existe y las otras filas son gastos con vida propia.
                Marcarlo aquí generaría doce duplicados. */}
            <div className="field" style={{display: editando ? 'none' : undefined}}>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
                <input type="checkbox" checked={form.repetir}
                  onChange={e=>setForm(p=>({...p,repetir:e.target.checked}))}/>
                Se repite durante el año
              </label>
              {form.repetir && (
                <>
                  <select className="input" style={{marginTop:6}} value={form.cadencia}
                    onChange={e=>setForm(p=>({...p,cadencia:e.target.value}))}>
                    {CADENCIAS.map(c=><option key={c.id} value={c.id}>{c.nombre} · {c.ayuda}</option>)}
                  </select>
                  {/* FIJO O VARIABLE. Para la gestoría, la media es un número
                      que no aparece en ninguna factura: si son 90 € y suben a
                      100, promediar da 92,50 €. Lo que vale ahí es el último
                      precio conocido. */}
                  <div style={{display:'flex',gap:6,marginTop:6}}>
                    {MODOS_ESTIMACION.map(m=>(
                      <button key={m.id} type="button" onClick={()=>setForm(p=>({...p,modoEst:m.id}))}
                        style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                                border:`1.5px solid ${form.modoEst===m.id?'var(--g)':'var(--bd)'}`,
                                background:form.modoEst===m.id?'var(--g)':'var(--w)',
                                color:form.modoEst===m.id?'#fff':'var(--gr)'}}>{m.nombre}</button>
                    ))}
                  </div>
                  <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>
                    {MODOS_ESTIMACION.find(m=>m.id===form.modoEst)?.ayuda}
                  </div>

                  <div style={{fontSize:9,color:'var(--gd)',marginTop:6,lineHeight:1.6,
                               background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 10px'}}>
                    Se crearán <strong>{fechasSerie.length}</strong> gastos hasta diciembre, el día{' '}
                    <strong>{form.fecha.split('-')[2]}</strong> de cada periodo.
                    {' '}El primero queda como <strong>real</strong> y los otros {fechasSerie.length-1} como
                    {' '}<strong>estimados</strong>, que no cuentan para los impuestos hasta que confirmes su factura.
                    {form.modoEst === 'fijo'
                      ? (ultimo != null
                          ? <> Los estimados llevarán <strong>{ultimo.toFixed(2)} €</strong> de base,
                              que es el último importe real de este concepto.</>
                          : <> Los estimados repetirán los <strong>{base.toFixed(2)} €</strong> que has puesto.
                              Cuando confirmes uno con otro importe, te ofrecerá aplicarlo al resto.</>)
                      : (media
                          ? <> Los estimados llevarán <strong>{media.base.toFixed(2)} €</strong> de base,
                              la media de los {media.n} anteriores de este concepto.</>
                          : <> No hay histórico de este concepto, así que los estimados repetirán
                              los <strong>{base.toFixed(2)} €</strong> que has puesto.</>)}
                  </div>
                </>
              )}
            </div>

            {base > 0 && (
              <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:'var(--grl)'}}>Base imponible</span>
                  <span style={{fontWeight:500}}>{base.toFixed(2)} €</span>
                </div>
                {ivaPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {ivaPct}%</span>
                    <span style={{fontWeight:500}}>{ivaImporte.toFixed(2)} €</span>
                  </div>
                )}
                {irpfPct > 0 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>− IRPF {irpfPct}%</span>
                    <span style={{fontWeight:500,color:'var(--red)'}}>−{irpfImporte.toFixed(2)} €</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                  <span style={{fontWeight:600,color:'var(--n)'}}>Total pagado</span>
                  <span style={{fontWeight:600,color:'var(--n)'}}>{total.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <div className="g2">
              {/* Lista cerrada. Era texto libre y "Suministros", "suministros"
                  y "Luz" eran tres categorías distintas para el ordenador: el
                  desglose se rompía solo en tres meses sin que nadie hiciera
                  nada mal. Ver CATEGORIAS_GASTO en lib/gastos. */}
              <div className="field"><label>Categoría</label>
                <select className="input" value={form.categoria}
                  onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}>
                  <option value="">Sin categoría</option>
                  {CATEGORIAS_GASTO.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}
                </select>
              </div>
              <div className="field"><label>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/></div>
            </div>
            {ayudaDeCategoria(form.categoria) && (
              <div style={{fontSize:9,color:'var(--grl)',marginTop:-4,marginBottom:10,lineHeight:1.5}}>
                {ayudaDeCategoria(form.categoria)}
              </div>
            )}
            <div onClick={()=>setForm(p=>({...p,tiene_factura:!p.tiene_factura}))} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:6,border:`1px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--gl)':'var(--w)',cursor:'pointer',marginBottom:10}}>
              <div style={{width:16,height:16,borderRadius:3,border:`2px solid ${form.tiene_factura?'var(--g)':'var(--bd)'}`,background:form.tiene_factura?'var(--g)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {form.tiene_factura && <span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
              </div>
              <span style={{fontSize:10,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:5}}><Ic name="informe" size={12}/> Tiene factura</span>
            </div>
            <div className="field"><label>Notas</label><textarea className="input" value={form.notas} onChange={e=>setForm(p=>({...p,notas:e.target.value}))} style={{minHeight:50}}/></div>
            {editando?.serie_id && (
              <div style={{fontSize:9,color:'var(--grl)',lineHeight:1.55,marginBottom:8}}>
                Esto cambia <strong>solo este mes</strong>. Los demás de la serie se quedan como están;
                para subir el precio de los que quedan, hazlo al confirmar uno.
              </div>
            )}
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>{setModal(false);setEditando(null)}}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crear} disabled={guardando}>{guardando?'…':<><Ic name="guardar" size={13}/> {editando?'Guardar cambios':'Guardar'}</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR UNA PREVISIÓN.
          Una pantalla, no dos cuadros encadenados del navegador: el importe y
          lo de propagarlo a lo que queda se deciden a la vez, viendo los dos
          números. */}
      {conf && (() => {
        const est = Number(conf.base_imponible || 0)
        const nueva = parseFloat(confBase.replace(',', '.'))
        const val = isNaN(nueva) ? null : nueva
        const iva = Number(conf.iva_pct || 0), irpf = Number(conf.irpf_pct || 0)
        const cambia = val != null && Math.abs(val - est) > 0.005
        return (
          <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setConf(null)}}>
            <div className="modal" style={{maxWidth:420}}>
              <div className="modal-title">Ha llegado la factura<button className="modal-close" onClick={()=>setConf(null)}>✕</button></div>

              {error && (
                <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,
                             padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)',lineHeight:1.55}}>
                  <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
                </div>
              )}
              <div style={{fontSize:11,color:'var(--n)',fontWeight:500}}>{conf.concepto}</div>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:10}}>
                {new Date(conf.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}
                {' · previsión de '}{est.toFixed(2)} €
              </div>

              <div className="field">
                <label>Base imponible de la factura (€)</label>
                <input className="input" type="number" value={confBase} autoFocus
                  onChange={e=>setConfBase(e.target.value)}/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                  Se pregunta porque lo que se deduce sale del papel, no del cálculo.
                  Si coincide con la previsión, dale a confirmar sin tocar nada.
                </div>
              </div>

              {val != null && (
                <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>Base</span><span style={{fontWeight:500}}>{val.toFixed(2)} €</span>
                  </div>
                  {iva > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {iva}%</span><span style={{fontWeight:500}}>{(val*iva/100).toFixed(2)} €</span>
                  </div>}
                  {irpf > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>− IRPF {irpf}%</span><span style={{fontWeight:500,color:'var(--red)'}}>−{(val*irpf/100).toFixed(2)} €</span>
                  </div>}
                  <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                    <span style={{fontWeight:600,color:'var(--n)'}}>Total pagado</span>
                    <span style={{fontWeight:600,color:'var(--n)'}}>{(val + val*iva/100 - val*irpf/100).toFixed(2)} €</span>
                  </div>
                </div>
              )}

              {/* La subida de abril. Marcado por ti: una factura más alta puede
                  ser una subida permanente o algo puntual de este mes. */}
              {cambia && confPend > 0 && (
                <div onClick={()=>setConfPropagar(v=>!v)}
                  style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 11px',borderRadius:6,cursor:'pointer',marginBottom:10,
                          border:`1px solid ${confPropagar?'var(--g)':'var(--bd)'}`,background:confPropagar?'var(--gl)':'var(--w)'}}>
                  <div style={{width:16,height:16,borderRadius:3,marginTop:1,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                               border:`2px solid ${confPropagar?'var(--g)':'var(--bd)'}`,background:confPropagar?'var(--g)':'transparent'}}>
                    {confPropagar && <span style={{color:'#fff',fontSize:9,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{fontSize:10,color:'var(--n)',lineHeight:1.55}}>
                    El importe {val! > est ? 'sube' : 'baja'} de {est.toFixed(2)} € a {val!.toFixed(2)} €.
                    {' '}<strong>Aplicarlo también a las {confPend} previsiones que quedan.</strong>
                    <div style={{color:'var(--grl)',marginTop:2}}>
                      Márcalo si es el precio nuevo de aquí en adelante. Déjalo sin marcar si
                      fue algo puntual de este mes.
                    </div>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-d btn-sm" onClick={()=>setConf(null)}>Cancelar</button>
                <div style={{flex:1}}/>
                <button className="btn btn-p" onClick={guardarConfirmacion} disabled={guardando || val==null}>
                  {guardando?'…':<><Ic name="guardar" size={13}/> Confirmar</>}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* DAR DE BAJA UN SERVICIO. La fecha con un calendario, no tecleando
          AAAA-MM-DD en un cuadro del navegador. */}
      {baja && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setBaja(null)}}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-title">Dar de baja el servicio<button className="modal-close" onClick={()=>setBaja(null)}>✕</button></div>
            <div style={{fontSize:11,color:'var(--n)',fontWeight:500,marginBottom:10}}>{baja.concepto}</div>
            <div className="field">
              <label>¿Desde qué día ya no lo tienes?</label>
              <input className="input" type="date" value={bajaDesde} autoFocus
                onChange={e=>setBajaDesde(e.target.value)}/>
            </div>
            <div style={{fontSize:10,color:'var(--grl)',lineHeight:1.6,marginBottom:10}}>
              Se quitarán las previsiones de esa fecha en adelante.
              {' '}<strong style={{color:'var(--n)'}}>Las facturas ya confirmadas no se tocan</strong>:
              {' '}son gasto deducible aunque el servicio se haya acabado.
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setBaja(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={darDeBaja} disabled={guardando || !bajaDesde}>
                {guardando?'…':'Dar de baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
