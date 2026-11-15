'use client'
import { useState, useEffect, useRef } from 'react'
import CuerpoZonas, { type ColorZona } from '@/components/CuerpoZonas'
import { ZONAS_CUERPO, zonasDeTest } from '@/lib/zonasCuerpo'
import { supabase } from '@/lib/supabase'
import { Ic } from '@/lib/icons'
import Silueta, { MarcaCuerpo } from './Silueta'
import BuscadorBiblioteca from '@/components/BuscadorBiblioteca'
import Sparkline from './Sparkline'
import Documentos from './Documentos'
import { textoMedida } from '@/lib/tests'
import { anadirALista, quitarDeLista, type ListaClinica } from '@/lib/listasPaciente'
import EscalaSlider, { textoEscala } from '@/components/EscalaSlider'
import ModalItemClinico, { type ConfigItemClinico } from '@/components/ModalItemClinico'
import { hoyISO } from '@/lib/fechas'
import SaludRegistrosTest from './SaludRegistrosTest'

// Trozo de pantalla sacado de SaludTab.tsx tal cual (misma logica, mismos datos):
// el archivo grande se queda con el estado y este solo pinta. Lo que necesita le llega
// por props desde alli.
export default function SaludDetalle(p: any) {
  const { LBL_EST_PAT, LBL_TIPO_MOL, abrirTest, cap, cargar, detalle, nombreTest, setDetalle } = p
  return (<>{detalle&&<div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)setDetalle(null)}}><div className="modal"><div className="modal-title"><span className="ct-l"><Ic name={detalle.tipo==='molestia'?'molestia':detalle.tipo==='patologia'?'patologia':detalle.tipo==='test'?'buscar':'medicamento'} size={16}/> {detalle.tipo==='molestia'?(detalle.datos.zona||'Molestia'):detalle.tipo==='patologia'?(detalle.datos.nombre||'Patología'):detalle.tipo==='test'?nombreTest(detalle.datos[0]):(detalle.datos.nombre||'Medicamento')}</span><button className="modal-close" onClick={()=>setDetalle(null)}>✕</button></div>
        {detalle.tipo==='test'&&(()=>{
          const t = detalle.datos[0]; const anteriores = detalle.datos.slice(1); const pos = t.resultado==='positivo'
          return (
            <div style={{display:'flex',flexDirection:'column',gap:9}}>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:12,fontWeight:500,padding:'3px 10px',borderRadius:99,background:pos?'var(--redl)':'var(--gl)',color:pos?'var(--red)':'var(--gd)',border:`1px solid ${pos?'#F5C8C8':'var(--gm)'}`}}>
                  {pos?'Positivo':'Negativo'}
                </span>
                <span style={{fontSize:12,color:'var(--gr)'}}>{new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</span>
              </div>
              {(t.items_resultado||[]).filter((i:any)=>i.marcado).length>0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--gr)',marginBottom:3}}>Ítems marcados</div>
                  {(t.items_resultado||[]).filter((i:any)=>i.marcado).map((it:any,ii:number)=>(
                    <div key={ii} style={{fontSize:13,color:'var(--n)',display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                      <Ic name="checkbox" size={12}/>{it.nombre}{textoMedida(it)?` · ${textoMedida(it)}`:''}
                    </div>
                  ))}
                </div>
              )}
              {t.observaciones && <div><div style={{fontSize:12,color:'var(--gr)',marginBottom:2}}>Observaciones</div><div style={{fontSize:13,color:'var(--n)',lineHeight:1.5}}>{t.observaciones}</div></div>}
              {t.fecha_repeticion && <div style={{fontSize:13,color:'#8A6410',display:'flex',alignItems:'center',gap:5}}><Ic name="alarma" size={13}/> Revisión el {new Date(t.fecha_repeticion+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>}
              {anteriores.length>0 && (
                <div>
                  <div style={{fontSize:12,color:'var(--gr)',marginBottom:4}}>Historial · {anteriores.length} anterior{anteriores.length>1?'es':''}</div>
                  {anteriores.map((ant:any,ai:number)=>(
                    <div key={ai} style={{fontSize:13,color:'var(--n)',paddingLeft:9,borderLeft:'2px solid var(--bd)',marginBottom:4}}>
                      {new Date(ant.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · <span style={{color:ant.resultado==='positivo'?'var(--red)':'var(--gd)'}}>{ant.resultado==='positivo'?'Positivo':'Negativo'}</span>
                      {ant.observaciones && <div style={{fontSize:12,color:'var(--gr)',fontStyle:'italic'}}>{ant.observaciones}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:8,marginTop:2,alignItems:'center'}}>
                <button className="btn btn-t btn-sm" onClick={()=>{setDetalle(null);abrirTest?.(t.test_id,t.lado||'bilateral')}}>Volver a evaluar</button>
                <div style={{flex:1}}/>
                {/* BORRAR el registro. No existía, y un resultado metido por error —el lado
                    equivocado, el test que no era— se quedaba dentro para siempre falseando
                    las metas, que se evalúan contra la última medición.
                    Es borrar, no corregir: se quita el registro y se vuelve a pasar. */}
                <button className="btn btn-t btn-sm" style={{color:'var(--red)'}}
                  onClick={async()=>{
                    if (!confirm(`¿Borrar este resultado del ${new Date(t.fecha+'T12:00:00').toLocaleDateString('es-ES')}?\n\nSe borra solo esta medición. Los objetivos que abrió siguen abiertos: ciérralos desde la ficha si ya no tocan.`)) return
                    const { error } = await supabase.from('resultados_tests').delete().eq('id', t.id)
                    if (error) { alert('No se pudo borrar: ' + error.message); return }
                    setDetalle(null); cargar()
                  }}>
                  <Ic name="papelera" size={12}/> Borrar este resultado
                </button>
              </div>
            </div>
          )
        })()}
        {detalle.tipo==='molestia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.activa?'var(--redl)':'var(--gl)',color:detalle.datos.activa?'var(--red)':'var(--gd)',border:`1px solid ${detalle.datos.activa?'#F5C8C8':'var(--gm)'}`}}>{detalle.datos.activa?'● Activa':'✓ Resuelta'}</span>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{detalle.datos.eva==null?'Sin EVA':`EVA ${detalle.datos.eva}/10`}</span>
            {detalle.datos.tipo&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{LBL_TIPO_MOL[detalle.datos.tipo]||detalle.datos.tipo}</span>}
            {detalle.datos.lado&&detalle.datos.lado!=='bilateral'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
          </div>
          {detalle.datos.sensacion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Cuándo aparece</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.sensacion}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='patologia'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:detalle.datos.estado==='activa'?'var(--redl)':detalle.datos.estado==='cronica'?'var(--ambl)':'var(--gl)',color:detalle.datos.estado==='activa'?'var(--red)':detalle.datos.estado==='cronica'?'#7A5800':'var(--gd)'}}>{LBL_EST_PAT[detalle.datos.estado]||detalle.datos.estado}</span>
            {detalle.datos.lado&&detalle.datos.lado!=='no_aplica'&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)'}}>{cap(detalle.datos.lado)}</span>}
            {detalle.datos.informe_url&&<span style={{fontSize:9,padding:'3px 9px',borderRadius:99,background:'var(--bl)',color:'var(--gr)',display:'inline-flex',alignItems:'center',gap:4}}><Ic name="informe" size={11}/> Informe {detalle.datos.informe_url==='pendiente'?'pendiente':'disponible'}</span>}
          </div>
          {detalle.datos.descripcion&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Descripción / observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.descripcion}</div></div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrada el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        {detalle.tipo==='medicamento'&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {detalle.datos.frecuencia&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Frecuencia</div><div style={{fontSize:11,color:'var(--n)'}}>{detalle.datos.frecuencia}</div></div>}
          {detalle.datos.observaciones&&<div><div style={{fontSize:9,fontWeight:600,color:'var(--grl)',textTransform:'uppercase',marginBottom:2}}>Observaciones</div><div style={{fontSize:11,color:'var(--n)',fontWeight:300,lineHeight:1.5,whiteSpace:'pre-line'}}>{detalle.datos.observaciones}</div></div>}
          {!detalle.datos.frecuencia&&!detalle.datos.observaciones&&<div className="muted">Sin información adicional registrada.</div>}
          <div style={{fontSize:10,color:'var(--grl)'}}>Registrado el {new Date(detalle.datos.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>}
        <div style={{display:'flex',marginTop:12}}><div style={{flex:1}}/><button className="btn btn-d btn-sm" onClick={()=>setDetalle(null)}>Cerrar</button></div>
      </div></div>}</>)
}
