'use client'
import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import { supabase } from '@/lib/supabase'
import { ZONAS, colorZona, mmss } from '@/lib/pulso'
import { COLOR } from '@/lib/resultados'

// ---------------------------------------------------------------------------
// CARDIO: lo que guardan los pulsómetros del taller (fc_sesiones, cada 30 s durante la
// clase). Antes se guardaba pero no se veía en ningún sitio. Aquí: cada clase con su
// FC media y máxima, el tiempo en cada zona y su gráfica; y la evolución entre clases
// (si con el mismo esfuerzo el pulso sube menos, el corazón está mejorando).
// ---------------------------------------------------------------------------

const fechaCorta = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
const horaDe = (iso: string) => iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''

/** Barra con el tiempo en cada zona (0 = por debajo del 50%). */
function BarraZonas({ zonas, alto = 10 }: { zonas: number[], alto?: number }) {
  const total = (zonas || []).reduce((s, x) => s + (x || 0), 0) || 1
  return (
    <div style={{ display: 'flex', height: alto, borderRadius: 99, overflow: 'hidden', background: COLOR.bm }}>
      {(zonas || []).map((seg, z) => seg > 0 && (
        <div key={z} title={`${z ? 'Zona ' + z + ' · ' + ZONAS[z - 1].nombre : 'Por debajo del 50%'}: ${mmss(seg)}`}
          style={{ width: `${seg / total * 100}%`, background: colorZona(z) }}/>
      ))}
    </div>
  )
}

