import {S,byId,contaNome,parcNome} from '../dados.js';
import {UI,monthCtl,perCtl,periodo} from '../estado.js';
import {custosMedios,margemVenda,statusT} from '../regras.js';
import {baixarCSVLinhas,slug} from './caixa.js';
import {brl,esc,fd,fkg,fnum,mLabel,num,r2,swatch} from '../util.js';

/* ---------- Relatórios ---------- */
function relDados(){
  let{ini,fim,label}=periodo();const dentro=x=>x.data>=ini&&x.data<=fim;const cm=custosMedios();
  const vendas=S.vendas.filter(dentro),compras=S.compras.filter(dentro);
  const mat=new Map(),cli=new Map(),forn=new Map(),desp=new Map(),rec=new Map();
  let receita=0,custo=0,semCusto=false;
  vendas.forEach(v=>{const m=margemVenda(v,cm);receita+=num(v.total);custo+=m.custo;semCusto=semCusto||m.semCusto;
    const c=cli.get(v.parceiroId)||{n:0,kg:0,total:0,margem:0};c.n++;c.kg+=num(v.totalKg);c.total+=num(v.total);c.margem+=m.margem;cli.set(v.parceiroId,c);
    (v.itens||[]).forEach(it=>{const k=it.tipo+'|'+it.cor;const ck=cm.get(k)||0;const e=mat.get(k)||{tipo:it.tipo,cor:it.cor,kg:0,receita:0,custo:0};
      e.kg+=num(it.kg);e.receita+=num(it.kg)*num(it.precoKg);e.custo+=num(it.kg)*ck;mat.set(k,e)})});
  compras.forEach(c=>{const e=forn.get(c.parceiroId)||{n:0,kg:0,total:0};e.n++;e.kg+=num(c.totalKg);e.total+=num(c.total);forn.set(c.parceiroId,e)});
  // despesas e outras receitas pelo caixa (compra e venda de material ficam de fora: já entram pelo custo e pelas vendas)
  S.movimentos.filter(dentro).forEach(m=>{if(m.ref?.col==='adiantamentos')return; // adiantamento não é receita: vira venda quando for abatido
    if(m.tipo==='saida'&&m.categoria!=='Compra de material'&&!m.ref?.frete){const k=m.categoria||'Sem categoria';desp.set(k,(desp.get(k)||0)+num(m.valor))}
    if(m.tipo==='entrada'&&m.categoria!=='Venda de material'&&!(m.ref&&m.ref.col==='vendas')&&!(m.ref&&m.ref.col==='titulos'&&byId('titulos',m.ref.id)?.ref?.col==='vendas')){const k=m.categoria||'Sem categoria';rec.set(k,(rec.get(k)||0)+num(m.valor))}});
  const despT=[...desp.values()].reduce((a,v)=>a+v,0),recT=[...rec.values()].reduce((a,v)=>a+v,0);
  if(UI.per==='ano')label=UI.mes.slice(0,4);
  return{label,ini,fim,vendas,compras,receita:r2(receita),custo:r2(custo),margem:r2(receita-custo),semCusto,despT:r2(despT),recT:r2(recT),resultado:r2(receita-custo+recT-despT),
    mat:[...mat.values()].map(e=>({...e,margem:e.receita-e.custo})).sort((a,b)=>b.receita-a.receita),
    cli:[...cli].map(([id,e])=>({nome:parcNome(id),...e})).sort((a,b)=>b.total-a.total),
    forn:[...forn].map(([id,e])=>({nome:parcNome(id),...e})).sort((a,b)=>b.total-a.total),
    desp:[...desp].sort((a,b)=>b[1]-a[1]),rec:[...rec].sort((a,b)=>b[1]-a[1])};
}
const pct=(a,b)=>b?fnum(a/b*100,1)+'%':'—';
function vRelatorios(){
  const d=relDados();
  const card=(titulo,k,head,linhas,foot)=>`<div class="card"><div class="card-h"><h2>${titulo}</h2><div class="sp"><button class="btn sm" data-act="csvRel" data-k="${k}">Baixar CSV</button></div></div>
    <div class="tbl-wrap"><table><thead><tr>${head.map((h,i)=>`<th${i?' class="r"':''}>${h}</th>`).join('')}</tr></thead><tbody>${linhas.length?linhas.map(l=>`<tr>${l.map((c,i)=>`<td${i?' class="r"':''}>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}"><div class="empty">Nada em ${esc(d.label)}.</div></td></tr>`}</tbody>${foot&&linhas.length?`<tfoot><tr>${foot.map((c,i)=>`<td${i?' class="r"':''}>${c}</td>`).join('')}</tr></tfoot>`:''}</table></div></div>`;
  const neg=v=>`<span class="${v<0?'neg':''}">${brl(v)}</span>`;
  return{sub:'Resultado, margem por material, clientes, fornecedores e despesas',actions:`<div class="toolbar">${perCtl()}${UI.per==='tudo'?'':monthCtl()}</div>`,html:`
  <div class="grid kpis">
    <div class="kpi hl"><span>Vendas em ${esc(d.label)}</span><b>${brl(d.receita)}</b><small>${d.vendas.length} venda(s), à vista e a prazo</small></div>
    <div class="kpi"><span>Custo das vendas</span><b>${brl(d.custo)}</b><small>Material pelo custo médio + frete CIF + impostos${d.semCusto?' · * há material sem custo':''}</small></div>
    <div class="kpi"><span>Margem bruta</span><b class="${d.margem<0?'neg':'pos'}">${brl(d.margem)}</b><small>${pct(d.margem,d.receita)} sobre as vendas</small></div>
    <div class="kpi"><span>Resultado estimado</span><b class="${d.resultado<0?'neg':'pos'}">${brl(d.resultado)}</b><small>Margem ${d.recT?'+ outras receitas '+brl(d.recT)+' ':''}− despesas ${brl(d.despT)}</small></div>
  </div>
  <p class="hint" style="margin:-4px 0 0">O resultado estimado considera as vendas pela data da venda (mesmo a prazo), o custo médio do material vendido e as despesas pagas no caixa. Compras de material não entram como despesa porque viram estoque.</p>
  ${card('Margem por material','mat',['Material','Peso vendido','Vendas','R$/kg venda','Custo/kg','Custo','Margem','Margem %'],d.mat.map(e=>[`${swatch(e.cor)}${esc(e.tipo)} ${esc(e.cor)}`,fkg(e.kg),brl(e.receita),e.kg?brl(e.receita/e.kg):'—',e.kg&&e.custo?brl(e.custo/e.kg):'<span class="muted">sem custo</span>',brl(e.custo),neg(e.margem),pct(e.margem,e.receita)]),['Total',fkg(d.mat.reduce((a,e)=>a+e.kg,0)),brl(d.receita),'','',brl(d.custo),neg(d.margem),pct(d.margem,d.receita)])}
  ${card('Vendas por cliente','cli',['Cliente','Vendas','Peso','Total','Margem'],d.cli.map(e=>[esc(e.nome),e.n,fkg(e.kg),brl(e.total),neg(e.margem)]))}
  ${card('Compras por fornecedor','forn',['Fornecedor','Compras','Peso','Total','R$/kg'],d.forn.map(e=>[esc(e.nome),e.n,fkg(e.kg),brl(e.total),e.kg?brl(e.total/e.kg):'—']))}
  <div class="grid two">
  ${card('Despesas por categoria','desp',['Categoria','Pago no caixa','% das despesas'],d.desp.map(([k,v])=>[esc(k),brl(v),pct(v,d.despT)]),['Total',brl(d.despT),''])}
  ${card('Outras receitas','rec',['Categoria','Recebido no caixa'],d.rec.map(([k,v])=>[esc(k),brl(v)]),['Total',brl(d.recT)])}
  </div>`};
}
function csvRel(k){const d=relDados();const f=fnum;let l;
  if(k==='mat')l=[['Material','Cor','Peso vendido (kg)','Vendas','Custo','Margem']].concat(d.mat.map(e=>[e.tipo,e.cor,f(e.kg),f(e.receita),f(e.custo),f(e.margem)]));
  if(k==='cli')l=[['Cliente','Vendas','Peso (kg)','Total','Margem']].concat(d.cli.map(e=>[e.nome,e.n,f(e.kg),f(e.total),f(e.margem)]));
  if(k==='forn')l=[['Fornecedor','Compras','Peso (kg)','Total']].concat(d.forn.map(e=>[e.nome,e.n,f(e.kg),f(e.total)]));
  if(k==='desp')l=[['Categoria','Pago']].concat(d.desp.map(([c,v])=>[c,f(v)]));
  if(k==='rec')l=[['Categoria','Recebido']].concat(d.rec.map(([c,v])=>[c,f(v)]));
  baixarCSVLinhas(l,`relatorio-${k}-${slug(d.label)}.csv`)}
function csvTit(lado){const rows=UI.titRows||[];
  baixarCSVLinhas([['Vencimento','Descrição',lado==='pagar'?'Fornecedor/favorecido':'Cliente/pagador','Categoria','Parcela','Valor','Situação','Pago em','Valor pago','Conta']].concat(rows.map(x=>[fd(x.vencimento),x.descricao,x.parceiroId?parcNome(x.parceiroId):'',x.categoria||'',x.totalParcelas>1?x.parcela+'/'+x.totalParcelas:'',fnum(x.valor),
    statusT(x)==='pago'?(lado==='pagar'?'Pago':'Recebido'):statusT(x)==='atrasado'?'Atrasado':'Em aberto',x.pago?fd(x.pagoEm):'',x.pago?fnum(x.valorPago):'',x.pago?contaNome(x.contaId):''])),
    `contas-a-${lado}-${slug(UI.filtroT==='atrasado'?'atrasadas':mLabel(UI.mes))}.csv`)}

export {relDados,pct,vRelatorios,csvRel,csvTit};
