'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { precioConDescuento, precioFinalPlan, redondear, esVentaPuntual } from '@/lib/bonos'

const G='#5A969E', GD='#3E7179'

export default function PlanesTab({ planes, bonos=[], bonosTipos=[], recargar }: any) {
  const [editando, setEditando] = useState<string|null>(null)
  const [modo, setModo] = useState<'final'|'base'>('final')
  const [valor, setValor] = useState('')
  const [ivaEdit, setIvaEdit] = useState('21')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const planPorTipo: Record<string, any> = {}
  planes.forEach((p:any)=>{ planPorTipo[p.bono_tipo] = p })

  // Por cada tipo: nº de pacientes activos e ingreso real (con descuentos aplicados)
  const activosPorTipo: Record<string, number> = {}
  const ingresoPorTipo: Record<string, number> = {}
  bonos.forEach((b:any)=>{
    activosPorTipo[b.tipo] = (activosPorTipo[b.tipo]||0)+1
    ingresoPorTipo[b.tipo] = (ingresoPorTipo[b.tipo]||0) + precioConDescuento(precioFinalPlan(planPorTipo[b.tipo]), b)
  })

  const finalDe = (p:any) => precioFinalPlan(p)

  function iniciarEdicion(p: any) {
    setEditando(p.id)
    setModo('final')
    setIvaEdit(String(p.iva))
    setValor(String(finalDe(p)))
  }

  async function guardar(p: any) {
    setGuardando(true)
    setError(null)
    const v = parseFloat(valor) || 0
    const iva = parseFloat(ivaEdit) || 0
    let base, finalP
    if (modo === 'final') {
      finalP = v
      base = redondear(v / (1 + iva/100))
    } else {
      base = v
      finalP = redondear(v * (1 + iva/100))
    }
    const { error } = await supabase.from('planes').update({ precio_base: base, precio_final: finalP, iva }).eq('id', p.id)
    setGuardando(false)
    if (error) { setError(`No se ha podido guardar el precio: ${error.message}`); return }
    setEditando(null)
    recargar()
  }

  async function crearPlan(tipo: string) {
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('planes').insert({ bono_tipo: tipo, nombre: nombreTipo(tipo), precio_base: 0, precio_final: 0, iva: 21, activo: true })
    setGuardando(false)
    if (error) { setError(`No se ha podido crear el plan: ${error.message}`); return }
    recargar()
  }

  function nombreTipo(tipo: string) {
    const bt = bonosTipos.find((b:any)=>b.id===tipo)
    return bt ? bt.nombre : tipo
  }

  function calcularPreview() {
    const v = parseFloat(valor) || 0
    const iva = parseFloat(ivaEdit) || 0
    if (modo === 'final') {
      const base = Math.round((v / (1 + iva/100)) * 100) / 100
      return { base, final: v, ivaImporte: Math.round((v - base) * 100) / 100 }
    } else {
      const final = Math.round(v * (1 + iva/100) * 100) / 100
      return { base: v, final, ivaImporte: Math.round((final - v) * 100) / 100 }
    }
  }

  const eur = (n:number) => `${n.toFixed(2)}€`

  return (
    <div>
      <div className="card-title"><span className="ct-l"><Ic name="euro"/> Planes y precios</span></div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Cada plan corresponde a un tipo de bono. Introduce el precio con IVA o el precio base; el IVA es configurable. Se muestra cuántos pacientes tienen cada bono activo y el ingreso que genera.</div>

      {error && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
        </div>
      )}

      {bonosTipos.length===0 && (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>No hay tipos de bono. Créalos en Ajustes → Bonos.</div>
      )}

      {/* EN REJILLA, NO EN LISTA.
          Cada plan ocupaba una fila entera para decir un precio y dos cifras.
          Con ocho tipos había que bajar toda la página para compararlos, que es
          justo lo que uno viene a hacer aquí. La edición sigue a lo ancho: ahí
          sí hacen falta los campos grandes. */}
      <div style={{display:'grid',/* Cinco fijas, repartidas a todo el ancho. Con auto-fill salían siete en
             pantalla grande y el nombre del bono partía en tres líneas. */
          gridTemplateColumns:'repeat(5,1fr)',gap:14}}>
      {bonosTipos.map((bt:any) => {
        const p = planPorTipo[bt.id]
        const nPac = activosPorTipo[bt.id] || 0

        // Sin plan: mostrar aviso + botón para crearlo
        if (!p) {
          return (
            <div key={bt.id} style={{padding:'12px',borderRadius:8,background:'var(--ambl)',border:'1px solid var(--amb)',display:'flex',flexDirection:'column',gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--n)'}}>{bt.nombre}{!bt.activo && ' (inactivo)'}</div>
                <div style={{fontSize:9,color:'#7A5800',marginTop:2}}>Sin precio asignado</div>
              </div>
              <button className="btn btn-p btn-sm" style={{marginTop:'auto'}} onClick={()=>crearPlan(bt.id)} disabled={guardando}>+ Asignar precio</button>
            </div>
          )
        }

        const final = finalDe(p)
        const ingreso = ingresoPorTipo[bt.id] || 0
        const enEdicion = editando === p.id
        const deSesiones = esVentaPuntual({ sesiones_totales: bt.sesiones }) || bt.modalidad === 'sesiones'
        const preview = enEdicion ? calcularPreview() : null

        if (enEdicion) {
          // EDITAR, EN LA PROPIA TARJETA.
          //
          // Antes se abría a lo ancho de toda la fila con dos botones grandes
          // para elegir si el número llevaba IVA, dos campos y un resumen
          // aparte. Para cambiar un precio. Ahora es un campo y debajo la
          // cuenta hecha, que es la comprobación que importa.
          return (
            <div key={bt.id} className="card" style={{margin:0,background:'var(--gl)',border:'1px solid var(--gm)',display:'flex',flexDirection:'column'}}>
              <div style={{fontSize:14,fontWeight:600,color:'var(--n)',lineHeight:1.25,marginBottom:8}}>{bt.nombre}</div>

              <div style={{display:'flex',gap:6,alignItems:'flex-end',marginBottom:6}}>
                <div className="field" style={{flex:1,marginBottom:0}}>
                  <label>{modo==='final'?'Precio con IVA':'Precio sin IVA'}</label>
                  <input className="input" type="number" value={valor} onChange={e=>setValor(e.target.value)} placeholder="0.00" autoFocus/>
                </div>
                <div className="field" style={{width:62,marginBottom:0}}>
                  <label>IVA %</label>
                  <input className="input" type="number" value={ivaEdit} onChange={e=>setIvaEdit(e.target.value)} placeholder="21"/>
                </div>
              </div>

              <button type="button" onClick={()=>setModo(modo==='final'?'base':'final')}
                style={{background:'none',border:'none',padding:0,cursor:'pointer',fontSize:9,color:'var(--g)',textAlign:'left',marginBottom:8}}>
                {modo==='final' ? 'Prefiero escribirlo sin IVA' : 'Prefiero escribirlo con IVA'}
              </button>

              {preview && (
                <div style={{fontSize:9,color:'var(--grl)',lineHeight:1.6,marginBottom:10}}>
                  <span style={{fontSize:22,fontWeight:300,color:G,lineHeight:1,marginRight:6,verticalAlign:'-2px'}}>{preview.final.toFixed(2)}€</span>
                  base <strong style={{color:'var(--n)'}}>{preview.base.toFixed(2)}€</strong>, IVA {preview.ivaImporte.toFixed(2)}€
                </div>
              )}

              <div style={{display:'flex',gap:6,marginTop:'auto'}}>
                <button className="btn btn-d btn-sm" style={{flex:1}} onClick={()=>setEditando(null)}>Cancelar</button>
                <button className="btn btn-p btn-sm" style={{flex:1}} onClick={()=>guardar(p)} disabled={guardando}>{guardando?'…':'Guardar'}</button>
              </div>
            </div>
          )
        }

        return (
          <div key={bt.id} className="card" style={{margin:0,opacity:bt.activo?1:.55,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--n)',lineHeight:1.25}}>{bt.nombre}{!bt.activo && ' (inactivo)'}</div>
                {bt.descripcion && <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>{bt.descripcion}</div>}

              </div>
              {/* Solo el icono: metido en un botón con marco parecía una caja
                  dentro de la tarjeta y competía con el precio. */}
              <button onClick={()=>iniciarEdicion(p)} title="Cambiar el precio"
                style={{flexShrink:0,background:'none',border:'none',cursor:'pointer',color:'var(--grl)',padding:2,display:'inline-flex'}}><Ic name="editar" size={14}/></button>
            </div>
            <div style={{marginTop:6}}>
              {/* El desglose al lado del precio, no repetido arriba y abajo: es
                  la misma cuenta y así se lee de un golpe. */}
              {/* Todo en la misma línea de texto: el precio manda por tamaño y
                  el desglose va detrás, como una frase, no como dos columnas. */}
              <div style={{fontSize:9,color:'var(--grl)',lineHeight:1.6}}>
                <span style={{fontSize:30,fontWeight:300,color:G,lineHeight:1,marginRight:7,verticalAlign:'-2px'}}>{eur(final)}</span>
                {p.iva > 0 && (
                  <>base <strong style={{color:'var(--n)'}}>{(final/(1+p.iva/100)).toFixed(2)}€</strong>, IVA {(final-final/(1+p.iva/100)).toFixed(2)}€ ({p.iva}%)</>
                )}
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,paddingTop:9,borderTop:'1px solid var(--bd)'}}>
              {/* Un bono de sesiones no da "ingreso / mes": se vende una vez.
                  Poner el mismo rótulo en los dos haría leer una venta suelta
                  como si fuera dinero que entra todos los meses. */}
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>{nPac}</div>
                <div style={{fontSize:8,color:'var(--grl)'}}>{deSesiones ? (nPac===1?'vendido este mes':'vendidos este mes') : (nPac===1?'paciente activo':'pacientes activos')}</div>
              </div>
              <div style={{flex:1,textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:500,color:GD}}>{ingreso.toFixed(0)}€</div>
                <div style={{fontSize:8,color:'var(--grl)'}}>{deSesiones ? 'ingreso este mes' : 'ingreso / mes'}</div>
              </div>
            </div>

          </div>
        )
      })}
      </div>
    </div>
  )
}
