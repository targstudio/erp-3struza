import {S,byId,del,put} from './dados.js';
import {MODE,QUEUE,SB} from './sync.js';
import {addDays,addMonths,fnum,nid,num,r2,today} from './util.js';

/* ===================== regras de negócio ===================== */
function saldoConta(id){
  const c=byId('contas',id);let s=num(c?.saldoInicial);
  for(const m of S.movimentos){
    if(m.tipo==='entrada'&&m.contaId===id)s+=num(m.valor);
    else if(m.tipo==='saida'&&m.contaId===id)s-=num(m.valor);
    else if(m.tipo==='transferencia'){if(m.contaId===id)s-=num(m.valor);if(m.contaDestinoId===id)s+=num(m.valor)}
  }return r2(s)
}
const saldoTotal=()=>S.contas.filter(c=>c.ativo!==false).reduce((a,c)=>a+saldoConta(c.id),0);
const statusT=t=>t.pago?'pago':(t.vencimento<today()?'atrasado':'aberto');
const STATUS_PILL={pago:['p-ok','Pago'],atrasado:['p-late','Atrasado'],aberto:['p-open','Em aberto']};
function pillT(t){const s=statusT(t);const[k,l]=STATUS_PILL[s];return `<span class="pill ${k}">${t.lado==='receber'&&s==='pago'?'Recebido':l}</span>`}
const EMB={saco:'Saco',bigbag:'Big Bag',granel:'Granel'};
const FORMA={dinheiro:'Dinheiro',pix:'PIX',cheque:'Cheque',permuta:'Troca / Permuta',credito:'Crédito (a prazo)',misto:'Vários'};
const MEIO={dinheiro:'Dinheiro',pix:'PIX',cheque:'Cheque'};const AVISTA=new Set(['dinheiro','pix','cheque','misto']);
const TIPOCONTA={banco:'Banco · C/C',gaveta:'Físico · Gaveta',credito:'Crédito com terceiro'};
const stockKey=it=>[it.tipo,it.cor,it.embalagem,it.embalagem==='granel'?0:num(it.pesoUn)].join('|');

function estoque(){
  const m=new Map();
  const ensure=it=>{const k=stockKey(it);if(!m.has(k))m.set(k,{key:k,tipo:it.tipo,cor:it.cor,embalagem:it.embalagem,pesoUn:it.embalagem==='granel'?0:num(it.pesoUn),kg:0,un:0});return m.get(k)};
  const custo=new Map();
  const addCusto=(it,kg,valor)=>{const k=it.tipo+'|'+it.cor;const c=custo.get(k)||{kg:0,v:0};c.kg+=kg;c.v+=valor;custo.set(k,c)};
  S.compras.forEach(c=>(c.itens||[]).forEach(it=>{const e=ensure(it);e.kg+=num(it.kg);e.un+=num(it.qtd);addCusto(it,num(it.kg),num(it.kg)*num(it.precoKg))}));
  S.ajustes.forEach(a=>{const e=ensure(a);const s=a.sentido==='saida'?-1:1;e.kg+=s*num(a.kg);e.un+=s*num(a.qtd);if(s>0&&num(a.custoKg))addCusto(a,num(a.kg),num(a.kg)*num(a.custoKg))});
  S.vendas.forEach(v=>(v.itens||[]).forEach(it=>{const e=ensure(it);e.kg-=num(it.kg);e.un-=num(it.qtd)}));
  const rows=[...m.values()].map(e=>{const c=custo.get(e.tipo+'|'+e.cor);e.custoKg=c&&c.kg?c.v/c.kg:0;e.valor=e.kg*e.custoKg;return e});
  rows.sort((a,b)=>a.tipo.localeCompare(b.tipo)||a.cor.localeCompare(b.cor)||a.embalagem.localeCompare(b.embalagem)||a.pesoUn-b.pesoUn);
  return rows;
}
// custo médio por kg de cada material + cor (compras e ajustes de entrada com custo)
function custosMedios(){const m=new Map();const add=(it,kg,v)=>{const k=it.tipo+'|'+it.cor;const c=m.get(k)||{kg:0,v:0};c.kg+=kg;c.v+=v;m.set(k,c)};
  S.compras.forEach(c=>(c.itens||[]).forEach(it=>add(it,num(it.kg),num(it.kg)*num(it.precoKg))));
  S.ajustes.forEach(a=>{if(a.sentido!=='saida'&&num(a.custoKg))add(a,num(a.kg),num(a.kg)*num(a.custoKg))});
  const out=new Map();m.forEach((c,k)=>out.set(k,c.kg?c.v/c.kg:0));return out}
