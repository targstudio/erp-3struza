import {COLS,S} from './dados.js';
import {TITLES,UI,renderNav} from './estado.js';
import {MODE,loaded} from './sync.js';
import {vCadastros} from './telas/cadastros.js';
import {vCaixa} from './telas/caixa.js';
import {vConfig} from './telas/configuracoes.js';
import {vEstoque} from './telas/estoque.js';
import {vHistorico} from './telas/historico.js';
import {vOps} from './telas/operacoes.js';
import {vPainel} from './telas/painel.js';
import {vRelatorios} from './telas/relatorios.js';
import {vTitulos} from './telas/titulos.js';
import {$,esc} from './util.js';

/* ===================== render ===================== */
function render(){
  renderNav();
  if(MODE==='db'&&loaded.size<COLS.length){return}
  const fn={painel:vPainel,caixa:vCaixa,pagar:()=>vTitulos('pagar'),receber:()=>vTitulos('receber'),compras:()=>vOps('compras'),vendas:()=>vOps('vendas'),estoque:vEstoque,relatorios:vRelatorios,cadastros:vCadastros,historico:vHistorico,config:vConfig}[UI.view];
  const r=fn();
  const banner=MODE==='local'?`<div class="banner">Modo local: os dados ficam só neste navegador. Abra o ERP pelo link do Claude para salvar na nuvem.</div>`:'';
  const focus=document.activeElement?.id;const pos=document.activeElement?.selectionStart;
  $('#view').innerHTML=banner+`<div class="sec-h"><div><h2>${TITLES[UI.view]}</h2><p>${esc(r.sub||'')}</p></div><div class="actions">${r.actions||''}</div></div>`+r.html;
  $('#view').classList.toggle('ocultar',UI.view==='painel'&&!!UI.ocultar);
  if(focus&&document.getElementById(focus)){const el=document.getElementById(focus);el.focus();try{el.setSelectionRange(pos,pos)}catch(e){}}
}

function needSetup(){
  if(S.contas.length)return '';
  return `<div class="card"><div class="empty"><b>Comece cadastrando onde fica o dinheiro</b>Crie as contas de saldo (banco C/C, gaveta, crédito com alguém) para lançar entradas, saídas, compras e vendas.<div style="margin-top:14px"><button class="btn pri" data-act="novaConta">+ Nova conta de saldo</button></div></div></div>`;
}

export {render,needSetup};
