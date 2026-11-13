import {describe,it,expect,beforeEach} from 'vitest';
import {natureza,jurosMes,capitalEm,resultadoCustos,sugestoes,despesas,CAT_APORTE,CAT_DEVOL,CAT_JUROS} from '../src/custos.js';
import {cfg,S} from '../src/dados.js';
import {UI} from '../src/estado.js';
import {render} from '../src/render.js';
import {relDados} from '../src/telas/relatorios.js';
import {formMov} from '../src/forms/movimento.js';
import {montar,conta,item,salvarModal} from './ajuda.js';

const mov=(id,tipo,valor,data,categoria,extra={})=>({id,tipo,valor,data,categoria,contaId:'a',descricao:categoria||'mov '+id,...extra});
// grão compra a 6 e vende a 8; moído compra a 2,5 e vende a 3,5. Vende 3.000 kg de grão e 1.000 kg de moído (75% / 25%)
const base=(extra={})=>({
  contas:[conta('a',0)],
  parceiros:[{id:'f1',nome:'Fornecedor',fornecedor:true},{id:'c1',nome:'Cliente',cliente:true}],
  compras:[{id:'k1',numero:1,data:'2026-09-02',parceiroId:'f1',total:20500,totalKg:5000,itens:[item('PP Granulado','Branco',3000,6),item('PP Moído','Preto',1000,2.5)]}],
  vendas:[
    {id:'v1',numero:1,data:'2026-10-10',parceiroId:'c1',total:24000,totalKg:3000,itens:[item('PP Granulado','Branco',3000,8)],frete:{tipo:'cif',valor:300},impostoPct:0},
    {id:'v2',numero:2,data:'2026-10-11',parceiroId:'c1',total:3500,totalKg:1000,itens:[item('PP Moído','Preto',1000,3.5)]},
  ],
  config:[{id:'geral',capitalInicial:100000,capitalDesde:'2026-09-01'}],
  ...extra});

describe('categorias de custo',()=>{
  beforeEach(()=>montar({config:[{id:'geral',catPagar:['Compra de material','Salários','Minha categoria']}]}));
  it('a lista salva ganha as categorias novas uma vez, sem perder as do usuário',()=>{
    const c=cfg();
    expect(c.catPagar.slice(0,3)).toEqual(['Compra de material','Salários','Minha categoria']);
    for(const k of ['Alimentação','Transporte de funcionário','Diária extra','Pigmento extra','Pró-labore Ricardo','Investimento / reforma',CAT_JUROS,CAT_DEVOL])expect(c.catPagar).toContain(k);
    expect(c.catReceber).toContain(CAT_APORTE);
    S.config[0]={...c,catPagar:c.catPagar.filter(x=>x!=='Alimentação')};
    expect(cfg().catPagar).not.toContain('Alimentação');
  });
  it('cada categoria tem natureza padrão, que pode ser trocada (menos as automáticas)',()=>{
    expect(natureza('Salários')).toBe('fixo');
    expect(natureza('Frete')).toBe('variavel');
    expect(natureza('Investimento / reforma')).toBe('investimento');
    expect(natureza('Compra de material')).toBe('fora');
    expect(natureza('Minha categoria')).toBe('fixo');
    S.config[0].natCat={'Salários':'variavel','Compra de material':'fixo'};
    expect(natureza('Salários')).toBe('variavel');
    expect(natureza('Compra de material')).toBe('fora');
  });
});

