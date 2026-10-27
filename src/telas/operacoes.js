import {S,contaNome,parcNome} from '../dados.js';
import {UI,monthCtl} from '../estado.js';
import {pgResumo} from '../forms/pagamento.js';
import {EMB,FORMA,custosMedios,linked,margemVenda} from '../regras.js';
import {histBtn} from './historico.js';
import {brl,esc,fd,fkg,fnum,mLabel,mShort,num,swatch} from '../util.js';

/* ---------- Compras / Vendas ---------- */
function vOps(col){
  const isC=col==='compras';const mes=UI.mes;
  let rows=S[col].filter(x=>x.data.slice(0,7)===mes);
  if(UI.busca){const q=UI.busca.toLowerCase();rows=rows.filter(x=>(parcNome(x.parceiroId)+' '+(x.itens||[]).map(i=>i.tipo+' '+i.cor).join(' ')+' '+(x.obs||'')).toLowerCase().includes(q))}
  rows.sort((a,b)=>b.data.localeCompare(a.data)||(b.numero||0)-(a.numero||0));
  const tot=rows.reduce((a,x)=>a+num(x.total),0),kgT=rows.reduce((a,x)=>a+num(x.totalKg),0);
  // por forma: à vista e entradas contam pela forma de cada linha de pagamento
  const porForma={};const addF=(k,v)=>porForma[k]=(porForma[k]||0)+v;
  rows.forEach(x=>{const pg=(x.pagamentos||[]).filter(p=>p.meio);
    if(x.forma==='credito'){addF('credito',num(x.total)-num(x.entrada));if(pg.length)pg.forEach(p=>addF(p.meio,num(p.valor)));else if(num(x.entrada))addF('pix',num(x.entrada))}
    else if(pg.length)pg.forEach(p=>addF(p.meio,num(p.valor)));else addF(x.forma,num(x.total))});
  const cm=custosMedios();const mg=new Map(isC?[]:rows.map(x=>[x.id,margemVenda(x,cm)]));const mgT=[...mg.values()].reduce((a,m)=>a+m.margem,0);
  return{sub:isC?'Entrada de material comprado de fornecedores':'Saída de material vendido a clientes',
    actions:`<button class="btn pri" data-act="${isC?'novaCompra':'novaVenda'}">+ Nova ${isC?'compra':'venda'}</button>`,html:`
  <div class="grid kpis">
    <div class="kpi hl"><span>Total ${isC?'comprado':'vendido'} em ${mShort(mes).toLowerCase()}</span><b>${brl(tot)}</b><small>${rows.length} ${isC?'compra(s)':'venda(s)'}</small></div>
    <div class="kpi"><span>Peso</span><b>${fkg(kgT)}</b><small>${kgT?'Média '+brl(tot/kgT)+'/kg':'—'}</small></div>
    ${isC?'':`<div class="kpi"><span>Lucro estimado</span><b class="${mgT<0?'neg':'pos'}">${brl(mgT)}</b><small>${tot?fnum(mgT/tot*100,1)+'% sobre as vendas · já desconta custo médio, frete CIF e impostos':'—'}</small></div>`}
    <div class="kpi"><span>Por forma de pagamento</span><small style="display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:var(--fg)">${Object.keys(FORMA).filter(k=>k!=='misto'||porForma.misto).map(k=>`<span style="display:flex;justify-content:space-between;gap:8px"><span class="muted">${FORMA[k]}</span><b class="num" style="font-size:14px;font-family:var(--f-body)">${brl(porForma[k]||0)}</b></span>`).join('')}</small></div>
  </div>
  <div class="card">
    <div class="card-h"><div class="toolbar">${monthCtl()}</div><div class="sp"><input class="search" id="busca" placeholder="Buscar ${isC?'fornecedor':'cliente'} ou material…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nº</th><th>Data</th><th>${isC?'Fornecedor':'Cliente'}</th><th>Material</th><th class="r">Peso</th><th class="r">R$/kg</th><th class="r">Total</th>${isC?'':'<th class="r">Lucro</th>'}<th>Pagamento</th><th></th></tr></thead><tbody>
    ${rows.map(x=>{const st=finStatus(x);return `<tr><td class="num muted">#${x.numero}</td><td class="num">${fd(x.data)}</td><td>${esc(parcNome(x.parceiroId))}</td>
      <td>${(x.itens||[]).map(i=>`<div style="white-space:nowrap">${swatch(i.cor)}${esc(i.tipo)} ${esc(i.cor)} <span class="muted">· ${i.embalagem==='granel'?'granel':fnum(i.qtd,0)+' '+EMB[i.embalagem].toLowerCase()+(num(i.qtd)>1?'s':'')+' de '+fnum(i.pesoUn,0)+' kg'}</span></div>`).join('')}</td>
      <td class="r">${fkg(x.totalKg)}</td><td class="r">${x.totalKg?brl(x.total/x.totalKg):'—'}</td><td class="r"><b>${brl(x.total)}</b></td>${isC?'':(m=>`<td class="r ${m.margem<0?'neg':''}" title="Material ${brl(m.custoMat)}${m.frete?' · frete CIF '+brl(m.frete):''}${m.imposto?' · impostos '+brl(m.imposto):''}${m.semCusto?' · algum material sem custo cadastrado':''}">${brl(m.margem)}${m.semCusto?' <span class="muted">*</span>':''}<div class="muted" style="font-size:12px">${num(x.total)?fnum(m.margem/num(x.total)*100,1)+'%':''}</div></td>`)(mg.get(x.id))}
      <td><div>${FORMA[x.forma]}${x.forma==='credito'?` · ${x.parcelas}x`:''}</div>${st}</td>
      <td class="acts"><button class="btn sm" data-act="recibo" data-col="${col}" data-id="${x.id}" title="${isC?'Comprovante de compra':'Recibo de venda'} para imprimir ou salvar em PDF">${isC?'Comprovante':'Recibo'}</button>${isC?'':` <button class="btn sm" data-act="romaneio" data-id="${x.id}" title="Romaneio de carga para imprimir">Romaneio</button>`} <button class="btn sm" data-act="editOp" data-col="${col}" data-id="${x.id}">Editar</button> <button class="btn sm danger" data-act="delOp" data-col="${col}" data-id="${x.id}">Excluir</button> ${histBtn(col,x.id)}</td></tr>`}).join('')||`<tr><td colspan="${isC?9:10}"><div class="empty"><b>Nenhuma ${isC?'compra':'venda'} em ${mLabel(mes)}</b>Use “+ Nova ${isC?'compra':'venda'}” para lançar.</div></td></tr>`}
    </tbody>${rows.length?`<tfoot><tr><td colspan="4">${rows.length} lançamento(s)</td><td class="r">${fkg(kgT)}</td><td class="r">${kgT?brl(tot/kgT):''}</td><td class="r">${brl(tot)}</td>${isC?'':`<td class="r">${brl(mgT)}</td>`}<td colspan="2"></td></tr></tfoot>`:''}</table></div>
  </div>`};
}
function finStatus(x){
  if(x.forma==='permuta')return `<span class="muted" style="font-size:12.5px">${esc(x.permutaDesc||'Sem movimento financeiro')}</span>`;
  if(x.forma==='credito'){const{tit}=linked(x.id);const p=tit.filter(t=>t.pago).length;return `<span class="pill ${p===tit.length&&tit.length?'p-ok':'p-open'}">${p}/${tit.length} ${x.lado==='vendas'||S.vendas.includes(x)?'recebidas':'pagas'}</span>${num(x.entrada)?`<div class="muted" style="font-size:12.5px">Entrada ${brl(x.entrada)}${(x.pagamentos||[]).length>1||x.pagamentos?.[0]?.meio==='cheque'?':<br>'+pgResumo(x,S.compras.includes(x)):''}</div>`:''}`}
  if((x.pagamentos||[]).length>1||x.pagamentos?.[0]?.meio==='cheque')return `<span class="muted" style="font-size:12.5px">${pgResumo(x,S.compras.includes(x))}</span>`;
  return `<span class="muted" style="font-size:12.5px">${esc(contaNome(x.contaId))}</span>`;
}

export {vOps,finStatus};
