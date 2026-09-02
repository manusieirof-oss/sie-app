'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Ic } from '@/lib/icons'
import { abrirFactura, numeroFactura } from '@/lib/factura'
import { emitirRectificativa } from '@/lib/cobros'
import { rangoDeMes } from '@/lib/fechas'

// Facturas emitidas. Ver, imprimir y rectificar.
//
// No hay botón de borrar ni de editar, y no es un olvido: una factura emitida
// no se toca. Lo único que se puede hacer con una equivocada es emitir una
// rectificativa que la corrija, y eso deja las dos en el histórico.

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLOR: Record<string,string> = { F:'#5A969E', S:'#3E7179', R:'#C25B5B' }
const LBL_TIPO: Record<string,string> = { completa:'Completa', simplificada:'Tique', rectificativa:'Rectificativa' }

// Cómo se pagó. El orden es el del cuadre de caja: primero lo que hay que contar
// a mano, después lo que sale del extracto del TPV, y luego lo demás.
const LBL_PAGO: Record<string,string> = {
  efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia',
  domiciliacion:'Domiciliación', otro:'Otro',
}
const ORDEN_PAGO = ['efectivo','tarjeta','transferencia','domiciliacion','otro']
const COLOR_PAGO: Record<string,string> = {
  efectivo:'#7A5800', tarjeta:'#3E7179', transferencia:'#5A969E',
  domiciliacion:'#5A969E', otro:'var(--grl)',
}

