'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { supabase } from '@/lib/supabase'
import { duplicarSesion } from '@/lib/sesiones'
import { hoyISO } from '@/lib/fechas'
import { cargarSistemas, asignarSistema, quitarSistema, marcarPrincipal,
         faseEn, tramos, Sistema, Asignacion } from '@/lib/sistemas'

// ---------------------------------------------------------------------------
// QUÉ SISTEMAS LLEVA HOY ESTE PACIENTE
//
// Pueden ser varios a la vez y cada uno corre a su ritmo: un embarazo va por
// semanas y un hombro por objetivos, sin saber nada el uno del otro. El MARCO
// —el que tiene las fechas inamovibles— es el que pinta las citas; los demás
// van por debajo. Por eso se marca a mano: automático se equivoca en cuanto
// alguien lleve dos por tiempo.
// ---------------------------------------------------------------------------

export default function SistemasPaciente({ pacienteId, asignaciones, logrados, onCambio, onRecargar }: {
  pacienteId: string
  asignaciones: Asignacion[]
  logrados: Record<string, string | null>
  onCambio: () => void
  onRecargar?: () => void
}) {
  const [trayendo, setTrayendo] = useState('')
  const [anadiendo, setAnadiendo] = useState(false)
  const [catalogo, setCatalogo] = useState<Sistema[]>([])
  const [sel, setSel] = useState('')
  const [ini, setIni] = useState(hoyISO())
  const [fin, setFin] = useState('')
  const hoy = hoyISO()

  useEffect(() => { if (anadiendo && catalogo.length === 0) cargarSistemas(true).then(setCatalogo) }, [anadiendo])

  const elegido = catalogo.find(s => s.id === sel)
  const pideFin = elegido?.progresion === 'fecha_fin'

  async function anadir() {
    if (!sel) return
    const r = await asignarSistema(pacienteId, sel, { fecha_inicio: ini || null, fecha_fin: fin || null })
    if (!r.ok) { alert(r.error); return }
    setAnadiendo(false); setSel(''); setFin(''); onCambio()
  }

  /**
   * Las sesiones de la fase se COPIAN a la ficha, igual que cualquier plantilla: a
   * partir de ahí son suyas. `plantilla_id` deja reconocer las que ya tiene, para que
   * volver a pulsar no le monte una segunda copia de lo mismo.
   */
  async function traer(faseId: string, ids: string[]) {
    if (ids.length === 0) return
    setTrayendo(faseId)
    const { data: yaTiene } = await supabase.from('sesiones')
      .select('plantilla_id').eq('paciente_id', pacienteId).in('plantilla_id', ids)
    const puestas = new Set((yaTiene || []).map((x: any) => x.plantilla_id))
    const faltan = ids.filter(id => !puestas.has(id))
    if (faltan.length === 0) { setTrayendo(''); alert('Ya las tiene todas.'); return }
    const { data: plantillas } = await supabase.from('sesiones').select('*').in('id', faltan)
    let n = 0
    for (const pl of plantillas || []) {
      const r = await duplicarSesion(pl, pacienteId, { sufijo: '', plantillaId: pl.id,
        motivo: 'Desde el sistema' })
      if (r.ok) n++
    }
    setTrayendo('')
    onRecargar?.()
    alert(`${n} sesión${n === 1 ? '' : 'es'} a la ficha. Ya puedes asignarlas a sus citas.`)
  }

  async function quitar(a: Asignacion) {
    if (!confirm(`¿Quitar «${a.sistema?.nombre}»? Las citas que ya pasaron siguen contando.`)) return
    await quitarSistema(a.id); onCambio()
  }

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="sh-l"><span className="ct-l"><Ic name="objetivo" size={13}/> Sistemas</span></span>
        <button className="btn btn-s btn-sm" onClick={() => setAnadiendo(v => !v)}>
          {anadiendo ? 'Cancelar' : '+ Añadir'}
        </button>
      </div>

      {anadiendo && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <select className="inp" style={{ maxWidth: 230 }} value={sel} onChange={e => setSel(e.target.value)}>
            <option value="">Elige un sistema…</option>
            {catalogo.filter(s => !asignaciones.some(a => a.sistema_id === s.id))
              .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--gr)' }}>desde</span>
          <input className="inp" style={{ width: 145 }} type="date" value={ini} onChange={e => setIni(e.target.value)}/>
          {pideFin && (
            <>
              <span style={{ fontSize: 11, color: 'var(--gr)' }}>hasta</span>
              <input className="inp" style={{ width: 145 }} type="date" value={fin} onChange={e => setFin(e.target.value)}/>
            </>
          )}
          <button className="btn btn-p btn-sm" onClick={anadir} disabled={!sel || (pideFin && !fin)}>Añadir</button>
        </div>
      )}

      {asignaciones.length === 0 && !anadiendo && (
        <div className="muted">Sin sistema. Sus citas se ven como hasta ahora.</div>
      )}

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {asignaciones.map(a => {
          const s = a.sistema
          if (!s) return null
          const t = faseEn(s, a, hoy, logrados)
          const todas = tramos(s, a)
          const i = t ? (s.fases || []).findIndex(f => f.id === t.fase.id) : -1
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--w)',
              border: '1px solid var(--bd)', borderLeft: `4px solid ${s.color}`, borderRadius: 7,
              padding: '7px 11px 7px 9px', minWidth: 215 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: s.color, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {s.icono ? <Ic name={s.icono} size={12}/> : null}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--n)' }}>{s.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--gr)' }}>
                  {t ? `${t.fase.nombre}${i >= 0 && (s.fases||[]).length > 1 ? ` · ${i + 1} de ${(s.fases||[]).length}` : ''}`
                     : (todas.length === 0 && s.progresion !== 'objetivos' ? 'Le faltan fechas' : 'Fuera de fase')}
                </div>
              </div>
              {t && (t.fase.sesiones || []).length > 0 && (
                <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  title="Copia a su ficha las sesiones que propone esta fase"
                  disabled={trayendo === t.fase.id}
                  onClick={() => traer(t.fase.id, t.fase.sesiones || [])}>
                  {trayendo === t.fase.id ? '…' : `traer ${(t.fase.sesiones || []).length}`}
                </button>
              )}
              {a.principal
                ? <span className="pill pill-o on" style={{ flexShrink: 0 }} title="Marca el color de las citas">marco</span>
                : <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer', flexShrink: 0 }}
                    title="Hacer que sea este el que pinta las citas"
                    onClick={() => marcarPrincipal(pacienteId, a.id).then(onCambio)}>hacer marco</button>}
              <button className="btn btn-s btn-sm" title="Quitar" onClick={() => quitar(a)}>✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
