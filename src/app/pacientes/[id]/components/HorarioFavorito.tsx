'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { horasDeAgenda } from '@/lib/generarHoras'
import { parseTiposClase } from '@/lib/tipos'
import { DIAS_SEMANA, planDeFechas, finDePeriodo, crearCitasPlan } from '@/lib/citas'
import { horarioDe, nombreDia, ocupacionEnFechas, type Hueco } from '@/lib/horarioFavorito'

// ---------------------------------------------------------------------------
// SU HORARIO, en la ficha. Los días y horas a los que viene de verdad (ver
// lib/horarioFavorito) y, desde aquí, volver a agendarle con ellos.
//
// Al agendar se mira la plaza de cada hueco en las fechas que tocan. Si uno no le
// cabe, se cambia solo el día, solo la hora o los dos, y el resto se mantiene. Las
// fechas en que la clase ya está llena se saltan (no se sobrecarga una sala) y se
// dice cuántas.
// ---------------------------------------------------------------------------

type Fila = { dia: number, hora: string, sala: string }
type Ocup = { total: number, llenas: string[] } | null

export default function HorarioFavorito({ pacienteId, tipoClase, onCreadas }: { pacienteId: string, tipoClase?: string | null, onCreadas?: () => void }) {
  const [h, setH] = useState<Awaited<ReturnType<typeof horarioDe>> | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [desde, setDesde] = useState(hoyISO())
  const [hasta, setHasta] = useState(finDePeriodo(hoyISO(), '3meses'))
  const [ocup, setOcup] = useState<Ocup[]>([])
  const [conf, setConf] = useState<{ horas: string[], salas: string[], max: number, duracion: number }>({ horas: [], salas: ['A', 'B'], max: 6, duracion: 50 })
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    horarioDe(pacienteId).then(setH)
    supabase.from('ajustes').select('clave,valor').then(({ data }) => {
      const m: Record<string, string> = {}; (data || []).forEach((a: any) => { m[a.clave] = a.valor || '' })
      let salas = ['A', 'B']; try { const s = JSON.parse(m.clinica_salas || ''); if (Array.isArray(s) && s.length) salas = s } catch {}
      const tipos = parseTiposClase(m.tipos_clase)
      setConf({ horas: horasDeAgenda(m), salas, max: parseInt(m.clinica_max_personas_sala || '6') || 6,
        duracion: (tipos.find((t: any) => t.valor === tipoClase) as any)?.duracion || 50 })
    })
  }, [pacienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  // La plaza de cada hueco en sus fechas. Se vuelve a mirar al cambiar cualquier cosa.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    setOcup(filas.map(() => null))
    Promise.all(filas.map(async f => {
      const fechas = planDeFechas(desde, hasta, [DIAS_SEMANA[f.dia]])
      if (!fechas.length) return { total: 0, llenas: [] }
      const o = await ocupacionEnFechas(fechas, f.hora, f.sala)
      return { total: fechas.length, llenas: fechas.filter(x => (o[x] || 0) >= conf.max) }
    })).then(r => { if (vivo) setOcup(r) })
    return () => { vivo = false }
  }, [abierto, JSON.stringify(filas), desde, hasta, conf.max]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!h || h.ok === false || h.huecos.length === 0) return null
  const huecos = h.huecos

  function abrir() {
    setFilas(huecos.map((x: Hueco) => ({ dia: x.dia, hora: x.hora, sala: x.sala })))
    setAbierto(true)
  }
  const cambiar = (i: number, k: keyof Fila, v: any) => setFilas(l => l.map((f, j) => j === i ? { ...f, [k]: v } : f))

  async function crear() {
    /* CLASES LLENAS: decide el entrenador. Antes se saltaban solas y esa semana se
       quedaba sin su clase sin que nadie lo decidiera. Ahora se enseñan y se pregunta:
       ponerla igualmente (la sala va con uno más) o saltarla. */
    const llenas: { fecha: string, hora: string, sala: string }[] = []
    filas.forEach((f, i) => (ocup[i]?.llenas || []).forEach(fecha => llenas.push({ fecha, hora: f.hora, sala: f.sala })))
    let ponerLlenas = false
    if (llenas.length > 0) {
      const fmtL = (x: { fecha: string, hora: string, sala: string }) =>
        `· ${new Date(x.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ${x.hora} Sala ${x.sala}`
      ponerLlenas = confirm(`${llenas.length === 1 ? 'Esta clase está llena' : `Estas ${llenas.length} clases están llenas`}:\n\n`
        + llenas.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(fmtL).join('\n')
        + `\n\nAceptar: poner la cita igualmente.\nCancelar: saltar ${llenas.length === 1 ? 'esa fecha' : 'esas fechas'}.`)
    }
    const items: { fecha: string, hora: string, sala: string }[] = []
    let saltadas = 0
    filas.forEach((f, i) => {
      const llenasF = new Set(ocup[i]?.llenas || [])
      planDeFechas(desde, hasta, [DIAS_SEMANA[f.dia]]).forEach(fecha => {
        if (llenasF.has(fecha) && !ponerLlenas) saltadas++
        else items.push({ fecha, hora: f.hora, sala: f.sala })
      })
    })
    if (!items.length) { alert('No hay ninguna fecha con plaza en ese horario.'); return }
    setCreando(true)
    const r = await crearCitasPlan(items, { pacienteId, hora: items[0].hora, sala: items[0].sala, tipo: tipoClase || undefined, duracionMin: conf.duracion })
    setCreando(false)
    if (!r.ok) { alert(`Error al crear las citas (${r.error}). Se crearon ${r.creadas}.`); return }
    alert(`✓ ${r.creadas} citas creadas con su horario.`
      + (saltadas ? `\n${saltadas} no se han puesto: la clase estaba llena.` : '')
      + (ponerLlenas && llenas.length ? `\n${llenas.length} van en clase llena.` : '')
      + (r.yaTenia ? `\n${r.yaTenia} ya las tenía.` : '')
      + (r.sinBono ? `\n${r.sinBono} no descuentan del bono: se le habían acabado.` : ''))
    setAbierto(false)
    onCreadas?.()
  }

  const fmt = (f: string | null) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : ''

  return (
    <div style={{ margin: '4px 0 18px' }}>
      <style>{`
        .hf-p { display:inline-flex; align-items:baseline; gap:6px; padding:7px 13px; border-radius:99px; background:#fff;
                box-shadow:0 2px 10px rgba(38,40,37,.10); font-size:13px; color:var(--n) }
        .hf-p small { font-size:10.5px; color:var(--grl) }
        .hf-sel { font-family:inherit; font-size:13px; color:var(--gd); background:transparent; border:none;
                  border-bottom:1.5px solid var(--gm); padding:2px 2px; cursor:pointer; outline:none }
        @keyframes hf-in { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="ct-l" style={{ fontSize: 12.5, color: 'var(--gd)' }}><Ic name="calendario" size={13}/> Su horario</span>
        {huecos.map((x: Hueco, i: number) => (
          <span key={i} className="hf-p" title={`Vino ${x.semanas} de ${h.semanas} semanas`}>
            {nombreDia(x.dia)} {x.hora} <small>Sala {x.sala} · {Math.round(x.pct * 100)}%</small>
          </span>
        ))}
        <span style={{ fontSize: 10.5, color: 'var(--grl)' }}>{fmt(h.desde)} – {fmt(h.hasta)}</span>
        {!abierto && <button className="btn btn-t btn-sm" onClick={abrir}>Agendar con su horario</button>}
      </div>

      {abierto && (
        <div style={{ marginTop: 12, background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 10px 28px rgba(38,40,37,.12)', animation: 'hf-in .3s ease backwards' }}>
          {filas.map((f, i) => {
            const o = ocup[i]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 0' }}>
                <select className="hf-sel" value={f.dia} onChange={e => cambiar(i, 'dia', Number(e.target.value))}>
                  {DIAS_SEMANA.map((d, k) => <option key={d} value={k}>{d}</option>)}
                </select>
                <select className="hf-sel" value={f.hora} onChange={e => cambiar(i, 'hora', e.target.value)}>
                  {Array.from(new Set([f.hora, ...conf.horas])).sort().map(x => <option key={x} value={x}>{x}</option>)}
                </select>
                <select className="hf-sel" value={f.sala} onChange={e => cambiar(i, 'sala', e.target.value)}>
                  {Array.from(new Set([f.sala, ...conf.salas])).map(x => <option key={x} value={x}>Sala {x}</option>)}
                </select>
                <span style={{ fontSize: 12, color: !o ? 'var(--grl)' : o.llenas.length ? '#8A6410' : 'var(--gd)' }}>
                  {!o ? 'Mirando plaza…' : o.total === 0 ? 'Sin fechas' : o.llenas.length === 0 ? `Cabe en las ${o.total}` : `Llena en ${o.llenas.length} de ${o.total}`}
                </span>
                <button className="tn-x" title="Quitar este día" style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--grl)' }}
                  onClick={() => setFilas(l => l.filter((_, j) => j !== i))}>✕</button>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--gr)' }}>Desde</span>
            <input type="date" className="hf-sel" value={desde} min={hoyISO()} onChange={e => setDesde(e.target.value)}/>
            <span style={{ fontSize: 12, color: 'var(--gr)' }}>hasta</span>
            <input type="date" className="hf-sel" value={hasta} min={desde} onChange={e => setHasta(e.target.value)}/>
            <span style={{ flex: 1 }}/>
            <button className="btn btn-t btn-sm" onClick={() => setAbierto(false)}>Cerrar</button>
            <button className="btn btn-p btn-sm" disabled={creando || filas.length === 0 || ocup.some(x => !x)} onClick={crear}>
              {creando ? 'Creando…' : 'Crear sus citas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
