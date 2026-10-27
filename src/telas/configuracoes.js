import {COLS,S,cfg,put} from '../dados.js';
import {TIPOCONTA,saldoConta} from '../regras.js';
import {brl,esc,fnum,swatch} from '../util.js';

/* ---------- Configurações ---------- */
function vConfig(){
  const c=cfg();
  const listEd=(k,l)=>`<div class="card"><div class="card-h"><h2>${l}</h2></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
    <div style="display:flex;flex-wrap:wrap;gap:6px">${c[k].map((v,i)=>`<span class="pill p-grey" style="font-size:13px;padding:4px 6px 4px 10px">${k==='cores'?swatch(v):''}<button class="link" style="color:inherit" data-act="cfgRen" data-k="${k}" data-i="${i}" title="Renomear">${esc(v)}</button> <button class="link" style="color:var(--muted);margin-left:4px" data-act="cfgDel" data-k="${k}" data-i="${i}" aria-label="Remover ${esc(v)}">×</button></span>`).join('')}</div>
    <div class="muted" style="font-size:12.5px">Clique num nome para renomear. Os lançamentos já feitos são atualizados junto.</div>
    <form data-form="cfgAdd" data-k="${k}" style="display:flex;gap:8px"><input class="search" name="v" id="cfg-${k}" placeholder="Adicionar…" style="flex:1"><button class="btn sm">Adicionar</button></form></div></div>`;
  const ex=COLS.reduce((a,col)=>a+S[col].filter(x=>x.exemplo).length,0);
  return{sub:'Contas de saldo, materiais, cores e categorias',actions:'',html:`
  ${ex?`<div class="card"><div class="card-b" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>Dados de exemplo carregados</b><div class="muted">Há ${ex} registros de exemplo (contas, cadastros, compras e vendas fictícias) para você conhecer o sistema. Remova quando for começar a usar de verdade.</div></div><button class="btn danger" data-act="limparEx">Remover dados de exemplo</button></div></div>`:''}
  <div class="card"><div class="card-b" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b>Backup dos dados</b><div class="muted">Baixe tudo em uma planilha do Excel (uma aba por módulo) para guardar ou conferir. O arquivo JSON é uma cópia completa, útil para restaurar.</div></div><button class="btn" data-act="backupJson">Baixar JSON</button><button class="btn pri" data-act="backup">Baixar planilha</button></div></div>
  <div class="card"><div class="card-h"><h2>Contas de saldo (local do dinheiro)</h2><div class="sp"><button class="btn sm pri" data-act="novaConta">+ Nova conta</button></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Detalhe</th><th class="r">Saldo inicial</th><th class="r">Saldo atual</th><th></th></tr></thead><tbody>
    ${S.contas.map(a=>`<tr><td>${esc(a.nome)} ${a.ativo===false?'<span class="pill p-grey">Inativa</span>':''}</td><td><span class="dot d-${a.tipo}" style="display:inline-block;margin-right:6px"></span>${TIPOCONTA[a.tipo]}</td><td class="muted">${esc(a.detalhe||'')}</td><td class="r">${brl(a.saldoInicial)}</td><td class="r"><b>${brl(saldoConta(a.id))}</b></td><td class="acts"><button class="btn sm" data-act="editConta" data-id="${a.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Nenhuma conta.</div></td></tr>'}
    </tbody></table></div></div>
  <div class="grid two">${listEd('tipos','Tipos de material')}${listEd('cores','Cores')}</div>
  <div class="grid two">${listEd('catPagar','Categorias de contas a pagar')}${listEd('catReceber','Categorias de contas a receber')}</div>
  <div class="card"><div class="card-h"><h2>Pesos padrão das embalagens</h2></div><form class="card-b" data-form="cfgPesos" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
    <label class="fl">Saco (kg)<input name="pesoSaco" id="cfgSaco" inputmode="decimal" value="${fnum(c.pesoSaco)}"></label>
    <label class="fl">Big Bag (kg)<input name="pesoBag" id="cfgBag" inputmode="decimal" value="${fnum(c.pesoBag)}"></label>
    <button class="btn">Salvar pesos</button></form></div>`};
}
async function saveCfg(patch){const c={...cfg(),...patch,id:'geral'};await put('config',c)}

export {vConfig,saveCfg};
