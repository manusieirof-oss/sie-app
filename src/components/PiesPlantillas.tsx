'use client'

/**
 * PIES Y PLANTILLAS, con dibujo.
 *
 * Lo primero que se mira es el pie, no la plantilla: cavo, normal o plano (o "no se
 * sabe", que es dejarlo sin marcar). La huella cambia con lo marcado, asi se ve de un
 * vistazo y nadie confunde cual es cual. Debajo, si lleva plantillas y de que tipo.
 */
export type TipoPie = '' | 'cavo' | 'normal' | 'plano'
const TIPOS: { v: TipoPie, t: string }[] = [{ v: 'cavo', t: 'Cavo' }, { v: 'normal', t: 'Normal' }, { v: 'plano', t: 'Plano' }]

/** Huella del pie derecho (el izquierdo es su espejo). El arco interno se estrecha con el cavo. */
function Huella({ tipo, izquierdo }: { tipo: TipoPie, izquierdo?: boolean }) {
  // x del borde interno a mitad de pie: plano = lleno, normal = media luna, cavo = casi nada.
  const m = tipo === 'plano' ? 32 : tipo === 'cavo' ? 75 : tipo === 'normal' ? 52 : 46
  const relleno = tipo ? 'var(--g)' : '#DCD8CF'
  return (
    <svg viewBox="0 0 100 220" width="74" height="162" style={{ transform: izquierdo ? 'scaleX(-1)' : undefined, display: 'block' }}>
      <g fill={relleno} opacity={tipo ? .85 : 1}>
        <circle cx="33" cy="24" r="11"/><circle cx="52" cy="15" r="7"/><circle cx="65" cy="18" r="6"/>
        <circle cx="76" cy="26" r="5.5"/><circle cx="85" cy="37" r="5"/>
        <ellipse cx="56" cy="66" rx="31" ry="21"/>
        <ellipse cx="54" cy="184" rx="23" ry="29"/>
        <path d={`M 84 70 C 86 110, 80 150, 76 168 L 34 170 C ${m} 150, ${m} 100, 30 74 Z`} style={{ transition: 'd .25s' }}/>
      </g>
    </svg>
  )
}

export default function PiesPlantillas({ form, up, tiposPlantilla }: { form: any, up: (k: string, v: any) => void, tiposPlantilla: string[] }) {
  const lado = (k: 'izq' | 'der', nombre: string) => {
    const tipo: TipoPie = form[`pie_${k}`] || ''
    return (
      <div className="pp-lado">
        <Huella tipo={tipo} izquierdo={k === 'izq'}/>
        <div className="pp-nombre">{nombre}</div>
        <div className="pp-chips">
          {TIPOS.map(o => (
            <button key={o.v} type="button" className={`pp-chip ${tipo === o.v ? 'on' : ''}`}
              onClick={() => up(`pie_${k}`, tipo === o.v ? '' : o.v)}>{o.t}</button>
          ))}
        </div>
        {form.plantillas && (
          <select className="input" style={{ marginTop: 8 }} value={form[`plantilla_${k}`] || ''} onChange={e => up(`plantilla_${k}`, e.target.value)}>
            <option value="">Plantilla…</option>
            {tiposPlantilla.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>
    )
  }
  return (
    <div>
      <div className="pp-pies">{lado('izq', 'Izquierdo')}{lado('der', 'Derecho')}</div>
      <label className="pp-usa">
        <span className={`pp-switch ${form.plantillas ? 'on' : ''}`} onClick={() => up('plantillas', !form.plantillas)}><span/></span>
        <span onClick={() => up('plantillas', !form.plantillas)}>Usa plantillas</span>
      </label>
      <div style={{ fontSize: 11.5, color: 'var(--grl)', textAlign: 'center', marginTop: 4 }}>Sin marcar = no se sabe</div>
    </div>
  )
}
