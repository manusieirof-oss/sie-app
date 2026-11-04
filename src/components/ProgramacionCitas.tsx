'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { MOTIVOS_CAMBIO } from '@/lib/cambioSesion'
import { rutaDeAsignacion } from '@/lib/asignarCita'
import { ponerEnCita, intercambiarCitas, type CitaProg } from '@/lib/cambiarCita'

// ---------------------------------------------------------------------------
// PROGRAMACIÓN: las próximas citas de un paciente con su sesión, para cambiarlas
// sin salir de donde estás. La misma pieza en la agenda (pestaña "Programación"
// del entreno) y en la ficha (Planificación → "Cambiar").
//
//   · Arrastrar la sesión de una cita encima de otra las INTERCAMBIA. En tablet,
//     donde arrastrar falla, vale tocar una y luego la otra.
//   · "Cambiar" en una cita: por otra de sus sesiones, de la biblioteca (vas y
//     vuelves con ella puesta) o abrir el calendario completo.
//
// Siempre se pide el motivo antes, como en el taller. Las de candado avisan.
// ---------------------------------------------------------------------------

type Cita = CitaProg & { hora: string | null, fija: boolean }
type Pendiente =
  | { tipo: 'poner', cita: Cita, ses: { id: string, nombre: string } }
  | { tipo: 'cambiar', a: Cita, b: Cita }
  | { tipo: 'biblio' | 'calendario', cita: Cita }

const fechaTxt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