// custo estimado e margem de uma venda (custo médio do material)
function margemVenda(v,cm=custosMedios()){let mat=0,semCusto=false;(v.itens||[]).forEach(it=>{const c=cm.get(it.tipo+'|'+it.cor);if(!c)semCusto=true;mat+=num(it.kg)*(c||0)});
  const frete=v.frete?.tipo==='cif'?num(v.frete.valor):0,imposto=r2(num(v.total)*num(v.impostoPct)/100);
  const custo=r2(mat+frete+imposto);return{custo,custoMat:r2(mat),frete,imposto,margem:r2(num(v.total)-custo),semCusto}}
const ultImposto=()=>{const v=S.vendas.slice().sort((a,b)=>(b.criadoEm||0)-(a.criadoEm||0)).find(v=>num(v.impostoPct));return v?fnum(v.impostoPct,2):''};
const FRETE={nenhum:'Sem frete',cif:'CIF · por nossa conta',fob:'FOB · por conta do cliente'};
// estoque disponível por material + cor (todas as embalagens somadas)
function dispMat(tipo,cor,ignoreVendaId){let kg=0;const ok=x=>x.tipo===tipo&&x.cor===cor;
  S.compras.forEach(c=>(c.itens||[]).forEach(x=>{if(ok(x))kg+=num(x.kg)}));
  S.ajustes.forEach(a=>{if(ok(a))kg+=(a.sentido==='saida'?-1:1)*num(a.kg)});
  S.vendas.forEach(v=>{if(v.id===ignoreVendaId)return;(v.itens||[]).forEach(x=>{if(ok(x))kg-=num(x.kg)})});
  return r2(kg)}
function faltaEstoque(its,ignoreVendaId){const pede=new Map();its.forEach(i=>{const k=i.tipo+'|'+i.cor;pede.set(k,(pede.get(k)||0)+num(i.kg))});
  return[...pede].map(([k,kg])=>{const[tipo,cor]=k.split('|');return{tipo,cor,pede:r2(kg),tem:dispMat(tipo,cor,ignoreVendaId)}}).filter(x=>x.pede>x.tem+0.005)}
// próximo número de compra/venda: consulta o banco para não repetir quando duas pessoas lançam juntas
async function proximoNumero(col){let mx=Math.max(0,...S[col].map(x=>num(x.numero)));
  if(MODE==='supa'&&navigator.onLine){try{const r=await SB.from('docs').select('n:data->numero').eq('col',col).order('data->numero',{ascending:false,nullsFirst:false}).limit(1);
    if(!r.error&&r.data&&r.data[0])mx=Math.max(mx,num(r.data[0].n))}catch(e){}}
  for(const op of QUEUE)if(op.col===col&&op.t==='put')mx=Math.max(mx,num(op.data?.numero));
  return mx+1}
// número da venda: data invertida + sequência do dia (ex.: 20261027/001)
// vendas antigas sem seqDia recebem a posição no dia pela ordem do número
function seqDia(v){if(num(v.seqDia))return num(v.seqDia);
  const usados=new Set(S.vendas.filter(x=>x.data===v.data&&num(x.seqDia)).map(x=>num(x.seqDia)));
  const antigas=S.vendas.filter(x=>x.data===v.data&&!num(x.seqDia)).sort((a,b)=>num(a.numero)-num(b.numero));
  let n=0;for(const x of antigas){n++;while(usados.has(n))n++;if(x.id===v.id)return n}
  n++;while(usados.has(n))n++;return n}
