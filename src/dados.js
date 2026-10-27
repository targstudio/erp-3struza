import {render} from './render.js';
import {DB,MODE,enqueue} from './sync.js';

/* ===================== dados ===================== */
const COLS=['contas','parceiros','movimentos','compras','vendas','titulos','ajustes','config'];
const S={};COLS.forEach(c=>S[c]=[]);
const DEF_CFG={
  tipos:['PP Moído','PP Granulado','PP Aglutinado','PP Aparas/Fardo'],
  cores:['Natural','Branco','Preto','Azul','Verde','Vermelho','Amarelo','Cinza','Laranja','Mista'],
  catPagar:['Compra de material','Aluguel','Energia elétrica','Água','Salários','Frete','Manutenção','Impostos','Combustível','Internet/Telefone','Contador','Outros'],
  catReceber:['Venda de material','Serviço de moagem','Empréstimo','Outros'],
  pesoSaco:25,pesoBag:1000
};
const cfg=()=>Object.assign({},DEF_CFG,(S.config.find(c=>c.id==='geral')||{}));
const byId=(col,id)=>S[col].find(x=>x.id===id);
const contaNome=id=>byId('contas',id)?.nome||'—';
const parcNome=id=>byId('parceiros',id)?.nome||'—';

function loadLocal(){try{const raw=localStorage.getItem('3struza-erp');if(raw){const o=JSON.parse(raw);COLS.forEach(c=>S[c]=o[c]||[])}}catch(e){}}
function saveLocal(){try{localStorage.setItem('3struza-erp',JSON.stringify(S))}catch(e){}}

function upsertLocal(col,obj){const i=S[col].findIndex(x=>x.id===obj.id);if(i>=0)S[col][i]=obj;else S[col].push(obj)}
async function put(col,obj){
  if(obj.exemplo){obj={...obj};delete obj.exemplo} // registro tocado pelo usuário deixa de ser exemplo
  const {id,...data}=obj;
  if(MODE==='supa'){upsertLocal(col,obj);schedule();enqueue({t:'put',col,id,data});return}
  if(MODE==='db'){await DB.collection(col).doc(id).set(data)}
  else{const i=S[col].findIndex(x=>x.id===id);if(i>=0)S[col][i]=obj;else S[col].push(obj);saveLocal();render()}
}
async function del(col,id){
  if(MODE==='supa'){S[col]=S[col].filter(x=>x.id!==id);schedule();enqueue({t:'del',col,id});return}
  if(MODE==='db'){await DB.collection(col).doc(id).delete()}
  else{S[col]=S[col].filter(x=>x.id!==id);saveLocal();render()}
}
let rq=null;function schedule(){if(rq)return;rq=requestAnimationFrame(()=>{rq=null;render()})}

export {COLS,S,DEF_CFG,cfg,byId,contaNome,parcNome,loadLocal,saveLocal,upsertLocal,put,del,rq,schedule};
