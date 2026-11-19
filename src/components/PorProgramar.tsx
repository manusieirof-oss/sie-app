'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// POR PROGRAMAR (en Hoy, para quien prepara entrenos). Que nadie se quede con citas sin
// sesión: quién tiene citas en las próximas dos semanas sin sesión puesta, y a quién se
// le acaba su plan (sql/plan-reparto.sql) en los próximos 7 días. Cada uno lleva a su
// calendario del torno.
// ---------------------------------------------------------------------------

const masDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

/** Hasta qué día dura un plan (null = sin fin). */
function finDelPlan(p: any): string | null {
  if (p.hasta_tipo === 'fecha' && p.hasta_fecha) return p.hasta_fecha
  if (p.hasta_tipo === 'semanas' && p.hasta_semanas) return masDias(p.inicio, 7 * p.hasta_semanas - 1)
  if (p.modo === 'bloques' && (p.orden || []).length) return masDias(p.inicio, 7 * Math.max(1, p.semanas) * p.orden.length - 1)
  return null
}

type Fila = { id: string, nombre: string, sinSesion: number, primera?: string, acaba?: string }

export default function PorProgramar({ caja }: { caja: React.CSSProperties }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => {
    const hoy = hoyISO(), en14 = masDias(hoy, 14), en7 = masDias(hoy, 7)
    Promise.all([
      supabase.from('citas').select('paciente_id,fecha,pacientes(nombre,apellidos,nombre_clinica)')
        .gte('fecha', hoy).lte('fecha', en14).is('sesion_id', null).not('estado', 'in', '(cancelada,falta)').order('fecha'),
      supabase.from('reparto_paciente').select('*,pacientes(nombre,apellidos,nombre_clinica)'),
    ]).then(([c, r]) => {
      const m = new Map<string, Fila>()
      const nom = (p: any) => { const x = Array.isArray(p) ? p[0] : p; return (x?.nombre_clinica || `${x?.nombre || ''} ${x?.apellidos || ''}`).trim() || 'Paciente' }
      ;(c.data || []).forEach((x: any) => {
        if (!x.paciente_id) return
        const f: Fila = m.get(x.paciente_id) || { id: x.paciente_id, nombre: nom(x.pacientes), sinSesion: 0 }
        f.sinSesion++; if (!f.primera) f.primera = x.fecha
        m.set(x.paciente_id, f)
      })
      ;(r.error ? [] : r.data || []).forEach((p: any) => {
        const fin = finDelPlan(p)
        if (!fin || fin < hoy || fin > en7) return
        const f: Fila = m.get(p.paciente_id) || { id: p.paciente_id, nombre: nom(p.pacientes), sinSesion: 0 }
        f.acaba = fin; m.set(p.paciente_id, f)
      })
      setFilas(Array.from(m.values()).sort((a, b) => (a.primera || a.acaba || '').localeCompare(b.primera || b.acaba || '')))
    })
  }, [])

  if (!filas || filas.length === 0) return null
  const corta = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const ver = verTodos ? filas : filas.slice(0, 6)
  return (
    <section style={caja}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Por programar <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--grl)' }}>· {filas.length}</span></h3>
      <div style={{ fontSize: 12, color: 'var(--gr)', marginBottom: 6 }}>Citas de las próximas dos semanas sin sesión, y planes que se acaban esta semana.</div>
      {ver.map(f => (
        <Link key={f.id} href={`/torno/${f.id}/citas`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--bl)', fontSize: 13.5, color: 'var(--n)', textDecoration: 'none' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nombre}</span>
          {f.sinSesion > 0 && <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: '#FCEFD6', color: '#7A5800', whiteSpace: 'nowrap' }}>
            {f.sinSesion} sin sesión · desde {corta(f.primera!)}</span>}
          {f.acaba && <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)', whiteSpace: 'nowrap' }}>
            su plan acaba el {corta(f.acaba)}</span>}
          <span style={{ color: 'var(--grl)' }}>›</span>
        </Link>
      ))}
      {filas.length > 6 && <button className="btn btn-t btn-sm" style={{ marginTop: 4 }} onClick={() => setVerTodos(v => !v)}>{verTodos ? 'Ver menos' : `Ver los ${filas.length}`}</button>}
    </section>
  )
}
