import {describe,it,expect,beforeEach} from 'vitest';
import {caixaPrevisto,vendasPorMes} from '../src/regras.js';
import {filtrar,itens} from '../src/busca.js';
import {colunas,linha} from '../src/graficos.js';
import {montar,conta,item} from './ajuda.js';

const tit=(id,lado,valor,vencimento,extra={})=>({id,lado,valor,vencimento,descricao:'Conta '+id,parcela:1,totalParcelas:1,...extra});

describe('caixa previsto',()=>{
  beforeEach(()=>montar({contas:[conta('a',1000),conta('b',500,{ativo:false})],titulos:[
    tit('t1','pagar',300,'2026-10-20'),           // atrasada: entra hoje
    tit('t2','receber',800,'2026-10-29'),
    tit('t3','pagar',2000,'2026-11-05'),
    tit('t4','receber',100,'2026-11-05',{pago:true}),  // já recebida: fora
    tit('t5','pagar',999,'2026-12-31'),           // depois do período: fora
  ]}));
  it('começa no saldo de hoje e soma a receber − a pagar dia a dia',()=>{
    const p=caixaPrevisto(30,'2026-10-27');
    expect(p).toHaveLength(31);
    expect(p[0]).toMatchObject({data:'2026-10-27',saldo:700,sai:300,atras:1});
    expect(p.find(x=>x.data==='2026-10-29').saldo).toBe(1500);
    expect(p.find(x=>x.data==='2026-11-05')).toMatchObject({saldo:-500,sai:2000,ent:0});
    expect(p[30]).toMatchObject({data:'2026-11-26',saldo:-500});
  });
});

it('vendas por mês somam total, kg e quantidade',()=>{
  montar({vendas:[{id:'v1',data:'2026-10-02',total:1000,totalKg:400},{id:'v2',data:'2026-10-20',total:500.5,totalKg:100},{id:'v3',data:'2026-08-15',total:300,totalKg:50}]});
  expect(vendasPorMes(3,'2026-10')).toEqual([
    {mes:'2026-08',total:300,kg:50,qtd:1},{mes:'2026-09',total:0,kg:0,qtd:0},{mes:'2026-10',total:1500.5,kg:500,qtd:2}]);
});

describe('busca rápida',()=>{
  beforeEach(()=>montar({
    contas:[conta('a',0)],
    parceiros:[{id:'p1',nome:'Recicla Sul Ltda',fornecedor:true,documento:'12.345.678/0001-90'},{id:'p2',nome:'Injetora Paraná',cliente:true}],
    vendas:[{id:'v1',numero:12,data:'2026-10-02',parceiroId:'p2',total:1000,itens:[item('PP Moído','Preto',100,10)]}],
    titulos:[tit('t1','pagar',300,'2026-10-20',{categoria:'Energia elétrica'})],
  }));
  const busca=q=>filtrar(itens(),q).map(x=>x.txt);
  it('sem texto mostra ações e telas',()=>{
    const r=filtrar(itens(),'');
    expect(r.some(x=>x.txt==='Nova venda')).toBe(true);
    expect(r.every(x=>x.grupo==='Ações'||x.grupo==='Ir para')).toBe(true);
  });
  it('ignora acentos e maiúsculas',()=>expect(busca('parana')).toContain('Injetora Paraná'));
  it('acha venda pelo número, cliente ou material',()=>{
    expect(busca('#12')).toContain('Venda #12 · Injetora Paraná');
    expect(busca('preto')).toContain('Venda #12 · Injetora Paraná');
  });
  it('acha cadastro pelo documento e conta pela categoria',()=>{
    expect(busca('0001-90')).toEqual(['Recicla Sul Ltda']);
    expect(busca('energia')).toContain('Conta t1');
  });
  it('todas as palavras precisam aparecer',()=>expect(busca('recicla paraná')).toEqual([]));
});

it('gráficos escapam o texto das dicas e desenham uma barra por valor',()=>{
  const s=colunas({rotulo:'x',series:[{cor:'red'},{cor:'blue'}],grupos:[{rot:'A',valores:[10,5],tip:'<b>"A"</b>'}]});
  expect(s).toContain('data-tip="&lt;b&gt;&quot;A&quot;&lt;/b&gt;"');
  expect(s.match(/<path /g)).toHaveLength(2);
  const l=linha({rotulo:'y',pontos:[{v:-5,tip:'a'},{v:10,tip:'b'}]});
  expect(l).toContain('class="gl zero"');
  expect(l.match(/class="pt"/g)).toHaveLength(2);
});
