import {S,byId,contaNome,parcNome} from '../dados.js';
import {UI,monthCtl,perCtl,periodo} from '../estado.js';
import {TIPOCONTA,saldoConta,saldoTotal,codVenda} from '../regras.js';
import {needSetup} from '../render.js';
import {histBtn} from './historico.js';
import {brl,esc,fd,fnum,num,today} from '../util.js';

/* ---------- Caixa ---------- */
function vCaixa(){
  const contas=S.contas.filter(c=>c.ativo!==false);
  const fc=UI.filtroConta;const{ini,fim,label}=periodo();
  // efeito de cada movimentação no saldo (de uma conta, ou do caixa inteiro)
  const efeito=m=>{
    if(fc){if(m.tipo==='transferencia')return(m.contaDestinoId===fc?num(m.valor):0)-(m.contaId===fc?num(m.valor):0);
      if(m.contaId!==fc)return 0;return m.tipo==='entrada'?num(m.valor):-num(m.valor)}
    return m.tipo==='entrada'?num(m.valor):m.tipo==='saida'?-num(m.valor):0;
  };
  const doCaixa=m=>fc?(m.contaId===fc||m.contaDestinoId===fc):true;
  const todos=S.movimentos.filter(doCaixa).slice().sort((a,b)=>a.data.localeCompare(b.data)||(a.criadoEm||0)-(b.criadoEm||0));
  const saldoBase=fc?num(byId('contas',fc)?.saldoInicial):contas.reduce((a,c)=>a+num(c.saldoInicial),0);
  // saldo acumulado em ordem cronológica
  let acc=saldoBase,anterior=saldoBase;const sal=new Map();
  todos.forEach(m=>{if(m.data<ini){anterior+=efeito(m)}acc+=efeito(m);sal.set(m.id,acc)});
  let movs=todos.filter(m=>m.data>=ini&&m.data<=fim);
  if(UI.busca){const q=UI.busca.toLowerCase();movs=movs.filter(m=>(m.descricao+' '+(m.categoria||'')+' '+parcNome(m.parceiroId)).toLowerCase().includes(q))}
  const ent=movs.reduce((a,m)=>a+Math.max(0,efeito(m)),0),sai=movs.reduce((a,m)=>a+Math.max(0,-efeito(m)),0);
  movs=movs.slice().reverse();
  // tabelas muito longas travam a tela: mostra os mais recentes primeiro e carrega o resto sob demanda
  const lim=UI.caixaLim||200,ocultos=Math.max(0,movs.length-lim);const movsTela=movs.slice(0,lim);
  const grupos=['banco','gaveta','credito'];
  const origem=m=>{if(!m.ref)return'';const src=m.ref.col==='titulos'?byId('titulos',m.ref.id):byId(m.ref.col,m.ref.id);
    if(m.ref.col==='compras')return `<span class="pill p-grey">Compra #${src?.numero??''}</span>`;
    if(m.ref.col==='vendas')return `<span class="pill p-grey">Venda ${codVenda(src)}</span>`;
    if(m.ref.col==='titulos')return `<span class="pill p-grey">${src?.lado==='receber'?'Conta a receber':'Conta a pagar'}</span>`;return''};
  const tituloExtrato=fc?'Extrato de '+esc(contaNome(fc)):'Extrato geral · todos os caixas';
  return{sub:'Entradas, saídas e saldo por local',actions:`<button class="btn" data-act="transf">⇄ Transferência</button><button class="btn" data-act="mov" data-t="saida">− Saída</button><button class="btn pri" data-act="mov" data-t="entrada">+ Entrada</button>`,html:`
  ${needSetup()}
  <div class="grid kpis">
    <div class="kpi hl"><span>Saldo total</span><b>${brl(saldoTotal())}</b><small>Soma de todos os locais</small></div>
    ${grupos.map(g=>{const cs=contas.filter(c=>c.tipo===g);return `<div class="kpi"><span>${TIPOCONTA[g]}</span><b>${brl(cs.reduce((a,c)=>a+saldoConta(c.id),0))}</b><small>${cs.length} conta(s)</small></div>`}).join('')}
  </div>
  <div class="grid accts">${contas.map(c=>`<div class="acct"><div class="t"><span class="dot d-${c.tipo}"></span>${TIPOCONTA[c.tipo]}</div><div class="n">${esc(c.nome)}</div>${c.detalhe?`<div class="muted" style="font-size:13px">${esc(c.detalhe)}</div>`:''}<b class="num ${saldoConta(c.id)<0?'neg':''}">${brl(saldoConta(c.id))}</b><div><button class="link" data-act="filtroConta" data-id="${c.id}">${fc===c.id?'Ver extrato geral':'Ver extrato'}</button> · <button class="link" data-act="editConta" data-id="${c.id}">Editar</button></div></div>`).join('')}
    <button class="acct" data-act="novaConta" style="cursor:pointer;align-items:center;justify-content:center;border-style:dashed;color:var(--muted);font-weight:600;min-height:120px">+ Nova conta de saldo</button></div>
  <div class="card">
    <div class="card-h"><h2>${tituloExtrato}</h2><div class="sp toolbar">${perCtl()}${UI.per==='tudo'?'':monthCtl()}
      <select class="f" id="fConta" data-act="fConta"><option value="">Todos os caixas juntos</option>${contas.map(c=>`<option value="${c.id}" ${fc===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select>
      <input class="search" id="busca" placeholder="Buscar…" value="${esc(UI.busca)}">
      <button class="btn sm" data-act="csv">Baixar CSV</button></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th class="r">Valor</th><th class="r">Saldo após</th><th></th></tr></thead><tbody>
    ${movsTela.map(m=>{const e=efeito(m);return `<tr><td class="num">${fd(m.data)}</td><td>${esc(m.descricao)} ${origem(m)}${m.parceiroId?`<div class="muted" style="font-size:12.5px">${esc(parcNome(m.parceiroId))}</div>`:''}</td><td class="muted">${esc(m.tipo==='transferencia'?'Transferência':m.categoria||'')}</td>
      <td>${m.tipo==='transferencia'?`${esc(contaNome(m.contaId))} → ${esc(contaNome(m.contaDestinoId))}`:esc(contaNome(m.contaId))}</td>
      <td class="r ${e>0?'pos':e<0?'neg':'muted'}">${e>0?'+ ':e<0?'− ':''}${e?brl(Math.abs(e)):brl(m.valor)}</td>
      <td class="r ${sal.get(m.id)<0?'neg':''}">${brl(sal.get(m.id))}</td>
      <td class="acts">${m.ref?'':`<button class="btn sm" data-act="editMov" data-id="${m.id}">Editar</button> `}<button class="btn sm danger" data-act="delMov" data-id="${m.id}">Excluir</button> ${histBtn('movimentos',m.id)}</td></tr>`}).join('')||`<tr><td colspan="7"><div class="empty"><b>Sem movimentações em ${label}</b>Lance uma entrada, saída ou transferência, ou mude o período.</div></td></tr>`}
    ${ocultos?`<tr><td colspan="7" style="text-align:center"><button class="btn sm" data-act="caixaMais">Mostrar mais ${Math.min(ocultos,500)} de ${ocultos} lançamentos mais antigos</button></td></tr>`:''}
    </tbody>${movs.length?`<tfoot>
      <tr><td colspan="4">Saldo antes de ${UI.per==='tudo'?'tudo':fd(ini)}</td><td></td><td class="r">${brl(anterior)}</td><td></td></tr>
      <tr><td colspan="4">Entradas <span class="pos">${brl(ent)}</span> · Saídas <span class="neg">${brl(sai)}</span>${fc?'':' <span class="muted">(transferências entre caixas não entram na soma)</span>'}</td><td class="r ${ent-sai<0?'neg':'pos'}">${brl(ent-sai)}</td><td class="r">${brl(anterior+ent-sai)}</td><td></td></tr></tfoot>`:''}</table></div>
  </div>`};
}
function baixarCSV(){
  const contas=S.contas.filter(c=>c.ativo!==false);const fc=UI.filtroConta;const{ini,fim}=periodo();
  const efeito=m=>{if(fc){if(m.tipo==='transferencia')return(m.contaDestinoId===fc?num(m.valor):0)-(m.contaId===fc?num(m.valor):0);if(m.contaId!==fc)return 0;return m.tipo==='entrada'?num(m.valor):-num(m.valor)}
    return m.tipo==='entrada'?num(m.valor):m.tipo==='saida'?-num(m.valor):0};
  const todos=S.movimentos.filter(m=>fc?(m.contaId===fc||m.contaDestinoId===fc):true).slice().sort((a,b)=>a.data.localeCompare(b.data)||(a.criadoEm||0)-(b.criadoEm||0));
  let acc=fc?num(byId('contas',fc)?.saldoInicial):contas.reduce((a,c)=>a+num(c.saldoInicial),0);
  const linhas=[['Data','Descrição','Categoria','Cliente/fornecedor','Conta','Entrada','Saída','Saldo após']];
  todos.forEach(m=>{acc+=efeito(m);if(m.data<ini||m.data>fim)return;const e=efeito(m);
    linhas.push([fd(m.data),m.descricao,m.tipo==='transferencia'?'Transferência':(m.categoria||''),m.parceiroId?parcNome(m.parceiroId):'',
      m.tipo==='transferencia'?contaNome(m.contaId)+' > '+contaNome(m.contaDestinoId):contaNome(m.contaId),
      e>0?fnum(e):'',e<0?fnum(-e):'',fnum(acc)])});
  baixarCSVLinhas(linhas,'extrato-3struza-'+(fc?slug(contaNome(fc))+'-':'')+today()+'.csv');
}
const slug=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\W+/g,'-').replace(/^-|-$/g,'').toLowerCase();
function baixarArquivo(conteudo,nome,tipo){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([conteudo],{type:tipo}));a.download=nome;
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0)}
function baixarCSVLinhas(linhas,nome){baixarArquivo('\ufeff'+linhas.map(l=>l.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n'),nome,'text/csv;charset=utf-8')}

export {vCaixa,baixarCSV,slug,baixarArquivo,baixarCSVLinhas};
