'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { modoDeSesion, duplicarSesion } from '@/lib/sesiones'
import { soloVigentes } from '@/lib/linaje'
import DetalleSesion from '@/app/pacientes/[id]/components/DetalleSesion'
import { Ic } from '@/lib/icons'

/**
 * Elegir la sesión de alguien, desde el taller.
 *
 * POR QUÉ NO ERA UN DESPLEGABLE. Lo era, con los nombres a secas, y con eso no se puede
 * decidir nada: "Tren inferior" y "Tren inferior (2ª tanda)" no se distinguen por el
 * nombre. Hay que ver qué lleva dentro, y para eso ya existe `DetalleSesion`, que es la
 * misma vista que se usa en la ficha y en la biblioteca. Una tercera forma de pintar una
 * sesión sería una tercera que mantener.
 *
 * DOS ORÍGENES, Y NO SE COMPORTAN IGUAL:
 *
 *   · LAS SUYAS — se asignan tal cual. Son de este paciente y ya están donde tienen que
 *     estar.
 *   · LA BIBLIOTECA — son PLANTILLAS, compartidas por todos (`paciente_id` a null). Una
 *     cita NUNCA apunta a una plantilla: se copia primero al paciente y se asigna la
 *     copia. Si no, el día que alguien retoque la plantilla estaría reescribiendo lo que
 *     ya se entrenó, y el histórico de todo el mundo cambiaría a la vez.
 *
 * La copia es la misma función que usa la ficha (`duplicarSesion`), así que el resultado
 * es idéntico se haga desde donde se haga.
 */
export default function ModalElegirSesion({ pacienteId, nombrePaciente, sesionActualId, onElegir, onCerrar }: {
  pacienteId: string
  nombrePaciente?: string
  sesionActualId?: string
  /** Recibe la sesión ya lista para asignar: si venía de biblioteca, ya es la copia. */
  onElegir: (sesion: any) => void
  onCerrar: () => void
}) {
  const [origen, setOrigen] = useState<'suyas' | 'biblioteca'>('suyas')
  const [suyas, setSuyas] = useState<any[]>([])
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [verDetalle, setVerDetalle] = useState<any>(null)
  const [copiando, setCopiando] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    (async () => {
      setCargando(true)
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from('sesiones').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
        supabase.from('sesiones').select('*').is('paciente_id', null).order('nombre'),
      ])
      // Solo las vigentes: proponer una tanda ya superada es proponer trabajo de hace tres
      // meses. La que tenga puesta la cita se conserva aunque sea vieja, para que se pueda
      // volver a ella tras haber mirado otras.
      const vig = soloVigentes(s || [], sesionActualId || null)
      setSuyas(vig); setPlantillas(p || [])
      // Si no tiene ninguna suya, se abre directamente en la biblioteca: es lo que va a
      // hacer igualmente y ahorra un clic en el peor momento, con el paciente delante.
      if (vig.length === 0) setOrigen('biblioteca')
      setCargando(false)
    })()
  }, [pacienteId, sesionActualId])

  const lista = useMemo(() => {
    const base = origen === 'suyas' ? suyas : plantillas
    const t = busca.trim().toLowerCase()
    if (!t) return base
    return base.filter((s: any) => (s.nombre || '').toLowerCase().includes(t) || (s.descripcion || '').toLowerCase().includes(t))
  }, [origen, suyas, plantillas, busca])

  const nEjercicios = (s: any) => (s.partes || []).reduce((n: number, p: any) => n + (p.ejercicios || []).length, 0)

  async function usar(s: any) {
    if (origen === 'suyas') { onElegir(s); return }
    setCopiando(true)
    // Sin sufijo: en la ficha del paciente "Tren inferior" se lee mejor que "Tren inferior
    // (copia)", y de dónde salió ya lo cuenta el evento que deja `duplicarSesion`.
    const r = await duplicarSesion(s, pacienteId, { sufijo: '' })
    setCopiando(false)
    if (!r.ok) { alert('No se ha podido copiar la sesión: ' + r.error); return }
    onElegir(r.sesion)
  }

  return (
    <>
      <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
        <div style={{ background: 'var(--w)', borderRadius: 'var(--rl)', width: '92vw', maxWidth: 620, maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--sh-md)', overflow: 'hidden' }}>

          <div style={{ padding: '13px 17px', borderBottom: '1px solid var(--bd)', background: 'var(--bl)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--n)' }}>Elegir sesión</div>
              {nombrePaciente && <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 2 }}>{nombrePaciente}</div>}
            </div>
            <button onClick={onCerrar} style={{ fontSize: 15, color: 'var(--gr)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>

          <div style={{ padding: '10px 17px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {([['suyas', 'Sus sesiones', suyas.length], ['biblioteca', 'Biblioteca', plantillas.length]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => setOrigen(k as any)}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'system-ui',
                  border: `1.5px solid ${origen === k ? 'var(--g)' : 'var(--bd)'}`,
                  background: origen === k ? 'var(--g)' : 'var(--w)', color: origen === k ? '#fff' : 'var(--gr)' }}>
                {l} <span style={{ opacity: .75 }}>{n}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <input className="input" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={{ maxWidth: 190, fontSize: 11 }} />
          </div>

          <div style={{ overflowY: 'auto', padding: '10px 17px 14px' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', padding: 30, fontSize: 10, color: 'var(--grl)' }}>Cargando…</div>
            ) : lista.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, fontSize: 10, color: 'var(--grl)' }}>
                {origen === 'suyas' ? 'Este paciente no tiene sesiones propias. Míralas en la biblioteca.' : 'Nada que coincida.'}
              </div>
            ) : lista.map((s: any) => {
              const esActual = s.id === sesionActualId
              return (
                <div key={s.id} style={{ border: `1px solid ${esActual ? 'var(--g)' : 'var(--bd)'}`, borderRadius: 8, padding: '9px 11px', marginBottom: 7, background: esActual ? 'var(--gl)' : 'var(--w)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--n)' }}>
                        {s.nombre}
                        {esActual && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 99, background: 'var(--g)', color: '#fff', marginLeft: 6 }}>puesta</span>}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 2 }}>
                        {textoModo(s)} · {nEjercicios(s)} ejercicios
                        {s.descripcion ? ' · ' + String(s.descripcion).slice(0, 70) : ''}
                      </div>
                    </div>
                    <button className="btn btn-t btn-sm" onClick={() => setVerDetalle(s)} style={{ fontSize: 10 }}>Ver</button>
                    <button className="btn btn-p btn-sm" onClick={() => usar(s)} disabled={copiando || esActual} style={{ fontSize: 10 }}>
                      {copiando ? '…' : esActual ? 'Puesta' : 'Usar'}
                    </button>
                  </div>
                </div>
              )
            })}

            {origen === 'biblioteca' && !cargando && lista.length > 0 && (
              <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 4, lineHeight: 1.5 }}>
                Al usar una de la biblioteca se le hace una copia propia al paciente. La plantilla
                no se toca, y a partir de ahí su sesión se puede ajustar sin afectar a nadie más.
              </div>
            )}
          </div>
        </div>
      </div>

      {verDetalle && <DetalleSesion sesion={verDetalle} onCerrar={() => setVerDetalle(null)} />}
    </>
  )
}

/** La etiqueta de modo, con el mismo cálculo que el resto de la app. */
function textoModo(s: any) {
  return modoDeSesion(s?.partes || []).nombre
}
