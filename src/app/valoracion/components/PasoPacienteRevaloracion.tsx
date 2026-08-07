'use client'
import { Ic } from '@/lib/icons'
import BuscadorPacientes from '@/components/BuscadorPacientes'

/**
 * Primer paso de la revaloración: a quién.
 *
 * No se piden datos: el paciente ya existe y sus datos están en su ficha, que es
 * donde se editan. Aquí solo se elige y se enseña de qué se viene, porque lo que
 * se va a escribir después —la anamnesis nueva, los tests— solo significa algo
 * comparado con lo anterior.
 */
export default function PasoPacienteRevaloracion({ form, pacientes, previo, cargando, onElegir, onLimpiar }: any) {
  const fmt = (f?: string) => f ? new Date(f + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const meses = (f?: string) => {
    if (!f) return null
    const d = Math.floor((Date.now() - new Date(f + 'T12:00:00').getTime()) / (30.44 * 24 * 3600 * 1000))
    return d < 1 ? 'este mes' : d === 1 ? 'hace 1 mes' : `hace ${d} meses`
  }

  return (
    <div className="g2">
      <div className="card">
        <div className="card-title">¿A quién se revalora?</div>
        <div className="field"><label>Paciente</label>
          <BuscadorPacientes
            pacientes={pacientes}
            valor={form.paciente_id}
            placeholder="Buscar por nombre, clínica o teléfono..."
            onElegir={onElegir}
            onLimpiar={onLimpiar} />
        </div>
        {!form.paciente_id && (
          <div style={{ fontSize: 10, color: 'var(--grl)', marginTop: 4 }}>
            La revaloración parte de una valoración anterior. Si el paciente aún no la tiene, hazle una valoración inicial desde la otra pestaña.
          </div>
        )}
        {cargando && <div style={{ fontSize: 11, color: 'var(--gr)', marginTop: 10 }}>Cargando su historial...</div>}

        {form.paciente_id && !cargando && previo && !previo.valoracion && (
          <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 6, background: 'var(--ambl)', border: '1px solid var(--amb)', fontSize: 10, color: '#8A6410', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <Ic name="alerta" size={12} /> Este paciente no tiene ninguna valoración registrada. Puedes seguir, pero no habrá nada con lo que comparar.
          </div>
        )}

        {previo?.valoracion && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--grl)', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 6 }}>
              Última valoración · {fmt(previo.valoracion.fecha)} {meses(previo.valoracion.fecha) && <span style={{ fontWeight: 400 }}>({meses(previo.valoracion.fecha)})</span>}
            </div>
            {previo.valoracion.anamnesis && (
              <div style={{ fontSize: 10, color: 'var(--n)', fontWeight: 300, lineHeight: 1.55, background: 'var(--bl)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 10px', whiteSpace: 'pre-line', maxHeight: 160, overflowY: 'auto' }}>
                {previo.valoracion.anamnesis}
              </div>
            )}
            {(previo.valoracion.objetivos || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--grl)', marginBottom: 4 }}>Objetivos que se marcó entonces</div>
                {(previo.valoracion.objetivos || []).map((o: string, i: number) => (
                  <div key={i} style={{ fontSize: 10, color: 'var(--n)', padding: '3px 8px', background: 'var(--gl)', borderRadius: 5, marginBottom: 3 }}>{o}</div>
                ))}
              </div>
            )}
            {(previo.valoracion.borg != null || previo.valoracion.estres != null) && (
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10 }}>
                <div><span style={{ color: 'var(--grl)' }}>Bienestar entonces: </span><span style={{ fontWeight: 500, color: 'var(--g)' }}>{previo.valoracion.borg}/10</span></div>
                <div><span style={{ color: 'var(--grl)' }}>Estrés: </span><span style={{ fontWeight: 500, color: 'var(--red)' }}>{previo.valoracion.estres}/10</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="test" /> Tests que trae abiertos</span></div>
        {!form.paciente_id && <div style={{ fontSize: 10, color: 'var(--grl)' }}>Elige un paciente para ver qué tiene pendiente.</div>}
        {form.paciente_id && !cargando && (previo?.positivos || []).length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--grl)' }}>
            No tiene ningún test positivo sin levantar. En el paso de Tests puedes añadir los que quieras pasarle igualmente.
          </div>
        )}
        {(previo?.positivos || []).length > 0 && (
          <>
            <div style={{ fontSize: 10, color: 'var(--grl)', marginBottom: 8, lineHeight: 1.5 }}>
              Dieron positivo la última vez, así que siguen abiertos: mantienen objetivos en marcha y etiquetas desaconsejadas. Se cargan en blanco en el paso de Tests —lo de entonces no se copia como resultado de hoy—.
            </div>
            {(previo.positivos || []).map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 6, background: 'var(--redl)', border: '1px solid #F5C8C8', marginBottom: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 11, color: 'var(--n)' }}>{p.nombre || 'Test'}</span>
                {p.lado !== 'bilateral' && <span style={{ fontSize: 9, color: 'var(--red)' }}>{p.lado}</span>}
                <span style={{ fontSize: 9, color: 'var(--grl)' }}>{fmt(p.fecha)}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
