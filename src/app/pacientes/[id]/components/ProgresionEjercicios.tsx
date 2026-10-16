'use client'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { COLOR, cargaPorEjercicio, ejecucionPorEjercicio, esfuerzoPorEjercicio, textoCarga, cargaSemanal, adherencia } from '@/lib/resultados'

// ---------------------------------------------------------------------------
// PROGRESIÓN DEL PACIENTE (Resultados → Progresión)
//
// Arriba, lo de conjunto: cómo se reparte la carga semana a semana (con aviso de picos)
// y cuánto de lo programado hace de verdad. Debajo, un ejercicio por tarjeta, como en
// el torno: su imagen, cómo va hoy y cuánto ha cambiado. Al tocarla se abre lo suyo.
//
// QUÉ SE MIRA EN CADA EJERCICIO:
//   - Con peso, el 1RM ESTIMADO y no el peso máximo: 20 kg × 12 y 22 kg × 6 no se
//     comparan por los kg. Y si hay peso corporal, la FUERZA RELATIVA (1RM / peso).
//   - En el detalle, la carga y el DOLOR en la misma gráfica: que la carga suba
//     mientras el dolor baja es la mejor señal que hay en rehabilitación.
//   - Una FAMILIA es una tarjeta: si pasa de "Flexiones · Rodillas apoyadas" a
//     "Flexiones", eso es progresar aunque el número baje, y se dice. Antes eran dos
//     tarjetas y la segunda parecía empezar de cero.
//
// Los cálculos viven en lib/resultados; aquí solo se agrupan y se enseñan.
// ---------------------------------------------------------------------------

const G = COLOR.g, GD = COLOR.gd, RED = COLOR.red, AMB = COLOR.amb, GREY = COLOR.gris
const PALETA = [G, AMB, GD, '#8E7CC3', '#C27C5B']

type Carga = ReturnType<typeof cargaPorEjercicio>[number]
type Miembro = { clave: string, nombre: string, carga: Carga }
type Tarjeta = {
  clave: string, ejercicioId: string, nombre: string,
  miembros: Miembro[], actual?: Miembro, primero?: Miembro,
  gesto?: ReturnType<typeof ejecucionPorEjercicio>[number],
  esfuerzo?: ReturnType<typeof esfuerzoPorEjercicio>[number],
  dias: number, ultimaFecha: string,
}

