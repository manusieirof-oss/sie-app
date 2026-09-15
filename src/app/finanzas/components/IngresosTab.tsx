'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { hoyISO, mesISO } from '@/lib/fechas'

/**
 * INGRESOS QUE NO SON CUOTAS.
 *
 * Los bonos y las facturas cubren lo que cobras a pacientes. Esto es para todo
 * lo demás: una charla, alquilar la sala, y el histórico de meses en los que
 * todavía no usabas la app —sin esos importes, las gráficas de un año que
 * empezó en enero arrancan en septiembre y el beneficio sale disparado.
 *
 * No emite factura ni toca la numeración: es un apunte, no un documento.
 */
const CATEGORIAS_INGRESO = [
  { id: 'Cuotas (histórico)', ayuda: 'Lo cobrado en meses anteriores a usar la app. Un apunte por mes.' },
  { id: 'Formación',          ayuda: 'Cursos, charlas, ponencias.' },
  { id: 'Alquiler de espacio',ayuda: 'Ceder la sala o el material a otro profesional.' },
  { id: 'Venta de material',  ayuda: 'Bandas, esterillas, lo que revendas.' },
  { id: 'Otros',              ayuda: 'Lo que no encaje.' },
]
const ayudaCat = (id?: string|null) => CATEGORIAS_INGRESO.find(c=>c.id===id)?.ayuda ?? null

const MOTIVOS_EXENCION = [
  { id: 'sanitario', nombre: 'Servicio sanitario', ayuda: 'Fisioterapia y asistencia sanitaria por profesional titulado.' },
  { id: 'educativo', nombre: 'Formación reglada',  ayuda: 'Enseñanza que la ley declara exenta. Confírmalo con la gestoría.' },
  { id: 'otro',      nombre: 'Otro motivo',        ayuda: 'Anótalo en las notas para poder justificarlo.' },
]

