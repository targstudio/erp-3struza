import {S} from './dados.js';
import {TIPOCONTA} from './regras.js';
import {$,esc} from './util.js';

/* ===================== modais ===================== */
let modalClose=null;
function modal(title,body,{wide=false,submit='Salvar',onSubmit,onMount,extra=''}={}){
  const root=$('#modalRoot');
  root.innerHTML=`<div class="ov"><form class="modal ${wide?'wide':''}" novalidate><div class="modal-h"><h3>${title}</h3><button type="button" class="x" data-x aria-label="Fechar">×</button></div><div class="modal-b">${body}<div class="err" id="mErr" hidden></div></div><div class="modal-f">${extra}<button type="button" class="btn" data-x>${submit?'Cancelar':'Fechar'}</button>${submit?`<button class="btn pri" type="submit">${submit}</button>`:''}</div></form></div>`;
  const form=root.querySelector('form');
  const close=()=>{root.innerHTML='';document.removeEventListener('keydown',kd);modalClose=null};
  const kd=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',kd);modalClose=close;
  root.querySelectorAll('[data-x]').forEach(b=>b.onclick=close);
  root.querySelector('.ov').addEventListener('mousedown',e=>{if(e.target.classList.contains('ov'))close()});
  form.onsubmit=async e=>{e.preventDefault();const err=$('#mErr');err.hidden=true;
    const btn=form.querySelector('[type=submit]');if(btn)btn.disabled=true;
    try{const r=await onSubmit(form);if(r===false){if(btn)btn.disabled=false;return}close();}
    catch(ex){err.textContent=typeof ex==='string'?ex:('Não foi possível salvar: '+(ex?.message||ex));err.hidden=false;if(btn)btn.disabled=false}};
  if(onMount)onMount(form);
  const f=form.querySelector('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select');if(f&&!('ontouchstart' in window))f.focus();
  return form;
}
function ask(title,msg,buttons){return new Promise(res=>{
  modal(title,`<p style="margin:0">${msg}</p>`,{submit:'',extra:buttons.map((b,i)=>`<button type="button" class="btn ${b.cls||''}" data-ans="${i}">${b.label}</button>`).join(''),onSubmit:()=>{}});
  $('#modalRoot').querySelectorAll('[data-ans]').forEach(b=>b.onclick=()=>{const v=buttons[+b.dataset.ans].v;modalClose&&modalClose();res(v)});
  $('#modalRoot').querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click',()=>res(null)));
})}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
const fv=(f,n)=>f.elements[n]?.value?.trim()??'';
const opt=(list,sel,ph)=>(ph?`<option value="">${ph}</option>`:'')+(sel&&!list.includes(sel)?[sel,...list]:list).map(v=>`<option ${v===sel?'selected':''}>${esc(v)}</option>`).join('');
const contaOpts=(sel,tipoPref)=>S.contas.filter(c=>c.ativo!==false||c.id===sel).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.nome)} · ${TIPOCONTA[c.tipo]}</option>`).join('');
function defaultConta(forma){const pref=forma==='dinheiro'||forma==='cheque'?'gaveta':'banco';return(S.contas.find(c=>c.tipo===pref&&c.ativo!==false)||S.contas[0])?.id||''}

export {modalClose,modal,ask,toast,fv,opt,contaOpts,defaultConta};
