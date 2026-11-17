import {describe,it,expect,beforeEach} from 'vitest';
import {S} from '../src/dados.js';
import {formOp} from '../src/forms/operacao.js';
import {margemVenda,porMaterial,fatorDesc} from '../src/regras.js';
import {montar,conta,item,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const campo=(nome,valor)=>{const f=$('#modalRoot form');const el=f.elements[nome];
  if(el instanceof RadioNodeList){[...el].forEach(r=>r.checked=r.value===valor);[...el].find(r=>r.checked).dispatchEvent(new Event('change',{bubbles:true}))}
  else{el.value=valor;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
const daVenda=id=>S.movimentos.filter(m=>m.ref?.col==='vendas'&&m.ref.id===id&&!m.ref.frete);

const base=()=>({
  contas:[conta('banco',0)],
  parceiros:[{id:'cli',nome:'Cliente X',cliente:true,fornecedor:false}],
  compras:[{id:'c1',numero:1,data:'2026-09-01',parceiroId:'cli',total:10000,forma:'pix',itens:[item('PP Moído','Preto',5000,2)]}],
  vendas:[{id:'v1',numero:7,data:'2026-10-20',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:5000,totalMat:5000,forma:'pix',contaId:'banco',pagamentos:[{meio:'pix',contaId:'banco',valor:5000}],entrada:0,parcelas:0,frete:null,impostoPct:0}],
  movimentos:[{id:'mv1',tipo:'entrada',valor:5000,contaId:'banco',data:'2026-10-20',ref:{col:'vendas',id:'v1'}}],
});

describe('desconto na venda',()=>{
  beforeEach(()=>montar(base()));

  it('desconto em R$ abate do total e do recebimento',async()=>{
    formOp('vendas','v1');campo('desconto','300');
    expect($('#totLine').textContent).toContain('Desconto');
    await salvarModal();
    const v=S.vendas[0];
    expect(v).toMatchObject({totalMat:5000,desconto:300,descontoPct:'',total:4700});
    expect(daVenda('v1')).toHaveLength(1);
    expect(daVenda('v1')[0]).toMatchObject({id:'mv1',valor:4700});
    expect(margemVenda(v).margem).toBe(4700-2000);
  });

  it('desconto em % guarda o valor e o percentual',async()=>{
    formOp('vendas','v1');campo('descTipo','pct');campo('desconto','10');await salvarModal();
    expect(S.vendas[0]).toMatchObject({desconto:500,descontoPct:10,total:4500});
    // ao abrir de novo, volta em %
    formOp('vendas','v1');
    const f=$('#modalRoot form');expect(f.elements.descTipo.value).toBe('pct');expect(f.elements.desconto.value).toBe('10');
  });

  it('a prazo: as parcelas saem do total com desconto',async()=>{
    formOp('vendas','v1');campo('forma','credito');campo('parcelas','2');campo('desconto','1000');await salvarModal();
    const tit=S.titulos.filter(t=>t.ref?.id==='v1');
    expect(tit.map(t=>t.valor)).toEqual([2000,2000]);
  });

  it('não aceita desconto maior ou igual ao total',async()=>{
    formOp('vendas','v1');campo('desconto','5000');
    await expect(salvarModal()).rejects.toThrow(/menor que o total/);
  });

  it('preço médio por material já considera o desconto',()=>{
    const v={itens:[item('PP Moído','Preto',1000,5),item('PP Granulado','Verde',1000,5)],desconto:1000,total:9000};
    expect(fatorDesc(v)).toBeCloseTo(0.9);
    const pm=porMaterial([v]);
    expect(pm.find(m=>m.tipo==='PP Moído').medio).toBeCloseTo(4.5);
    expect(pm.reduce((a,m)=>a+m.total,0)).toBeCloseTo(9000);
  });
});

describe('desconto no orçamento',()=>{
  beforeEach(()=>montar({...base(),orcamentos:[{id:'o1',numero:3,data:'2026-10-19',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:4800,totalMat:5000,desconto:200,descontoPct:''}]}));
  it('passa para a venda quando o orçamento vira venda',async()=>{
    formOp('vendas',null,{orcId:'o1'});
    expect($('#modalRoot form').elements.desconto.value).toBe('200');
    await salvarModal();
    const v=S.vendas.find(x=>x.orcamentoId==='o1');
    expect(v).toMatchObject({desconto:200,total:4800});
  });
});
