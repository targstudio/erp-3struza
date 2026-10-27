import {describe,it,expect,beforeEach} from 'vitest';
import {saldoConta,saldoTotal,estoque,custosMedios,margemVenda,dispMat,faltaEstoque,genTitulos,statusT,linked} from '../src/regras.js';
import {addMonths,today} from '../src/util.js';
import {montar,conta,item} from './ajuda.js';

describe('saldo das contas',()=>{
  beforeEach(()=>montar({
    contas:[conta('a',1000),conta('b',200),conta('c',500,{ativo:false})],
    movimentos:[
      {id:'m1',tipo:'entrada',contaId:'a',valor:'300,50'},
      {id:'m2',tipo:'saida',contaId:'a',valor:100},
      {id:'m3',tipo:'transferencia',contaId:'a',contaDestinoId:'b',valor:250},
      {id:'m4',tipo:'saida',contaId:'b',valor:50.25},
    ]}));
  it('soma entradas, tira saídas e move transferências',()=>{
    expect(saldoConta('a')).toBe(950.5);
    expect(saldoConta('b')).toBe(399.75);
  });
  it('saldo total ignora contas inativas',()=>expect(saldoTotal()).toBeCloseTo(1350.25,2));
});

describe('estoque e custo médio',()=>{
  beforeEach(()=>montar({
    compras:[
      {id:'c1',itens:[item('PP Moído','Preto',1000,2),{tipo:'PP Moído',cor:'Preto',embalagem:'bigbag',qtd:2,pesoUn:1000,kg:2000,precoKg:2.6}]},
      {id:'c2',itens:[item('PP Granulado','Natural',500,4)]},
    ],
    ajustes:[
      {id:'a1',sentido:'entrada',tipo:'PP Moído',cor:'Preto',embalagem:'granel',qtd:0,pesoUn:0,kg:1000,custoKg:3},
      {id:'a2',sentido:'saida',tipo:'PP Granulado',cor:'Natural',embalagem:'granel',qtd:0,pesoUn:0,kg:100},
    ],
    vendas:[{id:'v1',itens:[item('PP Moído','Preto',300,5)]}],
  }));
  it('separa por material, cor e embalagem',()=>{
    const e=estoque();
    const granel=e.find(x=>x.tipo==='PP Moído'&&x.embalagem==='granel');
    const bag=e.find(x=>x.tipo==='PP Moído'&&x.embalagem==='bigbag');
    expect(granel.kg).toBe(1700);
    expect(bag.kg).toBe(2000);expect(bag.un).toBe(2);
    expect(e.find(x=>x.tipo==='PP Granulado').kg).toBe(400);
  });
  it('custo médio pondera compras e ajustes de entrada',()=>{
    // (1000×2 + 2000×2,6 + 1000×3) / 4000 = 2,55
    expect(custosMedios().get('PP Moído|Preto')).toBeCloseTo(2.55,6);
    expect(estoque().find(x=>x.embalagem==='bigbag').custoKg).toBeCloseTo(2.55,6);
    expect(custosMedios().get('PP Granulado|Natural')).toBe(4);
  });
  it('disponível soma todas as embalagens e pode ignorar a venda em edição',()=>{
    expect(dispMat('PP Moído','Preto')).toBe(3700);
    expect(dispMat('PP Moído','Preto','v1')).toBe(4000);
  });
  it('aponta falta de estoque por material + cor',()=>{
    expect(faltaEstoque([item('PP Granulado','Natural',300,5),item('PP Granulado','Natural',200,5)])).toEqual([{tipo:'PP Granulado',cor:'Natural',pede:500,tem:400}]);
    expect(faltaEstoque([item('PP Moído','Preto',3700,5)])).toEqual([]);
  });
});

describe('margem da venda',()=>{
  beforeEach(()=>montar({compras:[{id:'c1',itens:[item('PP Moído','Preto',1000,2)]}]}));
  it('lucro = total − custo médio − frete CIF − impostos',()=>{
    const m=margemVenda({total:3000,impostoPct:10,frete:{tipo:'cif',valor:200},itens:[item('PP Moído','Preto',500,6)]});
    expect(m).toEqual({custo:1500,custoMat:1000,frete:200,imposto:300,margem:1500,semCusto:false});
  });
  it('frete FOB não entra no custo',()=>{
    const m=margemVenda({total:3000,impostoPct:0,frete:{tipo:'fob',valor:200},itens:[item('PP Moído','Preto',500,6)]});
    expect(m.frete).toBe(0);expect(m.margem).toBe(2000);
  });
  it('avisa quando o material não tem custo',()=>{
    expect(margemVenda({total:100,itens:[item('PP Granulado','Azul',10,10)]}).semCusto).toBe(true);
  });
});

describe('parcelas',()=>{
  beforeEach(()=>montar());
  it('parcelado divide sem perder centavos (diferença na última)',()=>{
    const p=genTitulos({lado:'receber'},'parcelada',3,100,'2026-01-31');
    expect(p.map(x=>x.valor)).toEqual([33.33,33.33,33.34]);
    expect(p.map(x=>x.vencimento)).toEqual(['2026-01-31','2026-02-28','2026-03-31']);
    expect(new Set(p.map(x=>x.grupo)).size).toBe(1);
    expect(p.map(x=>`${x.parcela}/${x.totalParcelas}`)).toEqual(['1/3','2/3','3/3']);
  });
  it('recorrente repete o valor todo mês',()=>{
    const p=genTitulos({},'recorrente',2,150.5,'2026-10-10');
    expect(p.map(x=>[x.valor,x.vencimento])).toEqual([[150.5,'2026-10-10'],[150.5,'2026-11-10']]);
  });
  it('status: pago, atrasado ou em aberto',()=>{
    expect(statusT({pago:true,vencimento:'2000-01-01'})).toBe('pago');
    expect(statusT({vencimento:'2000-01-01'})).toBe('atrasado');
    expect(statusT({vencimento:addMonths(today(),1)})).toBe('aberto');
  });
});

it('linked acha parcelas e lançamentos ligados a uma operação',()=>{
  montar({titulos:[{id:'t1',ref:{col:'vendas',id:'v1'}},{id:'t2',ref:{col:'vendas',id:'v2'}}],
    movimentos:[{id:'m1',ref:{col:'vendas',id:'v1'}},{id:'m2',ref:{col:'titulos',id:'t1'}},{id:'m3',ref:{col:'vendas',id:'v2'}}]});
  const {tit,mov}=linked('v1');
  expect(tit.map(t=>t.id)).toEqual(['t1']);expect(mov.map(m=>m.id).sort()).toEqual(['m1','m2']);
});
