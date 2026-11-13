import {UI,monthCtl,perCtl,periodo} from '../estado.js';
import {NAT,resultadoCustos,sugestoes} from '../custos.js';
import {baixarCSVLinhas,slug} from './caixa.js';
import {brl,esc,fd,fkg,fnum,num} from '../util.js';

/* ---------- Custos e resultado: custo por quilo, lucro bruto, lucro líquido e sugestões ---------- */
const kgv=v=>v==null?'<span class="muted">—</span>':(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:3,maximumFractionDigits:3});
const sinal=v=>`<span class="${v<0?'neg':''}">${brl(v)}</span>`;
const pc=(a,b)=>b?fnum(a/b*100,1)+'%':'—';
function resDados(){const{ini,fim,label}=periodo();const r=resultadoCustos(ini,fim);r.label=UI.per==='ano'?UI.mes.slice(0,4):label;r.dicas=sugestoes(r);return r}

function vResultado(){
  const r=resDados();const t=r.total;const cols=[...r.linhas,t];const multi=r.linhas.length>1;const vis=multi?cols:r.linhas.length?r.linhas:[t];
  const linha=(rot,f,cls='',dica='')=>`<tr class="${cls}"><td>${rot}${dica?`<div class="muted" style="font-size:12px">${dica}</div>`:''}</td>${vis.map(e=>`<td class="r">${f(e)}</td>`).join('')}</tr>`;
  const res=t.liquido;
  const dre=`<div class="card"><div class="card-h"><h2>Resultado e custo por quilo</h2><div class="sp"><button class="btn sm" data-act="csvRes" data-k="dre">Baixar CSV</button></div></div>
    <div class="tbl-wrap"><table class="dre"><thead><tr><th></th>${vis.map(e=>`<th class="r">${esc(e.tipo)}</th>`).join('')}</tr></thead><tbody>
    ${linha('Peso vendido',e=>fkg(e.kg))}
    ${linha('Preço médio de venda',e=>kgv(e.precoKg)+'<small class="muted">/kg</small>')}
    ${linha('<b>Vendas</b>',e=>`<b>${brl(e.receita)}</b>`)}
    ${linha('(−) Material vendido, pelo custo médio',e=>brl(e.material)+(e.semCusto?' *':''))}
    ${linha('(−) Frete CIF e impostos das vendas',e=>brl(e.freteImp))}
    ${linha('<b>= Lucro bruto</b>',e=>`<b>${sinal(e.bruto)}</b>`,'sub')}
    ${linha('(−) Custos variáveis',e=>brl(e.variavel),'','frete, combustível, energia, pigmento, diárias…')}
    ${linha('(−) Custos fixos',e=>brl(e.fixo),'','salários, alimentação, transporte, manutenção, pró-labore…')}
    ${t.financeiro?linha('(−) Juros, multas e tarifas',e=>brl(e.financeiro)):''}
    ${linha(`(−) Juros do capital do Ricardo (${fnum(r.param.taxaJuros,2)}% a.m.)`,e=>brl(e.juros))}
    ${t.investimento||r.investPago?linha(`(−) Investimento / reforma (diluído em ${r.param.mesesInvest} meses)`,e=>brl(e.investimento)):''}
    ${linha(`<b>= ${res<0?'Prejuízo':'Lucro líquido'}</b>`,e=>`<b>${sinal(e.liquido)}</b>`,'sub')}
    <tr class="sep"><td colspan="${vis.length+1}">Por quilo vendido</td></tr>
    ${linha('Custo do material',e=>kgv(e.materialKg))}
    ${linha('Custos da empresa (sem o material)',e=>kgv(e.despKg),'','quanto os gastos do mês pesam em cada kg')}
    ${linha('<b>Custo total</b>',e=>`<b>${kgv(e.custoKg)}</b>`)}
    ${linha('Lucro bruto',e=>kgv(e.brutoKg))}
    ${linha(`<b>${res<0?'Resultado':'Lucro líquido'}</b>`,e=>`<b class="${(e.liquidoKg||0)<0?'neg':'pos'}">${kgv(e.liquidoKg)}</b>`)}
    </tbody></table></div>
    <div class="card-b hint" style="padding-top:0">Os custos que não são de um material só são divididos pelos quilos vendidos de cada material${r.kgTotal?` (${r.linhas.map(e=>`${esc(e.tipo)} ${pc(e.kg,r.kgTotal)}`).join(', ')})`:''}. Contas a pagar entram pelo vencimento, mesmo ainda não pagas; saídas avulsas do caixa pela data.${r.freteDuplo.length?` Frete pago no caixa que é o mesmo frete CIF já lançado na venda não foi contado de novo (${r.freteDuplo.map(d=>esc(d.descricao)+' '+brl(d.valor)).join('; ')}).`:''}${t.semCusto?' * Há material vendido sem custo de compra.':''}${r.semRateio?' Sem vendas no período: os custos ficam só no total.':''}</div></div>`;
  const cats=`<div class="card"><div class="card-h"><h2>Custos por categoria</h2><div class="sp"><button class="btn sm" data-act="csvRes" data-k="cat">Baixar CSV</button></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Categoria</th><th>Tipo</th><th class="r">Valor</th><th class="r">Por kg vendido</th><th class="r">% dos custos</th></tr></thead><tbody>
    ${r.categorias.length?r.categorias.map(x=>`<tr><td>${esc(x.categoria||'Sem categoria')}${x.aberto?` <span class="pill p-open" title="Conta a pagar ainda não paga">${brl(x.aberto)} em aberto</span>`:''}</td><td class="muted">${NAT[x.nat]}</td><td class="r">${brl(x.valor)}</td><td class="r">${kgv(x.porKg)}</td><td class="r">${pc(x.valor,r.categorias.reduce((a,y)=>a+y.valor,0))}</td></tr>`).join(''):`<tr><td colspan="5"><div class="empty">Nenhum custo em ${esc(r.label)}.</div></td></tr>`}
    <tr><td>Juros do capital do Ricardo</td><td class="muted">Calculado</td><td class="r">${brl(r.juros)}</td><td class="r">${r.kgTotal?kgv(r.juros/r.kgTotal):'—'}</td><td></td></tr>
    </tbody></table></div>${r.investPago?`<div class="card-b hint" style="padding-top:0">Investimento / reforma pago no período: ${brl(r.investPago)}. No resultado entra só a parte do período (${brl(r.investMes)}), porque o gasto é diluído em ${r.param.mesesInvest} meses.</div>`:''}</div>`;
  const cap=`<div class="card"><div class="card-h"><h2>Capital do Ricardo</h2><div class="sp"><button class="btn sm" data-go="config">Configurar</button></div></div><div class="card-b">
    ${r.capital||r.juros?`<div class="grid kpis" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><div><div class="muted">Capital na empresa</div><b class="num">${brl(r.capital)}</b></div><div><div class="muted">Juros ${fnum(r.param.taxaJuros,2)}% no período</div><b class="num">${brl(r.juros)}</b></div><div><div class="muted">No CDB (${fnum(r.param.taxaCdb,2)}%) renderia</div><b class="num">${brl(r.cdb)}</b></div><div><div class="muted">Ganho a mais do Ricardo</div><b class="num">${brl(r.juros-r.cdb)}</b></div></div>
    <p class="hint" style="margin:12px 0 0">Juro simples sobre o capital de cada mês; dinheiro aportado ou devolvido no meio do mês conta pelos dias. Pagar o juro ao Ricardo (categoria “Juros do capital (Ricardo)”) não conta de novo como custo.</p>`
    :`<p style="margin:0">Ainda não há capital cadastrado. Informe o valor que o Ricardo colocou na 3STRUZA em <a href="#config" data-go="config">Configurações</a>, ou lance os próximos aportes no caixa com a categoria “Aporte de capital (Ricardo)”.</p>`}</div></div>`;
  const dicas=`<div class="card"><div class="card-h"><h2>Onde dá para reduzir os custos</h2></div><div class="card-b"><ul class="dicas">${r.dicas.map(d=>`<li>${d}</li>`).join('')||'<li>Sem pontos de atenção no período.</li>'}</ul></div></div>`;
  const recl=r.reclassificar.length?`<div class="card"><div class="card-h"><h2>Para classificar (${r.reclassificar.length})</h2></div><p class="card-b hint" style="margin:0;padding-bottom:0">Lançamentos em “Outros” ou sem categoria. Abra e escolha a categoria certa (alimentação, pigmento extra, diária extra…) para o custo aparecer no lugar certo.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="r">Valor</th><th></th></tr></thead><tbody>
    ${r.reclassificar.map(d=>`<tr><td>${fd(d.data)}</td><td>${esc(d.descricao)}</td><td class="muted">${esc(d.categoria||'—')}</td><td class="r">${brl(d.valor)}</td><td class="acts"><button class="btn sm" data-act="${d.col==='titulos'?'editTitulo':'editMov'}" data-id="${d.id}">Classificar</button></td></tr>`).join('')}
    </tbody></table></div></div>`:'';
  return{sub:'Custos fixos e variáveis, custo por quilo de cada material, lucro bruto e líquido',actions:`<div class="toolbar">${perCtl()}${UI.per==='tudo'?'':monthCtl()}</div>`,html:`
  <div class="grid kpis">
    <div class="kpi hl"><span>Vendas em ${esc(r.label)}</span><b>${brl(t.receita)}</b><small>${fkg(t.kg)} vendidos</small></div>
    <div class="kpi"><span>Lucro bruto</span><b class="${t.bruto<0?'neg':'pos'}">${brl(t.bruto)}</b><small>${pc(t.bruto,t.receita)} das vendas · vendas − material, frete CIF e impostos</small></div>
    <div class="kpi"><span>Custos da empresa</span><b>${brl(t.despesas)}</b><small>${r.kgTotal?kgv(t.despKg)+' em cada kg vendido':'fixos, variáveis, juros e investimento'}</small></div>
    <div class="kpi"><span>${res<0?'Prejuízo':'Lucro líquido'}</span><b class="${res<0?'neg':'pos'}">${brl(res)}</b><small>${pc(res,t.receita)} das vendas${r.kgTotal?' · '+kgv(t.liquidoKg)+'/kg':''}</small></div>
  </div>
  ${dicas}${dre}<div class="grid two">${cats}${cap}</div>${recl}`};
}
function csvRes(k){const r=resDados();const f=v=>v==null?'':fnum(v,4);let l;
  if(k==='dre'){const cols=[...r.linhas,r.total];const L=(rot,fn)=>[rot,...cols.map(fn)];
    l=[['',...cols.map(e=>e.tipo)],L('Peso vendido (kg)',e=>f(e.kg)),L('Vendas',e=>f(e.receita)),L('Material (custo médio)',e=>f(e.material)),L('Frete CIF e impostos',e=>f(e.freteImp)),L('Lucro bruto',e=>f(e.bruto)),
      L('Custos variáveis',e=>f(e.variavel)),L('Custos fixos',e=>f(e.fixo)),L('Juros, multas e tarifas',e=>f(e.financeiro)),L('Juros do capital do Ricardo',e=>f(e.juros)),L('Investimento diluído',e=>f(e.investimento)),L('Lucro líquido',e=>f(e.liquido)),
      L('Custo do material por kg',e=>f(e.materialKg)),L('Custos da empresa por kg',e=>f(e.despKg)),L('Custo total por kg',e=>f(e.custoKg)),L('Lucro líquido por kg',e=>f(e.liquidoKg))]}
  else l=[['Categoria','Tipo','Valor','Por kg vendido']].concat(r.categorias.map(x=>[x.categoria||'Sem categoria',NAT[x.nat],f(x.valor),f(x.porKg)]),[['Juros do capital do Ricardo','Calculado',f(r.juros),r.kgTotal?f(r.juros/r.kgTotal):'']]);
  baixarCSVLinhas(l,`resultado-${k}-${slug(r.label)}.csv`)}

export {vResultado,csvRes,resDados};
