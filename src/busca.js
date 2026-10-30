import {S,byId,parcNome} from './dados.js';
import {TITLES,go} from './estado.js';
import {formConta} from './forms/conta.js';
import {formMov} from './forms/movimento.js';
import {formOp} from './forms/operacao.js';
import {formParc,verParc} from './forms/parceiro.js';
import {formTitulo} from './forms/titulo.js';
import {formAjuste} from './forms/ajuste.js';
import {formAdiant} from './forms/adiantamento.js';
import {esconderDica} from './graficos.js';
import {modalClose} from './modal.js';
import {statusT,TIPOCONTA,codVenda} from './regras.js';
import {ICON,brl,esc,fd} from './util.js';

/* ===================== busca rápida (Ctrl+K) =====================
   Procura telas, ações, clientes/fornecedores, vendas, compras, contas a pagar/receber e contas de saldo. */

const sem=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const ACOES=[
  {txt:'Nova venda',ic:'vendas',fn:()=>formOp('vendas')},
  {txt:'Nova compra',ic:'compras',fn:()=>formOp('compras')},
  {txt:'Novo orçamento',ic:'orcamentos',fn:()=>formOp('orcamentos')},
  {txt:'Novo adiantamento de cliente',ic:'adiantamentos',fn:()=>formAdiant()},
  {txt:'Nova conta a pagar',ic:'pagar',fn:()=>formTitulo('pagar')},
  {txt:'Nova conta a receber',ic:'receber',fn:()=>formTitulo('receber')},
  {txt:'Nova entrada no caixa',ic:'caixa',fn:()=>formMov('entrada')},
  {txt:'Nova saída no caixa',ic:'caixa',fn:()=>formMov('saida')},
  {txt:'Transferência entre contas',ic:'caixa',fn:()=>formMov('transferencia')},
  {txt:'Novo cliente ou fornecedor',ic:'cadastros',fn:()=>formParc()},
  {txt:'Ajuste de estoque',ic:'estoque',fn:()=>formAjuste()},
  {txt:'Nova conta de saldo (banco ou gaveta)',ic:'caixa',fn:()=>formConta()},
];

// monta a lista de tudo que pode ser encontrado; extra = texto pesquisável além do título
function itens(){
  const out=[];
  for(const [v,t] of Object.entries(TITLES))out.push({grupo:'Ir para',txt:t,ic:v,fn:()=>go(v)});
  for(const a of ACOES)out.push({grupo:'Ações',...a});
  for(const p of S.parceiros)out.push({grupo:'Clientes e fornecedores',txt:p.nome,sub:[p.cliente&&'Cliente',p.fornecedor&&'Fornecedor',p.documento,p.cidade].filter(Boolean).join(' · '),extra:[p.documento,p.telefone,p.email,p.cidade].join(' '),ic:'cadastros',fn:()=>verParc(p.id)});
  for(const col of ['vendas','compras']){const nome=col==='vendas'?'Venda':'Compra';
    for(const o of S[col].slice().sort((a,b)=>(b.numero||0)-(a.numero||0)))
      out.push({grupo:col==='vendas'?'Vendas':'Compras',txt:`${col==='vendas'?'Venda '+codVenda(o):nome+' #'+o.numero} · ${parcNome(o.parceiroId)}`,sub:`${fd(o.data)} · ${brl(o.total)}`,extra:`#${o.numero} ${o.numero} ${col==='vendas'?codVenda(o):''} ${(o.itens||[]).map(i=>i.tipo+' '+i.cor).join(' ')} ${o.obs||''}`,ic:col,fn:()=>formOp(col,o.id)})}
  for(const o of S.orcamentos.slice().sort((a,b)=>(b.numero||0)-(a.numero||0)))
    out.push({grupo:'Orçamentos',txt:`Orçamento nº ${o.numero} · ${parcNome(o.parceiroId)}`,sub:`${fd(o.data)} · ${brl(o.total)}`,extra:`${o.numero} ${(o.itens||[]).map(i=>i.tipo+' '+i.cor).join(' ')} ${o.obs||''}`,ic:'orcamentos',fn:()=>formOp('orcamentos',o.id)});
  for(const t of S.titulos.filter(t=>!t.pago).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))){
    const st=statusT(t);out.push({grupo:t.lado==='pagar'?'Contas a pagar':'Contas a receber',txt:t.descricao+(t.totalParcelas>1?` (${t.parcela}/${t.totalParcelas})`:''),
      sub:`${st==='atrasado'?'Atrasada · ':''}vence ${fd(t.vencimento)} · ${brl(t.valor)}${t.parceiroId?' · '+parcNome(t.parceiroId):''}`,extra:`${t.categoria||''} ${t.parceiroId?parcNome(t.parceiroId):''}`,ic:t.lado,fn:()=>formTitulo(null,t.id)})}
  for(const c of S.contas)out.push({grupo:'Contas de saldo',txt:c.nome,sub:TIPOCONTA[c.tipo]+(c.ativo===false?' · inativa':''),extra:c.detalhe,ic:'caixa',fn:()=>formConta(c.id)});
  return out;
}

