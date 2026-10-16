'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import ImagenEjercicio from '@/components/ImagenEjercicio'
import { COLOR, cargaPorEjercicio, ejecucionPorEjercicio, esfuerzoPorEjercicio, textoCarga } from '@/lib/resultados'

// ---------------------------------------------------------------------------
// PROGRESIÓN, EJERCICIO A EJERCICIO, EN TARJETAS (Resultados → Progresión).
//
// Antes eran tres listas de gráficas grandes —carga, ejecución, esfuerzo— y el mismo
// ejercicio salía en tres sitios distintos, más una lista aparte para los de un solo
// día. Ahora cada ejercicio es UNA tarjeta, como en el torno: su imagen, cómo va hoy,
// cuánto ha cambiado y una línea mínima. Al tocarla se abre debajo todo lo suyo con
// las gráficas completas. Lo que hay que mirar se ve sin abrir nada; el detalle se pide.
//
// Mismos cálculos que antes (lib/resultados): aquí solo cambia cómo se enseña.
// ---------------------------------------------------------------------------

const G = COLOR.g, GD = COLOR.gd, RED = COLOR.red, AMB = COLOR.amb, GREY = COLOR.gris

type Tarjeta = {
  clave: string, ejercicioId: string, nombre: string, variante: string,
  carga?: ReturnType<typeof cargaPorEjercicio>[number],
  gesto?: ReturnType<typeof ejecucionPorEjercicio>[number],
  esfuerzo?: ReturnType<typeof esfuerzoPorEjercicio>[number],
  dias: number,
}

