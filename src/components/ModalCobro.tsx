'use client'
import { useMemo, useState } from 'react'
import { Ic } from '@/lib/icons'
import { indicePlanes, precioFinalPlan, precioConDescuento, esVentaPuntual } from '@/lib/bonos'
import {
  emitirCobro, desgloseDesdeTotal, totalesDe, fraccionDeAlta, LBL_FRACCION,
  lineaDeBono, ultimaFechaDeSerie, SERIE_COMPLETA, SERIE_SIMPLIFICADA,
  type LineaCobro, type FormaPago,
} from '@/lib/cobros'

// Modal de cobro. NO calcula precios por su cuenta: todo sale de lib/cobros y
// lib/bonos, que es donde vive la regla. Aquí solo se enseña y se deja tocar.
//
// El importe de cada línea es editable a propósito. La app propone lo que le
// corresponde al paciente —precio del plan, su descuento, la fracción de mes si
// se da de alta a mitad— pero el que sabe qué se ha acordado eres tú. Se avisa,
// no se impide: si el importe deja de coincidir con la propuesta, se dice.

const FORMAS: [FormaPago, string][] = [
  ['tarjeta','Tarjeta'], ['efectivo','Efectivo'], ['transferencia','Transfer.'], ['domiciliacion','Domicil.'],
]

type Props = {
  paciente: any
  bono?: any
  planes: any[]
  /** Servicios sueltos y descuentos guardados, de Ajustes → Tarifas. */
  servicios?: { nombre: string, precio: number, iva: number }[]
  descuentos?: { nombre: string, tipo: string, valor: number }[]
  /** true si es el primer cobro del paciente: solo entonces se propone prorrateo. */
  primerCobro?: boolean
  onCerrar: () => void
  onEmitida?: (r: { serie: string, numero: number, facturaId: string }) => void
}

