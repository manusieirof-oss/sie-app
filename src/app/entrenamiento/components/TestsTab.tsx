'use client'
import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { UNIDADES, unidadDe, mide, textoRegla, problemasDelTest, alcanceBorradoTest, borrarTest, esSuma, bandasDe, rangoTotal } from '@/lib/tests'
import ExploradorTests from '@/components/ExploradorTests'
import SelectorEtiquetasCompacto from '@/components/SelectorEtiquetasCompacto'
import { ordenAnatomico } from '@/lib/anatomia'

const CATEGORIAS = [
  { key: 'musculo', label: 'Músculo' },
  { key: 'articulacion', label: 'Articulación' },
  { key: 'movimiento', label: 'Movimiento' },
  { key: 'posicion', label: 'Posición' },
  { key: 'material', label: 'Material' },
  { key: 'apoyo', label: 'Apoyo' },
  { key: 'agarre', label: 'Agarre' },
  { key: 'patologia', label: 'Patología' },
  { key: 'plano_eje', label: 'Plano y eje' },
]

/**
 * La BARRA de un ítem medido: de dónde a dónde va y qué valor es un hallazgo.
 *
 * Sin esto, un ítem con unidad se rellenaba marcando una casilla y escribiendo el número
 * al lado, o sea que el veredicto lo ponías tú cada vez. Con la regla puesta, el positivo
 * lo decide el propio valor y siempre igual.
 *
 * Va en un componente y no copiado en los dos formularios —crear y editar— porque son el
 * mismo formulario dos veces y ya se nota: el de editar arrastra diferencias del de crear.
 */
function ConfigBarra({ item, onCambia, soloRango = false }: { item: any, onCambia: (campos: any) => void, soloRango?: boolean }) {
  if (!mide(item)) return null
  const u = unidadDe(item).simbolo.trim()
  const dosUmbrales = item.regla === 'entre' || item.regla === 'fuera'
  const num = (v: string) => v === '' ? undefined : Number(v)

  /* En un test de puntuación el ítem no decide nada por su cuenta: solo aporta su número
     al total. Enseñar aquí "Positivo si es..." invitaría a poner una regla que después se
     ignora, que es la clase de campo que hace desconfiar de toda la pantalla. */
  if (soloRango) {
    return (
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--bd)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Puntúa de</span>
        <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.min ?? ''}
          onChange={e => onCambia({ min: num(e.target.value) })} placeholder="mín" />
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
        <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.max ?? ''}
          onChange={e => onCambia({ max: num(e.target.value) })} placeholder="máx" />
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>{u}</span>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--bd)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>Positivo si es</span>
        <select className="input" style={{ width: 128, fontSize: 11 }} value={item.regla || ''}
          onChange={e => onCambia({ regla: e.target.value || undefined })}>
          <option value="">— sin barra —</option>
          <option value="menor">menor que</option>
          <option value="mayor">mayor que</option>
          <option value="entre">está entre</option>
          <option value="fuera">está fuera de</option>
        </select>
        {item.regla && (
          <>
            <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral ?? ''}
              onChange={e => onCambia({ umbral: num(e.target.value) })} placeholder="valor" />
            {dosUmbrales && (
              <>
                <span style={{ fontSize: 10, color: 'var(--grl)' }}>y</span>
                <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={item.umbral2 ?? ''}
                  onChange={e => onCambia({ umbral2: num(e.target.value) })} placeholder="valor" />
              </>
            )}
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>{u}</span>
            <span style={{ fontSize: 10, color: 'var(--grl)', marginLeft: 8 }}>Barra de</span>
            {/* El mínimo admite negativos: hay medidas que los tienen. */}
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.min ?? ''}
              onChange={e => onCambia({ min: num(e.target.value) })} placeholder="mín" />
            <span style={{ fontSize: 10, color: 'var(--grl)' }}>a</span>
            <input className="input" type="number" style={{ width: 66, fontSize: 11 }} value={item.max ?? ''}
              onChange={e => onCambia({ max: num(e.target.value) })} placeholder="máx" />
          </>
        )}
      </div>
      {item.regla && (
        <div style={{ fontSize: 10, color: 'var(--gd)', marginTop: 4 }}>
          {textoRegla(item) || 'Rellena el valor para ver la regla'}
        </div>
      )}
    </div>
  )
}

/**
 * Las BANDAS de un test de puntuación: en qué se convierte el total.
 *
 * Un FPI-6 que suma 9 no es "positivo" a secas, es un pie pronado, y esa palabra es la que
 * se lee luego en el historial. Cada banda dice además si caer ahí cuenta como hallazgo,
 * que es lo que se traduce al positivo/negativo con el que trabaja el resto de la app: sin
 * eso habría que decidirlo a mano en cada resultado, y se decidiría distinto cada vez.
 *
 * Se leen por TECHO, no por orden de escritura: el total cae en la primera banda cuyo
 * techo alcanza. Así se pueden añadir en cualquier orden sin que cambie el significado.
 */
