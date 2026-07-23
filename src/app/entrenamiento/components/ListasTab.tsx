'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'

export default function ListasTab({ medsBiblio, alergiasBiblio, intolBiblio, opsBiblioLib, cargar }: any) {
  const [buscarLista, setBuscarLista] = useState('')
  const [modalNuevoItem, setModalNuevoItem] = useState<{tipo:string,categoria:string}|null>(null)
  const [nuevoItemNombre, setNuevoItemNombre] = useState('')

  return (
    <>
      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
        <input className="input" placeholder="Buscar en listas..." value={buscarLista} onChange={e=>setBuscarLista(e.target.value)} style={{flex:1}}/>
      </div>

      {/* OPERACIONES */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-title"><span className="ct-l"><Ic name="cruz"/> Operaciones / Cirugías</span> <button className="btn btn-p btn-sm" onClick={()=>setModalNuevoItem({tipo:'operacion',categoria:''})}>+ Añadir</button></div>
        {[...new Set(opsBiblioLib.map((o:any)=>o.zona))].map((cat:any)=>{
          const items = opsBiblioLib.filter((o:any)=>o.zona===cat&&(!buscarLista||o.nombre.toLowerCase().includes(buscarLista.toLowerCase())))
          if (!items.length) return null
          return (
            <div key={cat} style={{marginBottom:8}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {items.map((o:any)=><span key={o.id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)',color:'var(--n)'}}>{o.nombre}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {/* MEDICAMENTOS */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-title"><span className="ct-l"><Ic name="medicamento"/> Medicamentos</span> <button className="btn btn-p btn-sm" onClick={()=>setModalNuevoItem({tipo:'medicamento',categoria:''})}>+ Añadir</button></div>
        {[...new Set(medsBiblio.map((m:any)=>m.categoria))].map((cat:any)=>{
          const items = medsBiblio.filter((m:any)=>m.categoria===cat&&(!buscarLista||m.nombre.toLowerCase().includes(buscarLista.toLowerCase())))
          if (!items.length) return null
          return (
            <div key={cat} style={{marginBottom:8}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {items.map((m:any)=><span key={m.id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--bl)',border:'1px solid var(--bd)',color:'var(--n)'}}>{m.nombre}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {/* ALERGIAS */}
      <div className="card" style={{marginBottom:10}}>
        <div className="card-title"><span className="ct-l"><Ic name="alergia"/> Alergias</span> <button className="btn btn-p btn-sm" onClick={()=>setModalNuevoItem({tipo:'alergia',categoria:''})}>+ Añadir</button></div>
        {[...new Set(alergiasBiblio.map((m:any)=>m.categoria))].map((cat:any)=>{
          const items = alergiasBiblio.filter((m:any)=>m.categoria===cat&&(!buscarLista||m.nombre.toLowerCase().includes(buscarLista.toLowerCase())))
          if (!items.length) return null
          return (
            <div key={cat} style={{marginBottom:8}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {items.map((m:any)=><span key={m.id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--redl)',border:'1px solid #F5C8C8',color:'var(--red)'}}>{m.nombre}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {/* INTOLERANCIAS */}
      <div className="card">
        <div className="card-title"><span className="ct-l"><Ic name="intolerancia"/> Intolerancias</span> <button className="btn btn-p btn-sm" onClick={()=>setModalNuevoItem({tipo:'intolerancia',categoria:''})}>+ Añadir</button></div>
        {[...new Set(intolBiblio.map((m:any)=>m.categoria))].map((cat:any)=>{
          const items = intolBiblio.filter((m:any)=>m.categoria===cat&&(!buscarLista||m.nombre.toLowerCase().includes(buscarLista.toLowerCase())))
          if (!items.length) return null
          return (
            <div key={cat} style={{marginBottom:8}}>
              <div style={{fontSize:9,fontWeight:600,color:'var(--grl)',letterSpacing:.4,textTransform:'uppercase',marginBottom:5}}>{cat}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {items.map((m:any)=><span key={m.id} style={{fontSize:10,padding:'3px 10px',borderRadius:99,background:'var(--ambl)',border:'1px solid var(--amb)',color:'#7A5800'}}>{m.nombre}</span>)}
              </div>
            </div>
          )
        })}
      </div>

      {modalNuevoItem&&(
        <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setModalNuevoItem(null)}}>
          <div className="modal">
            <div className="modal-title">Añadir {modalNuevoItem.tipo}<button className="modal-close" onClick={()=>setModalNuevoItem(null)}>✕</button></div>
            <div className="field"><label>Nombre *</label>
              <input className="input" value={nuevoItemNombre} onChange={e=>setNuevoItemNombre(e.target.value)} autoFocus placeholder="ej. Tramadol"/>
            </div>
            <div className="field"><label>Categoría</label>
              <input className="input" value={modalNuevoItem.categoria} onChange={e=>setModalNuevoItem(p=>p?{...p,categoria:e.target.value}:null)} placeholder="ej. Antiinflamatorios"/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="btn btn-d btn-sm" onClick={()=>setModalNuevoItem(null)}>Cancelar</button>
              <div style={{flex:1}}/>
              <button className="btn btn-p" onClick={async()=>{
                if (!nuevoItemNombre) return
                const tabla = modalNuevoItem.tipo==='medicamento'?'medicamentos_biblioteca':modalNuevoItem.tipo==='alergia'?'alergias_biblioteca':modalNuevoItem.tipo==='operacion'?'operaciones_biblioteca':'intolerancias_biblioteca'
                await supabase.from(tabla).insert({nombre:nuevoItemNombre,categoria:modalNuevoItem.categoria||'Otros',activo:true})
                setModalNuevoItem(null); setNuevoItemNombre(''); cargar()
              }}><Ic name="guardar" size={13}/> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
