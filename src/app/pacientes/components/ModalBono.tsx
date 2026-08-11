'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BonoTipo, TIPOS_DESCUENTO, quitarBono } from '@/lib/bonos'
import { esDeSesiones, caducidadDesde, textoModalidad } from '@/lib/bonoSesiones'
import BuscadorPacientes from '@/components/BuscadorPacientes'

/**
 * BONOS DE PAREJA: no existe "la pareja" como cosa guardada.
 *
 * Se le da a cada uno su bono, con sus propias sesiones y su propia factura, y
 * el precio del tipo "pareja" es lo que paga CADA UNO. Se decidió así porque es
 * lo único que cuadra por los dos lados: el consumo sale solo (las citas de
 * cada uno descuentan de su bono, sin tener que adivinar de quién era la
 * sesión) y cada uno tiene un justificante a su nombre para deducírselo.
 *
 * Lo que sí resuelve esta pantalla es el trabajo doble: se asignan los dos de
 * una vez. Si no, lo normal es asignárselo a uno, olvidarse del otro, y que
 * las clases del segundo no descuenten de nada durante un mes.
 */

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default function ModalBono({ pacienteId, bonoActual, bonosOpts, onCerrar, onGuardado }: {
  pacienteId: string
  bonoActual: any
  bonosOpts: BonoTipo[]
  onCerrar: () => void
  onGuardado?: () => void
}) {
  const [form, setForm] = useState({
    tipo: bonoActual?.tipo || (bonosOpts[0]?.id || ''),
    descuento_tipo: bonoActual?.descuento_tipo || '',
    descuento_valor: bonoActual?.descuento_valor ? String(bonoActual.descuento_valor) : '',
    descuento_motivo: bonoActual?.descuento_motivo || '',
    /**
     * CUÁNDO EMPIEZA. Antes era siempre hoy, y eso obligaba a esperar al día 1
     * para dar de alta a nadie: un bono creado el 20 de agosto era una cuota de
     * agosto, aunque la persona fuera a empezar en septiembre.
     *
     * De esta fecha salen tres cosas: el MES que cubre la cuota (y por tanto en
     * qué lista de Cobros aparece), la FRACCIÓN de alta si empieza a mitad de
     * mes, y la CADUCIDAD si es un bono de sesiones.
     *
     * Sirve sobre todo para las valoraciones: alguien que se valora el 20 de
     * agosto y empieza el 1 de septiembre se deja listo el mismo día, sin
     * ensuciar agosto con una cuota que nadie va a cobrar.
     */
    empieza: new Date().toISOString().split('T')[0],
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [confirmarQuitar, setConfirmarQuitar] = useState(false)
  // Segunda persona del bono de pareja. Se carga la lista solo si se pide: son
  // cientos de filas que no hacen falta en el caso normal.
  const [conPareja, setConPareja] = useState(false)
  const [pareja, setPareja] = useState<any>(null)
  const [lista, setLista] = useState<any[]>([])

  async function activarPareja() {
    setConPareja(true)
    if (lista.length) return
    const { data, error } = await supabase.from('pacientes')
      .select('id,nombre,apellidos').in('estado',['activo','pausa']).order('nombre')
    if (error) { setError(`No se ha podido cargar la lista de pacientes: ${error.message}`); return }
    setLista((data || []).filter((p:any) => p.id !== pacienteId))
  }

  const LBL_BONO: Record<string,string> = Object.fromEntries(bonosOpts.map(b=>[b.id,b.nombre]))
  const LBL_PAGO: Record<string,string> = { pagado:'Pagado', pendiente:'Pendiente', impago:'Impago' }
  const tipoElegido = bonosOpts.find(b=>b.id===form.tipo)

  /** A qué mes va a parar la cuota según la fecha escrita. Solo para enseñarlo. */
  const mesDeLaCuota = (() => {
    const [aa, mm, dd] = (form.empieza || '').split('-').map(Number)
    if (!aa || !mm || !dd || mm < 1 || mm > 12) return { valido: false, texto: '', futuro: false, dia: 1 }
    const hoy = new Date()
    const futuro = aa > hoy.getFullYear() || (aa === hoy.getFullYear() && mm > hoy.getMonth() + 1)
    return { valido: true, texto: `${MESES[mm-1]} de ${aa}`, futuro, dia: dd }
  })()

  async function quitar() {
    setGuardando(true); setError(null)
    const r = await quitarBono(bonoActual)
    setGuardando(false)
    if (!r.ok) { setError(r.error); setConfirmarQuitar(false); return }
    onGuardado?.()
    onCerrar()
  }

  async function guardar() {
    if (!form.tipo) return
    setGuardando(true)
    // El mes de la cuota sale de la fecha de inicio, no del día en que se
    // teclea. Se parte a mano en vez de `new Date(...)` para no depender de la
    // zona horaria: "2026-09-01" interpretado en UTC puede caer en agosto.
    const [aa, mm, dd] = form.empieza.split('-').map(Number)
    if (!aa || !mm || !dd) { setError('La fecha de inicio no es válida'); setGuardando(false); return }
    const mes = mm, anio = aa
    const tipoSel = bonosOpts.find(b=>b.id===form.tipo)
    const diasSemana = tipoSel?.dias_semana || 1
    const descTipo = form.descuento_tipo || null
    const descValor = descTipo ? (parseFloat(form.descuento_valor) || 0) : 0
    const comun = {
      tipo: form.tipo, dias_semana: diasSemana,
      descuento_tipo: descTipo, descuento_valor: descValor,
      descuento_motivo: descTipo ? (form.descuento_motivo || null) : null,
    }
    const inicio = form.empieza
    // El evento del historial lleva la fecha de HOY: la asignación ocurre
    // ahora, aunque la cuota empiece a correr en septiembre. Fecharlo en el
    // futuro metería el apunte fuera de sitio en la cronología del paciente.
    const hoyStr = new Date().toISOString().split('T')[0]
    const empiezaDespues = inicio > hoyStr

    // UN BONO DE SESIONES NO SUSTITUYE A NADA.
    //
    // La cuota mensual y el bono de sesiones conviven: alguien puede venir a
    // clase tres días por semana y además comprar ocho individuales. Si aquí se
    // aplicase la lógica de sustitución, comprar sesiones le quitaría la cuota
    // y dejaría de facturársele el mes.
    //
    // Las sesiones y la caducidad se COPIAN del tipo, no se leen de él: si
    // mañana el bono de 8 pasa a 10, quien compró 8 sigue teniendo 8. Mismo
    // criterio que congelar los datos dentro de la factura.
    if (esDeSesiones(tipoSel)) {
      const cad = caducidadDesde(inicio, tipoSel?.caduca_meses)
      // Los dos de la pareja llevan bono propio, con sus sesiones y su factura.
      const destinos = [pacienteId, ...(conPareja && pareja ? [pareja.id] : [])]
      const filas = destinos.map(pid => ({
        ...comun, paciente_id: pid, estado_pago: 'pendiente', mes, anio,
        fecha_inicio: inicio, activo: true,
        sesiones_totales: tipoSel?.sesiones || null,
        caduca: cad,
      }))
      const { error } = await supabase.from('bonos').insert(filas)
      // Se insertan los dos de golpe: o entran los dos o no entra ninguno. Si
      // fueran dos inserciones seguidas y fallara la segunda, uno se quedaría
      // con bono y el otro no, y nadie se enteraría hasta el mes siguiente.
      if (error) { setError(`No se ha podido asignar el bono: ${error.message}`); setGuardando(false); return }
      await supabase.from('eventos_paciente').insert(destinos.map(pid => ({
        paciente_id: pid, tipo: 'cambio_bono',
        titulo: `Bono de sesiones: ${LBL_BONO[form.tipo]||form.tipo}`,
        descripcion: `${tipoSel?.sesiones} sesiones. Pendiente de cobro.` +
          (cad ? ` Válido hasta ${new Date(cad+'T12:00:00').toLocaleDateString('es-ES')}.` : '') +
          (destinos.length > 1 ? ' Bono de pareja: cada uno tiene sus sesiones y su factura.' : '') +
          (empiezaDespues ? ` Empieza el ${new Date(inicio+'T12:00:00').toLocaleDateString('es-ES')}.` : ''),
        fecha: hoyStr,
      })))
      setGuardando(false)
      onGuardado?.()
      onCerrar()
      return
    }

    // Si el bono que se sustituye YA ES DE ESTE MES, se corrige en su sitio en
    // vez de crear otro.
    //
    // Antes se desactivaba el viejo y se insertaba uno nuevo, en ese orden y sin
    // mirar si la inserción funcionaba. Como hay un índice único por paciente,
    // mes y año, insertar un segundo bono del mismo mes falla — y el paciente se
    // quedaba sin ninguno, porque el viejo ya estaba desactivado. Silencioso y
    // destructivo, las dos cosas a la vez.
    //
    // Cambiar de bono a mitad de mes es corregir la cuota de ese mes, no abrir
    // una segunda. Lo que ya se haya cobrado no se toca: la factura está
    // congelada y sigue diciendo lo que decía.
    //
    // Si el bono anterior era DE SESIONES, no se corrige ni se retira: se le
    // está poniendo la cuota mensual además de las sesiones que compró, y esas
    // siguen siendo suyas hasta que se las gaste.
    const mismoMes = bonoActual && !esDeSesiones(bonoActual)
      && bonoActual.mes === mes && bonoActual.anio === anio
    const sustituye = bonoActual && !esDeSesiones(bonoActual)

    if (mismoMes) {
      const { error } = await supabase.from('bonos').update(comun).eq('id', bonoActual.id)
      if (error) { setError(`No se ha podido cambiar el bono: ${error.message}`); setGuardando(false); return }
    } else {
      // Primero se crea el nuevo. Solo si entra se retira el anterior, para que
      // un fallo no pueda dejar al paciente sin cuota.
      const { error } = await supabase.from('bonos').insert({
        ...comun, paciente_id: pacienteId, estado_pago: 'pendiente', mes, anio,
        fecha_inicio: inicio, activo: true,
      })
      if (error) { setError(`No se ha podido asignar el bono: ${error.message}`); setGuardando(false); return }
      if (sustituye) await supabase.from('bonos').update({ activo:false }).eq('id', bonoActual.id)
    }

    const txtDesc = descTipo
      ? ` · ${descTipo==='precio' ? `Precio pactado ${descValor} €` : descTipo==='porcentaje' ? `Descuento ${descValor}%` : `Descuento ${descValor} €`}${form.descuento_motivo?` (${form.descuento_motivo})`:''}`
      : ''
    await supabase.from('eventos_paciente').insert({
      paciente_id: pacienteId, tipo: 'cambio_bono',
      titulo: `${mismoMes ? 'Bono corregido' : 'Bono asignado'}: ${LBL_BONO[form.tipo]||form.tipo}`,
      descripcion: `${mismoMes ? 'Se corrige la cuota de este mes.' : 'Pendiente de cobro.'}${txtDesc}`
        + (empiezaDespues ? ` Cuota de ${MESES[mes-1].toLowerCase()}, empieza el ${new Date(inicio+'T12:00:00').toLocaleDateString('es-ES')}.` : ''),
      fecha: hoyStr,
    })

    setGuardando(false)
    onGuardado?.()
    onCerrar()
  }

  return (
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onCerrar()}}>
      <div className="modal">
        <div className="modal-title">{bonoActual?'Cambiar bono':'Asignar bono'}<button className="modal-close" onClick={onCerrar}>✕</button></div>

        {/* El aviso va donde se toma la decisión: aquí, viendo ya el tipo
            elegido, y no después en la ficha cuando ya no hay vuelta atrás. */}
        {esDeSesiones(tipoElegido) ? (
          <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:10,color:'var(--gd)',lineHeight:1.6}}>
            Bono de <strong>{tipoElegido?.sesiones} sesiones</strong>
            {tipoElegido?.caduca_meses ? <>, válido <strong>{tipoElegido.caduca_meses} {tipoElegido.caduca_meses===1?'mes':'meses'}</strong> desde hoy</> : ', sin caducidad'}.
            {bonoActual && ' No sustituye a la cuota actual: se suma a ella.'} Las sesiones se descuentan solas al marcar las citas.
          </div>
        ) : bonoActual?.estado_pago === 'pagado' && (
          <div style={{background:'var(--ambl)',border:'1px solid var(--amb)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:10,color:'#7A5800',lineHeight:1.6}}>
            El bono actual está <strong>pagado</strong>. El que asignes ahora nace <strong>pendiente de cobro</strong>: lo cobrado corresponde al anterior y se queda con él.
          </div>
        )}

        <div className="field"><label>Tipo de bono</label>
          <select className="input" value={form.tipo} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
            {bonosOpts.map(b=>(
              <option key={b.id} value={b.id}>{b.nombre} · {textoModalidad(b)}</option>
            ))}
          </select>
        </div>

        {/* La fecha manda sobre el mes de la cuota, así que se dice a qué mes va
            a parar. Sin eso, poner el 1 de septiembre y no ver la cuota en la
            lista de agosto parece un fallo. */}
        <div className="field">
          <label>Empieza el</label>
          <input className="input" type="date" value={form.empieza}
            onChange={e=>setForm(p=>({...p, empieza: e.target.value}))}/>
          <div style={{fontSize:9,color: mesDeLaCuota.futuro ? 'var(--gd)' : 'var(--grl)', marginTop:5, lineHeight:1.6}}>
            {mesDeLaCuota.valido
              ? <>Cuota de <strong>{mesDeLaCuota.texto}</strong>. Aparecerá en Cobros en ese mes, no antes.
                  {mesDeLaCuota.dia > 1 && !esDeSesiones(tipoElegido) &&
                    <> Al cobrarla podrás dejarla en la parte del mes que le corresponda.</>}</>
              : <span style={{color:'var(--red)'}}>Fecha no válida.</span>}
          </div>
        </div>

        {esDeSesiones(tipoElegido) && (
          <div className="field">
            <label>¿Es un bono de pareja?</label>
            {!conPareja ? (
              <button className="btn btn-s btn-sm" onClick={activarPareja} style={{width:'100%'}}>
                + Asignárselo también a otra persona
              </button>
            ) : (
              <>
                <BuscadorPacientes
                  pacientes={lista}
                  valor={pareja?.id || ''}
                  onElegir={(p:any)=>setPareja(p)}
                  onLimpiar={()=>{ setPareja(null); setConPareja(false) }}
                  placeholder="Buscar a la otra persona..."/>
                <div style={{fontSize:9,color:'var(--grl)',marginTop:5,lineHeight:1.6}}>
                  Cada uno se lleva sus <strong>{tipoElegido?.sesiones} sesiones</strong> y su propia factura,
                  y el precio del bono es lo que paga <strong>cada uno</strong>. Así las clases de cada
                  cual descuentan de su bono y los dos tienen justificante a su nombre.
                </div>
              </>
            )}
          </div>
        )}

        <div className="field"><label>Descuento (opcional) · se mantiene cada mes al renovar</label>
          <div style={{display:'flex',gap:6}}>
            <select className="input" style={{flex:'0 0 140px'}} value={form.descuento_tipo} onChange={e=>setForm(p=>({...p,descuento_tipo:e.target.value}))}>
              <option value="">Sin descuento</option>
              {TIPOS_DESCUENTO.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {form.descuento_tipo && (
              <input className="input" type="number" step="0.01" style={{flex:1}}
                placeholder={form.descuento_tipo==='porcentaje'?'ej. 10':form.descuento_tipo==='precio'?'ej. 55':'ej. 8'}
                value={form.descuento_valor} onChange={e=>setForm(p=>({...p,descuento_valor:e.target.value}))}/>
            )}
          </div>
          {form.descuento_tipo && (
            <div style={{fontSize:9,color:'var(--grl)',marginTop:5}}>
              {TIPOS_DESCUENTO.find(t=>t.id===form.descuento_tipo)?.ayuda}
              {form.descuento_tipo==='precio' && ' · Es lo que paga, sin céntimos raros.'}
            </div>
          )}
        </div>
        {form.descuento_tipo && (
          <div className="field"><label>Motivo del descuento (opcional)</label>
            <input className="input" placeholder="ej. familiar, promo, estudiante" value={form.descuento_motivo} onChange={e=>setForm(p=>({...p,descuento_motivo:e.target.value}))}/>
          </div>
        )}

        {error && (
          <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'8px 12px',marginBottom:10,fontSize:10,color:'var(--red)'}}>
            {error}
          </div>
        )}

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-d btn-sm" onClick={onCerrar}>Cancelar</button>
          <div style={{flex:1}}/>
          <button className="btn btn-p" onClick={guardar} disabled={guardando || (conPareja && !pareja)}>
            {guardando ? '…' : conPareja && pareja ? '✓ Guardar los dos bonos' : '✓ Guardar bono'}
          </button>
        </div>

        {/* QUITAR EL BONO. Va abajo, separado y en dos pasos, porque es lo único
            de esta pantalla que destruye algo. Lo normal aquí es cambiar de
            bono, no borrarlo, y no tiene que estar al lado de Guardar. */}
        {bonoActual && (
          <div style={{marginTop:14,paddingTop:12,borderTop:'1px solid var(--bd)'}}>
            {!confirmarQuitar ? (
              <button className="btn btn-t btn-sm" style={{color:'var(--red)'}}
                onClick={()=>{ setError(null); setConfirmarQuitar(true) }}>
                Quitar este bono
              </button>
            ) : (
              <div style={{background:'var(--redl)',border:'1px solid var(--red)',borderRadius:6,padding:'10px 12px'}}>
                <div style={{fontSize:10,color:'var(--red)',lineHeight:1.6,marginBottom:8}}>
                  Se borra la cuota de <strong>{MESES[(bonoActual.mes||1)-1]} de {bonoActual.anio}</strong>.
                  Úsalo solo si se asignó por error: si ya se cobró, no se podrá y habrá que hacer una rectificativa.
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-d btn-sm" onClick={()=>setConfirmarQuitar(false)}>No, dejarlo</button>
                  <div style={{flex:1}}/>
                  <button className="btn btn-p btn-sm" style={{background:'var(--red)',borderColor:'var(--red)'}}
                    onClick={quitar} disabled={guardando}>
                    {guardando ? '…' : 'Sí, quitar el bono'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
