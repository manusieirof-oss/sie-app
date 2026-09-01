'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { cargarBonosTipos, type BonoTipo } from '@/lib/bonos'
import { textoModalidad } from '@/lib/bonoSesiones'
import {
  citasDelGrupo, copiasDeLaPlantilla, planDeGrupo, aplicarPlanGrupo,
  mesesDe, mesActual, nombreMes, fechaCorta, ordinalTexto,
  type PlanGrupo,
} from '@/lib/programarGrupo'

/**
 * Programar una sesión a un grupo entero.
 *
 * Tres pasos en una pantalla, porque los tres se miran a la vez: a quién, qué sesión
 * del mes, y —lo importante— QUÉ VA A PASAR. La vista previa no es un adorno: escribir
 * en treinta agendas sin verlo antes es la clase de operación que no se puede deshacer
 * con un botón.
 *
 * Las reglas de qué cita recibe la sesión están en `lib/programarGrupo.ts`, no aquí.
 * Esta pantalla solo pregunta y enseña.
 */
export default function ModalProgramarGrupo({ plantilla, pacientes, onCerrar, onHecho }: {
  plantilla: any
  pacientes: any[]
  onCerrar: () => void
  onHecho: () => void
}) {
  // ---- A quién -----------------------------------------------------------
  const [tipos, setTipos] = useState<BonoTipo[]>([])
  /** paciente_id -> tipo de bono activo. */
  const [bonoDe, setBonoDe] = useState<Record<string, string>>({})
  const [filtroBono, setFiltroBono] = useState('')
  const [buscar, setBuscar] = useState('')
  const [sel, setSel] = useState<string[]>([])

  // ---- Qué sesiones del mes ---------------------------------------------
  const [ordinales, setOrdinales] = useState<number[]>([1])
  /**
   * HASTA QUÉ ORDINAL SE PUEDE ELEGIR.
   *
   * Estaba fijo en 8, que es lo que viene un bono reducido. Pero esencial son 12 al mes y
   * progreso 16, así que a partir de la octava clase no había forma de decir "esta": las
   * de la segunda mitad del mes quedaban fuera del alcance del modal.
   *
   * Sale de las citas que tienen de verdad los pacientes elegidos, no de una lista de
   * tipos de bono: si mañana aparece un bono de veinte, esto se adapta solo.
   */
  const [maxOrdinal, setMaxOrdinal] = useState(8)
  const [desde, setDesde] = useState(mesActual())
  const [meses, setMeses] = useState('4')

  // ---- Resultado ---------------------------------------------------------
  const [plan, setPlan] = useState<PlanGrupo | null>(null)
  const [copias, setCopias] = useState<Record<string, string>>({})
  const [calculando, setCalculando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [aviso, setAviso] = useState<{ txt: string, tipo: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    // Los tipos INACTIVOS también: un paciente puede seguir con un bono de un tipo que
    // ya no se vende, y si no está en la lista su filtro no existiría y desaparecería
    // de la selección sin que se vea por qué.
    cargarBonosTipos(false).then(setTipos)
    supabase.from('bonos').select('paciente_id,tipo').eq('activo', true).then(({ data }) => {
      const m: Record<string, string> = {}
      ;(data || []).forEach((b: any) => { if (b.paciente_id && !m[b.paciente_id]) m[b.paciente_id] = b.tipo })
      setBonoDe(m)
    })
  }, [])

  const nombreDe = (pid: string) => {
    const p = (pacientes || []).find((x: any) => x.id === pid)
    if (!p) return 'Paciente'
    return `${p.nombre || ''} ${p.apellidos || ''}`.trim() || p.nombre_clinica || 'Paciente'
  }
  const nombreBono = (id?: string) => tipos.find(t => t.id === id)?.nombre || id || 'Sin bono'

  const visibles = (pacientes || []).filter((p: any) => {
    if (filtroBono && (bonoDe[p.id] || '') !== filtroBono) return false
    if (!buscar) return true
    return `${p.nombre || ''} ${p.apellidos || ''} ${p.nombre_clinica || ''}`
      .toLowerCase().includes(buscar.toLowerCase())
  })

  const marcar = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const marcarVisibles = () => {
    const ids = visibles.map((p: any) => p.id)
    const faltan = ids.filter((id: string) => !sel.includes(id))
    setSel(faltan.length > 0 ? Array.from(new Set([...sel, ...ids])) : sel.filter(id => !ids.includes(id)))
  }
  const togglOrdinal = (n: number) =>
    setOrdinales(o => o.includes(n) ? o.filter(x => x !== n) : [...o, n].sort((a, b) => a - b))

  const nMeses = Math.max(1, Math.min(12, parseInt(meses) || 1))
  const listoParaCalcular = sel.length > 0 && ordinales.length > 0 && /^\d{4}-\d{2}$/.test(desde)

  /**
   * El plan se recalcula solo al cambiar cualquier cosa. Con un botón "ver plan" la
   * pantalla se queda enseñando el plan de la selección anterior, que es peor que no
   * enseñar nada: se aplica creyendo que es lo que se ve.
   */
  const tick = useRef(0)
  useEffect(() => {
    if (!listoParaCalcular) { setPlan(null); return }
    const mio = ++tick.current
    setCalculando(true)
    const t = setTimeout(async () => {
      const listaMeses = mesesDe(desde, nMeses)
      const [citas, cop] = await Promise.all([
        citasDelGrupo(sel, listaMeses),
        copiasDeLaPlantilla(plantilla.id, sel),
      ])
      if (mio !== tick.current) return   // llegó tarde: manda el cálculo más nuevo
      // El mayor número de citas que tiene un paciente en un mes: hasta ahí llegan los
      // ordinales que tiene sentido ofrecer.
      const porPacienteMes: Record<string, number> = {}
      citas.forEach((c: any) => {
        const k = `${c.paciente_id}|${c.fecha.slice(0, 7)}`
        porPacienteMes[k] = (porPacienteMes[k] || 0) + 1
      })
      const tope = Math.max(8, ...Object.values(porPacienteMes))
      setMaxOrdinal(Math.min(31, tope))
      setCopias(cop)
      setPlan(planDeGrupo(sel, citas, { ordinales, desde, meses: nMeses }, cop))
      setCalculando(false)
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.join(','), ordinales.join(','), desde, nMeses, plantilla?.id])

  async function aplicar() {
    if (!plan || plan.filas.length === 0) return
    setAplicando(true); setAviso(null)
    const r = await aplicarPlanGrupo(plantilla, plan, { ...copias })
    setAplicando(false)
    if (!r.ok) { setAviso({ txt: r.error, tipo: 'err' }); return }
    if (r.fallos.length > 0) {
      setAviso({ tipo: 'err', txt: `Programadas ${r.nCitas} citas, pero ${r.fallos.length} paciente(s) han fallado: `
        + r.fallos.map(f => `${nombreDe(f.pacienteId)} (${f.error})`).join(' · ') })
      return
    }
    setAviso({ tipo: 'ok', txt: `${r.nCitas} cita${r.nCitas > 1 ? 's' : ''} programada${r.nCitas > 1 ? 's' : ''} a ${r.nPacientes} paciente${r.nPacientes > 1 ? 's' : ''}`
      + (r.nCopias > 0 ? `, con ${r.nCopias} copia${r.nCopias > 1 ? 's' : ''} nueva${r.nCopias > 1 ? 's' : ''} de la sesión.` : '.') })
    onHecho()
  }

  // Pacientes que salen en el resumen: los que reciben algo o los que tienen algo que
  // avisar. Uno seleccionado del que no haya nada que decir no debería ocupar sitio.
  const conAlgo = sel.filter(pid =>
    (plan?.filas || []).some(f => f.pacienteId === pid) || (plan?.avisos || []).some(a => a.pacienteId === pid))

  const nCitas = plan?.filas.length || 0
  const nPac = new Set((plan?.filas || []).map(f => f.pacienteId)).size
  const nNuevas = sel.filter(pid => !copias[pid] && (plan?.filas || []).some(f => f.pacienteId === pid)).length

  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget && !aplicando) onCerrar() }}>
      <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '96vw', maxWidth: 940, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 4px 32px rgba(38,40,37,.15)' }}>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)' }}>
          <div style={{ fontSize: 14, color: 'var(--n)' }}>Programar &laquo;{plantilla.nombre}&raquo; a un grupo</div>
          <div style={{ fontSize: 12, color: 'var(--gr)', marginTop: 3, lineHeight: 1.5 }}>
            Cada paciente recibe una copia suya de la sesi&oacute;n. La plantilla no cambia.
            Solo se rellenan citas libres: lo que ya tenga sesi&oacute;n no se pisa.
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0,320px) minmax(0,1fr)', gap: 0 }}>

          {/* ---------- A QUIÉN ---------- */}
          <div style={{ borderRight: '1px solid var(--bd)', padding: 12, minWidth: 0 }}>
            <div className="et-mini" style={{ marginBottom: 6 }}>Pacientes · {sel.length} marcados</div>

            {/* El bono es lo que decide cuántos días viene cada uno, así que es el filtro
                que de verdad forma un grupo: "la 2ª del mes" solo significa lo mismo
                para todos dentro del mismo bono. */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              <button className={`chip-sel ${!filtroBono ? 'on' : ''}`} onClick={() => setFiltroBono('')}>Todos</button>
              {tipos.map(t => (
                <button key={t.id} className={`chip-sel ${filtroBono === t.id ? 'on' : ''}`}
                  title={textoModalidad(t)} onClick={() => setFiltroBono(t.id)}>
                  {t.nombre}
                </button>
              ))}
            </div>

            <input className="input" value={buscar} onChange={e => setBuscar(e.target.value)}
              placeholder="Buscar por nombre o apodo…" style={{ fontSize: 13, marginBottom: 6 }} />

            <button className="btn btn-s btn-sm" onClick={marcarVisibles} disabled={visibles.length === 0}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
              <Ic name="checkbox" size={12} /> Marcar los {visibles.length} de la lista
            </button>

            <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r)', maxHeight: 330, overflowY: 'auto' }}>
              {visibles.length === 0 && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--gr)' }}>
                  Ning&uacute;n paciente con ese filtro.
                </div>
              )}
              {visibles.map((p: any) => {
                const on = sel.includes(p.id)
                return (
                  <div key={p.id} onClick={() => marcar(p.id)}
                    style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--bl)', display: 'flex', alignItems: 'center', gap: 8, background: on ? 'var(--gl)' : 'transparent' }}>
                    <span style={{ color: on ? 'var(--g)' : 'var(--grl)', display: 'inline-flex' }}>
                      <Ic name={on ? 'check' : 'checkbox'} size={13} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.nombre} {p.apellidos}
                      {p.nombre_clinica && <span style={{ color: 'var(--gr)' }}> · “{p.nombre_clinica}”</span>}
                    </span>
                    <span className="badge badge-b">{nombreBono(bonoDe[p.id])}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ---------- QUÉ SESIONES Y QUÉ SALE ---------- */}
          <div style={{ padding: 12, minWidth: 0 }}>
            <div className="et-mini" style={{ marginBottom: 6 }}>Qu&eacute; sesiones del mes</div>
            {/* Se cuentan las CITAS del paciente dentro del mes, no días del calendario:
                la 2ª de abril es el día 3 para uno y el 7 para otro, y por eso la misma
                regla vale para treinta agendas distintas. */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
              {Array.from({ length: maxOrdinal }, (_, i) => i + 1).map(n => (
                <button key={n} className={`chip-sel ${ordinales.includes(n) ? 'on' : ''}`}
                  onClick={() => togglOrdinal(n)} title={`La ${ordinalTexto(n)} vez que venga ese mes`}>
                  {ordinalTexto(n)}
                </button>
              ))}
              {/* Con dieciséis clases al mes, marcarlas una a una son dieciséis clics para
                  lo más habitual: que toda su tanda lleve la misma sesión. */}
              <button className="chip-sel"
                onClick={() => setOrdinales(
                  ordinales.length === maxOrdinal
                    ? [1]
                    : Array.from({ length: maxOrdinal }, (_, i) => i + 1))}>
                {ordinales.length === maxOrdinal ? 'Ninguna' : 'Todas'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 10 }}>
              Se cuentan las citas de cada paciente dentro del mes. Las canceladas no cuentan.
              {' '}Llega hasta la {ordinalTexto(maxOrdinal)} porque es lo máximo que viene alguien
              de los elegidos.
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <div>
                <div className="et-mini" style={{ marginBottom: 4 }}>Desde el mes</div>
                <input className="input" type="month" value={desde} onChange={e => setDesde(e.target.value)} style={{ fontSize: 13 }} />
              </div>
              <div>
                <div className="et-mini" style={{ marginBottom: 4 }}>Cu&aacute;ntos meses</div>
                <input className="input" type="number" min={1} max={12} value={meses}
                  onChange={e => setMeses(e.target.value)} style={{ fontSize: 13, width: 90 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--gr)', paddingBottom: 7 }}>
                {mesesDe(desde, nMeses).map(nombreMes).join(' · ')}
              </div>
            </div>

            <div className="et-mini" style={{ marginBottom: 6 }}>Qu&eacute; va a pasar</div>

            {!listoParaCalcular ? (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--gr)', background: 'var(--bl)', borderRadius: 'var(--r)' }}>
                Marca al menos un paciente y una sesi&oacute;n del mes.
              </div>
            ) : calculando ? (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--gr)' }}>Calculando…</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 12, color: 'var(--gd)' }}>
                  <span className="badge badge-g">{nCitas} cita{nCitas === 1 ? '' : 's'}</span>
                  <span className="badge badge-g">{nPac} paciente{nPac === 1 ? '' : 's'}</span>
                  {nNuevas > 0 && <span className="badge badge-b">{nNuevas} copia{nNuevas === 1 ? '' : 's'} nueva{nNuevas === 1 ? '' : 's'} de la sesión</span>}
                  {(plan?.avisos.length || 0) > 0 && <span className="badge badge-pen">{plan!.avisos.length} sin programar</span>}
                </div>

                <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r)', maxHeight: 300, overflowY: 'auto' }}>
                  {conAlgo.length === 0 && (
                    <div style={{ padding: 12, fontSize: 12, color: 'var(--gr)' }}>
                      Nada que programar con esta regla.
                    </div>
                  )}
                  {conAlgo.map(pid => {
                    const suyas = (plan?.filas || []).filter(f => f.pacienteId === pid)
                    const sus = (plan?.avisos || []).filter(a => a.pacienteId === pid)
                    return (
                      <div key={pid} style={{ padding: '8px 10px', borderBottom: '1px solid var(--bl)' }}>
                        <div style={{ fontSize: 13, color: 'var(--n)', marginBottom: 4 }}>
                          {nombreDe(pid)}
                          {!copias[pid] && suyas.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--gr)' }}> · se le crea la copia</span>
                          )}
                        </div>
                        {suyas.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: sus.length > 0 ? 5 : 0 }}>
                            {suyas.map(f => (
                              <span key={f.citaId} className="badge badge-g" title={`${ordinalTexto(f.ordinal)} sesión de ${nombreMes(f.mes)}`}>
                                {fechaCorta(f.fecha)}{f.hora ? ` · ${String(f.hora).slice(0, 5)}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Lo que NO se programa sale por su nombre. "24 de 30" sin decir
                            quiénes son los seis se lee como que ha ido bien. */}
                        {sus.map((a, i) => (
                          <div key={i} style={{ fontSize: 11, color: a.motivo === 'ya_puesta' ? 'var(--gr)' : '#8A6410', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Ic name={a.motivo === 'ya_puesta' ? 'ok' : 'alerta'} size={10} /> {a.texto}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {aviso && (
              <div style={{ marginTop: 10, fontSize: 12, borderRadius: 'var(--r)', padding: '8px 11px',
                background: aviso.tipo === 'ok' ? 'var(--gl)' : 'var(--redl)',
                color: aviso.tipo === 'ok' ? 'var(--gd)' : 'var(--red)' }}>
                {aviso.txt}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--gr)' }}>
            Se puede volver a pasar cuando quieras: como solo rellena huecos, la segunda
            vez le pone la sesi&oacute;n al que la haya perdido y no toca a nadie m&aacute;s.
          </div>
          <button className="btn btn-t btn-sm" onClick={onCerrar} disabled={aplicando}>Cerrar</button>
          <button className="btn btn-p btn-sm" onClick={aplicar} disabled={aplicando || calculando || nCitas === 0}>
            {aplicando ? 'Programando…' : `Programar ${nCitas} cita${nCitas === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
