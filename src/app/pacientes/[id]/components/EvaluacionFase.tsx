'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import { hoyISO } from '@/lib/fechas'
import { esCuestionario } from '@/lib/cuestionarios'
import { evaluacionDe, abrirEvaluacion, moverEvaluacion, borrarEvaluacion,
         contenidoDe, objetivosDeFaseDelPaciente, type Pendiente } from '@/lib/evaluaciones'

// ---------------------------------------------------------------------------
// LA EVALUACION DE UNA FASE
//
// No decide nada: dice que hay que pasarle y para cuando. El test se hace como
// siempre y cierra el objetivo como siempre; cuando estan todos, la fase avanza
// sola porque el sistema mira los objetivos logrados, no esta lista.
//
// Por eso puede quedarse a medias sin problema: dos el jueves, tres el lunes.
// ---------------------------------------------------------------------------

export default function EvaluacionFase({ pacienteId, asignacion, fase, color }: {
  pacienteId: string
  asignacion: any
  fase: any
  color: string
}) {
  const [ev, setEv] = useState<any>(null)
  const [lista, setLista] = useState<Pendiente[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => { cargar() }, [asignacion?.id, fase?.id])

  async function cargar() {
    setCargando(true)
    const e = await evaluacionDe(asignacion.id, fase.id)
    setEv(e)
    if (e) {
      const suyos = await objetivosDeFaseDelPaciente(pacienteId, fase.objetivos || [])
      setLista(await contenidoDe(e.id, suyos))
    } else {
      setLista([])
    }
    setCargando(false)
  }

  async function abrir() {
    const r = await abrirEvaluacion({ pacienteId, asignacionId: asignacion.id, faseId: fase.id })
    if (r.ok === false) { alert(r.error); return }
    setAbierto(true); cargar()
  }

  async function quitar() {
    if (confirm('¿Quitar la evaluación de esta fase? Los tests ya pasados se quedan.') === false) return
    await borrarEvaluacion(ev.id); cargar()
  }

  const nObj = (fase?.objetivos || []).length
  if (nObj === 0) return null

  const hechos = lista.filter(p => p.hecho).length
  const total = lista.length
  const completa = total > 0 && hechos === total

  return (
    <div style={{ border: '1px solid var(--bd)', borderLeft: `3px solid ${color}`, borderRadius: 7,
      padding: '8px 11px', marginTop: 8, background: 'var(--w)' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--gr)', letterSpacing: '.5px',
          textTransform: 'uppercase' }}>Evaluación</span>
        <span style={{ fontSize: 12, color: 'var(--n)' }}>{fase.nombre}</span>

        {cargando ? <span style={{ fontSize: 11, color: 'var(--grl)' }}>…</span>
          : ev == null ? (
            <>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--grl)' }}>Sin programar</span>
              <button className="btn btn-s btn-sm" onClick={abrir}>Evaluar esta fase</button>
            </>
          ) : (
            <>
              <span className={`pill ${completa ? 'pill-o on' : 'pill-soft'}`}>
                {hechos} de {total}
              </span>
              <input className="input" type="date" style={{ width: 145, padding: '4px 8px', fontSize: 12 }}
                value={ev.fecha || hoyISO()}
                onChange={e => { setEv({ ...ev, fecha: e.target.value }); moverEvaluacion(ev.id, { fecha: e.target.value }) }}/>
              <div style={{ flex: 1 }}/>
              <button className="pill pill-soft" style={{ border: 'none', cursor: 'pointer' }}
                onClick={() => setAbierto(v => v === false)}>
                {abierto ? 'ocultar' : 'ver qué falta'}
              </button>
              <button className="btn btn-s btn-sm" title="Quitar" onClick={quitar}>✕</button>
            </>
          )}
      </div>

      {ev && abierto && (
        <div style={{ marginTop: 9 }}>
          {total === 0 && (
            <div style={{ fontSize: 11, color: 'var(--gr)' }}>
              Los objetivos de esta fase no tienen ningún test ni cuestionario que los evalúe,
              o el paciente aún no los lleva. Se enganchan en Biblioteca → Objetivos.
            </div>
          )}
          {lista.map(p => (
            <div key={p.test.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0',
              borderTop: '1px solid var(--bd2)' }}>
              <span style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                border: `1.5px solid ${p.hecho ? 'var(--g)' : 'var(--bd)'}`,
                background: p.hecho ? 'var(--g)' : 'transparent' }}>{p.hecho ? '✓' : ''}</span>
              <span style={{ fontSize: 12, flex: 1, color: p.hecho ? 'var(--grl)' : 'var(--n)' }}>
                {esCuestionario(p.test) ? '✎ ' : '◎ '}{p.test.nombre}
              </span>
              {p.hecho && p.fecha && (
                <span style={{ fontSize: 10, color: 'var(--grl)' }}>
                  {new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
          {total > 0 && (
            <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 7, lineHeight: 1.6 }}>
              Se pasan donde siempre, desde su ficha. Al registrarlos se marcan aquí solos.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
