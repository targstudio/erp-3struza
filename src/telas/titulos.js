import {S,contaNome,parcNome} from '../dados.js';
import {UI,monthCtl} from '../estado.js';
import {pillT} from '../regras.js';
import {histBtn} from './historico.js';
import {pgCurto} from '../forms/pagamento.js';
import {brl,esc,fd,mLabel,mShort,num,today} from '../util.js';

/* ---------- Contas a pagar / receber ---------- */
function vTitulos(lado){
  const mes=UI.mes;const t=today();
  let list=S.titulos.filter(x=>x.lado===lado);
  const doMes=list.filter(x=>x.vencimento.slice(0,7)===mes);
  const atrasTodos=list.filter(x=>!x.pago&&x.vencimento<t);
  let rows=UI.filtroT==='atrasado'?atrasTodos:doMes;
  if(UI.filtroT==='aberto')rows=rows.filter(x=>!x.pago);
  if(UI.filtroT==='pago')rows=rows.filter(x=>x.pago);
  if(UI.busca){const q=UI.busca.toLowerCase();rows=rows.filter(x=>(x.descricao+' '+(x.categoria||'')+' '+parcNome(x.parceiroId)).toLowerCase().includes(q))}
  rows.sort((a,b)=>a.vencimento.localeCompare(b.vencimento));UI.titRows=rows;
  const aberto=doMes.filter(x=>!x.pago).reduce((a,x)=>a+num(x.valor),0);
  const pago=doMes.filter(x=>x.pago).reduce((a,x)=>a+num(x.valor),0);
  const fixas=doMes.filter(x=>x.natureza==='fixa').reduce((a,x)=>a+num(x.valor),0);
  const verbo=lado==='pagar'?'Pagar':'Receber';
  const modoPill=x=>x.renova?`<span class="pill p-info">Mensal · renova sozinho</span>`:x.modo==='recorrente'?`<span class="pill p-info">Recorrente ${x.parcela}/${x.totalParcelas}</span>`:x.modo==='parcelada'?`<span class="pill p-info">Parcela ${x.parcela}/${x.totalParcelas}</span>`:'';
  return{sub:lado==='pagar'?'Despesas fixas, variáveis, recorrentes e parceladas':'Recebimentos únicos e parcelados',
    actions:`<button class="btn" data-act="csvTit" data-lado="${lado}">Baixar CSV</button><button class="btn pri" data-act="novoTitulo" data-lado="${lado}">+ Nova conta a ${lado}</button>`,html:`
  <div class="grid kpis">
    <div class="kpi"><span>Em aberto em ${mShort(mes).toLowerCase()}</span><b class="${lado==='pagar'?'neg':'pos'}">${brl(aberto)}</b><small>${doMes.filter(x=>!x.pago).length} lançamento(s)</small></div>
    <div class="kpi"><span>${lado==='pagar'?'Pago':'Recebido'} em ${mShort(mes).toLowerCase()}</span><b>${brl(pago)}</b><small>${doMes.filter(x=>x.pago).length} lançamento(s)</small></div>
    ${lado==='pagar'?`<div class="kpi"><span>Contas fixas no mês</span><b>${brl(fixas)}</b><small>Variáveis/pontuais ${brl(doMes.reduce((a,x)=>a+num(x.valor),0)-fixas)}</small></div>`:''}
    <div class="kpi"><span>Atrasados (todos os meses)</span><b class="${atrasTodos.length?'neg':''}">${brl(atrasTodos.reduce((a,x)=>a+num(x.valor),0))}</b><small>${atrasTodos.length} lançamento(s)</small></div>
  </div>
  <div class="card">
    <div class="card-h"><div class="toolbar">${monthCtl()}<div class="seg">${[['todos','Todos'],['aberto','Em aberto'],['pago',lado==='pagar'?'Pagos':'Recebidos'],['atrasado','Atrasados']].map(([k,l])=>`<button data-act="filtroT" data-v="${k}" class="${UI.filtroT===k?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="sp"><input class="search" id="busca" placeholder="Buscar…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Vencimento</th><th>Descrição</th><th>${lado==='pagar'?'Fornecedor / favorecido':'Cliente / pagador'}</th><th>Categoria</th><th class="r">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td class="num">${fd(x.vencimento)}</td><td>${esc(x.descricao)} ${modoPill(x)} ${lado==='pagar'?`<span class="pill p-grey">${x.natureza==='fixa'?'Fixa':'Variável'}</span>`:''}${x.pago?`<div class="muted" style="font-size:12.5px">${lado==='pagar'?'Pago':'Recebido'} em ${fd(x.pagoEm)} · ${(x.pagamentos||[]).length?x.pagamentos.map(p=>`${esc(pgCurto(p,lado==='pagar'))} · ${esc(contaNome(p.contaId))}${x.pagamentos.length>1?' '+brl(p.valor):''}`).join('<br>'):esc(contaNome(x.contaId))}</div>`:''}</td>
      <td>${x.parceiroId?esc(parcNome(x.parceiroId)):'<span class="muted">—</span>'}</td><td class="muted">${esc(x.categoria||'')}</td><td class="r">${brl(x.valor)}</td><td>${pillT(x)}</td>
      <td class="acts">${x.pago?`<button class="btn sm" data-act="estornar" data-id="${x.id}">Estornar</button>`:`<button class="btn sm pri" data-act="baixar" data-id="${x.id}">${verbo}</button> <button class="btn sm" data-act="editTitulo" data-id="${x.id}">Editar</button>`} <button class="btn sm danger" data-act="delTitulo" data-id="${x.id}">Excluir</button> ${histBtn('titulos',x.id)}</td></tr>`).join('')||`<tr><td colspan="7"><div class="empty"><b>Nada por aqui</b>${UI.filtroT==='atrasado'?'Nenhuma conta atrasada.':'Nenhuma conta com vencimento em '+mLabel(mes)+'.'}</div></td></tr>`}
    </tbody>${rows.length?`<tfoot><tr><td colspan="4">${rows.length} lançamento(s)</td><td class="r">${brl(rows.reduce((a,x)=>a+num(x.valor),0))}</td><td colspan="2"></td></tr></tfoot>`:''}</table></div>
  </div>`};
}

export {vTitulos};