export default function IngresosTab({ ingresos, recargar, mesRef }: any) {
  const [modal, setModal] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [editando, setEditando] = useState<any|null>(null)
  const [form, setForm] = useState({
    concepto:'', importe:'', metodo:'total', iva_pct:'21', exento_motivo:'',
    categoria:'', fecha:hoyISO(), notas:'',
  })

  const ivaPct = parseFloat(form.iva_pct) || 0
  const importe = parseFloat(form.importe) || 0
  const exento = ivaPct === 0
  const base = form.metodo === 'base' ? importe
    : ivaPct > 0 ? importe / (1 + ivaPct/100)
    : importe
  const ivaImporte = base * (ivaPct/100)
  const total = base + ivaImporte

  function abrirNuevo() {
    setEditando(null); setError(null)
    setForm({ concepto:'', importe:'', metodo:'total', iva_pct:'21', exento_motivo:'',
              categoria:'', fecha:hoyISO(), notas:'' })
    setModal(true)
  }

  function abrirEditar(g:any) {
    setEditando(g); setError(null)
    setForm({
      concepto: g.concepto || '',
      importe: String(g.base_imponible ?? g.importe ?? ''),
      metodo: 'base',
      iva_pct: String(g.iva_pct ?? 0),
      exento_motivo: g.exento_motivo || '',
      categoria: g.categoria || '',
      fecha: g.fecha,
      notas: g.notas || '',
    })
    setModal(true)
  }

  async function guardar() {
    if (!form.concepto) { setError('Falta el concepto.'); return }
    if (!form.importe)  { setError('Falta el importe.'); return }
    setGuardando(true); setError(null)
    const fila = {
      concepto: form.concepto,
      fecha: form.fecha,
      base_imponible: Math.round(base*100)/100,
      iva_pct: ivaPct,
      importe: Math.round(total*100)/100,
      categoria: form.categoria || null,
      exento_motivo: exento ? (form.exento_motivo || null) : null,
      notas: form.notas || null,
    }
    if (editando) {
      const { data, error: err } = await supabase.from('ingresos').update(fila).eq('id', editando.id).select('id')
      setGuardando(false)
      if (err) { setError(`No se ha podido guardar: ${err.message}`); return }
      if (!data || data.length === 0) { setError('No se ha modificado ninguna fila.'); return }
    } else {
      const { error: err } = await supabase.from('ingresos').insert(fila)
      setGuardando(false)
      if (err) { setError(`No se ha podido guardar: ${err.message}`); return }
    }
    setEditando(null); setModal(false); recargar()
  }

  async function eliminar(id:string) {
    if (!confirm('¿Eliminar este ingreso?')) return
    const { error: err } = await supabase.from('ingresos').delete().eq('id', id)
    if (err) { setError(`No se ha podido eliminar: ${err.message}`); return }
    recargar()
  }

  // -- Lista, filtros y totales ---------------------------------------------
  const [busca, setBusca] = useState('')
  const [mesFiltro, setMesFiltro] = useState('')
  const [orden, setOrden] = useState('fecha-desc')

  const mesActual = mesRef || mesISO()
  const delMes = ingresos.filter((g:any)=>g.fecha?.slice(0,7)===mesActual)
  const totalMes = delMes.reduce((a:number,g:any)=>a+Number(g.importe),0)
  const totalAnio = ingresos.filter((g:any)=>g.fecha?.slice(0,4)===mesActual.slice(0,4))
    .reduce((a:number,g:any)=>a+Number(g.importe),0)

  const mesesConIngresos = Array.from(new Set(
    ingresos.map((g:any)=>g.fecha?.slice(0,7)).filter(Boolean) as string[]
  )).sort().reverse()
  const nombreMes = (m:string) => new Date(m+'-01T12:00:00').toLocaleDateString('es-ES',{month:'long',year:'numeric'})

  const q = busca.trim().toLowerCase()
  const filtrados = ingresos.filter((g:any)=>{
    if (mesFiltro && g.fecha?.slice(0,7) !== mesFiltro) return false
    if (!q) return true
    return [g.concepto,g.categoria,g.notas].some((c:any)=>String(c||'').toLowerCase().includes(q))
  })
  const ordenados = [...filtrados].sort((a:any,b:any)=>{
    if (orden==='fecha-asc') return String(a.fecha).localeCompare(String(b.fecha))
    if (orden==='concepto')  return String(a.concepto||'').localeCompare(String(b.concepto||''),'es')
    if (orden==='importe')   return Number(b.importe) - Number(a.importe)
    return String(b.fecha).localeCompare(String(a.fecha))
  })
  const hayFiltro = !!q || !!mesFiltro
  const totalFiltrado = filtrados.reduce((a:number,g:any)=>a+Number(g.importe),0)

  return (
    <div className="card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div className="card-title" style={{margin:0}}><span className="ct-l"><Ic name="recibo"/> Otros ingresos</span></div>
        <button className="btn btn-p btn-sm" onClick={abrirNuevo}>+ Nuevo ingreso</button>
      </div>

      <div style={{fontSize:10,color:'var(--grl)',marginBottom:12,lineHeight:1.6}}>
        Lo que entra y no viene de una cuota: charlas, alquilar la sala, o lo cobrado
        en meses anteriores a usar la app. <strong>No emite factura</strong>: es un apunte para
        que las gráficas cuadren.
      </div>

      {error && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
        </div>
      )}

      <div className="g2" style={{marginBottom:14}}>
        <div style={{background:'var(--gl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'var(--gd)'}}>{totalMes.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>Este mes</div>
        </div>
        <div style={{background:'var(--bl)',borderRadius:6,padding:'10px 12px',textAlign:'center'}}>
          <div style={{fontSize:20,fontWeight:300,color:'var(--n)'}}>{totalAnio.toFixed(2)}€</div>
          <div style={{fontSize:8,color:'var(--grl)',marginTop:2}}>Total del año</div>
        </div>
      </div>

      {ingresos.length > 0 && (
        <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
          <input className="input" value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="Buscar por concepto, categoría o notas…" style={{flex:'1 1 180px',minWidth:0}}/>
          <select className="input" value={mesFiltro} onChange={e=>setMesFiltro(e.target.value)} style={{flex:'0 1 160px'}}>
            <option value="">Todos los meses</option>
            {mesesConIngresos.map(m=><option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <select className="input" value={orden} onChange={e=>setOrden(e.target.value)} style={{flex:'0 1 150px'}}>
            <option value="fecha-desc">Más reciente primero</option>
            <option value="fecha-asc">Más antiguo primero</option>
            <option value="concepto">Concepto (A-Z)</option>
            <option value="importe">Importe (mayor primero)</option>
          </select>
          {hayFiltro && <button className="btn btn-d btn-sm" onClick={()=>{setBusca('');setMesFiltro('')}}>Quitar</button>}
        </div>
      )}

      {hayFiltro && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,
                     background:'var(--bl)',borderRadius:6,padding:'7px 11px',marginBottom:8,fontSize:10}}>
          <span style={{color:'var(--grl)'}}>
            {filtrados.length===0 ? 'Ningún ingreso' : `${filtrados.length} ${filtrados.length===1?'ingreso':'ingresos'}`}
            {mesFiltro && ` · ${nombreMes(mesFiltro)}`}
          </span>
          {filtrados.length>0 && <span style={{fontWeight:600,color:'var(--n)'}}>{totalFiltrado.toFixed(2)} €</span>}
        </div>
      )}

      {ingresos.length===0 ? (
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:11}}>Sin ingresos registrados</div>
      ) : ordenados.length===0 ? (
        <div style={{textAlign:'center',padding:24,color:'var(--grl)',fontSize:11}}>No hay ningún ingreso que encaje.</div>
      ) : ordenados.map((g:any)=>(
        <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:6,border:'1px solid var(--bd)',marginBottom:5,background:'var(--bl)'}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:'var(--g)',flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:'var(--n)'}}>{g.concepto}</div>
            <div style={{fontSize:9,color:'var(--grl)'}}>
              {new Date(g.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})}
              {g.categoria && ' · '+g.categoria}
            </div>
            <div style={{fontSize:8,color:'var(--grl)',marginTop:1}}>
              Base {Number(g.base_imponible||0).toFixed(2)}€
              {Number(g.iva_pct||0) > 0
                ? ` · IVA ${g.iva_pct}% (${(Number(g.importe)-Number(g.base_imponible||0)).toFixed(2)}€)`
                : ` · exento${g.exento_motivo?` (${g.exento_motivo})`:''}`}
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:600,color:'var(--gd)'}}>{Number(g.importe).toFixed(2)}€</div>
          <button onClick={()=>abrirEditar(g)} title="Corregir"
            style={{color:'var(--grl)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="editar" size={13}/></button>
          <button onClick={()=>eliminar(g.id)} title="Borrar"
            style={{color:'var(--red)',background:'none',border:'none',cursor:'pointer',display:'inline-flex'}}><Ic name="papelera" size={13}/></button>
        </div>
      ))}

      {modal && (
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget){setModal(false);setEditando(null)}}}>
          <div className="modal">
            <div className="modal-title">
              {editando ? 'Corregir ingreso' : 'Nuevo ingreso'}
              <button className="modal-close" onClick={()=>{setModal(false);setEditando(null)}}>✕</button>
            </div>

            {error && (
              <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
                <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>{error}
              </div>
            )}

            <div className="field"><label>Concepto *</label>
              <input className="input" value={form.concepto} autoFocus
                onChange={e=>setForm(p=>({...p,concepto:e.target.value}))}
                placeholder="ej. Cuotas de marzo · Charla en el colegio"/>
            </div>

            <div className="g2">
              <div className="field">
                <label>{form.metodo==='base'?'Base imponible (€) *':'Total cobrado (€) *'}</label>
                <input className="input" type="number" value={form.importe}
                  onChange={e=>setForm(p=>({...p,importe:e.target.value}))} placeholder="0.00"/>
              </div>
              <div className="field"><label>Fecha</label>
                <input className="input" type="date" value={form.fecha}
                  onChange={e=>setForm(p=>({...p,fecha:e.target.value}))}/>
              </div>
            </div>

            <div className="field">
              <label>¿Qué importe vas a escribir?</label>
              <div style={{display:'flex',gap:6}}>
                {[['total','El total cobrado'],['base','La base imponible']].map(([v,l])=>(
                  <button key={v} type="button" onClick={()=>setForm(p=>({...p,metodo:v}))}
                    style={{flex:1,padding:'7px 6px',borderRadius:6,cursor:'pointer',fontFamily:'inherit',fontSize:10,
                            border:`1.5px solid ${form.metodo===v?'var(--g)':'var(--bd)'}`,
                            background:form.metodo===v?'var(--g)':'var(--w)',
                            color:form.metodo===v?'#fff':'var(--gr)'}}>{l}</button>
                ))}
              </div>
            </div>

            <div className="field"><label>IVA</label>
              <select className="input" value={form.iva_pct} onChange={e=>setForm(p=>({...p,iva_pct:e.target.value}))}>
                <option value="21">21%</option>
                <option value="10">10%</option>
                <option value="4">4%</option>
                <option value="0">Exento / sin IVA</option>
              </select>
            </div>

            {/* La fisioterapia está exenta por ser asistencia sanitaria, y parte
                de la formación también lo está. No es lo mismo que "olvidé el
                IVA": conviene dejar dicho por qué, que es lo que preguntará la
                gestoría. */}
            {exento && (
              <div className="field"><label>¿Por qué está exento?</label>
                <select className="input" value={form.exento_motivo}
                  onChange={e=>setForm(p=>({...p,exento_motivo:e.target.value}))}>
                  <option value="">Sin especificar</option>
                  {MOTIVOS_EXENCION.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>
                  {MOTIVOS_EXENCION.find(m=>m.id===form.exento_motivo)?.ayuda
                    ?? 'Una operación exenta se declara igual, pero no genera cuota de IVA.'}
                </div>
              </div>
            )}

            {base > 0 && (
              <div style={{padding:'9px 12px',background:'var(--bl)',borderRadius:6,marginBottom:10,fontSize:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{color:'var(--grl)'}}>Base imponible</span>
                  <span style={{fontWeight:500}}>{base.toFixed(2)} €</span>
                </div>
                {ivaPct > 0 ? (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>+ IVA {ivaPct}%</span>
                    <span style={{fontWeight:500}}>{ivaImporte.toFixed(2)} €</span>
                  </div>
                ) : (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                    <span style={{color:'var(--grl)'}}>IVA</span>
                    <span style={{fontWeight:500,color:'var(--grl)'}}>exento</span>
                  </div>
                )}
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:4,marginTop:2,borderTop:'1px solid var(--bd)'}}>
                  <span style={{fontWeight:600,color:'var(--n)'}}>Total cobrado</span>
                  <span style={{fontWeight:600,color:'var(--n)'}}>{total.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <div className="field"><label>Categoría</label>
              <select className="input" value={form.categoria} onChange={e=>setForm(p=>({...p,categoria:e.target.value}))}>
                <option value="">Sin categoría</option>
                {CATEGORIAS_INGRESO.map(c=><option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
              {ayudaCat(form.categoria) && (
                <div style={{fontSize:9,color:'var(--grl)',marginTop:3,lineHeight:1.5}}>{ayudaCat(form.categoria)}</div>
              )}
            </div>

            <div className="field"><label>Notas</label>
              <textarea className="input" value={form.notas}
                onChange={e=>setForm(p=>({...p,notas:e.target.value}))} style={{minHeight:50}}/>
            </div>

            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>{setModal(false);setEditando(null)}}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={guardar} disabled={guardando}>
                {guardando?'…':<><Ic name="guardar" size={13}/> {editando?'Guardar cambios':'Guardar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