export default function ResultadosCardio({ pacienteId }: { pacienteId: string }) {
  const [filas, setFilas] = useState<any[] | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('fc_sesiones').select('*').eq('paciente_id', pacienteId).order('inicio', { ascending: false })
      .then(({ data }) => {
        // Las de menos de un minuto son una banda que se conectó y se quitó: no son una clase.
        const f = (data || []).filter((x: any) => (x.segundos || 0) >= 60)
        setFilas(f); if (f[0]) setAbierta(f[0].id)
      })
  }, [pacienteId])

  const evolucion = useMemo(() => [...(filas || [])].reverse().map(f => ({
    fecha: fechaCorta(f.fecha), 'FC media': f.fc_media, 'FC máx.': f.fc_max, Carga: f.trimp,
  })), [filas])

  if (filas == null) return <div className="muted">Cargando…</div>
  if (!filas.length) return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '22px 18px', boxShadow: '0 2px 12px rgba(38,40,37,.07)', color: 'var(--gr)', fontSize: 13.5 }}>
      Todavía no hay clases con pulsómetro. Se guardan solas al conectar las bandas desde el taller (botón del corazón).
    </div>
  )

  const media = (k: string) => Math.round(filas.reduce((s, f) => s + (f[k] || 0), 0) / filas.length)
  const totalZonas = filas.reduce((acc: number[], f) => (f.zonas || []).map((x: number, i: number) => (acc[i] || 0) + (x || 0)), [] as number[])
  const sel = filas.find(f => f.id === abierta)
  const ref = sel?.fc_max_ref || null
  const datosSel = (sel?.muestras || []).map(([s, bpm]: [number, number]) => ({ min: Math.round(s / 6) / 10, ppm: bpm }))
  const tarjeta = { background: '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(38,40,37,.07)', minWidth: 0 } as const
  const titulo = { fontSize: 13, fontWeight: 500, color: 'var(--n)', marginBottom: 10 } as const

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, alignItems: 'start' }}>
      {/* RESUMEN */}
      <div style={{ ...tarjeta, gridColumn: '1/-1' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 14 }}>
          {[['Clases', filas.length, COLOR.gd], ['FC media', media('fc_media'), COLOR.g], ['FC máx. media', media('fc_max'), COLOR.red], ['Carga media', media('trimp'), COLOR.amb]].map(([l, v, c]) => (
            <div key={String(l)} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 200, color: c as string }}>{v}</div>
              <div style={{ fontSize: 12, color: 'var(--gr)' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>Tiempo en cada zona, sumando todas las clases</div>
        <BarraZonas zonas={totalZonas} alto={14}/>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 11.5, color: 'var(--gr)' }}>
          {ZONAS.map(Z => <span key={Z.z} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: Z.color }}/>Z{Z.z} {Z.nombre} ({Z.desde}%+)</span>)}
        </div>
      </div>

      {/* LAS CLASES */}
      <div style={tarjeta}>
        <div style={titulo}>Clases con pulsómetro</div>
        {filas.map(f => (
          <button key={f.id} type="button" onClick={() => setAbierta(f.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 10, padding: '8px 10px', marginBottom: 4,
              background: abierta === f.id ? COLOR.gl : 'transparent' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, marginBottom: 5 }}>
              <b style={{ fontWeight: 600, color: 'var(--n)', width: 64 }}>{fechaCorta(f.fecha)}</b>
              <span style={{ color: 'var(--gr)' }}>{horaDe(f.inicio)} · {mmss(f.segundos || 0)} min</span>
              <span style={{ flex: 1 }}/>
              <span style={{ color: 'var(--n)' }}>media <b style={{ fontWeight: 600 }}>{f.fc_media ?? '—'}</b> · máx <b style={{ fontWeight: 600 }}>{f.fc_max ?? '—'}</b></span>
            </div>
            <BarraZonas zonas={f.zonas}/>
          </button>
        ))}
      </div>

      {/* LA CLASE ELEGIDA */}
      {sel && (
        <div style={tarjeta}>
          <div style={titulo}>{fechaCorta(sel.fecha)}, {horaDe(sel.inicio)}–{horaDe(sel.fin)}</div>
          {datosSel.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={datosSel} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                {ref && ZONAS.map((Z, i) => (
                  <ReferenceArea key={Z.z} y1={Math.round(ref * Z.desde / 100)} y2={Math.round(ref * (ZONAS[i + 1]?.desde ?? 100) / 100)} fill={Z.color} fillOpacity={0.12} stroke="none"/>
                ))}
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
                <XAxis dataKey="min" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: '#9CA3AF' }} unit=" min"/>
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} domain={['dataMin - 10', ref || 'dataMax + 10']}/>
                <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #eee' }} formatter={(v: any) => [v + ' ppm', 'Pulso']} labelFormatter={(l: any) => 'Minuto ' + l}/>
                <Line type="monotone" dataKey="ppm" stroke={COLOR.red} strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="muted" style={{ fontSize: 12.5 }}>Sin gráfica de esta clase.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginTop: 10, textAlign: 'center' }}>
            {[['Media', sel.fc_media], ['Máx.', sel.fc_max], ['Mín.', sel.fc_min], ['Carga', sel.trimp]].map(([l, v]) => (
              <div key={String(l)}><div style={{ fontSize: 20, fontWeight: 300, color: COLOR.gd }}>{v ?? '—'}</div><div style={{ fontSize: 11.5, color: 'var(--gr)' }}>{l}</div></div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--grl)', marginTop: 8 }}>
            FC máx. de referencia {ref ?? '—'} ({sel.formula === 'medida' ? 'medida en su ficha' : 'por edad, Tanaka'}). Banda: {sel.banda || '—'}. Carga = minutos en cada zona × número de zona.
          </div>
        </div>
      )}

      {/* EVOLUCIÓN */}
      {evolucion.length > 1 && (
        <div style={{ ...tarjeta, gridColumn: '1/-1' }}>
          <div style={titulo}>Evolución entre clases</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={evolucion} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false}/>
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
              <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }}/>
              <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #eee' }}/>
              <Line type="monotone" dataKey="FC media" stroke={COLOR.g} strokeWidth={2}/>
              <Line type="monotone" dataKey="FC máx." stroke={COLOR.red} strokeWidth={2}/>
              <Line type="monotone" dataKey="Carga" stroke={COLOR.amb} strokeWidth={2} strokeDasharray="4 3"/>
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11.5, color: 'var(--gr)', marginTop: 6 }}>Si la carga es parecida y la FC media baja con las semanas, está mejorando su forma aeróbica.</div>
        </div>
      )}
    </div>
  )
}
