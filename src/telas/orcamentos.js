import {S,byId,parcNome} from '../dados.js';
import {UI} from '../estado.js';
import {EMB,codVenda,statusOrc} from '../regras.js';
import {histBtn} from './historico.js';
import {brl,esc,fd,fkg,fnum,num,swatch,today} from '../util.js';

/* ---------- Orçamentos ---------- */
const ST_ORC={aberto:['p-open','Em aberto'],vencido:['p-late','Vencido'],vendido:['p-ok','Virou venda']};
function vOrcamentos(){
  const fil=UI.orcFiltro||'abertos';const hoje=today();
  let rows=S.orcamentos.slice();
  if(fil==='abertos')rows=rows.filter(o=>statusOrc(o,hoje)!=='vendido');else if(fil==='vendidos')rows=rows.filter(o=>statusOrc(o,hoje)==='vendido');
  if(UI.busca){const q=UI.busca.toLowerCase();rows=rows.filter(x=>(parcNome(x.parceiroId)+' '+x.numero+' '+(x.itens||[]).map(i=>i.tipo+' '+i.cor).join(' ')+' '+(x.obs||'')).toLowerCase().includes(q))}
  rows.sort((a,b)=>b.data.localeCompare(a.data)||(b.numero||0)-(a.numero||0));
  const abertos=S.orcamentos.filter(o=>statusOrc(o,hoje)==='aberto');const totAb=abertos.reduce((a,o)=>a+num(o.total),0);
  const mes=hoje.slice(0,7);const vendMes=S.orcamentos.filter(o=>statusOrc(o,hoje)==='vendido'&&(byId('vendas',o.vendaId)?.data||'').slice(0,7)===mes);
  const seg=[['abertos','Em aberto'],['vendidos','Viraram venda'],['todos','Todos']];
  return{sub:'Propostas com preço para o cliente. Não mexem no estoque nem no caixa até virarem venda.',
    actions:`<button class="btn pri" data-act="novoOrc">+ Novo orçamento</button>`,html:`
  <div class="grid kpis">
    <div class="kpi hl"><span>Orçamentos em aberto</span><b>${brl(totAb)}</b><small>${abertos.length} orçamento(s) dentro da validade</small></div>
    <div class="kpi"><span>Viraram venda neste mês</span><b>${vendMes.length}</b><small>${brl(vendMes.reduce((a,o)=>a+num(o.total),0))}</small></div>
  </div>
  <div class="card">
    <div class="card-h"><div class="toolbar"><div class="seg">${seg.map(([k,l])=>`<button data-act="orcFiltro" data-v="${k}" class="${fil===k?'on':''}">${l}</button>`).join('')}</div></div><div class="sp"><input class="search" id="busca" placeholder="Buscar cliente, número ou material…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Material</th><th class="r">Peso</th><th class="r">Total</th><th>Validade</th><th>Situação</th><th></th></tr></thead><tbody>
    ${rows.map(x=>{const st=statusOrc(x,hoje);const[k,l]=ST_ORC[st];const v=st==='vendido'?byId('vendas',x.vendaId):null;return `<tr><td class="num muted">${x.numero}</td><td class="num">${fd(x.data)}</td><td>${esc(parcNome(x.parceiroId))}</td>
      <td>${(x.itens||[]).map(i=>`<div style="white-space:nowrap">${swatch(i.cor)}${esc(i.tipo)} ${esc(i.cor)} <span class="muted">· ${i.embalagem==='granel'?'granel':fnum(i.qtd,0)+' '+EMB[i.embalagem].toLowerCase()+(num(i.qtd)>1?'s':'')+' de '+fnum(i.pesoUn,0)+' kg'}</span></div>`).join('')}</td>
      <td class="r">${fkg(x.totalKg)}</td><td class="r"><b>${brl(x.total)}</b></td><td class="num">${x.validade?fd(x.validade):'—'}</td>
      <td><span class="pill ${k}">${l}</span>${v?`<div class="muted" style="font-size:12.5px">Venda ${codVenda(v)}</div>`:''}</td>
      <td class="acts"><button class="btn sm" data-act="orcImp" data-id="${x.id}" title="Orçamento com preços para imprimir ou mandar em PDF">Imprimir</button>${st==='vendido'?'':` <button class="btn sm pri" data-act="orcVenda" data-id="${x.id}" title="O cliente pagou: lança a venda com estes itens">Virar venda</button>`} <button class="btn sm" data-act="editOp" data-col="orcamentos" data-id="${x.id}">Editar</button> <button class="btn sm danger" data-act="delOp" data-col="orcamentos" data-id="${x.id}">Excluir</button> ${histBtn('orcamentos',x.id)}</td></tr>`}).join('')||`<tr><td colspan="9"><div class="empty"><b>Nenhum orçamento ${fil==='vendidos'?'que virou venda':fil==='abertos'?'em aberto':''}</b>Use “+ Novo orçamento” para montar uma proposta com preços.</div></td></tr>`}
    </tbody></table></div>
  </div>`};
}

export {vOrcamentos,ST_ORC};