export default function ProgresionEjercicios({ registros, bandas }: { registros: any[], bandas: string[] }) {
  const [abierta, setAbierta] = useState<string | null>(null)
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const raiz = useRef<HTMLDivElement>(null)

  const variosAnios = new Set(registros.map((r: any) => String(r.fecha || '').slice(0, 4))).size > 1
  const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES',
    variosAnios ? { day: 'numeric', month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })

  const tarjetas = useMemo(() => {
    const cargas = cargaPorEjercicio(registros, bandas)
    const gestos = ejecucionPorEjercicio(registros)
    const esfuerzos = esfuerzoPorEjercicio(registros)
    const m = new Map<string, Tarjeta>()
    // Una tarjeta por ejercicio y variante, como la carga: un unilateral no es un bilateral.
    cargas.forEach(c => {
      const [id, variante = ''] = c.ejercicio_id.split('|')
      m.set(c.ejercicio_id, { clave: c.ejercicio_id, ejercicioId: id, nombre: c.nombre, variante, carga: c, dias: c.puntos.length + (c.otros || 0) })
    })
    // Ejecución y esfuerzo van por ejercicio: se cuelgan de su primera tarjeta, o abren una.
    const colgar = (id: string, nombre: string, dias: number, f: (t: Tarjeta) => void) => {
      const t = Array.from(m.values()).find(x => x.ejercicioId === id)
      if (t) { f(t); t.dias = Math.max(t.dias, dias); return }
      const n: Tarjeta = { clave: id + '|', ejercicioId: id, nombre, variante: '', dias }
      f(n); m.set(n.clave, n)
    }
    gestos.forEach(g => colgar(g.ejercicio_id, g.nombre, g.puntos.length, t => { t.gesto = g }))
    esfuerzos.forEach(e => colgar(e.ejercicio_id, e.nombre, e.dias.length, t => { t.esfuerzo = e }))
    // Primero lo que más se ha trabajado: es donde la línea dice algo.
    return Array.from(m.values()).sort((a, b) => b.dias - a.dias || a.nombre.localeCompare(b.nombre))
  }, [registros, bandas])

  // La foto de cada ejercicio, si la tiene (los registros solo guardan el id).
  const ids = Array.from(new Set(tarjetas.map(t => t.ejercicioId)))
  useEffect(() => {
    if (!ids.length) return
    supabase.from('ejercicios').select('id,imagen_url').in('id', ids).then(({ data }) => {
      const f: Record<string, string> = {}; (data || []).forEach((e: any) => { if (e.imagen_url) f[e.id] = e.imagen_url }); setFotos(f)
    })
  }, [ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tocar fuera cierra el detalle, como en la agenda.
  useEffect(() => {
    if (!abierta) return
    const fuera = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('[data-prog]')) setAbierta(null) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierta])

  if (tarjetas.length === 0) return (
    <div className="panel"><div className="muted">Aún no hay nada anotado desde el taller.</div></div>
  )

  const pastilla = (txt: string, bueno: boolean) => (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 99,
      background: bueno ? 'var(--gl)' : 'var(--redl)', color: bueno ? GD : RED }}>{txt}</span>
  )
  const deltaCarga = (c: NonNullable<Tarjeta['carga']>) => {
    if (c.delta === 0 || c.puntos.length < 2) return null
    const txt = c.unidad === 'banda'
      ? `${c.delta > 0 ? '+' : '−'}${Math.abs(Math.round(c.delta))} banda${Math.abs(c.delta) === 1 ? '' : 's'}`
      : `${c.delta > 0 ? '+' : '−'}${textoCarga(Math.abs(c.delta), c.unidad)}`
    return pastilla(txt, c.delta > 0)
  }

  const grafica = (datos: any[], lineas: { k: string, nombre: string, color: string }[], opts: { dominio?: [number, number], fmt?: (v: any) => string, alto?: number }) => (
    <ResponsiveContainer width="100%" height={opts.alto || 150}>
      <LineChart data={datos} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
        <XAxis dataKey="fecha" tickFormatter={fechaCorta} tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false} minTickGap={16}/>
        <YAxis domain={opts.dominio || ['auto', 'auto']} tick={{ fontSize: 11, fill: GREY }} axisLine={false} tickLine={false}
          width={opts.fmt ? 58 : 36} tickFormatter={opts.fmt}/>
        <Tooltip labelFormatter={(f: any) => fechaCorta(String(f))} contentStyle={{ fontSize: 12.5, borderRadius: 8, border: '1px solid #eee' }}
          formatter={opts.fmt ? ((v: any, n: any) => [opts.fmt!(v), n]) : undefined}/>
        {lineas.map(l => <Line key={l.k} type="monotone" dataKey={l.k} name={l.nombre} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls/>)}
      </LineChart>
    </ResponsiveContainer>
  )

  const detalle = (t: Tarjeta) => {
    const c = t.carga
    return (
      <div data-prog className="pe-entra" style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 16, padding: '14px 16px',
        boxShadow: '0 4px 18px rgba(38,40,37,.10)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 14, color: 'var(--n)', flex: 1 }}>{t.nombre}{t.variante && <span style={{ color: 'var(--gr)' }}> · {t.variante}</span>}</span>
          <span style={{ fontSize: 11.5, color: 'var(--grl)' }}>{t.dias} día{t.dias === 1 ? '' : 's'} anotado{t.dias === 1 ? '' : 's'}</span>
          <button className="btn btn-t btn-sm" style={{ padding: '1px 7px' }} onClick={() => setAbierta(null)}><Ic name="cerrar" size={11}/></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          {c && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>Carga · la mejor serie del día</div>
              {c.puntos.length >= 2
                ? grafica(c.puntos, [{ k: 'valor', nombre: 'Máximo', color: G }],
                    { fmt: (v: any) => textoCarga(v, c.unidad, bandas), dominio: c.unidad === 'banda' ? [1, Math.max(bandas.length, 1)] : undefined })
                : <div className="muted" style={{ fontSize: 12 }}>Un solo día: {textoCarga(c.ultimo, c.unidad, bandas)} el {fechaCorta(c.puntos[0].fecha)}. La línea sale a partir del segundo.</div>}
              {(c.otros || 0) > 0 && <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 4 }}>+{c.otros} día{c.otros! > 1 ? 's' : ''} anotado{c.otros! > 1 ? 's' : ''} en otra medida, que no se pueden comparar.</div>}
            </div>
          )}
          {t.gesto && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>Cómo ejecuta · criterios cumplidos</div>
              {grafica(t.gesto.puntos, [{ k: 'pct', nombre: '% cumple', color: GD }], { dominio: [0, 100] })}
            </div>
          )}
          {t.esfuerzo && (
            <div>
              <div className="et-mini" style={{ marginBottom: 4 }}>Esfuerzo y dolor · media del día, 0 a 10</div>
              {grafica(t.esfuerzo.dias, [
                ...(t.esfuerzo.campos.includes('dolor') ? [{ k: 'dolor', nombre: 'Dolor', color: RED }] : []),
                ...(t.esfuerzo.campos.includes('rpe') ? [{ k: 'rpe', nombre: 'RPE', color: G }] : []),
                ...(t.esfuerzo.campos.includes('rir') ? [{ k: 'rir', nombre: 'RIR', color: AMB }] : []),
              ], { dominio: [0, 10] })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={raiz} className="panel">
      <style>{`.pe-entra{animation:pe-entra .18s ease both}@keyframes pe-entra{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}`}</style>
      <div className="sec-h" style={{ marginBottom: 12 }}>
        <span className="sh-l"><span className="ct-l"><Ic name="fuerza" size={13}/> Cómo va cada ejercicio</span></span>
        <span className="sh-r">Toca uno para ver sus gráficas</span>
      </div>
      {/* "dense": el detalle ocupa la fila entera y las tarjetas de al lado suben a rellenar. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gridAutoFlow: 'row dense', gap: 14 }}>
        {tarjetas.map(t => {
          const c = t.carga
          const on = abierta === t.clave
          const dolor = t.esfuerzo?.dolor
          return [
            <div key={t.clave} data-prog onClick={() => setAbierta(on ? null : t.clave)} style={{ cursor: 'pointer', minWidth: 0 }}>
              <div style={{ borderRadius: 14, overflow: 'hidden', position: 'relative',
                boxShadow: on ? `0 0 0 2px ${G}` : '0 2px 10px rgba(38,40,37,.10)', transition: 'box-shadow .15s' }}>
                <ImagenEjercicio src={fotos[t.ejercicioId]} ejercicioId={t.ejercicioId} radio={0} fondo="var(--bl)" icono={24} insignias={false}/>
                {/* El dolor de la última vez, en la esquina: es lo primero que hay que ver. */}
                {dolor != null && dolor > 0 && (
                  <span title={`Dolor la última vez: ${dolor}`} style={{ position: 'absolute', top: 6, right: 6, fontSize: 10.5, fontWeight: 600,
                    padding: '2px 7px', borderRadius: 99, background: dolor >= 4 ? RED : '#fff', color: dolor >= 4 ? '#fff' : RED,
                    boxShadow: '0 1px 5px rgba(38,40,37,.2)' }}>dolor {dolor}</span>
                )}
              </div>
              <div style={{ padding: '7px 2px 0' }}>
                <div title={t.nombre} style={{ fontSize: 12, color: 'var(--n)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {t.nombre}{t.variante && <span style={{ color: 'var(--gr)' }}> · {t.variante}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                  {c && <span style={{ fontSize: 13, color: 'var(--n)', fontWeight: 500 }}>{textoCarga(c.ultimo, c.unidad, bandas)}</span>}
                  {c && deltaCarga(c)}
                  {!c && t.gesto && <span style={{ fontSize: 12, color: 'var(--n)' }}>{t.gesto.ultimo}% técnica</span>}
                </div>
                {/* La línea mínima: solo la forma, sin ejes. Dice "sube, baja o igual" de un vistazo. */}
                {c && c.puntos.length >= 2 ? (
                  <div style={{ height: 26, marginTop: 4 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={c.puntos} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
                        <YAxis hide domain={['dataMin', 'dataMax']}/>
                        <Line type="monotone" dataKey="valor" stroke={G} strokeWidth={1.75} dot={false} isAnimationActive={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ fontSize: 10.5, color: 'var(--grl)', marginTop: 3 }}>
                    {t.dias === 1 ? `Un día · ${c ? fechaCorta(c.puntos[0].fecha) : ''}` : `${t.dias} días`}
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
