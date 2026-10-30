import {S,byId,contaNome,parcNome} from '../dados.js';
import {UI,monthCtl} from '../estado.js';
import {pgResumo} from '../forms/pagamento.js';
import {codVenda,creditosClientes} from '../regras.js';
import {histBtn} from './historico.js';
import {brl,esc,fd,mLabel,mShort,num} from '../util.js';

/* ---------- Adiantamentos de clientes ----------
   Crédito do cliente = adiantamentos recebidos − devoluções − valores abatidos em vendas. */
function vAdiantamentos(){
  const mes=UI.mes;
  const cred=creditosClientes().sort((a,b)=>b.saldo-a.saldo||parcNome(a.id).localeCompare(parcNome(b.id)));
  const comSaldo=cred.filter(c=>Math.abs(c.saldo)>0.005);const totSaldo=comSaldo.reduce((a,c)=>a+c.saldo,0);
  // lançamentos do mês: adiantamentos, devoluções e abatimentos nas vendas
  const linhas=[...S.adiantamentos.filter(a=>a.data.slice(0,7)===mes).map(a=>({a,data:a.data,pid:a.parceiroId,valor:(a.tipo==='devolucao'?-1:1)*num(a.valor)})),
    ...S.vendas.filter(v=>num(v.usoAdiant)&&v.data.slice(0,7)===mes).map(v=>({v,data:v.data,pid:v.parceiroId,valor:-num(v.usoAdiant)}))];
  if(UI.busca){const q=UI.busca.toLowerCase();for(let i=linhas.length-1;i>=0;i--)if(!(parcNome(linhas[i].pid)+' '+(linhas[i].a?.obs||'')).toLowerCase().includes(q))linhas.splice(i,1)}
  linhas.sort((x,y)=>y.data.localeCompare(x.data)||(y.a?.criadoEm||y.v?.criadoEm||0)-(x.a?.criadoEm||x.v?.criadoEm||0));
  const recMes=linhas.filter(l=>l.a&&l.valor>0).reduce((s,l)=>s+l.valor,0),usoMes=linhas.filter(l=>l.v).reduce((s,l)=>s-l.valor,0);
  return{sub:'Dinheiro que o cliente adiantou e fica de crédito para abater numa venda.',
    actions:`<button class="btn" data-act="novoAdiant" data-t="devolucao">− Devolver ao cliente</button><button class="btn pri" data-act="novoAdiant">+ Novo adiantamento</button>`,html:`
  <div class="grid kpis">
    <div class="kpi hl"><span>Crédito dos clientes hoje</span><b>${brl(totSaldo)}</b><small>${comSaldo.length} cliente(s) com crédito · é dinheiro que já entrou e ainda deve material</small></div>
    <div class="kpi"><span>Recebido em ${mShort(mes).toLowerCase()}</span><b class="pos">${brl(recMes)}</b><small>Adiantamentos lançados no mês</small></div>
    <div class="kpi"><span>Abatido em vendas em ${mShort(mes).toLowerCase()}</span><b>${brl(usoMes)}</b><small>Crédito usado como pagamento</small></div>
  </div>
  <div class="card"><div class="card-h"><h2>Crédito por cliente</h2></div>
    <div class="tbl-wrap"><table><thead><tr><th>Cliente</th><th class="r">Adiantado</th><th class="r">Abatido em vendas</th><th class="r">Devolvido</th><th class="r">Crédito</th><th></th></tr></thead><tbody>
    ${comSaldo.map(c=>`<tr><td>${esc(parcNome(c.id))}</td><td class="r">${brl(c.recebido)}</td><td class="r">${brl(c.usado)}</td><td class="r">${brl(c.devolvido)}</td><td class="r"><b class="${c.saldo<0?'neg':''}">${brl(c.saldo)}</b></td>
      <td class="acts"><button class="btn sm" data-act="novoAdiant" data-p="${c.id}">+ Adiantamento</button> <button class="btn sm" data-act="novoAdiant" data-t="devolucao" data-p="${c.id}">Devolver</button></td></tr>`).join('')||`<tr><td colspan="6"><div class="empty"><b>Nenhum cliente com crédito</b>Use “+ Novo adiantamento” quando um cliente adiantar um valor.</div></td></tr>`}
    </tbody></table></div></div>
  <div class="card">
    <div class="card-h"><h2>Lançamentos</h2><div class="sp toolbar">${monthCtl()}<input class="search" id="busca" placeholder="Buscar cliente…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Lançamento</th><th class="r">Crédito</th><th>Caixa</th><th></th></tr></thead><tbody>
    ${linhas.map(l=>{if(l.v)return `<tr><td></td><td class="num">${fd(l.data)}</td><td>${esc(parcNome(l.pid))}</td><td><span class="pill p-grey">Abatido na venda ${codVenda(l.v)}</span></td><td class="r neg">− ${brl(-l.valor)}</td><td class="muted">não movimenta o caixa</td><td></td></tr>`;
      const a=l.a,dev=a.tipo==='devolucao';const v=a.vendaId?byId('vendas',a.vendaId):null;
      return `<tr><td class="num muted">${a.numero}</td><td class="num">${fd(a.data)}</td><td>${esc(parcNome(a.parceiroId))}</td>
      <td><span class="pill ${dev?'p-late':'p-ok'}">${dev?'Devolução':'Adiantamento'}</span>${v?` <span class="muted">· junto com a venda ${codVenda(v)}</span>`:''}${a.obs?`<div class="muted" style="font-size:12.5px">${esc(a.obs)}</div>`:''}</td>
      <td class="r ${dev?'neg':'pos'}">${dev?'− ':'+ '}${brl(a.valor)}</td><td class="muted" style="font-size:12.5px">${(a.pagamentos||[]).length?pgResumo(a,dev):esc(contaNome(a.contaId))}</td>
      <td class="acts"><button class="btn sm" data-act="adImp" data-id="${a.id}">Recibo</button> <button class="btn sm" data-act="editAdiant" data-id="${a.id}">Editar</button> <button class="btn sm danger" data-act="delAdiant" data-id="${a.id}">Excluir</button> ${histBtn('adiantamentos',a.id)}</td></tr>`}).join('')||`<tr><td colspan="7"><div class="empty"><b>Nada lançado em ${mLabel(mes)}</b>Mude o mês para ver outros lançamentos.</div></td></tr>`}
    </tbody></table></div></div>`};
}

export {vAdiantamentos};
