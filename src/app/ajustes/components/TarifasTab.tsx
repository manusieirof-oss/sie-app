'use client'
import { useState } from 'react'
import { Ic } from '@/lib/icons'
import { TIPOS_DESCUENTO, LBL_DESCUENTO } from '@/lib/bonos'
import { SERVICIOS_POR_DEFECTO, DESCUENTOS_POR_DEFECTO, type Servicio, type Descuento } from '@/lib/tarifas'

// Catálogos que alimentan el modal de cobro.
//
// Viven en `ajustes` y no en código, igual que los tipos de clase o los
// festivos: cambiar el precio de la valoración no puede exigir un despliegue.
// Antes los 36 € de la valoración estaban escritos dentro del modal.
//
// Son PROPUESTAS: en el cobro todo se puede tocar antes de emitir. Por eso no
// hay tabla propia ni validaciones estrictas, es una lista de atajos.

export default function TarifasTab({ ajustes, set }: any) {
  const leer = <T,>(clave: string, porDefecto: T[]): T[] => {
    try { const v = ajustes[clave] ? JSON.parse(ajustes[clave]) : null; return Array.isArray(v) ? v : porDefecto }
    catch { return porDefecto }
  }

  const servicios  = leer<Servicio>('servicios_lista', SERVICIOS_POR_DEFECTO)
  const descuentos = leer<Descuento>('descuentos_lista', DESCUENTOS_POR_DEFECTO)

  const setServicios  = (v: Servicio[])  => set('servicios_lista', JSON.stringify(v))
  const setDescuentos = (v: Descuento[]) => set('descuentos_lista', JSON.stringify(v))

  const [srv, setSrv] = useState({ nombre: '', precio: '', iva: '21' })
  const [dto, setDto] = useState({ nombre: '', tipo: 'porcentaje', valor: '' })

  function añadirServicio() {
    const nombre = srv.nombre.trim(); const precio = parseFloat(srv.precio)
    if (!nombre || !(precio > 0)) return
    setServicios([...servicios, { nombre, precio, iva: parseFloat(srv.iva) || 21 }])
    setSrv({ nombre: '', precio: '', iva: srv.iva })
  }

  function añadirDescuento() {
    const nombre = dto.nombre.trim(); const valor = parseFloat(dto.valor)
    if (!nombre || isNaN(valor)) return
    setDescuentos([...descuentos, { nombre, tipo: dto.tipo, valor }])
    setDto({ nombre: '', tipo: dto.tipo, valor: '' })
  }

  const fmtDto = (d: Descuento) =>
    d.tipo === 'porcentaje' ? `${d.valor}%` : d.tipo === 'precio' ? `precio ${d.valor.toFixed(2)} €` : `${d.valor.toFixed(2)} € menos`

  return (
    <>
      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="euro"/> Servicios sueltos</span></div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>
          Lo que se cobra fuera de la cuota mensual: valoración, sesión individual, lo que sea.
          Sale como atajo al añadir una línea en un cobro, y el importe se puede cambiar antes de emitir.
          Los bonos no van aquí: sus precios están en Finanzas → Planes.
        </div>

        {servicios.length === 0 && <div style={{fontSize:10,color:'var(--grl)',marginBottom:8}}>Sin servicios. El modal de cobro solo ofrecerá línea libre.</div>}
        {servicios.map((s, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:'var(--bl)',border:'1px solid var(--bd)',marginBottom:5}}>
            <span style={{fontSize:11,color:'var(--n)',flex:1}}>{s.nombre}</span>
            <span style={{fontSize:9,color:'var(--grl)'}}>IVA {s.iva}%</span>
            <span style={{fontSize:12,fontWeight:600,color:'var(--gd)'}}>{s.precio.toFixed(2)} €</span>
            <button onClick={()=>setServicios(servicios.filter((_,j)=>j!==i))}
              style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}} title="Quitar">✕</button>
          </div>
        ))}

        <div style={{display:'flex',gap:6,marginTop:10}}>
          <input className="input" style={{flex:1,fontSize:11}} placeholder="Nombre del servicio" value={srv.nombre}
            onChange={e=>setSrv(p=>({...p,nombre:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')añadirServicio()}}/>
          <input className="input" type="number" step="0.01" style={{width:90,fontSize:11}} placeholder="Precio" value={srv.precio}
            onChange={e=>setSrv(p=>({...p,precio:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')añadirServicio()}}/>
          <select className="input" style={{width:80,fontSize:11}} value={srv.iva} onChange={e=>setSrv(p=>({...p,iva:e.target.value}))}>
            <option value="21">21%</option><option value="10">10%</option><option value="4">4%</option><option value="0">0%</option>
          </select>
          <button className="btn btn-p btn-sm" onClick={añadirServicio}>+ Añadir</button>
        </div>
        <div style={{fontSize:9,color:'var(--grl)',marginTop:6}}>El precio se escribe con IVA incluido, como en el resto de la app.</div>
      </div>

      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="etiqueta"/> Descuentos guardados</span></div>
        <div style={{fontSize:10,color:'var(--grl)',marginBottom:12}}>
          Los que aplicas a menudo, para no tener que teclearlos. Se pueden usar al asignar el bono en la ficha
          —y entonces se mantienen cada mes— o sobre una línea suelta de un cobro, y entonces valen solo para ese cobro.
        </div>

        <div style={{background:'var(--gl)',border:'1px solid var(--gm)',borderRadius:6,padding:'8px 12px',marginBottom:12,fontSize:9,color:'var(--gd)',lineHeight:1.6}}>
          <Ic name="info" size={11} style={{verticalAlign:'-2px',marginRight:4}}/>
          <strong>Precio pactado</strong> evita los céntimos: en vez de un 12% que deja la cuota en 55,44 €, dices que paga 55 € y se acabó.
        </div>

        {descuentos.length === 0 && <div style={{fontSize:10,color:'var(--grl)',marginBottom:8}}>Sin descuentos guardados.</div>}
        {descuentos.map((d, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8,background:'var(--bl)',border:'1px solid var(--bd)',marginBottom:5}}>
            <span style={{fontSize:11,color:'var(--n)',flex:1}}>{d.nombre}</span>
            <span style={{fontSize:9,color:'var(--grl)'}}>{LBL_DESCUENTO[d.tipo] || d.tipo}</span>
            <span style={{fontSize:12,fontWeight:600,color:'var(--gd)'}}>{fmtDto(d)}</span>
            <button onClick={()=>setDescuentos(descuentos.filter((_,j)=>j!==i))}
              style={{fontSize:9,color:'var(--red)',background:'none',border:'none',cursor:'pointer'}} title="Quitar">✕</button>
          </div>
        ))}

        <div style={{display:'flex',gap:6,marginTop:10}}>
          <input className="input" style={{flex:1,fontSize:11}} placeholder="Ej. Familiar, Estudiante" value={dto.nombre}
            onChange={e=>setDto(p=>({...p,nombre:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')añadirDescuento()}}/>
          <select className="input" style={{width:140,fontSize:11}} value={dto.tipo} onChange={e=>setDto(p=>({...p,tipo:e.target.value}))}>
            {TIPOS_DESCUENTO.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <input className="input" type="number" step="0.01" style={{width:90,fontSize:11}}
            placeholder={dto.tipo==='porcentaje'?'10':dto.tipo==='precio'?'55':'8'} value={dto.valor}
            onChange={e=>setDto(p=>({...p,valor:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')añadirDescuento()}}/>
          <button className="btn btn-p btn-sm" onClick={añadirDescuento}>+ Añadir</button>
        </div>
      </div>
    </>
  )
}