describe('juros do capital do Ricardo',()=>{
  beforeEach(()=>montar(base({movimentos:[
    mov('ap','entrada',30000,'2026-10-16',CAT_APORTE),       // metade de outubro (16 de 31 dias)
    mov('dv','saida',10000,'2026-11-01',CAT_DEVOL),
    mov('pd','entrada',5000,'2026-10-01',CAT_APORTE,{pendente:true}), // cheque a compensar: ainda não conta
  ]})));
  it('1,5% ao mês sobre o capital, aporte no meio do mês conta pelos dias',()=>{
    expect(jurosMes('2026-09')).toBe(1500);
    expect(jurosMes('2026-10')).toBe(r(1500+30000*0.015*16/31));
    expect(jurosMes('2026-11')).toBe(1800);
    expect(jurosMes('2026-08')).toBe(0);
    expect(capitalEm('2026-10-31')).toBe(130000);
  });
  it('a taxa e o CDB vêm da configuração',()=>{
    S.config[0].taxaJuros=2;expect(jurosMes('2026-09')).toBe(2000);
    expect(jurosMes('2026-09',cfg(),1)).toBe(1000);
  });
});
const r=n=>Math.round(n*100)/100;

describe('resultado do mês e custo por quilo',()=>{
  beforeEach(()=>montar(base({
    titulos:[
      {id:'t1',lado:'pagar',descricao:'Salário',categoria:'Salários',valor:4000,vencimento:'2026-10-05',pago:true,valorPago:4000},
      {id:'t2',lado:'pagar',descricao:'Energia',categoria:'Energia elétrica',valor:1000,vencimento:'2026-10-20'},       // em aberto: conta mesmo assim
      {id:'t3',lado:'pagar',descricao:'Compra a prazo',categoria:'Compra de material',valor:9000,vencimento:'2026-10-20',ref:{col:'compras',id:'k1'}},
      {id:'t4',lado:'pagar',descricao:'Aluguel nov',categoria:'Aluguel',valor:800,vencimento:'2026-11-05'},
    ],
    movimentos:[
      mov('m1','saida',4000,'2026-10-05','Salários',{ref:{col:'titulos',id:'t1'}}),   // pagamento do t1: não conta de novo
      mov('m2','saida',800,'2026-10-07','Pigmento extra',{material:'PP Granulado'}),
      mov('m3','saida',400,'2026-10-08','Alimentação'),
      mov('m4','saida',300,'2026-10-10','Frete de venda',{ref:{col:'vendas',id:'v1',frete:true}}), // já está no custo da venda
      mov('m5','saida',12000,'2026-10-12','Investimento / reforma'),
      mov('m6','saida',1500,'2026-10-31',CAT_JUROS),
      mov('m7','saida',100,'2026-10-15','Outros',{descricao:'Quentinhas'}),
      mov('m8','entrada',50000,'2026-10-01',CAT_APORTE),
      mov('m9','saida',5000,'2026-10-02','Compra de material'),
    ],
  })));
  it('conta cada custo uma vez e separa por material',()=>{
    const res=resultadoCustos('2026-10-01','2026-10-31');
    const g=res.linhas.find(l=>l.tipo==='PP Granulado'),m=res.linhas.find(l=>l.tipo==='PP Moído'),t=res.total;
    expect(res.kgTotal).toBe(4000);
    expect(g).toMatchObject({kg:3000,receita:24000,material:18000,freteImp:300,bruto:5700});
    expect(m).toMatchObject({kg:1000,receita:3500,material:2500,freteImp:0,bruto:1000});
    // fixos: salário 4000 + alimentação 400 + outros 100 = 4500, divididos 75/25
    expect(t.fixo).toBe(4500);expect(g.fixo).toBe(3375);expect(m.fixo).toBe(1125);
    // variáveis: energia 1000 (rateada) + pigmento 800 só no grão
    expect(g.variavel).toBe(750+800);expect(m.variavel).toBe(250);
    // reforma de 12.000 diluída em 12 meses
    expect(t.investimento).toBe(1000);expect(res.investPago).toBe(12000);
    // juros: 100.000 o mês todo + 50.000 desde o dia 1 = 150.000 × 1,5%
    expect(res.juros).toBe(2250);expect(g.juros).toBe(1687.5);
    expect(res.cdb).toBe(1500);
    expect(t.liquido).toBe(r(6700-4500-1800-1000-2250));
    expect(g.custoKg).toBeCloseTo((18000+300+3375+1550+750+1687.5)/3000,6);
    expect(t.despKg).toBeCloseTo((4500+1800+1000+2250)/4000,6);
    const cats=Object.fromEntries(res.categorias.map(x=>[x.categoria,x.valor]));
    expect(cats).toEqual({'Pigmento extra':800,'Energia elétrica':1000,'Salários':4000,'Alimentação':400,'Outros':100,'Investimento / reforma':12000});
    expect(res.categorias.find(x=>x.categoria==='Energia elétrica').aberto).toBe(1000);
    expect(res.reclassificar.map(d=>d.id)).toEqual(['m7']);
  });
  it('investimento continua diluído nos meses seguintes',()=>{
    const res=resultadoCustos('2026-11-01','2026-11-30');
    expect(res.total.investimento).toBe(1000);expect(res.investPago).toBe(0);
    expect(res.total.fixo).toBe(800);
    expect(res.semRateio).toBe(true); // sem venda em novembro: custo fica só no total
    expect(res.total.liquido).toBe(r(-800-1000-res.juros));
  });
  it('sugestões apontam prejuízo, ponto de equilíbrio, maior custo e o juro do capital',()=>{
    const d=sugestoes(resultadoCustos('2026-10-01','2026-10-31')).join('\n');
    expect(d).toMatch(/prejuízo de R\$\s?2\.850,00/);
    expect(d).toMatch(/Ponto de equilíbrio/);
    expect(d).toMatch(/Salários<\/b> é \d+% dos custos/);
    expect(d).toMatch(/CDB/);
  });
  it('relatório antigo: aporte não é receita, juros do capital pago não é despesa',()=>{
    UI.per='mes';UI.mes='2026-10';const d=relDados();
    expect(d.rec.map(x=>x[0])).not.toContain(CAT_APORTE);
    expect(d.desp.map(x=>x[0])).not.toContain(CAT_JUROS);
  });
  it('a tela Custos e resultado e a configuração abrem',()=>{
    UI.per='mes';UI.mes='2026-10';UI.view='resultado';render();
    const v=document.querySelector('#view').textContent;
    expect(v).toContain('Resultado e custo por quilo');expect(v).toContain('PP Granulado');expect(v).toContain('Prejuízo');expect(v).toContain('Quentinhas');
    UI.view='config';render();
    expect(document.querySelector('[data-form="cfgCapital"]')).toBeTruthy();
    expect(document.querySelector('select[data-cat="Alimentação"]').value).toBe('fixo');
  });
});