export default function ProgresionEjercicios({ registros, bandas, pacienteId, pesoKg }: {
  registros: any[], bandas: string[], pacienteId?: string, pesoKg?: number | null,
}) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [info, setInfo] = useState<Record<string, any>>({})
  const [sesiones, setSesiones] = useState<Record<string, any>>({})
  const [cambios, setCambios] = useState<any[]>([])

  const variosAnios = new Set(registros.map((r: any) => String(r.fecha || '').slice(0, 4))).size > 1
  const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES',
    variosAnios ? { day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })

  // Lo que los registros no traen: foto y familia de cada ejercicio, las sesiones (para
  // saber qué estaba programado) y los cambios de sesión con su motivo.
  const ids = Array.from(new Set(registros.map((r: any) => r.ejercicio_id).filter(Boolean))) as string[]
  const sesIds = Array.from(new Set(registros.map((r: any) => r.sesion_id).filter(Boolean))) as string[]
  useEffect(() => {
    if (!ids.length) return
    supabase.from('ejercicios').select('id,nombre,imagen_url,portada_id').in('id', ids).then(async ({ data }) => {
      const m: Record<string, any> = {}; (data || []).forEach((e: any) => { m[e.id] = e })
      // Los principales de las familias, para el nombre de la tarjeta.
      const faltan = Array.from(new Set((data || []).map((e: any) => e.portada_id).filter((p: any) => p && !m[p])))
      if (faltan.length) {
        const { data: ps } = await supabase.from('ejercicios').select('id,nombre,imagen_url,portada_id').in('id', faltan)
        ;(ps || []).forEach((e: any) => { m[e.id] = e })
      }
      setInfo(m)
    })
  }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sesIds.length) return
    supabase.from('sesiones').select('id,nombre,partes').in('id', sesIds).then(({ data }) => {
      const m: Record<string, any> = {}; (data || []).forEach((s: any) => { m[s.id] = s }); setSesiones(m)
    })
  }, [sesIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pacienteId) return
    supabase.from('cambios_sesion').select('fecha,motivo').eq('paciente_id', pacienteId).then(({ data }) => setCambios(data || []))
  }, [pacienteId])

  const semanas = useMemo(() => cargaSemanal(registros), [registros])
  const adh = useMemo(() => adherencia(registros, sesiones, cambios), [registros, sesiones, cambios])

  const tarjetas = useMemo(() => {
    const cargas = cargaPorEjercicio(registros, bandas)
    const gestos = ejecucionPorEjercicio(registros)
    const esfuerzos = esfuerzoPorEjercicio(registros)
    const familia = (id: string) => info[id]?.portada_id || id
    const m = new Map<string, Tarjeta>()
    const tarjeta = (id: string, nombre: string) => {
      const f = familia(id)
      let t = m.get(f)
      if (!t) { t = { clave: f, ejercicioId: f, nombre: info[f]?.nombre || nombre, miembros: [], dias: 0, ultimaFecha: '' }; m.set(f, t) }
      return t
    }
    cargas.forEach(c => {
      const [id, variante = ''] = c.ejercicio_id.split('|')
      const t = tarjeta(id, c.nombre)
      // El nombre del miembro: lo que lo distingue dentro de la familia.
      const nom = [info[id]?.portada_id ? (info[id]?.nombre || c.nombre).split(' · ').slice(1).join(' · ') || c.nombre : '', variante]
        .filter(Boolean).join(' · ') || (t.miembros.length ? c.nombre : '')
      t.miembros.push({ clave: c.ejercicio_id, nombre: nom, carga: c })
      t.dias += c.puntos.length + (c.otros || 0)
    })
    gestos.forEach(g => { const t = tarjeta(g.ejercicio_id, g.nombre); t.gesto = t.gesto || g; t.dias = Math.max(t.dias, g.puntos.length) })
    esfuerzos.forEach(e => { const t = tarjeta(e.ejercicio_id, e.nombre); t.esfuerzo = t.esfuerzo || e; t.dias = Math.max(t.dias, e.dias.length) })
    m.forEach(t => {
      const ult = (c: Carga) => c.puntos[c.puntos.length - 1]?.fecha || ''
      const ord = [...t.miembros].sort((a, b) => ult(a.carga).localeCompare(ult(b.carga)))
      t.actual = ord[ord.length - 1]
      t.primero = [...t.miembros].sort((a, b) => (a.carga.puntos[0]?.fecha || '').localeCompare(b.carga.puntos[0]?.fecha || ''))[0]
      t.ultimaFecha = t.actual ? ult(t.actual.carga) : ''
    })
    return Array.from(m.values()).sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre))
  }, [registros, bandas, info])

  // Tocar fuera cierra el detalle, como en la agenda.
  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('[data-prog]')) setAbierta(null) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta])

  if (registros.length === 0) return (
    <div className="panel"><div className="muted">Aún no hay nada anotado desde el taller.</div></div>
  )

  const pastilla = (txt: string, bueno: boolean, title?: string) => (
    <span title={title} style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
      background: bueno ? 'var(--gl)' : 'var(--redl)', color: bueno ? GD : RED }}>{txt}</span>
  )
  const redondo = (v: number) => Math.round(v * 10) / 10
  const relativa = (rm?: number) => rm && pesoKg ? Math.round(rm / pesoKg * 100) / 100 : null

  /** El cambio de un miembro: en 1RM si va con peso (lo honesto), si no en su unidad. */
  const cambio = (c: Carga) => {
    if (c.puntos.length < 2) return null
    const rms = c.puntos.map(p => p.rm).filter(Boolean) as number[]
    if (c.unidad === 'kg' && rms.length >= 2) {
      const d = redondo(rms[rms.length - 1] - rms[0])
      return d === 0 ? null : pastilla(`${d > 0 ? '+' : '−'}${Math.abs(d)} kg 1RM`, d > 0, 'Cambio del 1RM estimado entre el primer día y el último')
    }
    if (c.delta === 0) return null
    const txt = c.unidad === 'banda'
      ? `${c.delta > 0 ? '+' : '−'}${Math.abs(Math.round(c.delta))} banda${Math.abs(c.delta) === 1 ? '' : 's'}`
      : `${c.delta > 0 ? '+' : '−'}${textoCarga(Math.abs(c.delta), c.unidad)}`
    return pastilla(txt, c.delta > 0)
  }

  const ejeFecha = <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} minTickGap={16}/>
  const tooltip = (fmt?: (v: any, n: any) => any) => (
    <Tooltip labelFormatter={(f: any) => fechaCorta(String(f))} contentStyle={{ fontSize: 12.5, borderRadius: 8, border: '1px solid #eee' }} formatter={fmt}/>
  )

  // ---- Detalle de una tarjeta ------------------------------------------------
  const detalle = (t: Tarjeta) => {
    const act = t.actual?.carga
    const unidad = act?.unidad || ''
    // Los miembros que se pueden pintar juntos: los de la misma unidad que el actual.
    const juntos = t.miembros.filter(mm => mm.carga.unidad === unidad)
    const conRm = unidad === 'kg' && juntos.some(mm => mm.carga.puntos.some(p => p.rm))
    const dolorPorFecha: Record<string, number> = {}
    ;(t.esfuerzo?.dias || []).forEach(d => { if (d.dolor != null) dolorPorFecha[d.fecha] = d.dolor })
    const hayDolor = Object.keys(dolorPorFecha).length > 0
    // Una fila por fecha con una columna por miembro (y el dolor, si lo hay).
    const fechas = Array.from(new Set([...juntos.flatMap(mm => mm.carga.puntos.map(p => p.fecha)), ...Object.keys(dolorPorFecha)])).sort()
    const datos = fechas.map(f => {
      const fila: any = { fecha: f }
      juntos.forEach((mm, i) => {
        const p = mm.carga.puntos.find(x => x.fecha === f)
        if (p) fila['m' + i] = conRm ? (p.rm ?? null) : p.valor
      })
      if (dolorPorFecha[f] != null) fila.dolor = dolorPorFecha[f]
      return fila
    })
    const fmt = (v: any) => conRm ? `${redondo(v)} kg` : textoCarga(v, unidad, bandas)
    const rmAct = act?.puntos[act.puntos.length - 1]?.rm
    const rel = relativa(rmAct)
    return (
      <div data-prog className="pe-entra" style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 4px 18px rgba(38,40,37,.10)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: 'var(--n)', flex: 1 }}>{t.nombre}</span>
          <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>{t.dias} día{t.dias === 1 ? '' : 's'} anotado{t.dias === 1 ? '' : 's'}</span>
          <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} onClick={() => setAbierta(null)}><Ic name="cerrar" size={11}/></button>
        </div>

        {/* EL RECORRIDO POR LA FAMILIA: de qué variante a qué variante ha ido. */}
        {t.miembros.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span className="et-mini">Recorrido</span>
            {[...t.miembros].sort((a, b) => (a.carga.puntos[0]?.fecha || '').localeCompare(b.carga.puntos[0]?.fecha || '')).map((mm, i, arr) => (
              <span key={mm.clave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 99, background: mm === t.actual ? 'var(--gl)' : 'var(--bl)', color: mm === t.actual ? GD : 'var(--n)' }}>
                  {mm.nombre || t.nombre} <span style={{ color: 'var(--grl)' }}>· desde {fechaCorta(mm.carga.puntos[0].fecha)}</span>
                </span>
                {i < arr.length - 1 && <span style={{ color: 'var(--grl)' }}>→</span>}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
          {act && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>
                {conRm ? '1RM estimado' : 'Carga · la mejor serie del día'}{hayDolor ? ' y dolor' : ''}
              </div>
              {datos.length >= 2 ? (
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={datos} margin={{ top: 6, right: hayDolor ? 0 : 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                    {ejeFecha}
                    <YAxis yAxisId="c" domain={unidad === 'banda' ? [1, Math.max(bandas.length, 1)] : ['auto', 'auto']} tick={{ fontSize: 11, fill: GREY }}
                      axisLine={false} tickLine={false} width={unidad === 'banda' ? 58 : 40} tickFormatter={unidad === 'banda' ? (v: any) => textoCarga(v, 'banda', bandas) : undefined}/>
                    {hayDolor && <YAxis yAxisId="d" orientation="right" domain={[0, 10]} tick={{ fontSize: 11, fill: RED }} axisLine={false} tickLine={false} width={26}/>}
                    {tooltip((v: any, n: any) => [n === 'Dolor' ? v : fmt(v), n])}
                    {juntos.map((mm, i) => (
                      <Line key={mm.clave} yAxisId="c" type="monotone" dataKey={'m' + i} name={mm.nombre || t.nombre}
                        stroke={PALETA[i % PALETA.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls/>
                    ))}
                    {hayDolor && <Line yAxisId="d" type="monotone" dataKey="dolor" name="Dolor" stroke={RED} strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2.5 }} connectNulls/>}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="muted" style={{ fontSize: 12 }}>Un solo día: {textoCarga(act.ultimo, act.unidad, bandas)} el {fechaCorta(act.puntos[0].fecha)}. La línea sale a partir del segundo.</div>
              )}
              {conRm && rmAct && (
                <div style={{ fontSize: 11.5, color: 'var(--gr)', marginTop: 6 }}>
                  Hoy: 1RM ≈ <b style={{ fontWeight: 600, color: 'var(--n)' }}>{redondo(rmAct)} kg</b>
                  {rel != null && <> · <b style={{ fontWeight: 600, color: 'var(--n)' }}>{String(rel).replace('.', ',')}×</b> su peso</>}
                  <span style={{ color: 'var(--grl)' }}> · estimado con Epley, series de hasta 12 reps</span>
                </div>
              )}
              {hayDolor && <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 3 }}>Línea roja discontinua: dolor (0–10, eje derecho). Lo bueno: la carga sube y el dolor baja.</div>}
              {t.miembros.some(mm => (mm.carga.otros || 0) > 0) && <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 3 }}>Hay días anotados en otra medida que no se pueden comparar.</div>}
            </div>
          )}
          {t.gesto && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>Cómo ejecuta · criterios cumplidos</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={t.gesto.puntos} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  {ejeFecha}
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} width={36}/>
                  {tooltip((v: any) => [`${v}%`, 'Cumple'])}
                  <Line type="monotone" dataKey="pct" stroke={GD} strokeWidth={2} dot={{ r: 3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {t.esfuerzo && t.esfuerzo.campos.some(c => c !== 'dolor') && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>Esfuerzo · media del día</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={t.esfuerzo.dias} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                  {ejeFecha}
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} width={36}/>
                  {tooltip()}
                  {t.esfuerzo.campos.includes('rpe') && <Line type="monotone" dataKey="rpe" name="RPE" stroke={G} strokeWidth={2} dot={{ r: 3 }} connectNulls/>}
                  {t.esfuerzo.campos.includes('rir') && <Line type="monotone" dataKey="rir" name="RIR" stroke={AMB} strokeWidth={2} dot={{ r: 3 }} connectNulls/>}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Bloques de conjunto ---------------------------------------------------
  const ultimas = semanas.slice(-12)
  const picos = ultimas.filter(w => w.pico)
  const tarjetaFija = { background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 12px rgba(38,40,37,.07)', minWidth: 0 }

  return (
    <div className="panel">
      <style>{`.pe-entra{animation:pe-entra .18s ease both}@keyframes pe-entra{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 22 }}>
        {/* CARGA SEMANAL */}
        <div style={tarjetaFija}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span className="et-mini" style={{ flex: 1 }}>Carga semanal · series hechas</span>
            {picos.length > 0 && pastilla(`${picos.length} pico${picos.length > 1 ? 's' : ''}`, false, 'Semanas con más de un 30% de series que la media de las 4 anteriores')}
          </div>
          {ultimas.length < 2 ? <div className="muted" style={{ fontSize: 12 }}>Hace falta más de una semana anotada.</div> : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={ultimas} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="semana" tickFormatter={fechaCorta} tick={{ fontSize: 10.5, fill: GREY }} axisLine={false} tickLine={false} minTickGap={8}/>
                <YAxis tick={{ fontSize: 10.5, fill: GREY }} axisLine={false} tickLine={false} width={28} allowDecimals={false}/>
                <Tooltip labelFormatter={(f: any) => 'Semana del ' + fechaCorta(String(f))} contentStyle={{ fontSize: 12.5, borderRadius: 8, border: '1px solid #eee' }}
                  formatter={(v: any, n: any, o: any) => {
                    const w = o?.payload
                    return [`${v} series${w?.tonelaje ? ` · ${w.tonelaje.toLocaleString('es-ES')} kg movidos` : ''}${w?.rpe != null ? ` · RPE ${w.rpe}` : ''}${w?.pico ? ' · PICO' : ''}`, '']
                  }}/>
                <Bar dataKey="series" radius={[5, 5, 0, 0]}>
                  {ultimas.map(w => <Cell key={w.semana} fill={w.pico ? RED : G}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 4 }}>En rojo, las semanas que suben de golpe: es donde más recaídas aparecen.</div>
        </div>

        {/* ADHERENCIA */}
        <div style={tarjetaFija}>
          <div className="et-mini" style={{ marginBottom: 8 }}>Lo que hace de lo programado</div>
          {adh.pct == null ? <div className="muted" style={{ fontSize: 12 }}>Sin clases con sesión todavía.</div> : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 300, color: adh.pct >= 85 ? GD : adh.pct >= 65 ? AMB : RED }}>{adh.pct}%</span>
                <span style={{ fontSize: 12, color: 'var(--gr)' }}>{adh.hechos} de {adh.plan} ejercicios en {adh.clases} clase{adh.clases === 1 ? '' : 's'}</span>
              </div>
              {adh.saltados.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Los que más se quedan sin hacer (o se cambian ese día)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {adh.saltados.slice(0, 6).map(s => (
                      <span key={s.nombre} style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 99, background: 'var(--bl)' }}>
                        {s.nombre} <b style={{ fontWeight: 600, color: RED }}>{s.veces}</b><span style={{ color: 'var(--grl)' }}>/{s.de}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {adh.cambios > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 4 }}>Sesión cambiada en clase {adh.cambios} {adh.cambios === 1 ? 'vez' : 'veces'}, por</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {adh.motivos.map(([m, n]) => (
                      <span key={m} style={{ fontSize: 11.5, padding: '2px 9px', borderRadius: 99, background: m.startsWith('Dolor') ? 'var(--redl)' : 'var(--ambl)', color: m.startsWith('Dolor') ? RED : '#7A5800' }}>{m} · {n}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sec-h" style={{ marginBottom: 12 }}>
        <span className="sh-l"><span className="ct-l"><Ic name="fuerza" size={13}/> Cómo va cada ejercicio</span></span>
        <span className="sh-r">Toca uno para ver sus gráficas</span>
      </div>
      {/* "dense": el detalle ocupa la fila entera y las tarjetas de al lado suben a rellenar. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gridAutoFlow: 'row dense', gap: 14 }}>
        {tarjetas.map(t => {
          const c = t.actual?.carga
          const on = abierta === t.clave
          const dolor = t.esfuerzo?.dolor
          const rm = c?.puntos[c.puntos.length - 1]?.rm
          const rel = relativa(rm)
          // Cambió de variante: lo que se hace ahora no es lo del principio.
          const cambioVar = t.miembros.length > 1 && t.actual && t.primero && t.actual !== t.primero
          return [
            <div key={t.clave} data-prog onClick={() => setAbierta(on ? null : t.clave)} style={{ cursor: 'pointer', minWidth: 0 }}>
              <div style={{ borderRadius: 14, overflow: 'hidden', position: 'relative',
                boxShadow: on ? `0 0 0 2px ${G}` : '0 2px 10px rgba(38,40,37,.10)', transition: 'box-shadow .15s' }}>
                <ImagenEjercicio src={info[t.ejercicioId]?.imagen_url} ejercicioId={t.ejercicioId} radio={0} fondo="var(--bl)" icono={24} insignias={false}/>
                {dolor != null && dolor > 0 && (
                  <span title={`Dolor la última vez: ${dolor}`} style={{ position: 'absolute', top: 6, right: 6, fontSize: 10.5, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 99, background: dolor >= 4 ? RED : '#fff', color: dolor >= 4 ? '#fff' : RED,
                    boxShadow: '0 1px 5px rgba(38,40,37,.2)' }}>dolor {dolor}</span>
                )}
              </div>
              <div style={{ padding: '7px 2px 0' }}>
                <div title={t.nombre} style={{ fontSize: 12, color: 'var(--n)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.nombre}</div>
                {cambioVar && <div style={{ fontSize: 10.5, color: GD, marginTop: 1 }}>→ ahora {t.actual!.nombre || t.nombre}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  {c && <span style={{ fontSize: 13, color: 'var(--n)', fontWeight: 500 }}>{textoCarga(c.ultimo, c.unidad, bandas)}</span>}
                  {c && cambio(c)}
                  {!c && t.gesto && <span style={{ fontSize: 12, color: 'var(--n)' }}>{t.gesto.ultimo}% técnica</span>}
                </div>
                {rm && <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 1 }}>1RM ≈ {Math.round(rm)} kg{rel != null ? ` · ${String(rel).replace('.', ',')}× peso` : ''}</div>}
                {c && c.puntos.length >= 2 ? (
                  <div style={{ height: 26, marginTop: 4 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={c.puntos} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
                        <YAxis hide domain={['dataMin', 'dataMax']}/>
                        <Line type="monotone" dataKey={c.unidad === 'kg' && c.puntos.every(p => p.rm) ? 'rm' : 'valor'} stroke={G} strokeWidth={1.75} dot={false} isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 3 }}>
                    {t.dias <= 1 && t.ultimaFecha ? `Un día · ${fechaCorta(t.ultimaFecha)}` : `${t.dias} días`}
                  </div>
                )}
              </div>
            </div>,
            on ? <div key={t.clave + '-d'} style={{ gridColumn: '1 / -1' }}>{detalle(t)}</div> : null,
          ]
        })}
      </div>
    </div>
  )
}
