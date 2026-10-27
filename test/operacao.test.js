import {describe,it,expect,beforeEach} from 'vitest';
import {S} from '../src/dados.js';
import {formOp} from '../src/forms/operacao.js';
import {montar,conta,item,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const campo=(nome,valor)=>{const f=$('#modalRoot form');const el=f.elements[nome];
  if(el instanceof RadioNodeList){[...el].forEach(r=>r.checked=r.value===valor);[...el].find(r=>r.checked).dispatchEvent(new Event('change',{bubbles:true}))}
  else{if(el.type==='checkbox')el.checked=valor;else el.value=valor;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
const daVenda=id=>S.movimentos.filter(m=>m.ref?.col==='vendas'&&m.ref.id===id);

const base=()=>({
  contas:[conta('banco',0),conta('gaveta',0,{tipo:'gaveta'})],
  parceiros:[{id:'cli',nome:'Cliente X',cliente:true,fornecedor:false}],
  compras:[{id:'c1',numero:1,data:'2026-09-01',parceiroId:'cli',total:10000,forma:'pix',itens:[item('PP Moído','Preto',5000,2)]}],
});

describe('venda à vista com frete CIF',()=>{
  beforeEach(()=>montar({...base(),vendas:[{id:'v1',numero:7,data:'2026-10-20',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:5000,totalMat:5000,forma:'pix',contaId:'banco',pagamentos:[{meio:'pix',contaId:'banco',valor:5000}],entrada:0,parcelas:0,frete:null,impostoPct:0}],
    movimentos:[{id:'mv1',tipo:'entrada',valor:5000,contaId:'banco',data:'2026-10-20',ref:{col:'vendas',id:'v1'}}]}));

  it('lança o frete numa saída separada e mantém o recebimento no lugar',async()=>{
    formOp('vendas','v1');
    campo('freteTipo','cif');campo('freteValor','300');campo('freteConta','gaveta');campo('freteCobrar',false);
    await salvarModal();
    const movs=daVenda('v1');
    const frete=movs.filter(m=>m.ref.frete),proprios=movs.filter(m=>!m.ref.frete);
    expect(frete).toHaveLength(1);
    expect(frete[0]).toMatchObject({tipo:'saida',valor:300,contaId:'gaveta',categoria:'Frete de venda'});
    expect(proprios).toHaveLength(1);
    expect(proprios[0]).toMatchObject({id:'mv1',tipo:'entrada',valor:5000,contaId:'banco'});
    expect(S.vendas[0].frete).toMatchObject({tipo:'cif',valor:300,cobrar:false,contaId:'gaveta'});
  });

  it('salvar de novo não duplica o frete e tirar o frete apaga a saída',async()=>{
    formOp('vendas','v1');campo('freteTipo','cif');campo('freteValor','300');campo('freteConta','gaveta');await salvarModal();
    formOp('vendas','v1');await salvarModal();
    expect(daVenda('v1').filter(m=>m.ref.frete)).toHaveLength(1);
    formOp('vendas','v1');campo('freteTipo','nenhum');await salvarModal();
    expect(daVenda('v1').filter(m=>m.ref.frete)).toHaveLength(0);
    expect(daVenda('v1')).toHaveLength(1);
  });

  it('frete cobrado do cliente entra no total',async()=>{
    formOp('vendas','v1');campo('freteTipo','cif');campo('freteValor','300');campo('freteCobrar',true);await salvarModal();
    expect(S.vendas[0].total).toBe(5300);
    expect(daVenda('v1').find(m=>!m.ref.frete).valor).toBe(5300);
  });
});

describe('edição de venda a prazo com parcelas recebidas',()=>{
  beforeEach(()=>montar({...base(),
    vendas:[{id:'v2',numero:8,data:'2026-09-01',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,3)],total:3000,totalMat:3000,forma:'credito',contaId:'',pagamentos:[],entrada:0,parcelas:3,primeiroVenc:'2026-10-01',impostoPct:0}],
    titulos:[
      {id:'t1',lado:'receber',valor:1000,vencimento:'2026-10-01',parcela:1,totalParcelas:3,grupo:'g',pago:true,pagoEm:'2026-10-01',ref:{col:'vendas',id:'v2'}},
      {id:'t2',lado:'receber',valor:1000,vencimento:'2026-11-01',parcela:2,totalParcelas:3,grupo:'g',pago:false,ref:{col:'vendas',id:'v2'}},
      {id:'t3',lado:'receber',valor:1000,vencimento:'2026-12-01',parcela:3,totalParcelas:3,grupo:'g',pago:false,ref:{col:'vendas',id:'v2'}},
    ]}));
  const parc=()=>S.titulos.filter(t=>t.ref?.id==='v2').sort((a,b)=>a.parcela-b.parcela);

  it('sem mudar valores, mantém todas as parcelas como estão',async()=>{
    formOp('vendas','v2');await salvarModal();
    expect(parc().map(t=>[t.id,t.valor,t.pago])).toEqual([['t1',1000,true],['t2',1000,false],['t3',1000,false]]);
  });

  it('mudando o total, preserva a parcela recebida e refaz só as abertas',async()=>{
    formOp('vendas','v2');
    const kg=$('#itRows input[data-k="precoKg"]');kg.value='3,6';kg.dispatchEvent(new Event('input',{bubbles:true}));
    await salvarModal();
    const p=parc();
    expect(p[0]).toMatchObject({id:'t1',valor:1000,pago:true,parcela:1,totalParcelas:3});
    expect(p.slice(1).map(t=>[t.valor,t.pago,t.parcela])).toEqual([[1300,false,2],[1300,false,3]]);
    expect(p.reduce((a,t)=>a+t.valor,0)).toBe(3600);
  });

  it('não deixa trocar a forma de pagamento com parcela recebida',async()=>{
    formOp('vendas','v2');campo('forma','pix');
    await expect(salvarModal()).rejects.toThrow(/Estorne-as/);
  });
});
