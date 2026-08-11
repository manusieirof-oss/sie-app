'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BonoTipo, TIPOS_DESCUENTO } from '@/lib/bonos'
import { esDeSesiones, caducidadDesde, textoModalidad } from '@/lib/bonoSesiones'

export default function ModalBono({ pacienteId, bonoActual, bonosOpts, onCerrar, onGuardado }: {
  pacienteId: string
  bonoActual: any
  bonosOpts: BonoTipo[]
  onCerrar: () => void
  onGuardado?: () => void
}) {
  const [form, setForm] = useState({
    tipo: bonoActual?.tipo || (bonosOpts[0]?.id || ''),
    descuento_tipo: bonoActual?.descuento_tipo || '',
    descuento_valor: bonoActual?.descuento_valor ? String(bonoActual.descuento_valor) : '',
    descuento_motivo: bonoActual?.descuento_motivo || '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)

  const LBL_BONO: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))
  const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
  const tipoElegido = bonosOpts.find(b=>b.id===form.tipo)

  async function guardar() {
    if (!form.tipo) return
    setGuardando(true)
    const hoy = new Date()
    const mes = hoy.getMonth()+1, anio = hoy.getFullYear()
    const tipoSel = bonosOpts.find(b=>b.id===form.tipo)
    const diasSemana = tipoSel?.dias_semana || 1
    const descTipo = form.descuento_tipo || null
    const descValor = descTipo ? (parseFloat(form.descuento_valor) || 0) : 0
    const comun = {
      tipo: form.tipo, dias_semana: diasSemana,
      descuento_tipo: descTipo, descuento_valor: descValor,
      descuento_motivo: descTipo ? (form.descuento_motivo || null) : null,
    }
    const hoyStr = new Date().toISOString().split('T')[0]

    // UN BONO DE SESIONES NO SUSTITUYE A NADA.
    //
    // La cuota mensual y el bono de sesiones conviven: alguien puede venir a
    // clase tres días por semana y además comprar ocho individuales. Si aquí se
    // aplicase la lógica de sustitución, comprar sesiones le quitaría la cuota
    // y dejaría de facturársele el mes.
    //
    // Las sesiones y la caducidad se COPIAN del tipo, no se leen de él: si
    // mañana el bono de 8 pasa a 10, quien compró 8 sigue teniendo 8. Mismo
    // criterio que congelar los datos dentro de la factura.
    if (esDeSesiones(tipoSel)) {
      const { error } = await supabase.from('bonos').insert({
        ...comun, paciente_id: pacienteId, estado_pago: 'pendiente', mes, anio,
        fecha_inicio: hoyStr, activo: true,
        sesiones_totales: tipoSel?.sesiones || null,
        caduca: caducidadDesde(hoyStr, tipoSel?.caduca_meses),
      })
      if (error) { setError(`No se ha podido asignar el bono: ${error.message}`); setGuardando(false); return }
      const cad = caducidadDesde(hoyStr, tipoSel?.caduca_meses)
      await supabase.from('eventos_paciente').insert({
        paciente_id: pacienteId, tipo: 'cambio_bono',
        titulo: `Bono de sesiones: ${LBL_BONO[form.tipo]||form.tipo}`,
        descripcion: `${tipoSel?.sesiones} sesiones. Pendiente de cobro.` +
          (cad ? ` Válido hasta ${new Date(cad+'T12:00:00').toLocaleDateString('es-ES')}.` : ''),
        fecha: hoyStr,
      })
      setGuardando(false)
      onGuardado?.()
      onCerrar()
      return
    }

    // Si el bono que se sustituye YA ES DE ESTE MES, se corrige en su sitio en
    // vez de crear otro.
    //
    // Antes se desactivaba el viejo y se insertaba uno nuevo, en ese orden y sin
    // mirar si la inserción funcionaba. Como hay un índice único por paciente,
    // mes y año, insertar un segundo bono del mismo mes falla — y el paciente se
    // quedaba sin ninguno, porque el viejo ya estaba desactivado. Silencioso y
    // destructivo, las dos cosas a la vez.
    //
    // Cambiar de bono a mitad de mes es corregir la cuota de ese mes, no abrir
    // una segunda. Lo que ya se haya cobrado no se toca: la factura está
    // congelada y sigue diciendo lo que decía.
    //
    // Si el bono anterior era DE SESIONES, no se corrige ni se retira: se le
    // está poniendo la cuota mensual además de las sesiones que compró, y esas
    // siguen siendo suyas hasta que se las gaste.
    const mismoMes = bonoActual && !esDeSesiones(bonoActual)
      && bonoActual.mes === mes && bonoActual.anio === anio
    const sustituye = bonoActual && !esDeSesiones(bonoActual)

    if (mismoMes) {
      const { error } = await supabase.from('bonos').update(comun).eq('id', bonoActual.id)
      if (error) { setError(`No se ha podido cambiar el bono: ${error.message}`); setGuardando(false); return }
    } else {
      // Primero se crea el nuevo. Solo si entra se retira el anterior, para que
      // un fallo no pueda dejar al paciente sin cuota.
      const { error } = await supabase.from('bonos').insert({
        ...comun, paciente_id: pacienteId, estado_pago: 'pendiente', mes, anio,
        fecha_inicio: hoyStr, activo: true,
      })
      if (error) { setError(`No se ha podido asignar el bono: ${error.message}`); setGuardando(false); return }
      if (sustituye) await supabase.from('bonos').update({ activo:false }).eq('id', bonoActual.id)
    }

    const txtDesc = descTipo
      ? ` · ${descTipo==='precio' ? `Precio pactado ${descValor} €` : descTipo==='porcentaje' ? `Descuento ${descValor}%` : `Descuento ${descValor} €`}${form.descuento_motivo?` (${form.descuento_motivo})`:''}`
      : ''
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId, tipo: 'cambio_bono',
      titulo: `${mismoMes ? 'Bono corregido' : 'Bono asignado'}: ${LBL_BONO[form.tipo]||form.tipo}`,
      descripcion: `${mismoMes ? 'Se corrige la cuota de este mes.' : 'Pendiente de cobro.'}${txtDesc}`,
      fecha: new Date().toISOString().split('T')[0],
    })

    setGuardando(false)
    onGuardado?.()
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal">
        <div className="modal-title">{bonoActual?'Cambiar bono':'Asignar bono'}<button className="modal-close" onClick={onCerrar}>✕</button></div>

        {/* El aviso va donde se toma la decisión: aquí, viendo ya el tipo
            elegido, y no después en la ficha cuando ya no hay vuelta atrás. */}
        {esDeSesiones(tipoElegido) ? (
          <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:10,color:'var(--gd)',lineHeight:1.6}}>
            Bono de <strong>{tipoElegido?.sesiones} sesiones</strong>
            {tipoElegido?.caduca_meses ? <>, válido <strong>{tipoElegido.caduca_meses} {tipoElegido.caduca_meses===1?'mes':'meses'}</strong> desde hoy</> : ', sin caducidad'}.
            {bonoActual && ' No sustituye a la cuota actual: se suma a ella.'} Las sesiones se descuentan solas al marcar las citas.
          </div>
        ) : bonoActual?.estado_pago === 'pagado' && (
          <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
            El bono actual está <strong>pagado</strong>. El que asignes ahora nace <strong>pendiente de cobro</strong>: lo cobrado corresponde al anterior y se queda con él.
          </div>
        )}

        <div className="field"><label>Tipo de bono</label>
          <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
            {bonosOpts.map(b=>(
              <option key={b.id} value={b.id}>{b.nombre} · {textoModalidad(b)}</option>
            ))}
          </select>
        </div>

        <div className="field"><label>Descuento (opcional) · se mantiene cada mes al renovar</label>
          <div style={{display:'flex',gap:6}}>
            <select className="input" style={{flex:'0 0 140px'}} value={form.descuento_tipo} onChange={e=>setForm(p=>({...p,descuento_tipo:e.target.value}))}>
              <option value="">Sin descuento</option>
              {TIPOS_DESCUENTO.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {form.descuento_tipo && (
              <input className="input" type="number" step="0.01" style={{flex:1}}
                placeholder={form.descuento_tipo==='porcentaje'?'ej. 10':form.descuento_tipo==='precio'?'ej. 55':'ej. 8'}
                value={form.descuento_valor} onChange={e=>setForm(p=>({...p,descuento_valor:e.target.value}))}/>
            )}
          </div>
          {form.descuento_tipo && (
            <div style={{fontSize:9,color:'var(--grl)',marginTop:5}}>
              {TIPOS_DESCUENTO.find(t=>t.id===form.descuento_tipo)?.ayuda}
              {form.descuento_tipo==='precio' && ' · Es lo que paga, sin céntimos raros.'}
            </div>
          )}
        </div>
        {form.descuento_tipo && (
          <div className="field"><label>Motivo del descuento (opcional)</label>
            <input className="input" placeholder="ej. familiar, promo, estudiante" value={form.descuento_motivo} onChange={e=>setForm(p=>({...p,descuento_motivo:e.target.value}))}/>
          </div>
        )}

        {error && (
          <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
            {error}
          </div>
        )}

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={guardar} disabled={guardando}>{guardando?'…':'✓ Guardar bono'}</button>
        </div>
      </div>
    </div>
  )
}
