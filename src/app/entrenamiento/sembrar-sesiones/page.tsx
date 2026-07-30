'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { SESIONES } from '@/lib/semillaSesiones'
import { modoParte } from '@/lib/sesiones'

/**
 * Alta de las sesiones genéricas: las plantillas de las que se parte.
 *
 * Van sin paciente. Una sesión con paciente es la que se ejecuta y se anota; estas son
 * el molde, y si llevaran paciente cualquiera que las tocara estaría cambiando el molde
 * de todos los demás.
 *
 * Los ejercicios se referencian por NOMBRE y se resuelven contra la biblioteca. De ella
 * se copian imagen, variantes disponibles y cómo se mide, que es lo que el editor de
 * sesión espera encontrar dentro de la parte.
 */

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

type Linea = { texto: string, estado: 'ok' | 'aviso' | 'error' | 'info' }
type Problema = { sesion: string, que: string }

export default function SembrarSesionesPage() {
  const [log, setLog] = useState<Linea[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [problemas, setProblemas] = useState<Problema[] | null>(null)

  const anota = (texto: string, estado: Linea['estado'] = 'info') => setLog(l => [...l, { texto, estado }])

  useEffect(() => { comprobar() }, [])

  /**
   * Comprobación PREVIA, antes de tocar nada: qué ejercicios y variantes de las
   * plantillas no existen en la biblioteca. Es el mismo problema que teníamos con las
   * etiquetas y la misma solución: el aviso va donde se toma la decisión, no en el
   * recibo de después.
   */
  async function comprobar() {
    const { data } = await supabase.from('ejercicios').select('nombre,variantes')
    const porNombre: Record<string, any> = {}
    ;(data || []).forEach((e: any) => { porNombre[norm(e.nombre)] = e })

    const fallos: Problema[] = []
    SESIONES.forEach(s => s.partes.forEach(p => p.ejercicios.forEach(ej => {
      const e = porNombre[norm(ej.ejercicio)]
      if (!e) { fallos.push({ sesion: s.nombre, que: `no existe el ejercicio "${ej.ejercicio}"` }); return }
      if (ej.variante && !(e.variantes || []).some((v: any) => norm(v?.nombre) === norm(ej.variante!))) {
        fallos.push({ sesion: s.nombre, que: `"${ej.ejercicio}" no tiene la variante "${ej.variante}"` })
      }
    })))
    setProblemas(fallos)
  }

  async function sembrar() {
    setCorriendo(true); setLog([])

    const { data: ejs } = await supabase.from('ejercicios').select('id,nombre,imagen_url,variantes,tipo_medida')
    const porNombre: Record<string, any> = {}
    ;(ejs || []).forEach((e: any) => { porNombre[norm(e.nombre)] = e })

    // Solo se miran las que NO tienen paciente: una sesión con el mismo nombre asignada
    // a alguien es suya, no la plantilla, y machacarla sería borrarle el trabajo.
    const { data: existentes } = await supabase.from('sesiones')
      .select('id,nombre').is('paciente_id', null)

    let creadas = 0, actualizadas = 0
    const faltan = new Set<string>()

    for (const s of SESIONES) {
      const partes = s.partes.map(p => ({
        nombre: p.nombre,
        modo: p.modo || 'ejercicio',
        ...(p.tipo_tiempo ? { tipo_tiempo: p.tipo_tiempo } : {}),
        ...(p.minutos ? { minutos: p.minutos } : {}),
        ...(p.intervalo ? { intervalo: p.intervalo } : {}),
        ...(p.vueltas ? { vueltas: p.vueltas } : {}),
        ...(p.descanso ? { descanso: p.descanso } : {}),
        ejercicios: p.ejercicios.map(ej => {
          const e = porNombre[norm(ej.ejercicio)]
          if (!e) { faltan.add(ej.ejercicio); return null }
          return {
            ejercicio_id: e.id,
            nombre: e.nombre,
            variante: ej.variante || '',
            // Solo lo usa el modo superserie, pero se guarda siempre: si mañana
            // cambias la parte a superserie, los grupos ya están puestos.
            grupo: ej.grupo || 'A',
            capacidad: ej.capacidad || '',
            regimen: ej.regimen || 'Concéntrico',
            series: ej.series || '',
            reps: ej.reps || '',
            peso: '',
            tiempo: ej.tiempo || '',
            nota: ej.nota || '',
            // Copia de la biblioteca: la sesión guarda su propia foto del ejercicio
            // para que renombrarlo o cambiarle la imagen no reescriba lo ya prescrito.
            imagen_url: e.imagen_url || '',
            variantes_disp: e.variantes || [],
            tipo_medida: e.tipo_medida || 'peso_reps',
          }
        }).filter(Boolean),
      }))

      const campos = { nombre: s.nombre, descripcion: s.descripcion, partes }
      const ya = (existentes || []).find((x: any) => norm(x.nombre) === norm(s.nombre))

      if (ya) {
        const { error } = await supabase.from('sesiones').update(campos).eq('id', ya.id)
        if (error) { anota(`${s.nombre} — error: ${error.message}`, 'error'); continue }
        actualizadas++
      } else {
        const { error } = await supabase.from('sesiones')
          .insert({ ...campos, paciente_id: null, estado: 'lista' })
        if (error) { anota(`${s.nombre} — error: ${error.message}`, 'error'); continue }
        creadas++
      }

      const n = partes.reduce((a, p) => a + p.ejercicios.length, 0)
      const modos = Array.from(new Set(partes.map(p => modoParte(p.modo).nombre))).join(', ')
      anota(`${s.nombre} — ${ya ? 'actualizada' : 'creada'} · ${partes.length} partes, ${n} ejercicios · ${modos}`, 'ok')
    }

    if (faltan.size > 0) anota(`Ejercicios que no están en la biblioteca y se han omitido: ${Array.from(faltan).join(', ')}`, 'aviso')
    anota(`Resumen: ${creadas} creadas, ${actualizadas} actualizadas.`, 'info')
    setCorriendo(false)
  }

  const totalEj = SESIONES.reduce((a, s) => a + s.partes.reduce((b, p) => b + p.ejercicios.length, 0), 0)

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>
      <div className="panel">
        <div className="sec">
          <div className="sec-h">
            <span className="sh-l"><span className="ct-l"><Ic name="lista" size={13} /> Sembrar sesiones genéricas</span></span>
            <span className="sh-r">{SESIONES.length} sesiones · {totalEj} ejercicios</span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--gr)', lineHeight: 1.6, marginBottom: 14 }}>
            Crea las plantillas de sesión, <b>sin paciente asignado</b>. Si una ya existe
            con el mismo nombre y sin paciente, se actualiza en vez de duplicarse. Las
            sesiones que ya tengas asignadas a alguien no se tocan.
          </p>

          {problemas !== null && (
            problemas.length === 0 ? (
              <div className="fila-p" style={{ borderLeftColor: 'var(--g)', marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>
                  Todos los ejercicios y variantes de las plantillas existen en la biblioteca.
                </span>
              </div>
            ) : (
              <div className="fila-p" style={{ borderLeftColor: 'var(--amb)', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--n)', marginBottom: 6 }}>
                  <b>{problemas.length} referencia{problemas.length === 1 ? '' : 's'} sin resolver.</b> Siembra
                  antes la biblioteca en <a href="/entrenamiento/sembrar" style={{ color: 'var(--gd)' }}>sembrar ejercicios</a>.
                </div>
                {problemas.slice(0, 20).map((p, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--gr)', lineHeight: 1.6 }}>
                    <b style={{ color: 'var(--n)' }}>{p.sesion}</b> — {p.que}
                  </div>
                ))}
              </div>
            )
          )}

          <button className="btn btn-p" onClick={sembrar} disabled={corriendo}>
            {corriendo ? 'Sembrando…' : <><Ic name="guardar" size={13} /> Crear las sesiones</>}
          </button>
        </div>

        {log.length > 0 && (
          <div className="sec">
            <div className="sec-h"><span className="sh-l"><span className="ct-l">Resultado</span></span></div>
            {log.map((l, i) => (
              <div key={i} className="fila-p" style={{
                borderLeftColor: l.estado === 'ok' ? 'var(--g)' : l.estado === 'error' ? 'var(--red)' : l.estado === 'aviso' ? 'var(--amb)' : 'var(--bd)',
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 13, color: 'var(--n)' }}>{l.texto}</span>
              </div>
            ))}
            {!corriendo && (
              <a href="/entrenamiento" className="btn btn-s btn-sm" style={{ marginTop: 10 }}>Ver las sesiones</a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
