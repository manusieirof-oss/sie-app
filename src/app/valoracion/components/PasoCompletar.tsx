'use client'
import { Ic } from '@/lib/icons'
import PasoHistorial from './PasoHistorial'

/**
 * Paso de la revaloración: completar información.
 *
 * Solo AÑADE. Lo que el paciente ya tiene se enseña —para eso está `yaTiene`—
 * pero no se toca desde aquí: editar una patología o dar de baja una molestia se
 * hace en su ficha, que es su sitio. Un paso de valoración que pudiera modificar
 * el historial sería un segundo camino para lo mismo, y acabarían discrepando.
 *
 * El aviso de "esto ya lo tiene" va dentro de cada buscador, no en el resumen
 * final: cuando ya has añadido el duplicado, avisar no sirve de nada.
 */
export default function PasoCompletar(props: any) {
  const { form, up, deportesOpts, tiposPlantilla, yaTiene = {} } = props
  const deportesYa: string[] = yaTiene.deportes || []
  // Los que ya practica no se ofrecen: volver a marcarlos solo crearía una fila
  // repetida en deportes_paciente.
  const deportesLibres = (deportesOpts || []).filter((d: string) => !deportesYa.includes(d))

  return (
    <div>
      <div style={{ background: 'var(--bl)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', padding: '10px 13px', marginBottom: 10, fontSize: 10, color: 'var(--gr)', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <span style={{ color: 'var(--g)', flexShrink: 0, marginTop: 1 }}><Ic name="info" size={13} /></span>
        <span>Aquí solo se <strong style={{ fontWeight: 500 }}>añade</strong> lo que haya aparecido desde la última valoración. Lo que ya está registrado se muestra en gris y no se toca: para cambiarlo o darlo de baja, su ficha.</span>
      </div>

      <PasoHistorial {...props} yaTiene={yaTiene} />

      <div className="g2" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="deporte" /> Deportes</span></div>
          {deportesYa.length > 0 && (
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 9, color: 'var(--grl)', marginBottom: 4 }}>Ya practica</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {deportesYa.map((d: string) => (
                  <span key={d} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: 'var(--bl)', border: '1px solid var(--bd)', color: 'var(--grl)' }}>{d}</span>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--grl)', marginBottom: 6 }}>Añadir alguno nuevo</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {deportesLibres.map((d: string) => {
              const sel = (form.deportes || []).includes(d)
              return (
                <span key={d} onClick={() => {
                  const ds = form.deportes || []
                  up('deportes', sel ? ds.filter((x: string) => x !== d) : [...ds, d])
                  up('hace_deporte', true)
                }} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 99, border: `1px solid ${sel ? 'var(--g)' : 'var(--bd)'}`, background: sel ? 'var(--g)' : 'var(--w)', color: sel ? '#fff' : 'var(--gr)', cursor: 'pointer' }}>{d}</span>
              )
            })}
            {deportesLibres.length === 0 && <span style={{ fontSize: 10, color: 'var(--grl)' }}>Nada más que añadir de la lista.</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="plantillas" /> Plantillas</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: form.plantillas ? 10 : 0 }}>
            {([['No', false], ['Sí', true]] as const).map(([l, v]) => (
              <span key={String(l)} onClick={() => up('plantillas', v)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: `1.5px solid ${form.plantillas === v ? 'var(--g)' : 'var(--bd)'}`, background: form.plantillas === v ? 'var(--gl)' : 'var(--w)', color: form.plantillas === v ? 'var(--gd)' : 'var(--gr)', cursor: 'pointer', textAlign: 'center', fontSize: 11, fontWeight: form.plantillas === v ? 500 : 300 }}>{l}</span>
            ))}
          </div>
          {form.plantillas === true && (
            <div className="g2">
              <div className="field"><label>Pie izquierdo</label>
                <select className="input" value={form.plantilla_izq || ''} onChange={e => up('plantilla_izq', e.target.value)}>
                  <option value="">—</option>
                  {(tiposPlantilla || []).map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field"><label>Pie derecho</label>
                <select className="input" value={form.plantilla_der || ''} onChange={e => up('plantilla_der', e.target.value)}>
                  <option value="">—</option>
                  {(tiposPlantilla || []).map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
          <div style={{ fontSize: 9, color: 'var(--grl)', marginTop: 8 }}>Esto sí sustituye a lo anterior: las plantillas son un dato del paciente, no una lista que crece.</div>
        </div>
      </div>
    </div>
  )
}