export default function FacturasPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState<boolean|null>(null)
  const [veTotales, setVeTotales] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string|null>(null)
  const [aviso, setAviso] = useState<string|null>(null)

  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth()+1)
  const [anio] = useState(hoy.getFullYear())
  const [busca, setBusca] = useState('')
  // Filtro por forma de pago, para contar una sola vía de golpe.
  const [pago, setPago] = useState('todas')

  const [facturas, setFacturas] = useState<any[]>([])
  const [rectificando, setRectificando] = useState<any>(null)

  useEffect(() => { verificar() }, [])
  useEffect(() => { if (autorizado) cargar() }, [autorizado, mes])

  async function verificar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('user_id', user.id).maybeSingle()
    setAutorizado(data?.rol === 'admin' || data?.permisos?.cobros === true || data?.permisos?.finanzas === true)
    // Ver una factura suelta para reimprimirla es parte de cobrar. Sumar todas las del
    // periodo ya es la facturación de la clínica, y eso es otra cosa.
    setVeTotales(data?.rol === 'admin' || data?.permisos?.finanzas === true)
  }

  async function cargar() {
    setCargando(true); setFallo(null)
    // Ver lib/fechas: calcular el fin de mes con toISOString devolvía el día 30
    // en agosto, y una factura emitida el 31 no aparecía en ninguna parte.
    const { desde, hasta } = rangoDeMes(anio, mes)
    const { data, error } = await supabase.from('facturas')
      .select('*, cobros(paciente_id, forma_pago, pacientes(nombre,apellidos))')
      .gte('fecha_expedicion', desde).lte('fecha_expedicion', hasta)
      .order('fecha_expedicion', { ascending: false }).order('numero', { ascending: false })
    if (error) setFallo(`No se han podido leer las facturas: ${error.message}`)
    setFacturas(data || [])
    setCargando(false)
  }

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return facturas
      // Aislar una forma de pago. Para contar el efectivo hay que ver SOLO el
      // efectivo: buscándolo entre ciento cincuenta facturas se salta una.
      .filter(f => pago === 'todas' || (f.cobros?.forma_pago || 'otro') === pago)
      .filter(f => {
        if (!t) return true
        const p = f.cobros?.pacientes
        const nombre = f.receptor_nombre || (p ? `${p.nombre} ${p.apellidos}` : '')
        return nombre.toLowerCase().includes(t) || numeroFactura(f).toLowerCase().includes(t)
      })
  }, [facturas, busca, pago])

  /**
   * Cuánto entró por cada vía. Es lo que hace falta para cuadrar la caja: el
   * efectivo se cuenta a mano y la tarjeta se compara con el extracto del TPV.
   *
   * Las rectificativas suman en negativo, y tiene que ser así: si devolviste 66 €
   * en efectivo, en la caja hay 66 € menos. El desglose tiene que cuadrar con lo
   * que hay en el cajón, no con lo que se facturó en bruto.
   */
  const porFormaPago = useMemo(() => {
    const m = new Map<string, { total: number, n: number }>()
    filtradas.forEach(f => {
      const forma = f.cobros?.forma_pago || 'otro'
      const acc = m.get(forma) || { total: 0, n: 0 }
      acc.total += Number(f.total)
      acc.n += 1
      m.set(forma, acc)
    })
    return ORDEN_PAGO.filter(k => m.has(k)).map(k => ({ forma: k, ...m.get(k)! }))
  }, [filtradas])

  const totales = useMemo(() => filtradas.reduce((a, f) => ({
    base: a.base + Number(f.base_total), cuota: a.cuota + Number(f.cuota_total), total: a.total + Number(f.total),
  }), { base:0, cuota:0, total:0 }), [filtradas])

  async function imprimir(id: string) {
    const r = await abrirFactura(id)
    if (!r.ok) setAviso(r.error || 'No se ha podido abrir la factura.')
  }

  if (autorizado === null) return <div style={{fontSize:12,color:'var(--grl)',padding:20}}>Verificando acceso...</div>
  if (!autorizado) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'50vh',gap:10}}>
      <div style={{color:'var(--grl)'}}><Ic name="candado" size={40} strokeWidth={1.5}/></div>
      <div style={{fontSize:14,fontWeight:500,color:'var(--n)'}}>Acceso restringido</div>
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <Link href="/cobros" className="btn btn-s btn-sm" style={{textDecoration:'none'}}>← Cobros</Link>
        <select className="input" style={{width:'auto',padding:'6px 10px'}} value={mes} onChange={e=>setMes(Number(e.target.value))}>
          {MESES.map((m,i)=><option key={m} value={i+1}>{m} {anio}</option>)}
        </select>
        <input className="input" style={{width:220}} placeholder="Buscar por paciente o número..." value={busca} onChange={e=>setBusca(e.target.value)}/>
        <select className="input" style={{width:'auto',padding:'6px 10px'}} value={pago} onChange={e=>setPago(e.target.value)}>
          <option value="todas">Todas las formas de pago</option>
          {ORDEN_PAGO.map(k=><option key={k} value={k}>{LBL_PAGO[k]}</option>)}
        </select>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:'var(--grl)'}}>
          {filtradas.length} {filtradas.length===1?'factura':'facturas'}
          {veTotales && <> · base {totales.base.toFixed(2)} € · IVA {totales.cuota.toFixed(2)} € · <strong style={{color:'var(--n)'}}>{totales.total.toFixed(2)} €</strong></>}
        </span>
      </div>

      {/* CUADRE DE CAJA
          Cuánto entró por cada vía. El efectivo se cuenta a mano al cerrar y la
          tarjeta se compara con el extracto del TPV; sin esto había que abrir
          factura por factura para saber cuál fue cuál.

          Las rectificativas restan, y tiene que ser así: si devolviste 66 € en
          efectivo, en el cajón hay 66 € menos. Esto cuadra con la caja, no con
          lo facturado en bruto. */}
      {veTotales && porFormaPago.length > 0 && (
        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          {porFormaPago.map(fp => (
            <div key={fp.forma} className="card" style={{margin:0,flex:'1 1 130px',textAlign:'center',padding:'10px 12px'}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',letterSpacing:.4}}>
                {LBL_PAGO[fp.forma] || fp.forma}
              </div>
              <div style={{fontSize:20,fontWeight:300,color:COLOR_PAGO[fp.forma]||'var(--n)',marginTop:3}}>
                {fp.total.toFixed(2)} €
              </div>
              <div style={{fontSize:8,color:'var(--grl)'}}>{fp.n} {fp.n===1?'factura':'facturas'}</div>
            </div>
          ))}
        </div>
      )}

      {fallo && (
        <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:10,color:'var(--red)'}}>
          <Ic name="alerta" size={12} style={{verticalAlign:'-2px',marginRight:4}}/>{fallo}
        </div>
      )}
      {aviso && (
        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:8,padding:'9px 13px',marginBottom:12,fontSize:10,color:'#7A5800',display:'flex',gap:8,alignItems:'center'}}>
          <Ic name="alerta" size={12}/><span style={{flex:1}}>{aviso}</span>
          <button className="btn btn-t btn-sm" onClick={()=>setAviso(null)}>Cerrar</button>
        </div>
      )}

      {cargando ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:20}}>Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:24,textAlign:'center'}}>
          No hay facturas emitidas en {MESES[mes-1].toLowerCase()}.
        </div>
      ) : filtradas.map(f => {
        const p = f.cobros?.pacientes
        const nombre = f.receptor_nombre || (p ? `${p.nombre} ${p.apellidos}` : 'Sin destinatario')
        const negativa = Number(f.total) < 0
        return (
          <div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:8,
                                  border:'1px solid var(--bd)',marginBottom:6,background:'var(--w)'}}>
            <span style={{background:COLOR[f.serie]||'var(--grl)',color:'#fff',borderRadius:4,padding:'2px 7px',
                          fontSize:10,fontWeight:600,flexShrink:0,minWidth:62,textAlign:'center'}}>
              {numeroFactura(f)}
            </span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500,color:'var(--n)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{nombre}</div>
              <div style={{fontSize:9,color:'var(--grl)'}}>
                {new Date(f.fecha_expedicion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short'})}
                {' · '}{LBL_TIPO[f.tipo] || f.tipo}
                {/* Cómo se pagó, en cada fila: es lo que permite ir tachando
                    contra el extracto del TPV sin abrir factura por factura. */}
                {f.cobros?.forma_pago && (
                  <span style={{color:COLOR_PAGO[f.cobros.forma_pago]||'var(--grl)',fontWeight:600}}>
                    {' · '}{LBL_PAGO[f.cobros.forma_pago] || f.cobros.forma_pago}
                  </span>
                )}
                {f.rectifica_motivo ? ` · ${f.rectifica_motivo}` : ''}
              </div>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:negativa?'var(--red)':'var(--n)',flexShrink:0}}>
              {Number(f.total).toFixed(2)} €
            </div>
            <button className="btn btn-s btn-sm" onClick={()=>imprimir(f.id)} title="Ver, imprimir o guardar en PDF">
              <Ic name="informe" size={12}/>
            </button>
            {f.tipo !== 'rectificativa' && (
              <button className="btn btn-s btn-sm" onClick={()=>setRectificando(f)} title="Emitir una rectificativa de esta factura"
                style={{color:'var(--red)'}}>
                Rectificar
              </button>
            )}
          </div>
        )
      })}

      {rectificando && (
        <ModalRectificar
          factura={rectificando}
          onCerrar={()=>setRectificando(null)}
          onHecho={(n:string)=>{ setAviso(`Rectificativa ${n} emitida.`); setRectificando(null); cargar() }}
        />
      )}
    </div>
  )
}