// todas as palavras digitadas precisam aparecer; o título vale mais que o resto
function filtrar(lista,q){
  const ps=sem(q).replace(/#/g,' ').split(/\s+/).filter(Boolean);
  if(!ps.length)return lista.filter(x=>x.grupo==='Ações'||x.grupo==='Ir para');
  const r=[];for(const x of lista){const t=sem(x.txt),h=t+' '+sem(x.sub)+' '+sem(x.extra);
    if(!ps.every(p=>h.includes(p)))continue;r.push({x,pt:ps.filter(p=>t.includes(p)).length*2+(t.startsWith(ps[0])?1:0)})}
  // mantém a ordem dos grupos e limita cada grupo
  const ord=[...new Set(lista.map(x=>x.grupo))];const por=new Map();
  r.sort((a,b)=>b.pt-a.pt).forEach(({x})=>{const g=por.get(x.grupo)||[];if(g.length<6)g.push(x);por.set(x.grupo,g)});
  return ord.flatMap(g=>por.get(g)||[]);
}

let aberto=null;
function abrirBusca(){
  if(aberto)return;if(modalClose)modalClose();esconderDica();
  const lista=itens();let res=[],sel=0;
  const ov=document.createElement('div');ov.className='ov busca-ov';
  ov.innerHTML=`<div class="busca" role="dialog" aria-label="Busca rápida"><div class="busca-in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input id="buscaQ" placeholder="Buscar cliente, venda, compra, conta ou ação…" autocomplete="off" spellcheck="false" aria-controls="buscaRes"><kbd>Esc</kbd></div><div class="busca-res" id="buscaRes" role="listbox"></div><div class="busca-pe"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></div></div>`;
  document.body.appendChild(ov);
  const inp=ov.querySelector('#buscaQ'),box=ov.querySelector('#buscaRes');
  const desenhar=()=>{let g='';box.innerHTML=res.length?res.map((x,i)=>{const h=x.grupo!==g?`<div class="busca-g">${esc(x.grupo)}</div>`:'';g=x.grupo;
      return h+`<div class="busca-it${i===sel?' on':''}" role="option" aria-selected="${i===sel}" data-i="${i}"><svg viewBox="0 0 24 24">${ICON[x.ic]||ICON.painel}</svg><div><div>${esc(x.txt)}</div>${x.sub?`<small>${esc(x.sub)}</small>`:''}</div></div>`}).join('')
      :'<div class="busca-vazio">Nada encontrado.</div>';
    box.querySelector('.on')?.scrollIntoView({block:'nearest'})};
  const atualizar=()=>{res=filtrar(lista,inp.value);sel=0;desenhar()};
  const fechar=()=>{ov.remove();aberto=null};
  const escolher=i=>{const x=res[i];if(!x)return;fechar();x.fn()};
  inp.addEventListener('input',atualizar);
  inp.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(res.length-1,sel+1);desenhar()}
    else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);desenhar()}
    else if(e.key==='Enter'){e.preventDefault();escolher(sel)}
    else if(e.key==='Escape'){e.preventDefault();fechar()}});
  box.addEventListener('click',e=>{const it=e.target.closest('[data-i]');if(it)escolher(+it.dataset.i)});
  ov.addEventListener('mousedown',e=>{if(e.target===ov)fechar()});
  aberto=fechar;atualizar();inp.focus();
}

function ligarBusca(){
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();aberto?aberto():abrirBusca()}});
  document.getElementById('buscaBtn')?.addEventListener('click',abrirBusca);
}

export {abrirBusca,ligarBusca,filtrar,itens};
