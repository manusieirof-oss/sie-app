'use client'
import { useEffect, useState } from 'react'
import { Ic } from '@/lib/icons'
import PiesPlantillas from '@/components/PiesPlantillas'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'
import { catalogoDeObjetivos, sugerencias, type ObjetivoPedido } from '@/lib/objetivosPide'

/**
 * Un objetivo del paciente, con lo que ya ha pedido otra gente a mano.
 *
 * El campo sigue siendo texto libre —nadie va a encajar su vida en una lista cerrada— pero
 * al escribir sugiere lo ya dicho. Es lo único que hace que "bajar de peso" y "perder peso"
 * acaben siendo la misma cosa: con texto libre a secas no se juntan jamás, y entonces no
 * hay forma de saber qué pide la gente de verdad.
 */
function CampoObjetivo({ label, valor, onCambio, placeholder, catalogo }: {
  label: string, valor: string, onCambio: (v: string) => void,
  placeholder: string, catalogo: ObjetivoPedido[],
}) {
  const [abierto, setAbierto] = useState(false)
  const lista = abierto ? sugerencias(catalogo, valor) : []
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label>{label}</label>
      <input className="input" value={valor} placeholder={placeholder}
        onChange={e => onCambio(e.target.value)}
        onFocus={() => setAbierto(true)}
        // Con retraso: sin él, el clic sobre una sugerencia cierra la lista antes de que
        // el navegador llegue a registrar la pulsación y no se selecciona nada.
        onBlur={() => setTimeout(() => setAbierto(false), 150)} />
      {lista.length > 0 && (
        <div style={{ position:'absolute', zIndex:20, left:0, right:0, background:'var(--w)',
          border:'1px solid var(--bd)', borderRadius:'var(--r)', boxShadow:'var(--sh-md)',
          marginTop:2, overflow:'hidden' }}>
          {lista.map(o => (
            <button key={o.texto} type="button"
              onClick={() => { onCambio(o.texto); setAbierto(false) }}
              style={{ display:'flex', width:'100%', alignItems:'center', gap:8, padding:'7px 11px',
                background:'none', border:'none', cursor:'pointer', textAlign:'left',
                fontSize:13, color:'var(--n)', fontFamily:'inherit' }}>
              <span style={{ flex:1 }}>{o.texto}</span>
              <span style={{ fontSize:11, color:'var(--grl)' }}>
                {o.veces === 1 ? '1 persona' : `${o.veces} personas`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PasoAnamnesis({ form, up, tiposJornada, deportesOpts, tiposPlantilla, modo='inicial', previo=null }: any) {
  // En la revaloración el deporte y las plantillas se preguntan en el paso de
  // completar, junto al resto del historial: aquí solo estarían por segunda vez.
  const esRevaloracion = modo === 'revaloracion'
  const anterior = previo?.valoracion || null

  // El catálogo se lee una vez al abrir el paso: es la lista de lo que ya ha pedido la
  // gente, y no cambia mientras rellenas una valoración.
  const [catalogo, setCatalogo] = useState<ObjetivoPedido[]>([])
  useEffect(() => { catalogoDeObjetivos().then(setCatalogo) }, [])
  return (
    <div>
      <div className="card" style={{marginBottom:8}}>
        <div className="card-title">{esRevaloracion?'Anamnesis de hoy · cómo se encuentra':'Anamnesis inicial · motivo de consulta'}</div>
        <textarea className="input" style={{minHeight:110,fontSize:13,lineHeight:1.6}} placeholder={esRevaloracion?'¿Cómo está desde la última valoración? Qué ha mejorado, qué sigue igual, qué ha aparecido...':'¿Por qué empieza en SIE? Situación actual, historial, expectativas...'} value={form.anamnesis} onChange={e=>up('anamnesis',e.target.value)}/>
        <div className="g2" style={{marginTop:8}}>
          <div className="field"><label>Trabajo / profesión</label><input className="input" value={form.trabajo} onChange={e=>up('trabajo',e.target.value)} placeholder="ej. Administrativo, enfermera..."/></div>
          <div className="field"><label>Tipo de jornada</label>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
              {/* VARIAS A LA VEZ (sentado y con pantallas, conductor y esfuerzo...). Se guarda
                  como texto "A, B" en la misma columna: en la ficha y el resumen se lee igual. */}
              {tiposJornada.map((j:string)=>{
                const marcadas = String(form.tipo_jornada||'').split(',').map((x:string)=>x.trim()).filter(Boolean)
                const on = marcadas.includes(j)
                return (
                  <span key={j} onClick={()=>up('tipo_jornada',(on?marcadas.filter((x:string)=>x!==j):[...marcadas,j]).join(', '))} style={{fontSize:10,padding:'4px 10px',borderRadius:99,border:`1px solid ${on?'var(--g)':'var(--bd)'}`,background:on?'var(--g)':'var(--w)',color:on?'#fff':'var(--gr)',cursor:'pointer'}}>{j}</span>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="g2" style={{marginBottom:8}}>
        <div className="card">
          <div className="card-title">Objetivos del paciente</div>
          {/* Lo que se marcó la vez anterior, para escribir los de hoy sabiendo de
              dónde se viene. Es una copia visual: no se arrastra a la nueva ficha. */}
          {esRevaloracion && (anterior?.objetivos||[]).length>0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,color:'var(--grl)',marginBottom:4}}>Se marcó entonces</div>
              {(anterior.objetivos||[]).map((o:string,i:number)=>(
                <div key={i} style={{fontSize:10,color:'var(--grl)',padding:'3px 8px',background:'var(--bl)',border:'1px solid var(--bd)',borderRadius:5,marginBottom:3}}>{o}</div>
              ))}
            </div>
          )}
          <CampoObjetivo label="Objetivo 1" valor={form.objetivo1} catalogo={catalogo}
            onCambio={v=>up('objetivo1',v)} placeholder="ej. Reducir dolor de espalda"/>
          <CampoObjetivo label="Objetivo 2" valor={form.objetivo2} catalogo={catalogo}
            onCambio={v=>up('objetivo2',v)} placeholder="ej. Ganar fuerza"/>
          <CampoObjetivo label="Objetivo 3" valor={form.objetivo3} catalogo={catalogo}
            onCambio={v=>up('objetivo3',v)} placeholder="ej. Perder peso"/>
          <div className="field"><label>Si pudiera concederle un deseo ¿cuál sería?</label><textarea className="input" style={{minHeight:60}} value={form.deseo} onChange={e=>up('deseo',e.target.value)} placeholder="ej. Poder jugar con mis hijos sin dolor..."/></div>
        </div>
        <div className="card">
          <div className="card-title">Escalas</div>
          <EscalaSlider label="Borg · bienestar general" valor={form.borg} onCambio={v=>up('borg',v)}
            izquierda="0 Mal" derecha="10 Perfecto"/>
          <EscalaSlider label="Nivel de estrés" valor={form.estres} onCambio={v=>up('estres',v)} color="var(--red)"
            izquierda="0 Sin estrés" derecha="10 Máximo"/>
          {esRevaloracion && anterior && (anterior.borg!=null||anterior.estres!=null) && (
            <div style={{fontSize:9,color:'var(--grl)',marginTop:2}}>
              En la valoración anterior: bienestar {textoEscala(anterior.borg)} · estrés {textoEscala(anterior.estres)}
            </div>
          )}
        </div>
      </div>
      {!esRevaloracion && (<div className="g2">
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="deporte"/> Deportes que practica</span></div>
          {/* Se marcan los que haga, varios a la vez; ninguno = no practica. Sin el Si/No
              de antes: era un clic de mas para llegar a lo que importa. */}
          <ElegirDeportes form={form} up={up} deportesOpts={deportesOpts}/>
        </div>
        <div className="card">
          <div className="card-title"><span className="ct-l"><Ic name="plantillas"/> Pies y plantillas</span></div>
          <PiesPlantillas form={form} up={up} tiposPlantilla={tiposPlantilla}/>
        </div>
      </div>)}
    </div>
  )
}

/** Deportes: todos a la vista, varios marcables, y uno que no este se escribe y entra. */
export function ElegirDeportes({ form, up, deportesOpts }: any) {
  const [nuevo, setNuevo] = useState('')
  const marcados: string[] = form.deportes || []
  const lista: string[] = Array.from(new Set([...(deportesOpts || []), ...marcados])).filter(d => d !== 'Otro')
  const poner = (ds: string[]) => { up('deportes', ds); up('hace_deporte', ds.length > 0) }
  const anadir = () => {
    const t = nuevo.trim()
    if (!t) return
    const ya = lista.find(d => d.toLowerCase() === t.toLowerCase())
    if (!marcados.includes(ya || t)) poner([...marcados, ya || t])
    setNuevo('')
  }
  return (
    <div>
      <div className="dep-chips">
        {lista.map(d => {
          const on = marcados.includes(d)
          return <button key={d} type="button" className={`dep-chip ${on ? 'on' : ''}`}
            onClick={() => poner(on ? marcados.filter(x => x !== d) : [...marcados, d])}>{d}</button>
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input className="input" value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Otro deporte…"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadir() } }}/>
        <button type="button" className="btn btn-s" onClick={anadir} disabled={!nuevo.trim()}>Añadir</button>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--grl)', marginTop: 6 }}>
        {marcados.length ? `${marcados.length} marcado${marcados.length > 1 ? 's' : ''}` : 'Ninguno marcado = no practica'}
      </div>
    </div>
  )
}