const proximoSeqDia=(data,ignoreId)=>Math.max(0,...S.vendas.filter(x=>x.data===data&&x.id!==ignoreId).map(seqDia))+1;
const codVenda=v=>v?String(v.data||'').replace(/-/g,'')+'/'+String(seqDia(v)).padStart(3,'0'):'';
// rótulo de compra/venda: venda usa o código com data, compra o número
const rotOp=(col,o)=>col==='vendas'?'Venda '+codVenda(o):'Compra #'+(o?.numero??'');
function linked(refId){
  const tit=S.titulos.filter(t=>t.ref?.id===refId);
  const tids=new Set(tit.map(t=>t.id));
  const mov=S.movimentos.filter(m=>m.ref?.id===refId||tids.has(m.ref?.id));
  return{tit,mov};
}
async function removeLinked(refId){const{tit,mov}=linked(refId);for(const m of mov)await del('movimentos',m.id);for(const t of tit)await del('titulos',t.id)}
// contas recorrentes que renovam sozinhas: mantém 12 meses lançados à frente (id fixo evita duplicar entre usuários)
let renovando=false;
async function renovar(){if(renovando)return;renovando=true;
  try{const grupos=new Map();S.titulos.forEach(t=>{if(t.renova){const g=grupos.get(t.grupo)||[];g.push(t);grupos.set(t.grupo,g)}});
    const lim=addMonths(today(),11);
    for(const[g,ts]of grupos){const prim=ts.reduce((a,t)=>t.parcela<a.parcela?t:a);let ult=ts.reduce((a,t)=>t.parcela>a.parcela?t:a);
      while(ult.vencimento<lim){const k=ult.parcela+1;const{pago,pagoEm,valorPago,movimentoId,contaId,pagamentos,restoId,valorOriginal,restoDe,...b}=ult;
        const nv={...b,id:g+'-'+k,parcela:k,vencimento:addMonths(prim.vencimento,k-prim.parcela),valor:num(ult.valorOriginal)||num(ult.valor),pago:false,criadoEm:Date.now()};
        if(!byId('titulos',nv.id))await put('titulos',nv);ult=nv}}}
  finally{renovando=false}}
// caixa previsto: saldo de hoje + contas a receber − contas a pagar em aberto, dia a dia.
// Contas atrasadas entram no dia de hoje (ainda podem ser pagas/recebidas).
function caixaPrevisto(dias=30,hoje=today()){
  const fim=addDays(hoje,dias);const porDia=new Map();
  for(const t of S.titulos){if(t.pago)continue;const d=t.vencimento<hoje?hoje:t.vencimento;if(d>fim)continue;
    const x=porDia.get(d)||{ent:0,sai:0,atras:0};const v=num(t.valor);if(t.lado==='receber')x.ent+=v;else x.sai+=v;if(t.vencimento<hoje)x.atras++;porDia.set(d,x)}
  let saldo=saldoTotal();const out=[];
  for(let i=0;i<=dias;i++){const d=addDays(hoje,i);const x=porDia.get(d)||{ent:0,sai:0,atras:0};saldo+=x.ent-x.sai;out.push({data:d,ent:r2(x.ent),sai:r2(x.sai),atras:x.atras,saldo:r2(saldo)})}
  return out}
// vendas dos últimos meses: total em R$, kg e quantidade de vendas
function vendasPorMes(meses,ate=today().slice(0,7)){const out=[];
  for(let i=meses-1;i>=0;i--){const m=addMonths(ate+'-01',-i).slice(0,7);const vs=S.vendas.filter(v=>(v.data||'').slice(0,7)===m);
    out.push({mes:m,total:r2(vs.reduce((a,v)=>a+num(v.total),0)),kg:vs.reduce((a,v)=>a+num(v.totalKg),0),qtd:vs.length})}
  return out}
function genTitulos(base,modo,n,valor,venc){
  const grupo=nid();const out=[];
  if(modo==='unica'){out.push({...base,id:nid(),modo,grupo,parcela:1,totalParcelas:1,vencimento:venc,valor:r2(valor),pago:false})}
  else if(modo==='recorrente'){for(let i=0;i<n;i++)out.push({...base,id:nid(),modo,grupo,parcela:i+1,totalParcelas:n,vencimento:addMonths(venc,i),valor:r2(valor),pago:false})}
  else{const parc=Math.floor(valor/n*100)/100;let acc=0;for(let i=0;i<n;i++){const v=i===n-1?r2(valor-acc):parc;acc=r2(acc+parc);out.push({...base,id:nid(),modo,grupo,parcela:i+1,totalParcelas:n,vencimento:addMonths(venc,i),valor:v,pago:false})}}
  return out;
}

export {saldoConta,saldoTotal,statusT,STATUS_PILL,pillT,EMB,FORMA,MEIO,AVISTA,TIPOCONTA,stockKey,estoque,custosMedios,margemVenda,ultImposto,FRETE,dispMat,faltaEstoque,proximoNumero,seqDia,proximoSeqDia,codVenda,rotOp,linked,removeLinked,renovando,renovar,genTitulos,caixaPrevisto,vendasPorMes};
