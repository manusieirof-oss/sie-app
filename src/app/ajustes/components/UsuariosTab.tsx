'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import { VERSION_CONFIDENCIALIDAD } from '@/lib/confidencialidad'
import { NIVELES, nombreNivel } from '@/lib/permisos'

// Llama a /api/equipo con la sesión de quien está dentro: el servidor comprueba que
// es dirección antes de tocar nada.
async function equipo(accion: string, datos: any = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/equipo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify({ accion, ...datos }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`)
  return j
}

const fechaCorta = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  : null

export default function UsuariosTab({ perfilActual }: any) {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [cuentas, setCuentas] = useState<Record<string, { email: string | null, ultimo: string | null }>>({})
  const [loading, setLoading] = useState(true)
  /** Última aceptación del compromiso de confidencialidad de cada uno (por user_id). */
  const [firmas, setFirmas] = useState<Record<string, { aceptada: string, version: string }>>({})
  const [guardando, setGuardando] = useState<string|null>(null)
  // Alta nueva
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  // Un solo selector: 'n1' | 'n2' | 'n3' (entrenador de ese nivel) o 'admin' (dirección).
  const [perfilNuevo, setPerfilNuevo] = useState<string>('n1')  // se empieza por lo más bajo
  const [cobros, setCobros] = useState(false)
  const [error, setError] = useState('')
  // La contraseña provisional solo se enseña una vez: no se guarda en ningún sitio.
  const [entrega, setEntrega] = useState<{ nombre: string, email: string, password: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  /** Nombre que se está corrigiendo: { id del perfil, texto }. */
  const [editNombre, setEditNombre] = useState<{ id: string, v: string } | null>(null)

  const esAdmin = perfilActual?.rol === 'admin'

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('perfiles').select('*').order('created_at')
    setUsuarios(data || [])
    setLoading(false)
    const { data: f } = await supabase.from('confidencialidad_firmas').select('user_id,aceptada,version').order('aceptada')
    const m: Record<string, { aceptada: string, version: string }> = {}
    ;(f || []).forEach((x: any) => { m[x.user_id] = x })
    setFirmas(m)
    // Los correos van aparte (están en Supabase Auth, no en perfiles); si falla, la
    // lista se ve igual, solo sin correo.
    try { setCuentas((await equipo('lista')).usuarios || {}) } catch {}
  }

  async function crear() {
    setError('')
    setGuardando('nuevo')
    try {
      const rol = perfilNuevo === 'admin' ? 'admin' : 'usuario'
      const r = await equipo('crear', { nombre, email, rol, nivel: Number(perfilNuevo.slice(1)) || 1, cobros })
      setEntrega({ nombre: nombre.trim(), email: r.email, password: r.password })
      setNombre(''); setEmail(''); setPerfilNuevo('n1'); setCobros(false); setAbierto(false)
      await cargar()
    } catch (e: any) { setError(e.message) }
    setGuardando(null)
  }

  async function reiniciar(u: any) {
    setGuardando(u.id)
    try {
      const r = await equipo('reiniciar', { perfilId: u.id })
      setEntrega({ nombre: u.nombre || '', email: cuentas[u.user_id]?.email || '', password: r.password })
    } catch (e: any) { alert('No se ha podido: ' + e.message) }
    setGuardando(null)
  }

  // 'n1'..'n3' = entrenador de ese nivel; 'admin' = dirección. Pasar de dirección a
  // entrenador le quita Finanzas; entre niveles se respetan los permisos sueltos.
  // El nombre es el que sale en Hoy, en la agenda y en los turnos: corto mejor
  // («Mario» antes que el nombre completo con apellidos).
  async function guardarNombre() {
    if (!editNombre) return
    const v = editNombre.v.trim()
    if (!v) { setEditNombre(null); return }
    setGuardando(editNombre.id)
    const { error } = await supabase.from('perfiles').update({ nombre: v }).eq('id', editNombre.id)
    if (error) alert('No se ha podido cambiar el nombre: ' + error.message)
    setEditNombre(null)
    await cargar()
    setGuardando(null)
  }

  async function cambiarRol(id: string, valor: string, actual: any) {
    setGuardando(id)
    const upd: any = valor === 'admin'
      ? { rol: 'admin', permisos: { finanzas: true, cobros: true } }
      : { rol: 'usuario', nivel: Number(valor.slice(1)),
          ...(actual.rol === 'admin' ? { permisos: { finanzas: false, cobros: false } } : {}) }
    const { error } = await supabase.from('perfiles').update(upd).eq('id', id)
    if (error) alert('No se ha podido cambiar: ' + error.message)
    await cargar()
    setGuardando(null)
  }

  // Dos permisos separados a propósito. COBROS es cobrar al paciente y emitir su
  // factura; lo necesita cualquiera que atienda el mostrador. FINANZAS es ver el
  // dinero de la clínica: ingresos, gastos, impuestos y rentabilidad.
  // Quien tiene Finanzas puede cobrar; al revés no.
  async function togglePermiso(id: string, permisos: any, cual: 'finanzas' | 'cobros') {
    setGuardando(id)
    const nuevos = { ...permisos, [cual]: !permisos?.[cual] }
    // Dar Finanzas implica poder cobrar: si no, verías el dinero sin poder
    // registrarlo, que no le sirve a nadie.
    if (cual === 'finanzas' && nuevos.finanzas) nuevos.cobros = true
    const { error } = await supabase.from('perfiles').update({ permisos: nuevos }).eq('id', id)
    if (error) alert('No se ha podido cambiar el permiso: ' + error.message)
    await cargar()
    setGuardando(null)
  }

  const copiar = async () => {
    if (!entrega) return
    const texto = `Hola ${entrega.nombre.split(' ')[0]}, ya tienes cuenta en SIE.\nEntra en ${window.location.origin}\nCorreo: ${entrega.email}\nContraseña provisional: ${entrega.password}\nCámbiala en tu inicial (abajo a la izquierda) → Mi cuenta.`
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch {}
  }

  if (!esAdmin) {
    return (
      <div className="card">
        <div style={{textAlign:'center',padding:30,color:'var(--grl)',fontSize:12}}>
<Ic name="candado" size={12} style={{verticalAlign:'-2px',marginRight:4}}/> Solo dirección puede gestionar el equipo
        </div>
      </div>
    )
  }

  const listo = nombre.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <div className="card">
      <div className="card-title">
        <span className="ct-l"><Ic name="pacientes"/> Equipo</span>
        {!abierto && <button className="btn btn-p btn-sm" onClick={() => { setAbierto(true); setEntrega(null) }}><Ic name="mas" size={12}/> Añadir trabajador</button>}
      </div>
      <div style={{fontSize:10,color:'var(--grl)',marginBottom:14}}>Quién entra en SIE y qué ve cada uno</div>

      {/* ALTA: nombre, correo y qué perfil tiene. La contraseña la pone SIE. */}
      {abierto && (
        <div style={{padding:14,borderRadius:10,border:'1px solid var(--gm)',background:'var(--gl)',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--n)',marginBottom:10}}>Nuevo trabajador</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div className="field" style={{margin:0}}><label>Nombre</label>
              <input className="input" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Mario Pérez" autoFocus/>
            </div>
            <div className="field" style={{margin:0}}><label>Correo con el que entrará</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="mario@…" autoComplete="off"/>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginTop:12}}>
            {[...NIVELES.map(x => [`n${x.n}`, `Nivel ${x.n} · ${x.nombre}`, x.que]), ['admin','Dirección','Todo, también finanzas, ajustes y el equipo']].map(([v,t,d]) => (
              <button key={v} onClick={()=>setPerfilNuevo(v)} style={{textAlign:'left',padding:'8px 12px',borderRadius:10,cursor:'pointer',maxWidth:220,background:perfilNuevo===v?'#fff':'transparent',border:`1px solid ${perfilNuevo===v?'var(--g)':'var(--bd)'}`}}>
                <div style={{fontSize:12,fontWeight:600,color:perfilNuevo===v?'var(--gd)':'var(--n)'}}>{t}</div>
                <div style={{fontSize:10,color:'var(--grl)'}}>{d}</div>
              </button>
            ))}
            {(perfilNuevo==='n1' || perfilNuevo==='n2') && (
              <label style={{fontSize:11,color:'var(--n)',display:'inline-flex',alignItems:'center',gap:6,marginLeft:6,cursor:'pointer'}}>
                <input type="checkbox" checked={cobros} onChange={e=>setCobros(e.target.checked)}/> Puede cobrar
              </label>
            )}
          </div>
          {error && <div style={{fontSize:11,color:'var(--red)',marginTop:10}}>{error}</div>}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
            <button className="btn btn-s btn-sm" onClick={()=>{ setAbierto(false); setError('') }}>Cancelar</button>
            <button className="btn btn-p btn-sm" disabled={!listo || guardando==='nuevo'} onClick={crear}>{guardando==='nuevo' ? 'Creando…' : 'Crear cuenta'}</button>
          </div>
        </div>
      )}

      {/* La contraseña provisional, una sola vez, lista para mandarla. */}
      {entrega && (
        <div style={{padding:14,borderRadius:10,border:'1px solid var(--g)',background:'#fff',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gd)',marginBottom:6}}><Ic name="check" size={13} style={{verticalAlign:'-2px'}}/> Cuenta lista{entrega.nombre ? ` para ${entrega.nombre}` : ''}</div>
          <div style={{fontSize:11,color:'var(--n)',lineHeight:1.7}}>
            Correo: <b>{entrega.email}</b><br/>
            Contraseña provisional: <b style={{fontFamily:'ui-monospace,monospace',fontSize:13,letterSpacing:.5}}>{entrega.password}</b>
          </div>
          <div style={{fontSize:10,color:'var(--grl)',marginTop:6}}>Pásasela tú: no se vuelve a mostrar. La cambia él en su inicial → Mi cuenta.</div>
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <button className="btn btn-p btn-sm" onClick={copiar}><Ic name="copiar" size={12}/> {copiado ? 'Copiado' : 'Copiar mensaje para enviárselo'}</button>
            <button className="btn btn-s btn-sm" onClick={()=>setEntrega(null)}>Hecho</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Cargando equipo...</div>
      ) : usuarios.length === 0 ? (
        <div style={{fontSize:11,color:'var(--grl)',padding:10}}>Todavía no hay nadie</div>
      ) : (
        usuarios.map(u => {
          const cuenta = cuentas[u.user_id]
          // A uno mismo no se le deja quitarse dirección: se quedaría sin poder volver.
          const soyYo = u.id === perfilActual?.id
          return (
          <div key={u.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:8,border:'1px solid var(--bd)',marginBottom:8,background:'var(--bl)',flexWrap:'wrap'}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:u.rol==='admin'?'var(--g)':'var(--bm)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:u.rol==='admin'?'#fff':'var(--gr)',flexShrink:0,fontWeight:500}}>
              {(u.nombre||'?').charAt(0).toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:160}}>
              {editNombre?.id === u.id ? (
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input className="input" autoFocus value={editNombre!.v} onChange={e=>setEditNombre({ id: u.id, v: e.target.value })}
                    onKeyDown={e=>{ if (e.key==='Enter') guardarNombre(); if (e.key==='Escape') setEditNombre(null) }}
                    style={{fontSize:12,padding:'4px 8px',maxWidth:220}}/>
                  <button className="btn btn-p btn-sm" onClick={guardarNombre} disabled={guardando===u.id}>Guardar</button>
                  <button className="btn btn-s btn-sm" onClick={()=>setEditNombre(null)}>✕</button>
                </div>
              ) : (
                <div style={{fontSize:12,fontWeight:500,color:'var(--n)',display:'flex',alignItems:'center',gap:6}}>
                  {u.nombre||'Sin nombre'}{soyYo && <span style={{color:'var(--grl)',fontWeight:400}}> · tú</span>}
                  <button onClick={()=>setEditNombre({ id: u.id, v: u.nombre || '' })} title="Cambiar el nombre"
                    style={{background:'none',border:'none',padding:0,cursor:'pointer',color:'var(--grl)',display:'inline-flex'}}><Ic name="editar" size={12}/></button>
                </div>
              )}
              <div style={{fontSize:9,color:'var(--grl)'}}>
                {cuenta?.email || (u.rol==='admin' ? 'Dirección' : nombreNivel(u.nivel ?? 1))}
                {cuenta && ` · ${cuenta.ultimo ? 'último acceso ' + fechaCorta(cuenta.ultimo) : 'aún no ha entrado'}`}
              </div>
              {/* Confidencialidad: firmada (con su versión) o pendiente; se abre para imprimir. */}
              <a href={`/confidencialidad?u=${u.user_id}`} style={{fontSize:9,textDecoration:'none',color:firmas[u.user_id]?.version===VERSION_CONFIDENCIALIDAD?'var(--gd)':'#8a6d1f'}}>
                <Ic name="firmar" size={10} style={{verticalAlign:'-1px'}}/> {firmas[u.user_id]?.version===VERSION_CONFIDENCIALIDAD ? `Confidencialidad aceptada el ${fechaCorta(firmas[u.user_id].aceptada)}` : 'Confidencialidad pendiente: la aceptará al entrar'}
              </a>
            </div>

            {/* SELECTOR DE PERFIL */}
            <select className="input" value={u.rol==='admin' ? 'admin' : `n${u.nivel ?? 1}`} onChange={e=>cambiarRol(u.id, e.target.value, u)} disabled={guardando===u.id||soyYo} title={soyYo?'No puedes quitarte dirección a ti mismo':undefined} style={{width:170,fontSize:11}}>
              {NIVELES.map(x => <option key={x.n} value={`n${x.n}`}>Nivel {x.n} · {x.nombre}</option>)}
              <option value="admin">Dirección</option>
            </select>

            {/* PERMISOS · cobrar y ver el dinero son cosas distintas */}
            {([['cobros','recibo','Cobros'],['finanzas','finanzas','Finanzas']] as const).map(([clave,icono,etiqueta])=>{
              // Dirección los tiene siempre; con Finanzas, Cobros va implícito.
              // El nivel 3 (encargado/a) cobra siempre.
              const n3 = u.rol!=='admin' && u.nivel===3 && clave==='cobros'
              const activo = u.rol==='admin' || n3 || u.permisos?.[clave]===true || (clave==='cobros' && u.permisos?.finanzas===true)
              const fijo = u.rol==='admin' || n3 || (clave==='cobros' && u.permisos?.finanzas===true)
              return (
                <div key={clave} style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:10,color:'var(--grl)',display:'inline-flex',alignItems:'center',gap:4}}><Ic name={icono} size={11}/> {etiqueta}</span>
                  <button onClick={()=>togglePermiso(u.id, u.permisos, clave)} disabled={guardando===u.id||fijo}
                    title={fijo ? (u.rol==='admin' ? 'Dirección lo tiene siempre' : n3 ? 'El nivel 3 cobra siempre' : 'Con Finanzas, cobrar va incluido') : undefined}
                    style={{width:38,height:21,borderRadius:99,background:activo?'var(--g)':'var(--bm)',border:'none',cursor:fijo?'not-allowed':'pointer',transition:'background .2s',position:'relative',opacity:fijo?0.5:1}}>
                    <div style={{width:15,height:15,borderRadius:'50%',background:'#fff',position:'absolute',top:3,transition:'left .2s',left:activo?'20px':'3px',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
                  </button>
                </div>
              )
            })}

            {!soyYo && (
              <button className="btn btn-s btn-sm" onClick={()=>reiniciar(u)} disabled={guardando===u.id} title="Para quien la ha olvidado: genera una provisional nueva">
                <Ic name="candado" size={11}/> Nueva contraseña
              </button>
            )}
          </div>
          )
        })
      )}

      <div style={{marginTop:14,padding:'10px 12px',background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,fontSize:9,color:'var(--gd)'}}>
<Ic name="info" size={12} style={{verticalAlign:'-2px',marginRight:4}}/> <strong>Nivel 1 · Eventual</strong>: Hoy, Agenda (solo consulta) y Taller; da las clases, apunta y marca faltas. <strong>Nivel 2 · Entrenador</strong>: además Pacientes y Valoración, cambia ejercicios y sesiones, cancela citas. <strong>Nivel 3 · Encargado/a</strong>: además El torno, Biblioteca y Cobros. <strong>Dirección</strong> lo ve todo. <strong>Cobros</strong> permite cobrar al paciente y emitir su factura; <strong>Finanzas</strong> es el dinero de la clínica e incluye Cobros.
      </div>
    </div>
  )
}
