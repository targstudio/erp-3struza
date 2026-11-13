import {S,contaNome} from '../dados.js';
import {UI} from '../estado.js';
import {statusCheque} from '../cheques.js';
import {MEIO} from '../regras.js';
import {brl,esc,fd} from '../util.js';

/* ---- resumo das formas de pagamento de um registro (venda, compra, conta, adiantamento) ----
   Uma linha curta agrupada por forma ("PIX R$ 110,13 · 8 cheques R$ 24.789,87") e, ao clicar,
   uma tabela com cada forma: quem emitiu o cheque, banco/nº, bom para, caixa, valor e situação. */
const SIT={vencido:['p-late','Venceu'],aguardando:['p-open','A compensar'],compensado:['p-ok','Compensado'],semDados:['p-info','Sem dados'],dadosVencidos:['p-late','Registrar dados']};
const nomeMeio=m=>MEIO[m]||'Outro';
const plural=(n,m)=>n>1?(m==='cheque'?n+' cheques':n+'× '+nomeMeio(m)):nomeMeio(m);

// lançamento de caixa de cada pagamento, para mostrar se o cheque já compensou
function movsDos(refId,pags){const movs=S.movimentos.filter(m=>m.ref?.id===refId&&!m.ref.frete);const usados=new Set();
  return pags.map(p=>{const m=movs.find(m=>!usados.has(m.id)&&m.meio===p.meio&&Math.abs((+m.valor||0)-(+p.valor||0))<0.005&&(p.meio!=='cheque'||(m.cheque?.numero||'')===(p.cheque?.numero||'')));
    if(m)usados.add(m.id);return m||null})}

function emitente(p,isC){const c=p.cheque||{};return c.titular==='terceiro'?(c.nome||'Terceiro'):(isC?'3STRUZA':'O próprio cliente')}

// resumo agrupado em uma linha
function pgLinha(pags){const g=new Map();pags.forEach(p=>{const x=g.get(p.meio)||{n:0,v:0};x.n++;x.v+=+p.valor||0;g.set(p.meio,x)});
  return[...g].map(([m,x])=>`<span style="white-space:nowrap">${esc(plural(x.n,m))} <b>${brl(x.v)}</b></span>`).join(' · ')}

/* refId: id do registro (os lançamentos de caixa apontam para ele); isC: saída (compra/pagamento) */
function pgDetalhe(refId,pags,isC){
  if(!pags?.length)return'';
  const simples=pags.length===1&&pags[0].meio!=='cheque';
  if(simples)return `${esc(nomeMeio(pags[0].meio))} · ${esc(contaNome(pags[0].contaId))}`;
  const aberto=UI.pgAbertos?.has(refId);const movs=movsDos(refId,pags);
  const chq=movs.filter((m,i)=>pags[i].meio==='cheque'&&m?.pendente).length;
  const head=`${pgLinha(pags)}${chq?` · <span class="pill p-open" style="font-size:11.5px">${chq} a compensar</span>`:''} <button class="link" data-act="pgDet" data-id="${esc(refId)}">${aberto?'ocultar':'ver detalhes'}</button>`;
  return head}
// tabela detalhada numa linha própria da lista (ocupa a largura toda), só quando aberta
function pgLinhaDet(refId,pags,isC,colspan){
  if(!pags?.length||!UI.pgAbertos?.has(refId)||(pags.length===1&&pags[0].meio!=='cheque'))return'';const movs=movsDos(refId,pags);
  return `<tr class="pg-row"><td></td><td colspan="${colspan-1}"><table class="pg-det"><thead><tr><th>Forma</th><th>${isC?'Emitente':'Quem emitiu'}</th><th>Banco · nº</th><th>Bom para</th><th>Caixa</th><th class="r">Valor</th><th>Situação</th></tr></thead><tbody>    ${pags.map((p,i)=>{const c=p.cheque||{};const ch=p.meio==='cheque';const m=movs[i];const st=ch&&m&&(m.pendente||m.compensadoEm)?SIT[statusCheque(m)]:null;
      return `<tr><td>${esc(nomeMeio(p.meio))}</td><td>${ch?esc(emitente(p,isC)):'<span class="muted">—</span>'}</td>
      <td>${ch?(c.semDados?'<span class="muted">dados pendentes</span>':esc([c.banco,c.numero?'nº '+c.numero:''].filter(Boolean).join(' · ')||'—')):'<span class="muted">—</span>'}</td>
      <td class="num">${ch&&(m?.venceEm||c.bomPara)?fd(m?.venceEm||c.bomPara):'<span class="muted">—</span>'}</td>
      <td>${esc(contaNome(m?.contaId||p.contaId))}</td><td class="r num">${brl(p.valor)}</td><td>${st?`<span class="pill ${st[0]}">${st[1]}</span>`:''}</td></tr>`}).join('')}
    </tbody><tfoot><tr><td colspan="5">${pags.length} forma(s)</td><td class="r num">${brl(pags.reduce((a,p)=>a+(+p.valor||0),0))}</td><td></td></tr></tfoot></table></td></tr>`}


export {pgDetalhe,pgLinhaDet,pgLinha,movsDos};
