import {S} from './dados.js';
import {render} from './render.js';
import {HIST,loadHist} from './telas/historico.js';
import {$,ICON,addMonths,mLabel,mShort,today} from './util.js';

/* ===================== estado de UI ===================== */
const UI={view:'painel',mes:today().slice(0,7),filtroT:'todos',busca:'',filtroConta:'',cadFiltro:'todos',estTipo:'',estCor:'',
  per:'mes',histOpen:new Set(),histPer:'7',histUser:'',histCol:''};
const VIEWS=[
  ['painel','Visão geral'],['g'],
  ['caixa','Caixa'],['pagar','Contas a pagar'],['receber','Contas a receber'],['g'],
  ['compras','Compras'],['orcamentos','Orçamentos'],['vendas','Vendas'],['adiantamentos','Adiantamentos'],['estoque','Estoque'],['relatorios','Relatórios'],['g'],
  ['cadastros','Clientes e fornecedores'],['historico','Histórico'],['config','Configurações']
];
const TITLES={painel:'Visão geral',caixa:'Caixa',pagar:'Contas a pagar',receber:'Contas a receber',compras:'Compras',orcamentos:'Orçamentos',vendas:'Vendas',adiantamentos:'Adiantamentos de clientes',estoque:'Estoque',relatorios:'Relatórios',cadastros:'Clientes e fornecedores',historico:'Histórico de alterações',config:'Configurações'};

function go(v){UI.view=v;UI.caixaLim=0;if(v==='historico'&&!HIST.loaded)loadHist(true);UI.busca='';try{history.replaceState(null,'','#'+v)}catch(e){}closeSide();render();window.scrollTo(0,0)}
function closeSide(){$('#side').classList.remove('open');$('#scrim').classList.remove('on')}

const PER=[['mes','Mês'],['3m','3 meses'],['ano','Ano'],['tudo','Tudo']];
function periodo(){
  const mes=UI.mes;
  if(UI.per==='tudo')return{ini:'',fim:'9999-12-31',label:'todo o período'};
  if(UI.per==='mes')return{ini:mes+'-01',fim:mes+'-31',label:mLabel(mes).toLowerCase()};
  if(UI.per==='3m'){const i=addMonths(mes+'-01',-2).slice(0,7);return{ini:i+'-01',fim:mes+'-31',label:mShort(i).toLowerCase()+' a '+mShort(mes).toLowerCase()+' de '+mes.slice(0,4)}}
  return{ini:mes.slice(0,4)+'-01-01',fim:mes.slice(0,4)+'-12-31',label:'o ano de '+mes.slice(0,4)};
}
function perCtl(){return `<div class="seg">${PER.map(([k,l])=>`<button data-act="per" data-v="${k}" class="${UI.per===k?'on':''}">${l}</button>`).join('')}</div>`}
function monthCtl(){return `<div class="month"><button data-act="mes" data-d="-1" aria-label="Mês anterior">‹</button><span>${mLabel(UI.mes)}</span><button data-act="mes" data-d="1" aria-label="Próximo mês">›</button></div>`}

function renderNav(){
  const late=S.titulos.filter(t=>!t.pago&&t.vencimento<today());
  const lp=late.filter(t=>t.lado==='pagar').length,lr=late.filter(t=>t.lado==='receber').length;
  $('#nav').innerHTML=VIEWS.map(([k,l])=>k==='g'?`<div class="nav-sep"></div>`:
    `<a data-go="${k}" class="${UI.view===k?'on':''}" tabindex="0"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${l}${k==='pagar'&&lp?`<span class="badge">${lp}</span>`:''}${k==='receber'&&lr?`<span class="badge">${lr}</span>`:''}</a>`).join('');
}

export {UI,VIEWS,TITLES,go,closeSide,PER,periodo,perCtl,monthCtl,renderNav};