export default function ModalCobro({ paciente, bono, planes, servicios = [], descuentos = [], primerCobro, onCerrar, onEmitida }: Props) {
  const idx = useMemo(() => indicePlanes(planes), [planes])
  const plan = bono ? idx[bono.tipo] : undefined

  // Un bono de sesiones no se fracciona: ocho sesiones son ocho empieces cuando
  // empieces. Ver `lineaDeBono`.
  const ventaPuntual = esVentaPuntual(bono)
  const fraccionPropuesta = primerCobro && bono?.fecha_inicio && !ventaPuntual
    ? fraccionDeAlta(bono.fecha_inicio) : 1
  const [fraccion, setFraccion] = useState(fraccionPropuesta)

  /**
   * DE QUÉ MES ES LA CUOTA, escrito en la factura.
   *
   * `lineaDeBono` admitía esta etiqueta desde el principio y nadie se la pasaba, así que
   * todas las cuotas salían como "Cuota mensual · Individual", sin decir el periodo. Con
   * cobros del mes en curso se adivina por la fecha de la factura, pero en cuanto alguien
   * paga septiembre por adelantado en agosto la factura deja de decir qué se está
   * pagando — y eso es justo lo que tiene que constar en ella.
   */
  const etiquetaPeriodo = bono && bono.mes && bono.anio
    ? new Date(bono.anio, bono.mes - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : undefined

  const [lineas, setLineas] = useState<LineaCobro[]>(() =>
    bono ? [lineaDeBono(bono, plan, fraccionPropuesta, etiquetaPeriodo)] : []
  )
  /**
   * CUÁNDO SE COBRÓ DE VERDAD.
   *
   * Antes siempre era hoy, así que un pago recibido hace tres días se registraba con la
   * fecha equivocada. La fecha de una factura no se elige: es la del hecho. Lo que sí hace
   * falta es poder anotar la real cuando se registra con retraso.
   *
   * No se admite fecha futura. Una factura fechada mañana no documenta nada que haya
   * pasado, y mover un cobro a otro periodo cambiándole la fecha no es un ajuste
   * contable: es declarar en el trimestre que no toca.
   */
  const hoyISO = new Date().toISOString().split('T')[0]
  /** Cuándo se emite la factura. Es hoy, salvo que se esté regularizando algo. */
  const [fecha, setFecha] = useState(hoyISO)
  /** Cuándo se cobró de verdad. Si es otro día, va en la factura como fecha de operación. */
  const [fechaCobro, setFechaCobro] = useState(hoyISO)
  const [formaPago, setFormaPago] = useState<FormaPago>('tarjeta')
  const [notas, setNotas] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const tieneDni = !!(paciente?.dni || '').trim()
  const totales = totalesDe(lineas)

  const mensualConDescuento = bono ? precioConDescuento(precioFinalPlan(plan), bono) : 0
  const pvp = precioFinalPlan(plan)
  const hayDescuento = bono?.descuento_tipo && mensualConDescuento < pvp

  function cambiarFraccion(f: number) {
    setFraccion(f)
    // Solo se recalcula la línea de la cuota; lo añadido a mano no se toca.
    setLineas(ls => ls.map(l => {
      if (!(l.bono_id && bono && l.bono_id === bono.id)) return l
      const nueva = lineaDeBono(bono, plan, f, etiquetaPeriodo)
      return { ...nueva, precioBase: nueva.total, descuento: null }
    }))
  }

  function setLinea(i: number, cambios: Partial<LineaCobro>) {
    setLineas(ls => ls.map((l, j) => j === i ? { ...l, ...cambios } : l))
  }

  function añadirDesde(valor: string) {
    if (valor === 'libre') { setLineas(ls => [...ls, { concepto:'', total:0, precioBase:0, iva_pct:21, cantidad:1 }]); return }
    const [clase, ref] = valor.split(':')
    if (clase === 's') {
      const s = servicios[Number(ref)]
      if (s) setLineas(ls => [...ls, { concepto: s.nombre, total: s.precio, precioBase: s.precio, iva_pct: s.iva ?? 21, cantidad: 1 }])
    }
    if (clase === 'p') {
      const p: any = idx[ref]
      if (p) setLineas(ls => [...ls, { concepto: p.nombre || ref, total: precioFinalPlan(p), precioBase: precioFinalPlan(p), iva_pct: Number(p.iva ?? 21), cantidad: 1 }])
    }
  }

  /**
   * Aplica un descuento guardado sobre UNA línea.
   *
   * Vale solo para este cobro: el bono del paciente no se toca, así que el mes
   * que viene vuelve a su tarifa. Para que sea permanente hay que ponerlo en su
   * ficha, y el modal lo dice justo aquí, donde se toma la decisión.
   */
  function aplicarDescuento(i: number, d: { tipo: string, valor: number, nombre: string }) {
    setLineas(ls => ls.map((l, j) => {
      if (j !== i) return l
      const partida = l.precioBase ?? l.total
      // Pulsar el mismo descuento lo quita. Y el cálculo va siempre contra el
      // precio de partida, nunca contra el importe ya rebajado: si no, pulsar
      // dos veces descontaba dos veces y acababa dejándolo en cero.
      const quitar = l.descuento?.nombre === d.nombre
      return quitar
        ? { ...l, total: partida, descuento: null }
        : { ...l, total: precioConDescuento(partida, { descuento_tipo: d.tipo, descuento_valor: d.valor }), descuento: d }
    }))
  }

  async function cobrar() {
    setEmitiendo(true); setError(null)
    // Antes de emitir con fecha atrasada, se comprueba que no rompa el orden de la serie.
    // Se avisa y se deja decidir: puede haber un motivo, pero no puede pasar sin saberlo.
    if (fecha < hoyISO) {
      const serie = tieneDni ? SERIE_COMPLETA : SERIE_SIMPLIFICADA
      const ultima = await ultimaFechaDeSerie(serie)
      if (ultima && fecha < ultima) {
        const ok = confirm(
          `La última factura de la serie ${serie} es del ${new Date(ultima+'T12:00:00').toLocaleDateString('es-ES')}.\n\n` +
          `Si emites esta con fecha ${new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')}, la numeración deja de ir en orden de fecha.\n\n¿Emitir igualmente?`)
        if (!ok) { setEmitiendo(false); return }
      }
    }

    const r = await emitirCobro({
      pacienteId: paciente.id,
      lineas,
      formaPago,
      fecha,
      fechaOperacion: fechaCobro !== fecha ? fechaCobro : undefined,
      notas: notas || undefined,
      tipo: tieneDni ? 'completa' : 'simplificada',
    })
    setEmitiendo(false)
    if (!r.ok) { setError(r.error); return }
    onEmitida?.({ serie: r.serie, numero: r.numero, facturaId: r.facturaId })
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{maxWidth:480}}>
        <div className="modal-title">
          Cobrar a {paciente.nombre} {paciente.apellidos}
          <button className="modal-close" onClick={onCerrar}>✕</button>
        </div>

        <div style={{fontSize:10,color:'var(--grl)',marginBottom:14,display:'flex',alignItems:'center',gap:5}}>
          <Ic name="recibo" size={12}/>
          {tieneDni
            ? <>Se emitirá <strong>factura completa</strong> (serie F) al confirmar.</>
            : <>Sin DNI en la ficha: saldrá <strong>factura simplificada</strong> (serie S), que no le sirve para deducirse el gasto.</>}
        </div>

        {primerCobro && bono && !ventaPuntual && (
          <div style={{marginBottom:12}}>
            <label style={{fontSize:10,color:'var(--grl)',display:'block',marginBottom:5}}>
              Primer mes · se da de alta el {new Date(bono.fecha_inicio+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long'})}
            </label>
            <div style={{display:'flex',gap:4}}>
              {[1,0.75,0.5,0.25].map(f=>(
                <button key={f} onClick={()=>cambiarFraccion(f)}
                  style={{flex:1,fontSize:10,padding:'6px 4px',borderRadius:6,cursor:'pointer',fontFamily:'system-ui',
                    border:`1px solid ${fraccion===f?'var(--g)':'var(--bd)'}`,
                    background:fraccion===f?'var(--g)':'var(--w)',
                    color:fraccion===f?'#fff':'var(--gr)',fontWeight:fraccion===f?500:400}}>
                  {f===1?'Mes entero':LBL_FRACCION[f]}
                </button>
              ))}
            </div>
          </div>
        )}

        {lineas.length === 0 && (
          <div style={{border:'1px dashed var(--bd)',borderRadius:8,padding:'14px 12px',marginBottom:8,
                       fontSize:10,color:'var(--grl)',textAlign:'center'}}>
            Sin líneas. Añade lo que vayas a cobrar con el desplegable de abajo.
          </div>
        )}
        {lineas.map((l, i) => {
          const d = desgloseDesdeTotal(l.total, l.iva_pct ?? 21)
          const esCuota = !!l.bono_id
          const propuesto = esCuota ? Math.round(mensualConDescuento * fraccion * 100)/100 : null
          const tocado = propuesto != null && Math.abs(propuesto - l.total) > 0.005
          return (
            <div key={i} style={{border:'1px solid var(--bd)',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <input className="input" style={{flex:1,fontSize:11}} value={l.concepto}
                  onChange={e=>setLinea(i,{concepto:e.target.value})}/>
                <input className="input" type="number" step="0.01" style={{width:88,fontSize:12,textAlign:'right',fontWeight:600}}
                  value={l.total} onChange={e=>{
                    const v = parseFloat(e.target.value) || 0
                    // Escribir un importe manda sobre el descuento: pasa a ser el
                    // precio de partida y el descuento se retira.
                    setLinea(i, { total: v, precioBase: v, descuento: null })
                  }}/>
                {/* Cualquier línea se puede quitar, también la de la cuota: a
                    veces se cobra otro bono distinto del que tiene asignado. */}
                <button onClick={()=>setLineas(ls=>ls.filter((_,j)=>j!==i))} title="Quitar esta línea"
                  style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',display:'inline-flex',padding:4}}>
                  <Ic name="papelera" size={13}/>
                </button>
              </div>
              <div style={{fontSize:9,color:'var(--grl)',marginTop:5,display:'flex',gap:10,flexWrap:'wrap'}}>
                <span>Base {d.base.toFixed(2)} € · IVA {l.iva_pct ?? 21}% {d.cuota.toFixed(2)} €</span>
                {esCuota && hayDescuento && (
                  <span style={{color:'var(--gd)'}}>
                    PVP {pvp.toFixed(2)} € · descuento {bono.descuento_tipo==='porcentaje'?`${bono.descuento_valor}%`:`${bono.descuento_valor} €`}
                    {bono.descuento_motivo?` (${bono.descuento_motivo})`:''}
                  </span>
                )}
              </div>
              {tocado && (
                <div style={{fontSize:9,color:'#7A5800',marginTop:4,display:'flex',alignItems:'center',gap:4}}>
                  <Ic name="alerta" size={10}/> Le corresponden {propuesto!.toFixed(2)} €. Vas a cobrar otra cantidad.
                </div>
              )}
              {l.descuento && (
                <div style={{fontSize:9,color:'var(--gd)',marginTop:4}}>
                  {l.descuento.nombre} · de {(l.precioBase ?? 0).toFixed(2)} € a {l.total.toFixed(2)} €
                  {' '}(−{((l.precioBase ?? 0) - l.total).toFixed(2)} €) · solo en este cobro
                </div>
              )}
              {descuentos.length > 0 && (
                <div style={{display:'flex',alignItems:'center',gap:5,marginTop:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:9,color:'var(--grl)'}}>Descuento solo para este cobro:</span>
                  {descuentos.map((d,k)=>{
                    const puesto = l.descuento?.nombre === d.nombre
                    return (
                      <button key={k} onClick={()=>aplicarDescuento(i,d)} title={puesto?'Pulsa otra vez para quitarlo':undefined}
                        style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',fontFamily:'system-ui',
                                border:`1px solid ${puesto?'var(--g)':'var(--bd)'}`,
                                background:puesto?'var(--g)':'var(--w)',color:puesto?'#fff':'var(--gr)'}}>
                        {puesto ? '✓ ' : ''}{d.nombre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Añadir línea: tarifas de Ajustes, bonos de Finanzas → Planes, o libre.
            Todo son atajos; el importe se puede tocar después. */}
        <select className="input" style={{fontSize:11,marginBottom:14}} value=""
          onChange={e=>{ if (e.target.value) { añadirDesde(e.target.value); e.target.value = '' } }}>
          <option value="">+ Añadir línea…</option>
          {servicios.length > 0 && (
            <optgroup label="Servicios">
              {servicios.map((s,i)=><option key={`s${i}`} value={`s:${i}`}>{s.nombre} · {s.precio.toFixed(2)} €</option>)}
            </optgroup>
          )}
          {planes.length > 0 && (
            <optgroup label="Bonos">
              {planes.map((p:any)=>(
                <option key={p.bono_tipo} value={`p:${p.bono_tipo}`}>
                  {p.nombre || p.bono_tipo} · {precioFinalPlan(p).toFixed(2)} €
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Otro">
            <option value="libre">Línea libre (escribes concepto e importe)</option>
          </optgroup>
        </select>

        <div style={{background:'var(--bl)',borderRadius:8,padding:'10px 13px',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--grl)',padding:'2px 0'}}>
            <span>Base imponible</span><span>{totales.base.toFixed(2)} €</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--grl)',padding:'2px 0'}}>
            <span>Cuota IVA</span><span>{totales.cuota.toFixed(2)} €</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontWeight:600,color:'var(--n)',
                       borderTop:'1px solid var(--bd)',paddingTop:7,marginTop:5}}>
            <span>TOTAL</span><span>{totales.total.toFixed(2)} €</span>
          </div>
        </div>

        <div style={{display:'flex',gap:4,marginBottom:12}}>
          {FORMAS.map(([k,l])=>(
            <button key={k} onClick={()=>setFormaPago(k)}
              style={{flex:1,fontSize:10,padding:'7px 4px',borderRadius:6,cursor:'pointer',fontFamily:'system-ui',
                border:`1px solid ${formaPago===k?'var(--g)':'var(--bd)'}`,
                background:formaPago===k?'var(--g)':'var(--w)',
                color:formaPago===k?'#fff':'var(--gr)',fontWeight:formaPago===k?500:400}}>{l}</button>
          ))}
        </div>

        {/* DOS FECHAS, que son dos cosas distintas.
            La de expedición numera la serie; la del cobro es el hecho que se documenta y
            es la que marca el devengo del IVA en un pago anticipado. Solo consta en la
            factura cuando son distintas, que es lo que pide el reglamento. */}
        <div style={{display:'flex',gap:8}}>
          <div className="field" style={{flex:1}}><label>Fecha del cobro</label>
            <input className="input" type="date" value={fechaCobro} max={hoyISO}
              onChange={e=>setFechaCobro(e.target.value)}/>
          </div>
          <div className="field" style={{flex:1}}><label>Fecha de la factura</label>
            <input className="input" type="date" value={fecha} max={hoyISO}
              onChange={e=>setFecha(e.target.value)}/>
          </div>
        </div>
        <div style={{fontSize:12,color:'var(--gr)',marginTop:-6,marginBottom:12,lineHeight:1.5}}>
          {fechaCobro === fecha
            ? 'Cobraste y facturas el mismo día, así que la factura llevará solo esa fecha.'
            : <>La factura se expide el <b>{new Date(fecha+'T12:00:00').toLocaleDateString('es-ES')}</b> y hará constar
               que la operación fue el <b>{new Date(fechaCobro+'T12:00:00').toLocaleDateString('es-ES')}</b>.</>}
        </div>

        {/* SIMPLIFICADA O COMPLETA, dicho ANTES de emitir.
            Lo decide el DNI del paciente y hasta ahora te enterabas al abrir la factura
            ya emitida — que además es inmutable, así que arreglarlo obliga a rectificar.
            Aquí todavía estás a tiempo de ir a su ficha y ponerlo. */}
        {!tieneDni && (
          <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,
            padding:'8px 11px',marginBottom:12,fontSize:12,color:'#8A6410',lineHeight:1.5}}>
            <b>{paciente?.nombre} no tiene DNI</b>, así que saldrá <b>factura simplificada</b> y
            sin sus datos. Si la necesita para desgravar, ponle el DNI en su ficha antes de cobrar.
          </div>
        )}

        <div className="field"><label>Notas (opcional)</label>
          <input className="input" value={notas} onChange={e=>setNotas(e.target.value)} placeholder="ej. paga la mitad ahora"/>
        </div>

        {error && (
          <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',
                       marginBottom:10,fontSize:10,color:'var(--red)'}}>
            <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={cobrar} disabled={emitiendo || totales.total <= 0}>
            {emitiendo ? '…' : <><Ic name="recibo" size={13}/> Cobrar y emitir factura</>}
          </button>
        </div>

        <div style={{fontSize:9,color:'var(--grl)',marginTop:8,textAlign:'right'}}>
          Una vez emitida, solo se corrige con una rectificativa.
        </div>
      </div>
    </div>
  )
}
