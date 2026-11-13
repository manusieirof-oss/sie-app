'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { llamarVald } from '@/lib/vald'

/**
 * REGISTRAR EN VALD DESDE LA VALORACIÓN. El DynaMo se pasa en mitad de la valoración, y el
 * alta en VALD solo se hacía al guardarla: había que crear el perfil a mano en la app de
 * VALD, con el nombre escrito a ojo, y luego no casaba con la ficha.
 *
 * Paciente nuevo: se reserva ya el id que tendrá en SIE (form.id_previo) y VALD lo recibe
 * como syncId, así que al guardar queda enlazado solo. Revaloración: el de siempre.
 */
/** Lo que falta en el formulario para poder darlo de alta en VALD (paciente nuevo). */
export const faltanParaVald = (form: any): string[] => [
  !form.nombre && 'nombre', !form.apellidos && 'apellidos',
  !form.fecha_nacimiento && 'fecha de nacimiento', !form.sexo && 'género',
].filter(Boolean) as string[]

/** Alta en VALD con los datos del formulario y el id reservado que tendrá en SIE. */
export async function altaValdDesdeForm(form: any, up: (k: string, v: any) => void) {
  // El que viene de «pendiente» ya tiene ficha: se usa su id. El nuevo reserva uno.
  const id = form.paciente_id || form.id_previo || crypto.randomUUID()
  if (!form.paciente_id && !form.id_previo) up('id_previo', id)
  const r = await llamarVald('crear', { datos: { id, nombre: form.nombre, apellidos: form.apellidos,
    fecha_nacimiento: form.fecha_nacimiento, sexo: form.sexo, email: form.email || null } })
  if (r.profileId) up('vald_profile_id', r.profileId)
  return r.profileId as string | undefined
}

export default function RegistrarVald({ form, up }: { form: any, up: (k: string, v: any) => void }) {
  const [enlazado, setEnlazado] = useState<boolean>(!!form.vald_profile_id)
  const [estado, setEstado] = useState<'' | 'enviando' | 'error'>('')
  const [msg, setMsg] = useState('')

  // Revaloración: ¿ya está enlazado en su ficha?
  useEffect(() => {
    if (!form.paciente_id) { setEnlazado(!!form.vald_profile_id); return }
    supabase.from('pacientes').select('vald_profile_id').eq('id', form.paciente_id).maybeSingle()
      .then(({ data }) => setEnlazado(!!data?.vald_profile_id))
  }, [form.paciente_id, form.vald_profile_id])

  const faltan = form.paciente_id && !form.desde_pendiente ? [] : faltanParaVald(form)

  async function registrar() {
    setEstado('enviando'); setMsg('')
    try {
      if (form.paciente_id && !form.desde_pendiente) {
        await llamarVald('crear', { pacienteId: form.paciente_id })
      } else {
        await altaValdDesdeForm(form, up)
      }
      setEnlazado(true); setEstado('')
    } catch (e: any) { setEstado('error'); setMsg(e?.message || 'No se ha podido') }
  }

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 14px' }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13.5, color: 'var(--n)', fontWeight: 500 }}>VALD · DynaMo</div>
        <div style={{ fontSize: 12, color: estado === 'error' ? 'var(--red)' : 'var(--grl)' }}>
          {enlazado ? 'Ya está en VALD: búscalo por su nombre en la app de DynaMo.'
            : estado === 'error' ? msg
            : faltan.length ? `Para registrarlo falta: ${faltan.join(', ')} (en el paso Paciente).`
            : 'Regístralo antes de pasarle el DynaMo, así sus resultados llegan a su ficha.'}
        </div>
      </div>
      {enlazado
        ? <span className="chip-sel on" style={{ cursor: 'default' }}>✓ En VALD</span>
        : <button type="button" className="btn btn-s btn-sm" disabled={faltan.length > 0 || estado === 'enviando'} onClick={registrar}>
            {estado === 'enviando' ? 'Registrando…' : 'Registrar en VALD'}</button>}
    </div>
  )
}
