import {S,cfg} from './dados.js';
import {custoItem,custosMedios,margemVenda} from './regras.js';
import {addMonths,esc,num,r2,today} from './util.js';

/* ===================== custos e resultado do mês =====================
   Cada categoria de saída tem uma natureza (fixo, variável, financeiro, investimento ou fora).
   O resultado do mês junta as vendas (receita, custo médio do material, frete CIF e impostos),
   as despesas pela data (contas a pagar pelo vencimento, saídas avulsas pela data), o juro do
   capital do Ricardo e a parcela dos investimentos/reforma diluída em alguns meses.
   Os custos que não são de um material só são divididos pelos quilos vendidos de cada material. */
const NAT={variavel:'Custo variável',fixo:'Custo fixo',financeiro:'Custo financeiro',investimento:'Investimento / reforma',fora:'Não é custo do mês'};
const NAT_ORDEM=['variavel','fixo','financeiro','investimento','fora'];
const NAT_DICA={variavel:'sobe e desce com o quanto se compra, produz e vende',fixo:'existe mesmo num mês sem venda',financeiro:'juros, multas e tarifas de dinheiro',investimento:'reforma, máquina: diluído em vários meses no resultado',fora:'compra de material (vira estoque), aporte, devolução e retirada'};
const CAT_APORTE='Aporte de capital (Ricardo)',CAT_DEVOL='Devolução de capital (Ricardo)',CAT_JUROS='Juros do capital (Ricardo)';
const CUSTOS_PADRAO={
  'Frete':'variavel','Frete de venda':'variavel','Pigmento extra':'variavel','Beneficiamento (moagem / granulação)':'variavel',
  'Embalagens (sacos e big bags)':'variavel','Energia elétrica':'variavel','Combustível':'variavel','Diária extra':'variavel','Comissões':'variavel','Impostos':'variavel',
  'Salários':'fixo','Encargos (INSS, FGTS, férias)':'fixo','Pró-labore Ricardo':'fixo','Transporte de funcionário':'fixo','Alimentação':'fixo',
  'Aluguel':'fixo','Água':'fixo','Internet/Telefone':'fixo','Contador':'fixo','Manutenção':'fixo','Limpeza e escritório':'fixo','Outros':'fixo',
  'Juros e multas':'financeiro','Tarifas bancárias':'financeiro',
  'Investimento / reforma':'investimento','Máquinas e equipamentos':'investimento',
  'Compra de material':'fora',[CAT_JUROS]:'fora',[CAT_DEVOL]:'fora','Retirada de lucro':'fora'};
// categorias com natureza fixa: o sistema já trata de outro jeito (estoque, capital, juro calculado)
const NAT_TRAVADA=new Set(['Compra de material',CAT_JUROS,CAT_DEVOL,CAT_APORTE]);
const CAT_RECEBER_NOVAS=[CAT_APORTE];
const natureza=(cat,c=cfg())=>NAT_TRAVADA.has(cat)?(CUSTOS_PADRAO[cat]||'fora'):(c.natCat?.[cat]||CUSTOS_PADRAO[cat]||'fixo');
const PARAM={taxaJuros:1.5,taxaCdb:1,mesesInvest:12};
const param=(c=cfg())=>({taxaJuros:c.taxaJuros??PARAM.taxaJuros,taxaCdb:c.taxaCdb??PARAM.taxaCdb,mesesInvest:Math.max(1,Math.round(num(c.mesesInvest)||PARAM.mesesInvest)),
  capitalInicial:num(c.capitalInicial),capitalDesde:c.capitalDesde||''});