it('saída do caixa guarda o material do custo',async()=>{
  montar({contas:[conta('a',0)]});
  formMov('saida');
  const f=document.querySelector('#modalRoot form');
  f.elements.valor.value='850';f.elements.descricao.value='Pigmento branco';f.elements.categoria.value='Pigmento extra';f.elements.material.value='PP Granulado';
  expect(f.querySelector('optgroup[label="Custo variável"]')).toBeTruthy();
  await salvarModal();
  expect(S.movimentos[0]).toMatchObject({categoria:'Pigmento extra',material:'PP Granulado',valor:850});
  expect(despesas('2000-01-01','2999-12-31')[0].nat).toBe('variavel');
});

it('frete CIF da venda sem conta e pago à mão no caixa conta uma vez só',()=>{
  montar(base({movimentos:[mov('f1','saida',300,'2026-10-12','Frete',{descricao:'Frete venda cliente'}),mov('f2','saida',300,'2026-10-13','Frete',{descricao:'Outro frete'})]}));
  const res=resultadoCustos('2026-10-01','2026-10-31');
  expect(res.freteDuplo.map(d=>d.id)).toEqual(['f1']);
  expect(res.total.freteImp).toBe(300);expect(res.total.variavel).toBe(300); // o segundo frete é outro gasto
});
