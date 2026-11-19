'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nombrePuesto } from '@/lib/permisos'
import { hoyISO } from '@/lib/fechas'

// ---------------------------------------------------------------------------
// USO DEL EQUIPO (dirección). ¿Lo usan de verdad, y para qué? Por persona y por semana:
// qué días entra, qué pantallas abre, cuánto apunta en clase y qué prepara.
//
// De dónde sale: `uso_app` (cada pantalla que abre cada uno, una vez al día) y la
// columna `hecho_por` que desde sql/uso-equipo.sql llevan las cosas que se apuntan
// (series, sesiones, valoraciones, tests, alertas, objetivos, citas). Lo de antes de
// ese SQL no tiene autor: se cuenta desde ese día. Los pacientes de prueba no cuentan,
// salvo en «Practicó».
// ---------------------------------------------------------------------------

type Fila = { uid: string, nombre: string, puesto: string, dias: Set<string>, pantallas: Map<string, number>, practico: number,
  clases: number, series: number, sesiones: number, valoraciones: number, tests: number, alertas: number, objetivos: number, citas: number, avisos: number }

const PANTALLA: Record<string, string> = { hoy: 'Hoy', agenda: 'Agenda', taller: 'Taller', torno: 'Torno', pacientes: 'Pacientes',
  valoracion: 'Valoración', entrenamiento: 'Biblioteca', movil: 'Móvil', resultados: 'Resultados', cobros: 'Cobros', finanzas: 'Finanzas' }

