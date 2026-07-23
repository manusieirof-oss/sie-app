'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BonoTipo } from '@/lib/bonos'

export default function ModalBono({ pacienteId, bonoActual, bonosOpts, onCerrar, onGuardado }: {
  pacienteId: string
  bonoActual: any
  bonosOpts: BonoTipo[]
  onCerrar: () => void
  onGuardado?: () => void
}) {
  const [form, setForm] = useState({
    tipo: bonoActual?.tipo || (bonosOpts[0]?.id || ''),
    estado_pago: bonoActual?.estado_pago || 'pendiente',
    descuento_tipo: bonoActual?.descuento_tipo || '',
    descuento_valor: bonoActual?.descuento_valor ? String(bonoActual.descuento_valor) : '',
    descuento_motivo: bonoActual?.descuento_motivo || '',
  })
  const [guardando, setGuardando] = useState(false)

  const LBL_BONO: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))
  const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }

  async function guardar() {
    if (!form.tipo) return
    setGuardando(true)
    const hoy = new Date()
    const mes = hoy.getMonth()+1, anio = hoy.getFullYear()
    const diasSemana = bonosOpts.find(b=>b.id===form.tipo)?.dias_semana || 1
    const descTipo = form.descuento_tipo || null
    const descValor = descTipo ? (parseFloat(form.descuento_valor) || 0) : 0

    if (bonoActual) await supabase.from('bonos').update({ activo:false }).eq('id', bonoActual.id)
    await supabase.from('bonos').insert({
      paciente_id: pacienteId, tipo: form.tipo, dias_semana: diasSemana,
      estado_pago: form.estado_pago, mes, anio,
      fecha_inicio: new Date().toISOString().split('T')[0], activo: true,
      descuento_tipo: descTipo, descuento_valor: descValor,
      descuento_motivo: descTipo ? (form.descuento_motivo || null) : null,
    })
    const txtDesc = descTipo ? ` · Descuento: ${descTipo==='porcentaje'?descValor+'%':descValor+'€'}${form.descuento_motivo?' ('+form.descuento_motivo+')':''}` : ''
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId, tipo: 'cambio_bono',
      titulo: `Bono asignado: ${LBL_BONO[form.tipo]||form.tipo}`,
      descripcion: `Estado de pago: ${LBL_PAGO[form.estado_pago]||form.estado_pago}${txtDesc}`,
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

        <div className="field"><label>Tipo de bono</label>
          <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
            {bonosOpts.map(b=>(
              <option key={b.id} value={b.id}>{b.nombre}{b.descripcion?` · ${b.descripcion}`:''}</option>
            ))}
          </select>
        </div>

        <div className="field"><label>Estado de pago</label>
          <select className="input" value={form.estado_pago} onChange={e=>setForm(p=>({...p,estado_pago:e.target.value}))}>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="impago">Impago</option>
          </select>
        </div>

        <div className="field"><label>Descuento (opcional)</label>
          <div style={{display:'flex',gap:6}}>
            <select className="input" style={{flex:'0 0 110px'}} value={form.descuento_tipo} onChange={e=>setForm(p=>({...p,descuento_tipo:e.target.value}))}>
              <option value="">Sin descuento</option>
              <option value="porcentaje">% Porcentaje</option>
              <option value="fijo">€ Importe fijo</option>
            </select>
            {form.descuento_tipo && (
              <input className="input" type="number" style={{flex:1}} placeholder={form.descuento_tipo==='porcentaje'?'ej. 10':'ej. 15'} value={form.descuento_valor} onChange={e=>setForm(p=>({...p,descuento_valor:e.target.value}))}/>
            )}
          </div>
        </div>
        {form.descuento_tipo && (
          <div className="field"><label>Motivo del descuento (opcional)</label>
            <input className="input" placeholder="ej. familiar, promo, estudiante" value={form.descuento_motivo} onChange={e=>setForm(p=>({...p,descuento_motivo:e.target.value}))}/>
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