/* ---- seletores para os formulários de saída ---- */
function catOpts(cats,sel){const c=cfg();const g=new Map(NAT_ORDEM.map(n=>[n,[]]));
  const lista=sel&&!cats.includes(sel)?[sel,...cats]:cats;lista.forEach(x=>g.get(natureza(x,c)).push(x));
  return `<option value="">—</option>`+NAT_ORDEM.filter(n=>g.get(n).length).map(n=>`<optgroup label="${NAT[n]}">${g.get(n).map(x=>`<option ${x===sel?'selected':''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')}
const matOpts=sel=>`<option value="">Todos (dividido pelos kg vendidos)</option>`+cfg().tipos.map(t=>`<option ${t===sel?'selected':''}>${esc(t)}</option>`).join('');
const campoMaterial=sel=>`<label class="fl">Custo de qual material<select name="material">${matOpts(sel)}</select><span class="hint">Use quando o gasto é só de um material, como pigmento para o grão.</span></label>`;

/* ---- capital do Ricardo ---- */
function eventosCapital(c=cfg()){const p=param(c);const ev=[];
  if(p.capitalInicial)ev.push({data:p.capitalDesde||'2000-01-01',valor:p.capitalInicial,origem:'inicial'});
  S.movimentos.forEach(m=>{if(m.pendente)return;
    if(m.tipo==='entrada'&&m.categoria===CAT_APORTE)ev.push({data:m.data,valor:num(m.valor),origem:'aporte',id:m.id,descricao:m.descricao});
    if(m.tipo==='saida'&&m.categoria===CAT_DEVOL)ev.push({data:m.data,valor:-num(m.valor),origem:'devolucao',id:m.id,descricao:m.descricao})});
  return ev.sort((a,b)=>a.data.localeCompare(b.data))}
const capitalEm=(data,c=cfg())=>r2(eventosCapital(c).filter(e=>e.data<=data).reduce((a,e)=>a+e.valor,0));
const diasMes=ym=>new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
// juro do mês: dinheiro que já estava no início do mês paga o mês inteiro; o que entrou (ou saiu) no meio do mês paga só os dias
function jurosMes(ym,c=cfg(),taxa=param(c).taxaJuros){const dm=diasMes(ym);let base=0;
  for(const e of eventosCapital(c)){const m=e.data.slice(0,7);if(m>ym)continue;
    base+=m<ym?e.valor:e.valor*(dm-num(e.data.slice(8,10))+1)/dm}
  return r2(Math.max(0,base)*num(taxa)/100)}

/* ---- período em meses ---- */
function primeiroMes(){let m=today().slice(0,7);
  for(const col of ['vendas','compras','movimentos'])for(const x of S[col])if(x.data&&x.data.slice(0,7)<m)m=x.data.slice(0,7);
  for(const t of S.titulos)if(t.vencimento&&t.vencimento.slice(0,7)<m)m=t.vencimento.slice(0,7);
  return m}
function mesesDe(ini,fim){const a=(ini||primeiroMes()+'-01').slice(0,7);let b=fim&&fim<'9000'?fim.slice(0,7):today().slice(0,7);if(b<a)b=a;
  const out=[];for(let m=a;m<=b&&out.length<240;m=addMonths(m+'-01',1).slice(0,7))out.push(m);return out}

/* ---- despesas do período ----
   contas a pagar entram pelo vencimento (pagas ou não), saídas avulsas do caixa pela data.
   Ficam de fora: pagamentos de contas (já contadas pelo título), compras de material, frete CIF de venda
   (já está no custo da venda) e devolução de adiantamento de cliente. */
const dif=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/864e5;
// frete CIF lançado na venda sem conta (sem saída automática) e pago à mão no caixa: é o mesmo frete, não conta duas vezes
function freteDaVenda(m,usadas){if(m.ref||!/frete/i.test((m.categoria||'')+' '+(m.descricao||'')))return null;
  const v=S.vendas.find(v=>!usadas.has(v.id)&&v.frete?.tipo==='cif'&&!v.frete.contaId&&Math.abs(num(v.frete.valor)-num(m.valor))<0.01&&v.data&&dif(v.data,m.data)<=10);
  if(v)usadas.add(v.id);return v||null}
function despesas(ini,fim,c=cfg(),dup){const out=[];const usadas=new Set();
  for(const t of S.titulos){if(t.lado!=='pagar'||!t.vencimento||t.vencimento<ini||t.vencimento>fim)continue;
    if(t.ref&&['compras','vendas','adiantamentos'].includes(t.ref.col))continue;
    out.push({col:'titulos',id:t.id,data:t.vencimento,descricao:t.descricao||'',categoria:t.categoria||'',valor:t.pago?(num(t.valorPago)||num(t.valor)):num(t.valor),material:t.material||'',pago:!!t.pago})}
  for(const m of S.movimentos){if(m.tipo!=='saida'||!m.data||m.data<ini||m.data>fim)continue;
    if(m.ref&&(['titulos','compras','vendas','adiantamentos'].includes(m.ref.col)||m.ref.frete))continue;
    const fv=freteDaVenda(m,usadas);if(fv){if(dup)dup.push({id:m.id,data:m.data,descricao:m.descricao||'',valor:num(m.valor),vendaId:fv.id});continue}
    out.push({col:'movimentos',id:m.id,data:m.data,descricao:m.descricao||'',categoria:m.categoria||'',valor:num(m.valor),material:m.material||'',pago:!m.pendente})}
  out.forEach(d=>d.nat=natureza(d.categoria,c));
  return out.sort((a,b)=>a.data.localeCompare(b.data))}

/* ---- resultado do período, por material ---- */
function resultadoCustos(ini,fim){const c=cfg(),p=param(c);
  const meses=mesesDe(ini,fim);const i0=meses[0]+'-01',f0=meses[meses.length-1]+'-31';
  const cm=custosMedios();const mats=new Map();
  const mat=t=>{if(!mats.has(t))mats.set(t,{tipo:t,kg:0,receita:0,material:0,freteImp:0,variavel:0,fixo:0,financeiro:0,juros:0,investimento:0,semCusto:false});return mats.get(t)};
  const vendas=S.vendas.filter(v=>v.data>=i0&&v.data<=f0);
  for(const v of vendas){const its=(v.itens||[]).filter(it=>it.tipo&&num(it.kg));if(!its.length)continue;const mv=margemVenda(v,cm);
    const val=its.reduce((a,it)=>a+num(it.kg)*num(it.precoKg),0),kg=its.reduce((a,it)=>a+num(it.kg),0);
    for(const it of its){const e=mat(it.tipo);const k=num(it.kg);const parte=val?num(it.kg)*num(it.precoKg)/val:k/kg;const ck=custoItem(cm,it);
      e.kg+=k;e.receita+=num(v.total)*parte;e.material+=k*ck;e.freteImp+=mv.frete*k/kg+mv.imposto*parte;if(!ck)e.semCusto=true}}
  const kgTotal=[...mats.values()].reduce((a,e)=>a+e.kg,0);
  // distribui um valor: direto no material escolhido, ou pelos kg vendidos de cada um
  const semRateio={variavel:0,fixo:0,financeiro:0,juros:0,investimento:0};
  const lancar=(campo,valor,material)=>{if(!valor)return;
    if(material){mat(material)[campo]+=valor;return}
    if(!kgTotal){semRateio[campo]+=valor;return}
    mats.forEach(e=>{e[campo]+=valor*e.kg/kgTotal})};
  const freteDuplo=[];const desp=despesas(i0,f0,c,freteDuplo);
  for(const d of desp)if(['variavel','fixo','financeiro'].includes(d.nat))lancar(d.nat,d.valor,d.material);
  // investimento/reforma: cada um vira N parcelas mensais a partir do mês em que foi pago
  const N=p.mesesInvest;const inv=despesas(addMonths(i0,-(N-1)),f0,c).filter(d=>d.nat==='investimento');let investMes=0;
  for(const d of inv){const m0=d.data.slice(0,7);const n=meses.filter(m=>m>=m0&&m<=addMonths(m0+'-01',N-1).slice(0,7)).length;
    if(n){const v=d.valor*n/N;investMes+=v;lancar('investimento',v,d.material)}}
  const jurosPorMes=meses.map(m=>({mes:m,juros:jurosMes(m,c),cdb:jurosMes(m,c,p.taxaCdb),capital:capitalEm(m+'-'+String(diasMes(m)).padStart(2,'0'),c)}));
  const juros=r2(jurosPorMes.reduce((a,x)=>a+x.juros,0)),cdb=r2(jurosPorMes.reduce((a,x)=>a+x.cdb,0));
  lancar('juros',juros,'');
  const fecha=e=>{const desp=e.variavel+e.fixo+e.financeiro+e.juros+e.investimento;const bruto=e.receita-e.material-e.freteImp;const liquido=bruto-desp;
    const kg=e.kg;const k=v=>kg?v/kg:null;
    return{...e,receita:r2(e.receita),material:r2(e.material),freteImp:r2(e.freteImp),variavel:r2(e.variavel),fixo:r2(e.fixo),financeiro:r2(e.financeiro),juros:r2(e.juros),investimento:r2(e.investimento),
      despesas:r2(desp),bruto:r2(bruto),liquido:r2(liquido),precoKg:k(e.receita),materialKg:k(e.material),despKg:k(desp),custoKg:k(e.material+e.freteImp+desp),brutoKg:k(bruto),liquidoKg:k(liquido)}};
  const linhas=[...mats.values()].sort((a,b)=>b.kg-a.kg||a.tipo.localeCompare(b.tipo)).map(fecha);
  const tot=linhas.reduce((a,e)=>{for(const k of ['kg','receita','material','freteImp','variavel','fixo','financeiro','juros','investimento'])a[k]+=e[k];a.semCusto=a.semCusto||e.semCusto;return a},
    {tipo:'Total',kg:0,receita:0,material:0,freteImp:0,variavel:0,fixo:0,financeiro:0,juros:0,investimento:0,semCusto:false});
  for(const k in semRateio)tot[k]+=semRateio[k];
  const total=fecha(tot);
  // categorias: quanto cada uma custou e quanto pesa em cada quilo vendido
  const cats=new Map();for(const d of desp){if(d.nat==='fora')continue;const x=cats.get(d.categoria)||{categoria:d.categoria,nat:d.nat,valor:0,n:0,aberto:0};x.valor+=d.valor;x.n++;if(!d.pago)x.aberto+=d.valor;cats.set(d.categoria,x)}
  const categorias=[...cats.values()].map(x=>({...x,valor:r2(x.valor),aberto:r2(x.aberto),porKg:kgTotal?x.valor/kgTotal:null})).sort((a,b)=>NAT_ORDEM.indexOf(a.nat)-NAT_ORDEM.indexOf(b.nat)||b.valor-a.valor);
  const reclassificar=desp.filter(d=>!d.categoria||d.categoria==='Outros');
  const capitalHoje=capitalEm(f0<today()?f0:today(),c);
  return{meses,ini:i0,fim:f0,param:p,freteDuplo,linhas,total,kgTotal,categorias,despesas:desp,reclassificar,juros,cdb,jurosPorMes,capital:capitalHoje,
    investPago:r2(desp.filter(d=>d.nat==='investimento').reduce((a,d)=>a+d.valor,0)),investMes:r2(investMes),semRateio:Object.values(semRateio).some(v=>v)}}

/* ---- onde dá para cortar: sugestões a partir dos números ---- */
const DICAS=[
  [/frete|transporte de func/i,'Feche frete por carga cheia e por rota fixa, junte entregas do mesmo dia e, quando o cliente puder buscar, venda FOB.'],
  [/combust/i,'Controle o combustível por veículo e por viagem (km e litros); rotas juntas e abastecimento num posto só com desconto costumam reduzir 10 a 15%.'],
  [/aliment/i,'Compare quentinha avulsa com marmita contratada por mês ou vale-refeição; contrato mensal costuma sair mais barato por refeição.'],
  [/diária/i,'Diária extra indica pico de trabalho: planejar a moagem e as cargas na semana evita chamar gente de última hora.'],
  [/salár|encargo|comiss/i,'Acompanhe quantos kg cada funcionário movimenta por mês; se o volume não sobe, a folha pesa mais em cada quilo.'],
  [/manuten/i,'Manutenção preventiva (troca de facas, correias e peneiras em dia marcado) costuma sair mais barata que a corretiva com máquina parada.'],
  [/energia/i,'Energia pesa na moagem: concentre a produção, evite máquina ligada sem carga e veja com a distribuidora a tarifa por horário.'],
  [/pigmento|aditivo/i,'Use pigmento só em pedido que exige cor e repasse no preço desse pedido (é custo daquele material, não da empresa toda).'],
  [/beneficiamento|moagem|granula/i,'Compare o custo por kg de beneficiar fora com o preço do material já granulado; negocie o valor por volume.'],
  [/embalag/i,'Reaproveite big bags em bom estado e compre sacos em maior quantidade para baixar o preço unitário.'],
  [/água|internet|telefone|aluguel|contador|tarifa|limpeza/i,'Custo fixo pequeno, mas todo mês: vale renegociar uma vez por ano (plano, pacote do banco, honorário).'],
];
function sugestoes(r){const out=[];const t=r.total;const kg=r.kgTotal;const f=(v,d=2)=>(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:d,maximumFractionDigits:d});
  if(!kg){out.push('Sem vendas no período: não dá para calcular o custo por quilo. Os custos do mês aparecem no total e precisam ser cobertos pelas próximas vendas.');}
  if(kg&&t.liquido<0){const precisa=-t.liquido/kg;out.push(`O período fechou com <b>prejuízo de ${f(-t.liquido)}</b>. Com o mesmo volume, o preço médio de venda teria de ser <b>${f(precisa,3)}/kg maior</b> para empatar.`)}
  const fixos=t.fixo+t.financeiro+t.juros+t.investimento;const mc=kg?(t.bruto-t.variavel)/kg:0;
  if(kg&&fixos>0){if(mc>0)out.push(`Ponto de equilíbrio: cada quilo vendido deixa ${f(mc,3)} depois do material e dos custos variáveis. Para pagar os custos fixos, juros e investimento (${f(fixos)}) é preciso vender <b>${Math.ceil(fixos/mc).toLocaleString('pt-BR')} kg</b> no período; foram vendidos ${kg.toLocaleString('pt-BR',{maximumFractionDigits:0})} kg.`);
    else out.push('A margem depois do material e dos custos variáveis está negativa: vender mais assim aumenta o prejuízo. Primeiro é preciso subir o preço ou baixar o custo de compra.')}
  for(const l of r.linhas)if(l.kg&&l.liquidoKg<0)out.push(`<b>${esc(l.tipo)}</b> está dando prejuízo de ${f(-l.liquidoKg,3)} por kg depois de todos os custos (vende a ${f(l.precoKg,3)}, custa ${f(l.custoKg,3)}). Reveja o preço de venda ou o de compra desse material.`);
  const despT=r.categorias.reduce((a,x)=>a+x.valor,0);
  const top=r.categorias.filter(x=>x.nat!=='investimento').slice().sort((a,b)=>b.valor-a.valor).slice(0,3);
  for(const x of top){if(!despT||x.valor/despT<0.12)continue;const d=DICAS.find(([re])=>re.test(x.categoria));
    out.push(`<b>${esc(x.categoria||'Sem categoria')}</b> é ${Math.round(x.valor/despT*100)}% dos custos (${f(x.valor)}${kg?`, ${f(x.porKg,3)} em cada kg`:''}).${d?' '+d[1]:''}`)}
  const outros=r.reclassificar.reduce((a,d)=>a+d.valor,0);
  if(despT&&outros/despT>=0.1)out.push(`${f(outros)} (${Math.round(outros/despT*100)}%) está como “Outros” ou sem categoria. Reclassifique abaixo para saber de verdade para onde vai o dinheiro.`);
  if(r.juros>0){const extra=r.juros-r.cdb;out.push(`O capital do Ricardo (${f(r.capital)}) custa ${f(r.juros)} de juros no período${kg?` (${f(r.juros/kg,3)} por kg)`:''}. No CDB renderia ${f(r.cdb)}, então a 3STRUZA paga ${f(extra)} a mais pela troca. Cada R$ 10.000 devolvidos com dinheiro parado em caixa economiza ${f(10000*r.param.taxaJuros/100)} por mês.`)}
  else if(!r.capital)out.push('O capital do Ricardo ainda não está cadastrado, então o juro de 1,5% ao mês não entrou no custo. Informe em Configurações → Capital do Ricardo.');
  if(t.semCusto)out.push('Há material vendido sem custo de compra registrado; o lucro desse material está maior do que o real. Lance um ajuste de estoque com o custo por kg.');
  return out}

export {NAT,NAT_ORDEM,NAT_DICA,NAT_TRAVADA,CUSTOS_PADRAO,CAT_APORTE,CAT_DEVOL,CAT_JUROS,CAT_RECEBER_NOVAS,PARAM,natureza,param,catOpts,matOpts,campoMaterial,
  eventosCapital,capitalEm,jurosMes,mesesDe,despesas,resultadoCustos,sugestoes};