/**
 * Rectificar una factura.
 *
 * Se eligen las líneas que se anulan: a veces sobra una sola —la valoración
 * cobrada dos veces— y no toda la factura. Las líneas van en positivo aquí y
 * `emitirRectificativa` las invierte, para que lo que se ve marcado sea lo que
 * se está quitando.
 */
function ModalRectificar({ factura, onCerrar, onHecho }: any) {
  const [lineas, setLineas] = useState<any[]>([])
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [motivo, setMotivo] = useState('')
  const [emitiendo, setEmitiendo] = useState(false)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    supabase.from('cobro_lineas').select('*').eq('cobro_id', factura.cobro_id).order('orden')
      .then(({ data, error }) => {
        if (error) { setError(`No se han podido leer las líneas: ${error.message}`); return }
        setLineas(data || [])
        // Por defecto se anula entera, que es lo más habitual.
        setMarcadas(Object.fromEntries((data || []).map((l:any)=>[l.id, true])))
      })
  }, [factura.cobro_id])

  const elegidas = lineas.filter(l => marcadas[l.id])
  const total = elegidas.reduce((a,l)=>a+Number(l.total), 0)

  async function emitir() {
    setEmitiendo(true); setError(null)
    const r = await emitirRectificativa({
      facturaId: factura.id,
      motivo,
      lineas: elegidas.map(l => ({ concepto: l.concepto, bono_id: l.bono_id, cantidad: l.cantidad, total: Number(l.total), iva_pct: Number(l.iva_pct) })),
    })
    setEmitiendo(false)
    if (!r.ok) { setError(r.error); return }
    onHecho(`${r.serie}/${String(r.numero).padStart(4,'0')}`)
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-title">Rectificar {numeroFactura(factura)}<button className="modal-close" onClick={onCerrar}>✕</button></div>

        <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'9px 12px',marginBottom:14,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
          <Ic name="alerta" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>
          La factura original <strong>no se borra ni se modifica</strong>. Se emite otra en la serie R, en negativo, que la corrige. Las dos quedan en el histórico y en el listado de la gestoría.
        </div>

        <div style={{fontSize:10,color:'var(--grl)',marginBottom:8}}>Qué se anula:</div>
        {lineas.map(l => (
          <label key={l.id} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',borderRadius:8,
                                    border:`1px solid ${marcadas[l.id]?'var(--red)':'var(--bd)'}`,marginBottom:6,cursor:'pointer',
                                    background:marcadas[l.id]?'var(--redl)':'var(--w)'}}>
            <input type="checkbox" checked={!!marcadas[l.id]} onChange={e=>setMarcadas(m=>({...m,[l.id]:e.target.checked}))}/>
            <span style={{flex:1,fontSize:11,color:'var(--n)'}}>{l.concepto}</span>
            <span style={{fontSize:12,fontWeight:600}}>{Number(l.total).toFixed(2)} €</span>
          </label>
        ))}

        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'1px solid var(--bd)',marginTop:4,fontWeight:600}}>
          <span style={{fontSize:12}}>Se rectificará</span>
          <span style={{fontSize:15,color:'var(--red)'}}>−{total.toFixed(2)} €</span>
        </div>

        <div className="field"><label>Motivo *</label>
          <input className="input" value={motivo} onChange={e=>setMotivo(e.target.value)}
            placeholder="ej. la valoración se cobró dos veces" autoFocus/>
          <div style={{fontSize:9,color:'var(--grl)',marginTop:4}}>Va impreso en la rectificativa. Que se entienda dentro de un año.</div>
        </div>

        {error && (
          <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>{error}</div>
        )}

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={emitir} disabled={emitiendo || !motivo.trim() || elegidas.length===0}>
            {emitiendo ? '…' : 'Emitir rectificativa'}
          </button>
        </div>
      </div>
    </div>
  )
}
