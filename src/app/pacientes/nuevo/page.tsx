'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NuevoPacientePage() {
  
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', apellidos: '', dni: '', fecha_nacimiento: '',
    telefono: '', email: '', altura_cm: '', peso_kg: '',
    como_nos_conocio: 'Recomendación', tipo_clase: 'entrenamiento', notas: ''
  })
  const [bono, setBono] = useState({ tipo: 'esencial', estado_pago: 'pendiente' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre || !form.apellidos) { setError('Nombre y apellidos son obligatorios'); return }
    setSaving(true)
    setError('')
    const dias = { reducido: 2, esencial: 3, progreso: 4, avanzado: 5, individual: 1, bono4: 1 }
    const { data: pat, error: err } = await supabase.from('pacientes').insert({
      nombre: form.nombre, apellidos: form.apellidos, dni: form.dni || null,
      fecha_nacimiento: form.fecha_nacimiento || null, telefono: form.telefono || null,
      email: form.email || null, altura_cm: form.altura_cm ? parseInt(form.altura_cm) : null,
      peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
      como_nos_conocio: form.como_nos_conocio, tipo_clase: form.tipo_clase,
      notas: form.notas || null
    }).select().single()
    if (err || !pat) { setError('Error al guardar: ' + err?.message); setSaving(false); return }
    await supabase.from('bonos').insert({
      paciente_id: pat.id, tipo: bono.tipo,
      dias_semana: dias[bono.tipo as keyof typeof dias],
      estado_pago: bono.estado_pago, activo: true,
      mes: new Date().getMonth() + 1, anio: new Date().getFullYear(),
      fecha_inicio: new Date().toISOString().split('T')[0]
    })
    router.push(`/pacientes/${pat.id}`)
  }

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Nuevo paciente</span>
        <span className="topbar-sep" />
        <span className="topbar-sub">Registro inicial</span>
        <div className="topbar-right">
          <button className="btn btn-s btn-sm" onClick={() => router.back()}>← Cancelar</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="flash flash-err">{error}</div>}
        <form onSubmit={guardar}>
          <div className="g2">
            <div>
              <div className="card">
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--grl)', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 12 }}>Datos personales</div>
                <div className="g2">
                  <div className="field"><label>Nombre *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre" required /></div>
                  <div className="field"><label>Apellidos *</label><input value={form.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Apellidos" required /></div>
                  <div className="field"><label>DNI</label><input value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="12345678A" /></div>
                  <div className="field"><label>F. Nacimiento</label><input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} /></div>
                  <div className="field"><label>Teléfono</label><input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+34 600 000 000" /></div>
                  <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@email.com" /></div>
                  <div className="field"><label>Altura (cm)</label><input type="number" value={form.altura_cm} onChange={e => set('altura_cm', e.target.value)} placeholder="170" /></div>
                  <div className="field"><label>Peso (kg)</label><input type="number" step="0.1" value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} placeholder="70" /></div>
                </div>
                <div className="field"><label>¿Cómo nos conoció?</label>
                  <select value={form.como_nos_conocio} onChange={e => set('como_nos_conocio', e.target.value)}>
                    <option>Recomendación</option><option>Redes sociales</option><option>Google</option><option>Pasó por la clínica</option><option>Médico</option><option>Otro</option>
                  </select>
                </div>
                <div className="field"><label>Notas iniciales</label><textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Observaciones..." /></div>
              </div>
            </div>
            <div>
              <div className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--grl)', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 12 }}>Tipo de clase</div>
                {[['entrenamiento','🏋 Entrenamiento','Fuerza, funcional'],['pilates','🧘 Pilates','Control motor'],['rehabilitacion','🏥 Rehabilitación','Recuperación']].map(([v,l,d]) => (
                  <div key={v} onClick={() => set('tipo_clase', v)}
                    style={{ border: `1.5px solid ${form.tipo_clase === v ? 'var(--g)' : 'var(--bd)'}`, background: form.tipo_clase === v ? 'var(--gl)' : 'var(--w)', borderRadius: 7, padding: '9px 12px', cursor: 'pointer', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{l.split(' ')[0]}</span>
                    <div><div style={{ fontSize: 11, fontWeight: 400, color: 'var(--n)' }}>{l.split(' ').slice(1).join(' ')}</div><div style={{ fontSize: 9, color: 'var(--grl)' }}>{d}</div></div>
                    {form.tipo_clase === v && <div style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%', background: 'var(--g)', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>}
                  </div>
                ))}
              </div>
              <div className="card">
                <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--grl)', letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: 12 }}>Bono</div>
                {[['reducido','Reducido','2 días/semana'],['esencial','Esencial','3 días/semana'],['progreso','Progreso','4 días/semana'],['avanzado','Avanzado','5 días/semana'],['individual','Individual','Sesiones sueltas'],['bono4','Bono 4 sesiones','4 sesiones']].map(([v,l,d]) => (
                  <div key={v} onClick={() => setBono(b => ({ ...b, tipo: v }))}
                    style={{ border: `1.5px solid ${bono.tipo === v ? 'var(--g)' : 'var(--bd)'}`, background: bono.tipo === v ? 'var(--gl)' : 'var(--w)', borderRadius: 6, padding: '8px 11px', cursor: 'pointer', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 11, fontWeight: 400, color: 'var(--n)' }}>{l}</div><div style={{ fontSize: 9, color: 'var(--grl)' }}>{d}</div></div>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${bono.tipo === v ? 'var(--g)' : 'var(--bd)'}`, background: bono.tipo === v ? 'var(--g)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{bono.tipo === v ? '✓' : ''}</div>
                  </div>
                ))}
                <div className="field" style={{ marginTop: 10 }}>
                  <label>Estado de pago inicial</label>
                  <select value={bono.estado_pago} onChange={e => setBono(b => ({ ...b, estado_pago: e.target.value }))}>
                    <option value="pendiente">⏳ Pendiente</option>
                    <option value="pagado">✓ Pagado</option>
                    <option value="impago">⚠ Impago</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-p" style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: 13 }} disabled={saving}>
                {saving ? 'Guardando...' : '✓ Crear paciente'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
