import {S,contaNome,parcNome} from '../dados.js';
import {UI} from '../estado.js';
import {chequeTxt,ehCheque,ladoCheque,semDados,statusCheque,venceCheque} from '../cheques.js';
import {histBtn} from './historico.js';
import {addDays,brl,esc,fd,num,today} from '../util.js';

/* ---------- Cheques a compensar ---------- */
const PILL={vencido:['p-late','Venceu · confirmar'],aguardando:['p-open','Aguardando'],compensado:['p-ok','Compensado'],semDados:['p-info','Sem dados'],dadosVencidos:['p-late','Registrar dados']};
function vCheques(){
  const t=today();const todos=S.movimentos.filter(ehCheque);
  const pend=todos.filter(m=>m.pendente);
  const venc=pend.filter(m=>!semDados(m)&&venceCheque(m)<=t);
  const sd=pend.filter(semDados),sdV=sd.filter(m=>(m.cheque.prazoDados||m.data)<=t);
  const soma=l=>l.reduce((a,m)=>a+num(m.valor),0);
  const rec=pend.filter(m=>m.tipo!=='saida'),emi=pend.filter(m=>m.tipo==='saida');
  const semana=pend.filter(m=>{const v=venceCheque(m);return v>t&&v<=addDays(t,7)});
  const f=UI.chqFiltro||'abertos';
  let rows=f==='compensados'?todos.filter(m=>!m.pendente):f==='vencidos'?venc:f==='semdados'?sd:f==='todos'?todos:pend;
  if(UI.busca){const q=UI.busca.toLowerCase();rows=rows.filter(m=>(m.descricao+' '+chequeTxt(m)+' '+parcNome(m.parceiroId)).toLowerCase().includes(q))}
  rows=rows.slice().sort(f==='compensados'?(a,b)=>b.data.localeCompare(a.data):(a,b)=>venceCheque(a).localeCompare(venceCheque(b)));
  const linha=m=>{const st=statusCheque(m,t);const[k,l]=PILL[st];const pz=m.prazos||[];const sdm=semDados(m);
    return `<tr class="${st==='vencido'||st==='dadosVencidos'?'late':''}"><td class="num">${sdm?(m.cheque.bomPara?fd(m.cheque.bomPara):'<span class="muted">a definir</span>')+`<div class="muted" style="font-size:12px">dados até ${fd(m.cheque.prazoDados)}</div>`:fd(venceCheque(m))}${pz.length?`<div class="muted" style="font-size:12px" title="${esc(pz.map(p=>fd(p.de)+' → '+fd(p.para)+(p.motivo?' ('+p.motivo+')':'')).join('\n'))}">reprogramado ${pz.length}× · era ${fd(pz[0].de)}</div>`:''}</td>
      <td style="min-width:170px"><span class="pill p-grey">${ladoCheque(m)==='emitido'?'Emitido':'Recebido'}</span><div style="margin-top:4px">${esc(chequeTxt(m))}</div></td>
      <td style="min-width:220px">${m.parceiroId?esc(parcNome(m.parceiroId)):'<span class="muted">—</span>'}<div class="muted" style="font-size:12.5px">${esc(m.descricao||'')}</div></td>
      <td>${esc(contaNome(m.contaId))}${m.compensadoEm?`<div class="muted" style="font-size:12.5px">compensou em ${fd(m.compensadoEm)}</div>`:''}</td>
      <td class="r ${m.tipo==='saida'?'neg':'pos'}">${brl(m.valor)}</td><td><span class="pill ${k}">${l}</span></td>
      <td class="acts" style="white-space:nowrap">${sdm?`<button class="btn sm pri" data-act="chqDados" data-id="${m.id}">Registrar dados</button>`:m.pendente?`<button class="btn sm pri" data-act="chqOk" data-id="${m.id}">Compensou</button> <button class="btn sm" data-act="chqPrazo" data-id="${m.id}">Novo prazo</button>`:`<button class="btn sm" data-act="chqDesfazer" data-id="${m.id}">Desfazer</button>`} ${histBtn('movimentos',m.id)}</td></tr>`};
  return{sub:'Cheques recebidos e emitidos que ainda vão compensar',html:`
  ${venc.length?`<div class="notice"><h3>${venc.length===1?'1 cheque venceu':venc.length+' cheques venceram'}: confirme se ${venc.length===1?'compensou':'compensaram'}</h3><div class="hint" style="margin:0">Se compensou, o dinheiro entra no caixa que você escolher. Se não, informe o novo prazo e a contagem recomeça.</div></div>`:''}
  ${sdV.length?`<div class="notice"><h3>${sdV.length===1?'1 cheque está sem os dados e o prazo chegou':sdV.length+' cheques estão sem os dados e o prazo chegou'}</h3><div class="hint" style="margin:0">A venda foi feita antes de o cheque chegar. Registre banco, número e bom para em <b>Registrar dados</b>.</div></div>`:''}
  <div class="grid kpis">
    <div class="kpi hl"><span>Recebidos a compensar</span><b>${brl(soma(rec))}</b><small>${rec.length} cheque(s) · ainda fora do saldo</small></div>
    <div class="kpi"><span>Emitidos a compensar</span><b class="neg">${brl(soma(emi))}</b><small>${emi.length} cheque(s) da 3STRUZA ou repassados</small></div>
    <div class="kpi"><span>Vencidos para confirmar</span><b class="${venc.length?'neg':''}">${brl(soma(venc))}</b><small>${venc.length} cheque(s)</small></div>
    <div class="kpi"><span>Vencem nos próximos 7 dias</span><b>${brl(soma(semana))}</b><small>${semana.length} cheque(s)</small></div>
    ${sd.length?`<div class="kpi"><span>Sem dados registrados</span><b class="${sdV.length?'neg':''}">${brl(soma(sd))}</b><small>${sd.length} cheque(s) que ainda não chegaram${sdV.length?` · ${sdV.length} no prazo ou atrasado(s)`:''}</small></div>`:''}
  </div>
  <div class="card">
    <div class="card-h"><div class="toolbar"><div class="seg">${[['abertos','A compensar'],['vencidos','Vencidos'],['semdados','Sem dados'],['compensados','Compensados'],['todos','Todos']].map(([k,l])=>`<button data-act="chqFiltro" data-v="${k}" class="${f===k?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="sp"><input class="search" id="busca" placeholder="Buscar…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Vencimento</th><th>Cheque</th><th>Cliente / fornecedor</th><th>Caixa</th><th class="r">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
    ${rows.map(linha).join('')||`<tr><td colspan="7"><div class="empty"><b>${f==='compensados'?'Nenhum cheque compensado':'Nenhum cheque a compensar'}</b>Quando um pagamento for em cheque, ele aparece aqui até você confirmar a compensação.</div></td></tr>`}
    </tbody>${rows.length?`<tfoot><tr><td colspan="4">${rows.length} cheque(s)</td><td class="r">${brl(soma(rows))}</td><td colspan="2"></td></tr></tfoot>`:''}</table></div>
  </div>`};
}

export {vCheques};