const lunes = (iso: string) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const masDias = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const corta = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function UsoEquipo() {
  const [desde, setDesde] = useState(() => lunes(hoyISO()))
  const hasta = masDias(desde, 6)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => { cargar() }, [desde]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setFilas(null); setAviso('')
    const ini = desde + 'T00:00:00', fin = masDias(desde, 7) + 'T00:00:00'
    const { data: perf } = await supabase.from('perfiles').select('user_id,nombre,rol,nivel,permisos')
    const { data: prac } = await supabase.from('pacientes').select('id').eq('practica', true)
    const dePrueba = new Set((prac || []).map((p: any) => p.id))
    const mapa = new Map<string, Fila>()
    ;(perf || []).filter((p: any) => p.user_id).forEach((p: any) => mapa.set(p.user_id, {
      uid: p.user_id, nombre: p.nombre || '—', puesto: nombrePuesto(p), dias: new Set(), pantallas: new Map(), practico: 0,
      clases: 0, series: 0, sesiones: 0, valoraciones: 0, tests: 0, alertas: 0, objetivos: 0, citas: 0, avisos: 0 }))
    const de = (uid: string | null) => (uid ? mapa.get(uid) : undefined)

    const uso = await supabase.from('uso_app').select('user_id,dia,pantalla,practica').gte('dia', desde).lte('dia', hasta)
    if (uso.error) setAviso('Falta ejecutar sql/uso-equipo.sql en Supabase: sin él no hay datos.')
    ;(uso.data || []).forEach((u: any) => {
      const f = de(u.user_id); if (!f) return
      f.dias.add(u.dia)
      if (u.practica) f.practico++
      else f.pantallas.set(u.pantalla, (f.pantallas.get(u.pantalla) || 0) + 1)
    })

    // Lo apuntado. Cada tabla, quién y cuándo (sin los pacientes de prueba).
    const traer = async (tabla: string, campos = 'hecho_por,paciente_id') => {
      const { data, error } = await supabase.from(tabla).select(campos).gte('hecho_en', ini).lt('hecho_en', fin).not('hecho_por', 'is', null).limit(5000)
      return error ? [] : (data || []).filter((r: any) => !r.paciente_id || !dePrueba.has(r.paciente_id))
    }
    const [reg, ses, val, tes, ale, obj, cit] = await Promise.all([
      traer('registros_ejercicio', 'hecho_por,paciente_id,fecha'), traer('sesiones'), traer('valoraciones'), traer('resultados_tests'),
      traer('alertas_paciente'), traer('pacientes_objetivos'), traer('citas'),
    ])
    const clasesVistas = new Set<string>()
    reg.forEach((r: any) => { const f = de(r.hecho_por); if (!f) return; f.series++
      const k = `${r.hecho_por}|${r.paciente_id}|${r.fecha}`; if (!clasesVistas.has(k)) { clasesVistas.add(k); f.clases++ } })
    ses.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.sesiones++ })
    val.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.valoraciones++ })
    tes.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.tests++ })
    ale.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.alertas++ })
    obj.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.objetivos++ })
    cit.forEach((r: any) => { const f = de(r.hecho_por); if (f) f.citas++ })
    // Avisos del buzón: guardan el nombre de quien avisa.
    const { data: av } = await supabase.from('avisos').select('autor_nombre').gte('created_at', ini).lt('created_at', fin)
    ;(av || []).forEach((a: any) => { const f = Array.from(mapa.values()).find(x => x.nombre === a.autor_nombre); if (f) f.avisos++ })

    setFilas(Array.from(mapa.values()).sort((a, b) => b.dias.size - a.dias.size || a.nombre.localeCompare(b.nombre, 'es')))
  }

  const semanaTxt = `${corta(desde)} – ${corta(hasta)}`
  const esEsta = desde === lunes(hoyISO())
  const cols: [keyof Fila, string, string][] = [
    ['clases', 'Clases', 'Personas a las que ha apuntado la clase (una por persona y día)'],
    ['series', 'Series', 'Ejercicios apuntados en el taller'],
    ['alertas', 'Alertas', 'Alertas puestas a pacientes'],
    ['sesiones', 'Sesiones', 'Sesiones creadas (torno, taller «para siempre»…)'],
    ['valoraciones', 'Valor.', 'Valoraciones y revaloraciones'],
    ['tests', 'Tests', 'Resultados de tests'],
    ['objetivos', 'Objet.', 'Objetivos puestos a pacientes'],
    ['citas', 'Citas', 'Citas dadas'],
    ['avisos', 'Avisos', 'Avisos enviados al buzón'],
  ]
  const totalDe = useMemo(() => (k: keyof Fila) => (filas || []).reduce((s, f) => s + (f[k] as number), 0), [filas])

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Uso del equipo</h1>
        <span style={{ flex: 1 }}/>
        <button className="btn btn-s btn-sm" onClick={() => setDesde(masDias(desde, -7))}>‹</button>
        <span style={{ fontSize: 14, minWidth: 130, textAlign: 'center' }}>{esEsta ? 'Esta semana' : semanaTxt}</span>
        <button className="btn btn-s btn-sm" disabled={esEsta} onClick={() => setDesde(masDias(desde, 7))}>›</button>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--gr)', marginBottom: 14 }}>Quién entra en SIE, qué pantallas abre y cuánto apunta. Los pacientes de prueba no cuentan, salvo en «Practicó».</div>
      {aviso && <div style={{ fontSize: 13, background: 'var(--ambl, #FCEFD6)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>{aviso}</div>}
      {!filas ? <div className="muted">Cargando…</div> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--gr)', fontSize: 11.5 }}>
                <th style={{ padding: '10px 14px' }}>Persona</th>
                <th style={{ padding: '10px 8px' }} title="Días de la semana en que ha entrado">Días</th>
                <th style={{ padding: '10px 8px' }}>Pantallas que usa</th>
                <th style={{ padding: '10px 8px' }} title="Veces que ha entrado en modo práctica">Practicó</th>
                {cols.map(([k, t, ayuda]) => <th key={k} title={ayuda} style={{ padding: '10px 8px', textAlign: 'right' }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const nada = f.dias.size === 0
                return (
                  <tr key={f.uid} style={{ borderTop: '1px solid var(--bl)', opacity: nada ? .5 : 1 }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontWeight: 600 }}>{f.nombre}</div><div style={{ fontSize: 11, color: 'var(--grl)' }}>{f.puesto}</div></td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: 7 }, (_, i) => masDias(desde, i)).map(d => (
                          <span key={d} title={corta(d)} style={{ width: 10, height: 10, borderRadius: 3, background: f.dias.has(d) ? 'var(--g)' : 'var(--bl)' }}/>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {nada ? <span style={{ color: 'var(--grl)' }}>No ha entrado</span> : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {Array.from(f.pantallas.entries()).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                            <span key={p} title={`${n} día${n === 1 ? '' : 's'}`} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 99, background: 'var(--gl)', color: 'var(--gd)' }}>{PANTALLA[p] || p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', color: f.practico ? 'var(--gd)' : 'var(--grl)' }}>{f.practico ? 'Sí' : '—'}</td>
                    {cols.map(([k]) => <td key={k} style={{ padding: '10px 8px', textAlign: 'right', color: (f[k] as number) ? 'var(--n)' : 'var(--grl)' }}>{(f[k] as number) || '—'}</td>)}
                  </tr>
                )
              })}
              <tr style={{ borderTop: '1.5px solid var(--bd)', fontWeight: 600 }}>
                <td style={{ padding: '10px 14px' }} colSpan={4}>Total</td>
                {cols.map(([k]) => <td key={k} style={{ padding: '10px 8px', textAlign: 'right' }}>{totalDe(k) || '—'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: 'var(--grl)', marginTop: 10 }}>Pasa el ratón por el título de cada columna para ver qué cuenta. Lo apuntado se cuenta desde que se ejecutó sql/uso-equipo.sql.</div>
    </div>
  )
}