function EditorBandas({ bandas, items, onCambia }: { bandas: any, items: any[], onCambia: (b: any[]) => void }) {
  const lista: any[] = Array.isArray(bandas) ? bandas : []
  const rango = rangoTotal(items)
  const ordenadas = bandasDe({ bandas: lista })
  const set = (i: number, campos: any) => { const b = [...lista]; b[i] = { ...b[i], ...campos }; onCambia(b) }

  return (
    <div className="field">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ margin: 0 }}>Bandas del total</label>
        <span style={{ fontSize: 10, color: 'var(--grl)' }}>
          {rango ? `El total puede ir de ${rango.min} a ${rango.max}` : 'Pon mín y máx en los ítems para saber el rango'}
        </span>
      </div>

      {lista.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--grl)', marginBottom: 6 }}>
          Sin bandas el total es un número suelto: el test no podría dar ni positivo ni negativo.
        </div>
      )}

      {lista.map((b: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, background: 'var(--bl)', borderRadius: 5, padding: '6px 8px', border: '1px solid var(--bd)' }}>
          <span style={{ fontSize: 10, color: 'var(--grl)', whiteSpace: 'nowrap' }}>Hasta</span>
          <input className="input" type="number" style={{ width: 74, fontSize: 11 }} value={b?.hasta ?? ''}
            onChange={e => set(i, { hasta: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="techo" />
          <input className="input" style={{ flex: 1, fontSize: 11 }} value={b?.etiqueta || ''}
            onChange={e => set(i, { etiqueta: e.target.value })} placeholder="ej. Normal" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: b?.hallazgo ? 'var(--red)' : 'var(--grl)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={!!b?.hallazgo} onChange={e => set(i, { hallazgo: e.target.checked })}
              style={{ width: 15, height: 15, accentColor: 'var(--red)', cursor: 'pointer' }} />
            Hallazgo
          </label>
          <button onClick={() => onCambia(lista.filter((_, j) => j !== i))}
            style={{ fontSize: 11, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      ))}

      <button className="btn btn-t btn-sm" onClick={() => onCambia([...lista, { hasta: undefined, etiqueta: '', hallazgo: false }])}>
        + Añadir banda
      </button>

      {/* Cómo queda leído de verdad, ordenado por techo. Escribir "hasta 5" debajo de
          "hasta 9" no cambia nada, y verlo evita tener que fiarse de eso. */}
      {ordenadas.length > 0 && (
        <div style={{ marginTop: 7, fontSize: 10, color: 'var(--gr)', lineHeight: 1.7 }}>
          {ordenadas.map((b, i) => {
            const desde = i === 0 ? (rango ? rango.min : '−∞') : ordenadas[i - 1].hasta + 1
            return (
              <div key={i}>
                <span style={{ color: b.hallazgo ? 'var(--red)' : 'var(--gd)' }}>
                  {desde} a {b.hasta}
                </span>
                {' · '}{b.etiqueta || <span style={{ color: 'var(--grl)' }}>sin nombre</span>}
                {' · '}{b.hallazgo ? '+ positivo' : '− negativo'}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const FAMILIAS_OBJ = [
  { id: 'metrico', nombre: 'Medibles' },
  { id: 'fase', nombre: 'Por fases' },
  { id: 'cualitativo', nombre: 'Cualitativos' },
] as const

/**
 * Los objetivos que abre un ítem.
 *
 * Antes se pintaban LOS 22 debajo de cada ítem. Con cuatro ítems eran ochenta y ocho
 * píldoras de 8 px, y para saber cuáles estaban puestas había que leerlas todas buscando
 * las de color.
 *
 * Ahora se ven solo los puestos, y el buscador se abre con los mismos tres filtros que la
 * biblioteca de objetivos —familia, zona y texto—. Es a propósito: si allí se busca así,
 * aquí buscar de otra manera obliga a aprender dos sistemas para lo mismo.
 *
 * NO se sale del formulario. Llevarte a la pestaña de objetivos habría sido más cómodo de
 * programar, pero el test que estás editando vive solo en pantalla hasta que guardas: irse
 * a otro sitio se lleva por delante el nombre, la descripción y los ítems escritos.
 */
function PildorasObjetivos({ seleccionados, objetivos, etiquetas = [], onToggle, movimientos = {}, onMovimiento }: any) {
  const [abierto, setAbierto] = useState(false)
  const [busca, setBusca] = useState('')
  const [familia, setFamilia] = useState('')
  const [zona, setZona] = useState('')

  const sel = seleccionados || []
  const nombreEt = (id: string) => (etiquetas || []).find((e: any) => e.id === id)?.nombre || ''

  /** Las zonas que de verdad se usan, de la cabeza a los pies. Igual que en la biblioteca. */
  const zonas = useMemo(() => {
    const ids = Array.from(new Set([
      ...(objetivos || []).map((o: any) => o.articulacion_id),
      ...(objetivos || []).flatMap((o: any) => o.etiquetas || []),
    ].filter(Boolean))) as string[]
    return ids.map(id => ({ id, nombre: nombreEt(id) }))
      .filter(z => z.nombre)
      .sort((a, b) => ordenAnatomico(a.nombre, b.nombre))
  }, [objetivos, etiquetas])

  if (!objetivos || objetivos.length===0) return null

  const puestos = objetivos.filter((o:any)=>sel.includes(o.id))
  const q = busca.toLowerCase().trim()
  const resto = objetivos.filter((o:any)=>{
    if (sel.includes(o.id)) return false
    const mQ = !q || (o.nombre||'').toLowerCase().includes(q) || (o.descripcion||'').toLowerCase().includes(q)
    const mF = !familia || (o.tipo||'cualitativo') === familia
    // Por articulación O por etiqueta libre: "Trocantéritis" tiene que encontrar el
    // objetivo que la lleva como patología y no como zona.
    const mZ = !zona || o.articulacion_id === zona || (o.etiquetas||[]).includes(zona)
    return mQ && mF && mZ
  })

  return (
    <div style={{marginTop:5,marginLeft:2}}>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
        <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
        {puestos.length===0 && <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>}
        {puestos.map((o:any)=>{
          /* EL MOVIMIENTO SE FIJA AQUÍ, no en la ficha del paciente.
             El test ya sabe qué mide —el lunge mide dorsiflexión, siempre—, así que
             preguntarlo otra vez con el paciente delante es repetir un trabajo que se
             puede hacer una vez en la biblioteca. Si se deja sin elegir, se comporta como
             antes y el movimiento se decide al asignar la meta. */
          const movs = (o.movimientos||[]).map((id:string)=>({ id, nombre: nombreEt(id) })).filter((m:any)=>m.nombre)
          const elegido = movimientos?.[o.id] || ''
          return (
            <span key={o.id} style={{display:'inline-flex',alignItems:'center',gap:0,borderRadius:99,background:o.color||'var(--g)',color:'#fff',overflow:'hidden'}}>
              <span style={{fontSize:9,padding:'2px 4px 2px 8px'}}>{o.nombre}</span>
              {(o.tipo==='metrico'&&movs.length>0&&onMovimiento) && (
                <select value={elegido} onChange={e=>onMovimiento(o.id, e.target.value)}
                  title="Movimiento concreto que mide este ítem"
                  style={{fontSize:9,border:'none',background:'rgba(255,255,255,.22)',color:'#fff',padding:'2px 4px',cursor:'pointer',fontFamily:'inherit',maxWidth:130}}>
                  <option value="" style={{color:'var(--n)'}}>— sin concretar —</option>
                  {movs.map((m:any)=><option key={m.id} value={m.id} style={{color:'var(--n)'}}>{m.nombre}</option>)}
                </select>
              )}
              <span onClick={()=>onToggle(o.id)} title="Quitar"
                style={{fontSize:10,padding:'2px 8px 2px 5px',cursor:'pointer',opacity:.75}}>✕</span>
            </span>
          )
        })}
        <button onClick={()=>setAbierto(v=>!v)}
          style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',border:'1px dashed var(--bd)',background:'var(--w)',color:'var(--g)',fontFamily:'inherit'}}>
          {abierto ? 'Cerrar' : '+ Objetivo'}
        </button>
      </div>

      {abierto && (
        <div style={{marginTop:5,border:'1px solid var(--bd)',borderRadius:6,overflow:'hidden'}}>
          {/* FILTROS Y RESULTADOS TIENEN QUE DISTINGUIRSE.
              Iban los dos como píldoras del mismo tamaño, uno debajo del otro, y no había
              forma de saber qué era un filtro y qué un objetivo que ibas a añadir. Ahora
              los filtros van sobre fondo gris y con su rótulo; los resultados, en lista
              blanca debajo. */}
          <div style={{background:'var(--bl)',padding:'7px 8px',borderBottom:'1px solid var(--bd)'}}>
            <input className="input" value={busca} onChange={e=>setBusca(e.target.value)}
              placeholder="Buscar objetivo..." style={{fontSize:11,marginBottom:6}}/>

            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginBottom:zonas.length>0?5:0}}>
              <span style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',width:42}}>Familia</span>
              {FAMILIAS_OBJ.map(f=>(
                <span key={f.id} onClick={()=>setFamilia(familia===f.id?'':f.id)}
                  style={{fontSize:9,padding:'2px 9px',borderRadius:99,cursor:'pointer',
                    border:`1.5px solid ${familia===f.id?'var(--g)':'var(--bd)'}`,
                    background:familia===f.id?'var(--g)':'var(--w)',color:familia===f.id?'#fff':'var(--gr)'}}>
                  {f.nombre}
                </span>
              ))}
            </div>

            {zonas.length>0 && (
              <div style={{display:'flex',alignItems:'flex-start',gap:5,flexWrap:'wrap'}}>
                <span style={{fontSize:8,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',width:42,paddingTop:3}}>Zona</span>
                <div style={{display:'flex',flexWrap:'wrap',gap:4,flex:1}}>
                  {zonas.map(z=>(
                    <span key={z.id} onClick={()=>setZona(zona===z.id?'':z.id)}
                      style={{fontSize:9,padding:'2px 8px',borderRadius:99,cursor:'pointer',
                        border:`1.5px solid ${zona===z.id?'var(--gd)':'var(--bd)'}`,
                        background:zona===z.id?'var(--gd)':'var(--w)',color:zona===z.id?'#fff':'var(--gr)'}}>
                      {z.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LISTA VERTICAL, no píldoras sueltas. Los nombres son largos y al envolverse
              cortaban la última fila por la mitad, sin que se viera que había más abajo.
              Una fila por objetivo se lee y se desplaza sin sorpresas. */}
          <div style={{maxHeight:190,overflowY:'auto',background:'var(--w)'}}>
            {resto.length===0
              ? <div style={{fontSize:10,color:'var(--grl)',padding:'10px 9px'}}>
                  {puestos.length>0 && !q && !familia && !zona ? 'Ya están todos puestos.' : 'Nada que coincida.'}
                </div>
              : resto.map((o:any)=>(
                <div key={o.id} onClick={()=>onToggle(o.id)} title={o.descripcion||''}
                  style={{display:'flex',alignItems:'center',gap:7,padding:'6px 9px',cursor:'pointer',borderBottom:'1px solid var(--bl)'}}
                  onMouseOver={e=>(e.currentTarget as HTMLElement).style.background='var(--gl)'}
                  onMouseOut={e=>(e.currentTarget as HTMLElement).style.background=''}>
                  <span style={{width:8,height:8,borderRadius:2,background:o.color||'var(--g)',flexShrink:0}}/>
                  <span style={{fontSize:11,color:'var(--n)',flex:1}}>{o.nombre}</span>
                  <Ic name="mas" size={11}/>
                </div>
              ))}
          </div>

          {resto.length>6 && (
            <div style={{fontSize:9,color:'var(--grl)',padding:'4px 9px',borderTop:'1px solid var(--bl)',background:'var(--bl)'}}>
              {resto.length} objetivos · desplaza para ver el resto
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TestsTab({ testsLib, etiquetas, objetivos, setTestsLib, SelectorColumnas }: any) {
  const [modalTest, setModalTest] = useState(false)
  const [testDetalle, setTestDetalle] = useState<any>(null)
  const [modalEditarTest, setModalEditarTest] = useState(false)
  const [testEditando, setTestEditando] = useState<any>(null)
  const [subiendoImgTest, setSubiendoImgTest] = useState(false)
  const [nuevoTest, setNuevoTest] = useState({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null as File|null, items:[] as any[], logica:'cualquiera', bandas:[] as any[], etiquetas_relacionadas:[] as string[], etiquetas_bloquea:[] as string[], tipo_lado:'bilateral' })

  /**
   * Todo lo de abajo miraba el resultado de Supabase de reojo o directamente no lo miraba:
   * se cerraba el modal, se recargaba la lista y parecía que había ido bien. Un test que
   * no se guarda tiene que decir que no se ha guardado, y el modal tiene que seguir
   * abierto con lo escrito dentro.
   */
  async function recargarTests() {
    const { data, error } = await supabase.from('tests').select('*').order('nombre')
    if (error) { alert('El test se ha guardado, pero la lista no se ha podido recargar: ' + error.message); return }
    setTestsLib(data || [])
  }

  /** Sube la imagen y devuelve su URL pública, o el motivo por el que no ha podido. */
  async function subirImagenTest(testId: string, file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split('.').pop()
    const path = `tests/${testId}/foto.${ext}`
    const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
    if (error) return { error: error.message }
    const { data: { publicUrl } } = supabase.storage.from('fotos').getPublicUrl(path)
    return { url: publicUrl }
  }

  /** Las reglas están en `lib/tests.ts`; aquí solo se enseñan. true = no se guarda. */
  function bloqueadoPorProblemas(test: any): boolean {
    const p = problemasDelTest(test)
    if (p.length === 0) return false
    alert('El test no se ha guardado:\n\n' + p.map(x => '· ' + x).join('\n'))
    return true
  }

  async function crearTest() {
    if (bloqueadoPorProblemas(nuevoTest)) return
    setSubiendoImgTest(true)
    const { data: t, error } = await supabase.from('tests').insert({ nombre:nuevoTest.nombre, descripcion:nuevoTest.descripcion, frecuencia_meses:nuevoTest.frecuencia_meses, video_url:nuevoTest.video_url, items:nuevoTest.items, logica:nuevoTest.logica, bandas:esSuma(nuevoTest)?(nuevoTest.bandas||[]):[], etiquetas_relacionadas:nuevoTest.etiquetas_relacionadas||[], etiquetas_bloquea:nuevoTest.etiquetas_bloquea||[], tipo_lado:nuevoTest.tipo_lado, imagen_url:'' }).select().single()
    if (error || !t) {
      setSubiendoImgTest(false)
      alert('No se ha podido crear el test: ' + (error?.message || 'la base de datos no ha devuelto la fila creada.'))
      return
    }
    // La imagen falla aparte y no invalida el test: se avisa, pero después de cerrar, para
    // que no parezca que no se ha guardado nada.
    let avisoImagen = ''
    if (nuevoTest.imagen_file) {
      const r = await subirImagenTest(t.id, nuevoTest.imagen_file)
      if ('error' in r) avisoImagen = r.error
      else {
        const { error: errUrl } = await supabase.from('tests').update({ imagen_url: r.url }).eq('id', t.id)
        if (errUrl) avisoImagen = errUrl.message
      }
    }
    setSubiendoImgTest(false)
    setModalTest(false)
    setNuevoTest({ nombre:'', descripcion:'', frecuencia_meses:3, video_url:'', imagen_url:'', imagen_file:null, items:[], logica:'cualquiera', bandas:[], etiquetas_relacionadas:[], etiquetas_bloquea:[], tipo_lado:'bilateral' })
    await recargarTests()
    if (avisoImagen) alert('El test se ha creado, pero la imagen no se ha subido: ' + avisoImagen + '\n\nVuelve a subirla desde Editar.')
  }

  async function guardarEditTest() {
    if (!testEditando) return
    if (bloqueadoPorProblemas(testEditando)) return
    setSubiendoImgTest(true)
    let imagenUrl = testEditando.imagen_url || ''
    let avisoImagen = ''
    if (testEditando.imagen_file) {
      const r = await subirImagenTest(testEditando.id, testEditando.imagen_file)
      if ('error' in r) avisoImagen = r.error
      // El sufijo con la hora es para saltarse la caché del navegador: la ruta del fichero
      // es siempre la misma y sin esto se sigue viendo la imagen anterior.
      else imagenUrl = r.url + '?t=' + Date.now()
    }
    const { error } = await supabase.from('tests').update({ nombre:testEditando.nombre, descripcion:testEditando.descripcion, video_url:testEditando.video_url, frecuencia_meses:testEditando.frecuencia_meses, logica:testEditando.logica, items:testEditando.items||[], bandas:esSuma(testEditando)?(testEditando.bandas||[]):[], etiquetas_relacionadas:testEditando.etiquetas_relacionadas||[], etiquetas_bloquea:testEditando.etiquetas_bloquea||[], tipo_lado:testEditando.tipo_lado||'bilateral', imagen_url:imagenUrl }).eq('id', testEditando.id)
    setSubiendoImgTest(false)
    if (error) { alert('No se han guardado los cambios: ' + error.message); return }
    setModalEditarTest(false); setTestEditando(null)
    await recargarTests()
    if (avisoImagen) alert('Los cambios se han guardado, pero la imagen no se ha subido: ' + avisoImagen)
  }

  /**
   * El borrado vive en `lib/tests.ts`, que es quien sabe qué cuelga de un test. Aquí solo
   * se pregunta —diciendo exactamente qué se lleva por delante— y se enseña el resultado.
   */
  async function eliminarTest(t: any) {
    const a = await alcanceBorradoTest(t.id)
    const lineas = [
      `Vas a eliminar «${t.nombre}» de la biblioteca.`, '',
      `· ${a.resultados} resultado${a.resultados === 1 ? '' : 's'} de paciente se borran con él.`,
      `· ${a.pacientes} paciente${a.pacientes === 1 ? ' tiene' : 's tienen'} objetivos abiertos por este test: esas vías se quitan.`,
    ]
    if (a.objetivos.length > 0) lineas.push(`· Se quedan sin test los objetivos: ${a.objetivos.join(', ')}.`)
    lineas.push('', 'No se puede deshacer. ¿Seguir?')
    if (!confirm(lineas.join('\n'))) return

    const r = await borrarTest(t.id)
    if (!r.ok) { alert('No se ha eliminado: ' + r.error); return }
    setTestDetalle(null)
    await recargarTests()
    alert(`Eliminado «${t.nombre}».\n${r.resultados} resultado${r.resultados === 1 ? '' : 's'} y ${r.viasQuitadas} vía${r.viasQuitadas === 1 ? '' : 's'} de objetivo.`)
  }

  // El buscador, el filtro por zona y la rejilla los pone `ExploradorTests`, que es el
  // mismo que usa la valoración. Estaban escritos aquí y la valoración tenía su propia
  // versión, peor; es el caso de `ExploradorEjercicios` otra vez.

  return (
    <>
      <ExploradorTests
        tests={testsLib} etiquetas={etiquetas} onAbrir={(t:any)=>setTestDetalle(t)}
        acciones={<button className="btn btn-p btn-sm" onClick={()=>setModalTest(true)}>+ Nuevo test</button>}/>

      {testDetalle&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setTestDetalle(null)}}>
          <div style={{background:'var(--w)',borderRadius:'var(--rl)',width:'94vw',maxWidth:820,maxHeight:'90vh',display:'flex',flexDirection:'column',boxShadow:'0 4px 32px rgba(38,40,37,.15)',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid var(--bd)',background:'var(--bl)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:14,fontWeight:400,color:'var(--n)'}}>{testDetalle.nombre}</div>
              <button className="btn btn-s btn-sm" onClick={()=>{setTestEditando({...testDetalle});setModalEditarTest(true);setTestDetalle(null)}}><Ic name="editar" size={12}/> Editar</button>
              {/* La ficha NO se cierra al pulsar: se cerraba antes de que respondiera el
                  borrado, así que un borrado fallido se veía igual que uno correcto. */}
              <button className="btn btn-d btn-sm" onClick={()=>eliminarTest(testDetalle)}><Ic name="papelera" size={12}/></button>
              <button onClick={()=>setTestDetalle(null)} style={{width:26,height:26,borderRadius:'50%',border:'1px solid var(--bd)',background:'var(--w)',cursor:'pointer',fontSize:13,color:'var(--gr)'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
                <div>
                  {testDetalle.imagen_url?<img src={testDetalle.imagen_url} alt={testDetalle.nombre} style={{width:'100%',height:240,objectFit:'contain',background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)'}}/>:<div style={{width:'100%',height:240,background:'var(--bm)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--grl)'}}><Ic name="test" size={48}/></div>}
                </div>
                <div>
                  {testDetalle.descripcion&&<div style={{marginBottom:12}}><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Descripción</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.6}}>{testDetalle.descripcion}</div></div>}
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>Revisión cada {testDetalle.frecuencia_meses} meses</span>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--bm)',color:'var(--gr)'}}>{testDetalle.tipo_lado==='lateral'?'Izq / Der':'Bilateral'}</span>
                    {testDetalle.video_url&&<a href={testDetalle.video_url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,padding:'2px 8px',borderRadius:99,background:'var(--gl)',color:'var(--gd)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:3}}><Ic name="play" size={10}/> Vídeo</a>}
                  </div>
                  {/* LO QUE HACE CADA ÍTEM, SIN ENTRAR A EDITAR.
                      Aquí solo salía el nombre del ítem, así que para saber con qué regla
                      decide o qué objetivo abre había que abrir el formulario de edición
                      —con el riesgo de tocar algo— y cerrarlo sin guardar. Revisar la
                      biblioteca es justo lo que se hace desde esta ficha. */}
                  {(testDetalle.items||[]).length>0&&(
                    <div>
                      <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>Ítems · {esSuma(testDetalle)?'Suma · manda el total':testDetalle.logica==='todos'?'Todos = positivo':'Cualquiera = positivo'}</div>
                      {(testDetalle.items||[]).map((item:any,i:number)=>{
                        const regla = textoRegla(item)
                        const objs = (item.objetivos||[]).map((id:string)=>(objetivos||[]).find((o:any)=>o.id===id)).filter(Boolean)
                        return (
                          <div key={i} style={{padding:'5px 0',borderTop:i===0?'none':'1px solid var(--bl)'}}>
                            <div style={{fontSize:11,color:'var(--n)',fontWeight:300}}>
                              {esSuma(testDetalle)?'▤':regla?'▭':'☐'} {item.nombre}{unidadDe(item).simbolo?` · mide ${unidadDe(item).nombre.toLowerCase()}`:''}
                            </div>
                            {esSuma(testDetalle)
                              ? <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>Puntúa de {item.min ?? '?'} a {item.max ?? '?'}</div>
                              : regla&&(
                                <div style={{fontSize:10,color:'var(--gd)',marginTop:2}}>
                                  {regla} · barra {item.min ?? '?'} a {item.max ?? '?'}
                                </div>
                              )}
                            {/* En un test de puntuación los ítems no abren objetivos: lo
                                hace el test entero. Enseñar aquí un "Abre: ninguno" haría
                                pensar que falta engancharlos ítem a ítem. */}
                            {!esSuma(testDetalle) && (
                              <div style={{display:'flex',flexWrap:'wrap',gap:3,marginTop:3,alignItems:'center'}}>
                                <span style={{fontSize:9,color:'var(--grl)'}}>Abre:</span>
                                {objs.length===0
                                  ? <span style={{fontSize:9,color:'var(--grl)'}}>ningún objetivo</span>
                                  : objs.map((o:any)=>{
                                      const movId=(item.objetivos_mov||{})[o.id]
                                      const mov=movId?((etiquetas||[]).find((e:any)=>e.id===movId)?.nombre||''):''
                                      return (
                                        <span key={o.id} style={{fontSize:9,padding:'1px 8px',borderRadius:99,background:o.color||'var(--g)',color:'#fff'}}>
                                          {o.nombre}{mov?` · ${mov}`:''}
                                        </span>
                                      )
                                    })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {esSuma(testDetalle)&&(()=>{
                    const bandas = bandasDe(testDetalle)
                    const rango = rangoTotal(testDetalle.items||[])
                    return (
                      <div style={{marginTop:12}}>
                        <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>
                          Bandas del total{rango?` · de ${rango.min} a ${rango.max}`:''}
                        </div>
                        {bandas.length===0
                          ? <div style={{fontSize:10,color:'var(--grl)'}}>Sin bandas: este test no puede dar resultado.</div>
                          : bandas.map((b,i)=>{
                              const desde = i===0 ? (rango?rango.min:'−∞') : bandas[i-1].hasta+1
                              return (
                                <div key={i} style={{fontSize:11,color:'var(--n)',fontWeight:300,display:'flex',alignItems:'center',gap:6,padding:'1px 0'}}>
                                  <span style={{width:9,height:9,borderRadius:2,background:b.hallazgo?'var(--red)':'var(--g)',flexShrink:0}}/>
                                  <span style={{color:'var(--grl)',minWidth:64}}>{desde} a {b.hasta}</span>
                                  <span>{b.etiqueta||'sin nombre'}</span>
                                </div>
                              )
                            })}
                      </div>
                    )
                  })()}
                  {/* Los mismos problemas que impiden guardar, en los tests que ya están
                      guardados: la biblioteca se ha ido montando a mano y hay ítems de
                      antes de que existiera la validación. */}
                  {(()=>{
                    const probs = problemasDelTest(testDetalle)
                    if (probs.length===0) return null
                    return (
                      <div style={{marginTop:12,padding:'8px 10px',borderRadius:7,background:'var(--ambl)',border:'1px solid #E0C068'}}>
                        <div style={{fontSize:9,fontWeight:600,color:'#8A6410',letterSpacing:.4,textTransform:'uppercase',marginBottom:4,display:'flex',alignItems:'center',gap:5}}>
                          <Ic name="alerta" size={11}/> Este test está incompleto
                        </div>
                        {probs.map((p,i)=><div key={i} style={{fontSize:10,color:'var(--n)',fontWeight:300,lineHeight:1.5}}>· {p}</div>)}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalTest&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Nuevo test<button className="modal-close" onClick={()=>setModalTest(false)}>✕</button></div>
            {/* CABECERA: LA IMAGEN MANDA.
                Un test se reconoce por la foto de la posición, no por su nombre: "Lunge de
                tobillo · con alza bajo el talón" no dice cómo se coloca al paciente. Antes
                la imagen era un cuadrado de 80 px perdido a mitad del formulario, debajo de
                cuatro campos de texto. Ahora abre el modal, y los LADOS van justo debajo
                porque son parte del montaje: dónde se pone el paciente y de qué lado. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {nuevoTest.imagen_url
                    ? <img src={nuevoTest.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {nuevoTest.imagen_url&&(
                    <button onClick={()=>setNuevoTest(p=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Subir imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setNuevoTest(p=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>(
                      <div key={v} onClick={()=>setNuevoTest(p=>({...p,tipo_lado:v}))}
                        style={{padding:'8px',borderRadius:6,border:`1.5px solid ${nuevoTest.tipo_lado===v?'var(--g)':'var(--bd)'}`,background:nuevoTest.tipo_lado===v?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:nuevoTest.tipo_lado===v?500:300,color:nuevoTest.tipo_lado===v?'var(--gd)':'var(--grl)'}}>{l}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={nuevoTest.nombre} onChange={e=>setNuevoTest(p=>({...p,nombre:e.target.value}))} autoFocus/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={nuevoTest.descripcion} onChange={e=>setNuevoTest(p=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="g2">
              <div className="field"><label>Enlace vídeo</label><input className="input" value={nuevoTest.video_url} onChange={e=>setNuevoTest(p=>({...p,video_url:e.target.value}))}/></div>
              <div className="field"><label>Frecuencia revisión</label>
                <select className="input" value={nuevoTest.frecuencia_meses} onChange={e=>setNuevoTest(p=>({...p,frecuencia_meses:parseInt(e.target.value)}))}>
                  {[1,2,3,6,12].map(m=><option key={m} value={m}>{m} {m===1?'mes':'meses'}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
                {/* CÓMO SE RESUELVE EL TEST. 'suma' no es una lógica más: es otro tipo de
                    test —el veredicto sale del total y no de los ítems— y por eso cambia
                    lo que se pide debajo. La regla está en `lib/tests.ts`. */}
                <select style={{fontSize:9,padding:'2px 6px',border:'1px solid var(--bd)',borderRadius:3,background:'var(--bl)',fontFamily:'system-ui'}} value={nuevoTest.logica} onChange={e=>setNuevoTest(p=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Cualquier ítem = positivo</option>
                  <option value="todos">Todos los ítems = positivo</option>
                  <option value="suma">Puntuación · manda el total</option>
                </select>
              </div>
              {esSuma(nuevoTest) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {nuevoTest.items.map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...nuevoTest.items];its[i]={...its[i],nombre:e.target.value};setNuevoTest(p=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    {/* La unidad va por ítem: un mismo test tiene ítems cualitativos y
                        medidos, y partirlo en dos por eso sería partir lo que en la
                        camilla es un solo test. */}
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...nuevoTest.items] as any[];its[i]={...its[i],unidad:e.target.value};setNuevoTest(p=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setNuevoTest(p=>({...p,items:p.items.filter((_,j)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  <ConfigBarra item={item} soloRango={esSuma(nuevoTest)} onCambia={(campos:any)=>{
                    const its=[...nuevoTest.items] as any[]; its[i]={...its[i],...campos}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>
                  {!esSuma(nuevoTest) && <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} etiquetas={etiquetas}
                    movimientos={item.objetivos_mov||{}}
                    onMovimiento={(oid:string,mid:string)=>{
                      const its=[...nuevoTest.items] as any[]
                      const mapa={...(its[i].objetivos_mov||{})}
                      if (mid) mapa[oid]=mid; else delete mapa[oid]
                      its[i]={...its[i], objetivos_mov: mapa}
                      setNuevoTest(p=>({...p,items:its}))
                    }}
                    onToggle={(oid:string)=>{
                    const its=[...nuevoTest.items] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setNuevoTest(p=>({...p,items:its}))
                  }}/>}
                </div>
              ))}
              {/* Un ítem de test de puntuación nace ya midiendo puntos: es lo único que
                  puede ser, y dejarlo en "sin medida" solo daba un aviso de validación. */}
              <button className="btn btn-t btn-sm" onClick={()=>setNuevoTest(p=>({...p,items:[...p.items,{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esSuma(nuevoTest) && (
              <EditorBandas bandas={nuevoTest.bandas} items={nuevoTest.items}
                onCambia={(b:any[])=>setNuevoTest(p=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={nuevoTest.etiquetas_bloquea||[]} onChange={(ids:string[])=>setNuevoTest(p=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={crearTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}

      {modalEditarTest&&testEditando&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalEditarTest(false)}}>
          <div className="modal" style={{width:'94vw',maxWidth:900,maxHeight:'90vh'}}>
            <div className="modal-title">Editar test<button className="modal-close" onClick={()=>setModalEditarTest(false)}>✕</button></div>
            {/* Misma cabecera que el de crear: imagen grande, nombre y descripción al
                lado, lados debajo. Ver el porqué en el modal de arriba. */}
            <div style={{display:'grid',gridTemplateColumns:'240px 1fr',gap:14,marginBottom:14,alignItems:'start'}}>
              <div>
                <div style={{position:'relative',width:'100%',aspectRatio:1,background:'var(--bm)',borderRadius:8,border:'1px solid var(--bd)',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {testEditando.imagen_url
                    ? <img src={testEditando.imagen_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
                    : <span style={{color:'var(--grl)'}}><Ic name="test" size={40}/></span>}
                  {testEditando.imagen_url&&(
                    <button onClick={()=>setTestEditando((p:any)=>({...p,imagen_url:'',imagen_file:null}))}
                      style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:'50%',background:'var(--red)',color:'#fff',border:'none',cursor:'pointer',fontSize:11}}>✕</button>
                  )}
                </div>
                <label style={{cursor:'pointer',display:'block',marginTop:6}}>
                  <div className="btn btn-s btn-sm" style={{width:'100%',justifyContent:'center'}}><Ic name="camara" size={12}/> Cambiar imagen</div>
                  <input type="file" accept="image/*" style={{display:'none'}}
                    onChange={e=>{const f=e.target.files?.[0];if(f)setTestEditando((p:any)=>({...p,imagen_file:f,imagen_url:URL.createObjectURL(f)}))}}/>
                </label>
                <div style={{marginTop:10}}>
                  <label style={{fontSize:10,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase'}}>¿Tiene lados?</label>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:5}}>
                    {([['bilateral','Bilateral / único'],['lateral','Izquierdo / Derecho']] as const).map(([v,l])=>{
                      const act=(testEditando.tipo_lado||'bilateral')===v
                      return (
                        <div key={v} onClick={()=>setTestEditando((p:any)=>({...p,tipo_lado:v}))}
                          style={{padding:'8px',borderRadius:6,border:`1.5px solid ${act?'var(--g)':'var(--bd)'}`,background:act?'var(--gl)':'var(--w)',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:act?500:300,color:act?'var(--gd)':'var(--grl)'}}>{l}</div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div>
                <div className="field"><label>Nombre *</label><input className="input" value={testEditando.nombre||''} onChange={e=>setTestEditando((p:any)=>({...p,nombre:e.target.value}))}/></div>
                <div className="field"><label>Descripción</label><textarea className="input" value={testEditando.descripcion||''} onChange={e=>setTestEditando((p:any)=>({...p,descripcion:e.target.value}))} style={{minHeight:200,lineHeight:1.6}}/></div>
              </div>
            </div>
            <div className="field"><label>Enlace vídeo</label><input className="input" value={testEditando.video_url||''} onChange={e=>setTestEditando((p:any)=>({...p,video_url:e.target.value}))}/></div>
            <div className="g2">
              <div className="field"><label>Revisión (meses)</label><input className="input" type="number" value={testEditando.frecuencia_meses||3} onChange={e=>setTestEditando((p:any)=>({...p,frecuencia_meses:parseInt(e.target.value)||3}))}/></div>
              <div className="field"><label>Se resuelve por</label>
                <select className="input" value={testEditando.logica||'cualquiera'} onChange={e=>setTestEditando((p:any)=>({...p,logica:e.target.value}))}>
                  <option value="cualquiera">Positivo si algún ítem está marcado</option>
                  <option value="todos">Positivo si todos los ítems están marcados</option>
                  <option value="suma">Puntuación · manda el total</option>
                </select>
              </div>
            </div>
            <div className="field">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <label style={{margin:0}}>Ítems</label>
              </div>
              {esSuma(testEditando) && (
                <div style={{fontSize:11,color:'var(--gr)',marginBottom:7,lineHeight:1.5}}>
                  Cada ítem aporta su puntuación y el total cae en una banda. Los objetivos no
                  cuelgan de los ítems —un ítem suelto no significa nada— sino del test entero:
                  se enganchan desde la biblioteca de objetivos.
                </div>
              )}
              {(testEditando.items||[]).map((item:any,i:number)=>(
                <div key={i} style={{marginBottom:5,background:'var(--bl)',borderRadius:5,padding:'6px 8px',border:'1px solid var(--bd)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:7}}>
                    <input className="input" value={item.nombre} onChange={e=>{const its=[...(testEditando.items||[])];its[i]={...its[i],nombre:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}} placeholder="ej. La rodilla no llega a 90°" style={{flex:1,fontSize:11}}/>
                    <select className="input" value={unidadDe(item).id} style={{width:118,fontSize:11,flexShrink:0}}
                      onChange={e=>{const its=[...(testEditando.items||[])] as any[];its[i]={...its[i],unidad:e.target.value};setTestEditando((p:any)=>({...p,items:its}))}}>
                      {UNIDADES.map(u=><option key={u.id} value={u.id}>{u.nombre}</option>)}
                    </select>
                    <button onClick={()=>setTestEditando((p:any)=>({...p,items:(p.items||[]).filter((_:any,j:number)=>j!==i)}))} style={{fontSize:11,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
                  </div>
                  <ConfigBarra item={item} soloRango={esSuma(testEditando)} onCambia={(campos:any)=>{
                    const its=[...(testEditando.items||[])] as any[]; its[i]={...its[i],...campos}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>
                  {!esSuma(testEditando) && <PildorasObjetivos seleccionados={item.objetivos||[]} objetivos={objetivos} etiquetas={etiquetas}
                    movimientos={item.objetivos_mov||{}}
                    onMovimiento={(oid:string,mid:string)=>{
                      const its=[...(testEditando.items||[])] as any[]
                      const mapa={...(its[i].objetivos_mov||{})}
                      if (mid) mapa[oid]=mid; else delete mapa[oid]
                      its[i]={...its[i], objetivos_mov: mapa}
                      setTestEditando((p:any)=>({...p,items:its}))
                    }}
                    onToggle={(oid:string)=>{
                    const its=[...(testEditando.items||[])] as any[]
                    const act = its[i].objetivos||[]
                    its[i]={...its[i], objetivos: act.includes(oid)?act.filter((x:string)=>x!==oid):[...act,oid]}
                    setTestEditando((p:any)=>({...p,items:its}))
                  }}/>}
                </div>
              ))}
              <button className="btn btn-t btn-sm" onClick={()=>setTestEditando((p:any)=>({...p,items:[...(p.items||[]),{nombre:'',unidad:esSuma(p)?'puntos':''}]}))}>+ Añadir ítem</button>
            </div>
            {esSuma(testEditando) && (
              <EditorBandas bandas={testEditando.bandas} items={testEditando.items||[]}
                onCambia={(b:any[])=>setTestEditando((p:any)=>({...p,bandas:b}))}/>
            )}
            <div className="field">
              <label>Etiquetas relacionadas</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_relacionadas||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_relacionadas:ids}))}/></div>
            </div>
            {/* Lo que este test DESACONSEJA si sale positivo. Avisa al montar la sesión;
                no impide nada, porque hay motivos para prescribirlo igual —carga baja,
                rango parcial— y un bloqueo duro se acaba esquivando fuera de la app.
                Un negativo posterior lo levanta solo. */}
            <div className="field">
              <label>Si sale positivo, desaconseja</label>
              <div style={{marginTop:5}}><SelectorEtiquetasCompacto etiquetas={etiquetas} seleccionadas={testEditando.etiquetas_bloquea||[]} onChange={(ids:string[])=>setTestEditando((p:any)=>({...p,etiquetas_bloquea:ids}))}/></div>
              <div style={{fontSize:12,color:'var(--gr)',marginTop:4}}>
                Los ejercicios con estas etiquetas saldrán avisados en el editor de sesión de
                quien dé positivo. Alcanza también a sus subetiquetas.
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalEditarTest(false)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardarEditTest} disabled={subiendoImgTest}>{subiendoImgTest?'…':<><Ic name="guardar" size={13}/> Guardar</>}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