export default function ProgramacionCitas({ pacienteId, citaFoco, volver, etiqueta, limite = 10, onCambio }: {
  pacienteId: string
  /** La cita desde la que se viene (la de hoy en la agenda): sale marcada. */
  citaFoco?: string
  /** A dónde volver desde la biblioteca o el calendario. */
  volver: string
  /** Nombre del paciente, para los avisos de la biblioteca y el calendario. */
  etiqueta: string
  limite?: number
  onCambio?: () => void
}) {
  const router = useRouter()
  const [citas, setCitas] = useState<Cita[]>([])
  const [suyas, setSuyas] = useState<{ id: string, nombre: string }[]>([])
  const [cargando, setCargando] = useState(true)
  const [cogida, setCogida] = useState<string | null>(null)   // tocar-y-tocar en tablet
  const [sobre, setSobre] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [pend, setPend] = useState<Pendiente | null>(null)
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    const [{ data: cs, error: ec }, { data: ss }] = await Promise.all([
      // `sesiones:sesion_id`: citas tiene más de un enlace a sesiones y sin decir cuál la
      // consulta fallaba entera (y salía "sin citas"). La de hoy cuenta aunque ya esté
      // realizada; las canceladas y las faltas no.
      supabase.from('citas').select('id,fecha,hora,sesion_id,tipo,sesiones:sesion_id(nombre,fija)')
        .eq('paciente_id', pacienteId).gte('fecha', hoyISO()).not('estado', 'in', '(cancelada,falta)').order('fecha').order('hora').limit(limite),
      supabase.from('sesiones').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
    ])
    if (ec) setError(ec.message)
    setCitas((cs || []).filter((c: any) => !/valora/i.test(c.tipo || '')).map((c: any) => {
      const s = Array.isArray(c.sesiones) ? c.sesiones[0] : c.sesiones
      return { id: c.id, fecha: c.fecha, hora: c.hora, sesion_id: c.sesion_id, sesNombre: s?.nombre || null, fija: !!s?.fija }
    }))
    setSuyas((ss || []).filter((x: any) => !x.finalizada_en).map((x: any) => ({ id: x.id, nombre: x.nombre })))
    setCargando(false)
  }
  useEffect(() => { cargar() }, [pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  function pedirIntercambio(aId: string, bId: string) {
    setCogida(null); setSobre(null)
    if (aId === bId) return
    const a = citas.find(c => c.id === aId), b = citas.find(c => c.id === bId)
    if (!a || !b || a.sesion_id === b.sesion_id) return
    if ((a.fija || b.fija) && !confirm('Una de las dos lleva una sesión con candado (fuerza). ¿Intercambiarlas igualmente?')) return
    abrir({ tipo: 'cambiar', a, b })
  }
  function abrir(p: Pendiente) { setMenu(null); setMotivo(''); setNota(''); setPend(p) }

  async function confirmar() {
    if (!pend || !motivo) return
    const m = { motivo, nota }
    const enc = (c: Cita) => ({ pacienteId, citaId: c.id, etiqueta, volver,
      antesId: c.sesion_id || undefined, antesNombre: c.sesNombre || undefined, motivo, nota: nota || undefined })
    if (pend.tipo === 'biblio') { router.push(rutaDeAsignacion('biblioteca', enc(pend.cita))); return }
    if (pend.tipo === 'calendario') { router.push(rutaDeAsignacion('ficha', enc(pend.cita))); return }
    setGuardando(true)
    const p = pend
    const r = p.tipo === 'poner' ? await ponerEnCita(pacienteId, p.cita, p.ses, m)
      : p.tipo === 'cambiar' ? await intercambiarCitas(pacienteId, p.a, p.b, m)
      : { ok: true as const, aviso: undefined }
    setGuardando(false)
    if (!r.ok) { alert('No se ha podido cambiar: ' + r.error); return }
    if (r.aviso) alert('El cambio está hecho, pero no se ha podido apuntar el motivo:\n\n' + r.aviso)
    setPend(null)
    await cargar()
    onCambio?.()
  }

  if (cargando) return <div style={{ fontSize: 11, color: 'var(--grl)', padding: 12 }}>Cargando…</div>
  // Un fallo de la consulta no puede parecer "no tiene citas": se dice.
  if (error) return <div style={{ fontSize: 11, color: 'var(--red)', padding: 12 }}>No se han podido leer sus citas: {error}</div>
  if (!citas.length) return <div style={{ fontSize: 11, color: 'var(--grl)', padding: 12 }}>Sin citas por delante.</div>

  const titulo = pend?.tipo === 'cambiar' ? `Intercambiar ${fechaTxt(pend.a.fecha)} y ${fechaTxt(pend.b.fecha)}`
    : pend?.tipo === 'poner' ? `${fechaTxt(pend.cita.fecha)}: poner «${pend.ses.nombre}»`
    : pend?.tipo === 'biblio' ? `${fechaTxt(pend.cita.fecha)}: traer de la biblioteca`
    : pend ? `${fechaTxt(pend.cita.fecha)}: abrir el calendario` : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 10, color: 'var(--grl)', lineHeight: 1.4 }}>
        Arrastra una sesión encima de otra cita para intercambiarlas (en tablet: toca una y luego la otra).
      </div>

      {pend && (
        <div style={{ border: '1px solid var(--gm)', background: 'var(--gl)', borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--n)', marginBottom: 6 }}>{titulo}</div>
          <div style={{ fontSize: 10.5, color: 'var(--gr)', marginBottom: 5 }}>¿Por qué se cambia?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {MOTIVOS_CAMBIO.map(mo => (
              <button key={mo.id} type="button" title={mo.ayuda} onClick={() => setMotivo(mo.id)}
                className={`chip-sel ${motivo === mo.id ? 'on' : ''}`} style={{ fontSize: 10.5 }}>{mo.nombre}</button>
            ))}
          </div>
          <input className="input" placeholder="Nota (opcional)" value={nota} onChange={e => setNota(e.target.value)} style={{ marginBottom: 6 }}/>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-t btn-sm" onClick={() => setPend(null)}>Cancelar</button>
            <button className="btn btn-p btn-sm" disabled={!motivo || guardando} onClick={confirmar}>
              {guardando ? 'Guardando…' : pend.tipo === 'biblio' ? 'Ir a la biblioteca' : pend.tipo === 'calendario' ? 'Abrir calendario' : 'Cambiar'}
            </button>
          </div>
        </div>
      )}

      {citas.map(c => {
        const foco = c.id === citaFoco
        const marcada = cogida === c.id || sobre === c.id
        return (
          <div key={c.id}
            onDragOver={e => { e.preventDefault(); if (sobre !== c.id) setSobre(c.id) }}
            onDragLeave={() => { if (sobre === c.id) setSobre(null) }}
            onDrop={e => { e.preventDefault(); const de = e.dataTransfer.getData('text/plain'); if (de) pedirIntercambio(de, c.id) }}
            onClick={() => { if (cogida && cogida !== c.id) pedirIntercambio(cogida, c.id) }}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9,
              border: `1.5px solid ${marcada ? 'var(--gd)' : foco ? 'var(--g)' : 'var(--bd)'}`, background: foco ? 'var(--gl)' : 'var(--w)' }}>
            <div style={{ width: 74, flexShrink: 0, fontSize: 11, color: foco ? 'var(--gd)' : 'var(--gr)', fontWeight: foco ? 600 : 400 }}>
              {foco ? 'Hoy · ' : ''}{fechaTxt(c.fecha)}<div style={{ fontSize: 10, color: 'var(--grl)' }}>{c.hora ? String(c.hora).slice(0, 5) : ''}</div>
            </div>
            <span draggable={!!c.sesion_id}
              onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move' }}
              onClick={e => { e.stopPropagation(); if (cogida && cogida !== c.id) { pedirIntercambio(cogida, c.id); return } if (c.sesion_id) setCogida(cogida === c.id ? null : c.id) }}
              title={c.sesion_id ? 'Arrastra encima de otra cita, o tócala y luego toca la otra' : undefined}
              style={{ flex: 1, minWidth: 0, fontSize: 11.5, padding: '4px 8px', borderRadius: 7, cursor: c.sesion_id ? 'grab' : 'default',
                background: c.sesion_id ? (cogida === c.id ? 'var(--gd)' : 'var(--g)') : 'transparent', color: c.sesion_id ? '#fff' : 'var(--grl)',
                border: c.sesion_id ? 'none' : '1px dashed var(--bd)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.fija && <span title="Con candado">🔒 </span>}{c.sesNombre || 'Sin sesión'}
            </span>
            <button type="button" className="btn btn-s btn-sm" onClick={e => { e.stopPropagation(); setMenu(menu === c.id ? null : c.id) }}>Cambiar</button>
            {menu === c.id && (
              <div onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', right: 6, top: 'calc(100% + 4px)', zIndex: 20, width: 230, background: '#fff', border: '1px solid var(--bd)',
                  borderRadius: 10, boxShadow: '0 10px 28px rgba(38,40,37,.16)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--grl)' }}>Por otra de sus sesiones</div>
                {suyas.filter(s => s.id !== c.sesion_id).map(s => (
                  <button key={s.id} type="button" onClick={() => abrir({ tipo: 'poner', cita: c, ses: s })}
                    style={{ textAlign: 'left', border: 0, background: 'var(--bl)', borderRadius: 6, padding: '5px 7px', font: 'inherit', fontSize: 11.5, cursor: 'pointer' }}>{s.nombre}</button>
                ))}
                <div style={{ borderTop: '1px solid var(--bd2)', margin: '3px 0' }}/>
                <button type="button" className="btn btn-s btn-sm" onClick={() => abrir({ tipo: 'biblio', cita: c })}><Ic name="biblioteca" size={12}/> De la biblioteca</button>
                <button type="button" className="btn btn-s btn-sm" onClick={() => abrir({ tipo: 'calendario', cita: c })}><Ic name="calendario" size={12}/> Calendario completo</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
