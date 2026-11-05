import {describe,it,expect,beforeEach} from 'vitest';
import {S} from '../src/dados.js';
import {formBaixa} from '../src/forms/titulo.js';
import {formOp} from '../src/forms/operacao.js';
import {pgCollect} from '../src/forms/pagamento.js';
import {chequesVencidos,comCheque,desfazerCompensacao,formCompensar,formReprogramar,statusCheque} from '../src/cheques.js';
import {caixaPrevisto,saldoConta} from '../src/regras.js';
import {vCheques} from '../src/telas/cheques.js';
import {addDays,today} from '../src/util.js';
import {montar,conta,item,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const muda=(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
const hoje=today();

const base=()=>({contas:[conta('banco',0),conta('gaveta',0,{tipo:'gaveta'})],parceiros:[{id:'cli',nome:'Cliente X',cliente:true}],
  titulos:[{id:'t1',lado:'receber',descricao:'Parcela da venda',valor:1000,vencimento:hoje,parcela:1,totalParcelas:1,grupo:'g',pago:false,parceiroId:'cli'}]});

async function receberEmCheque(bomPara){
  formBaixa('t1');
  muda($('#pgRows [data-pk=meio]'),'cheque');
  muda($('#pgRows [data-ck=numero]'),'000123');
  if(bomPara)muda($('#pgRows [data-ck=bomPara]'),bomPara);
  await salvarModal();
  return S.movimentos.find(m=>m.ref?.id==='t1');
}

describe('cheque recebido',()=>{
  beforeEach(()=>montar(base()));

  it('pede o vencimento do cheque',async()=>{
    await expect(receberEmCheque('')).rejects.toThrow(/vencimento/);
    expect(()=>pgCollect([{contaId:'a',valor:'',meio:'cheque',cheque:{titular:'proprio'}}],100,'ao total')).toThrow(/vencimento/);
  });

  it('fica a compensar, fora do saldo, e acende o alerta no vencimento',async()=>{
    const m=await receberEmCheque(addDays(hoje,10));
    expect(m).toMatchObject({pendente:true,venceEm:addDays(hoje,10),contaId:'gaveta'});
    expect(S.titulos[0].pago).toBe(true);
    expect(saldoConta('gaveta')).toBe(0);
    expect(statusCheque(m)).toBe('aguardando');
    expect(chequesVencidos()).toHaveLength(0);
    expect(chequesVencidos(addDays(hoje,10))).toHaveLength(1);
    // previsão de caixa conta o cheque no dia do vencimento
    const p=caixaPrevisto(30,hoje);expect(p[10].ent).toBe(1000);expect(p[9].saldo).toBe(0);expect(p[10].saldo).toBe(1000);
  });

  it('compensado: entra no caixa escolhido na data da compensação; dá para desfazer',async()=>{
    const m=await receberEmCheque(hoje);
    expect(chequesVencidos()).toHaveLength(1);
    formCompensar(m.id);muda($('#modalRoot [name=contaId]'),'banco');await salvarModal();
    const c=S.movimentos.find(x=>x.id===m.id);
    expect(c.pendente).toBeUndefined();
    expect(c).toMatchObject({compensadoEm:hoje,data:hoje,contaId:'banco',contaOrig:'gaveta'});
    expect(saldoConta('banco')).toBe(1000);expect(saldoConta('gaveta')).toBe(0);
    expect(chequesVencidos()).toHaveLength(0);
    await desfazerCompensacao(m.id);
    expect(S.movimentos.find(x=>x.id===m.id)).toMatchObject({pendente:true,contaId:'gaveta'});
    expect(saldoConta('banco')).toBe(0);
  });

  it('não compensou: novo prazo reinicia a contagem e guarda o histórico',async()=>{
    const m=await receberEmCheque(hoje);
    formReprogramar(m.id);muda($('#modalRoot [name=para]'),addDays(hoje,5));await salvarModal();
    const c=S.movimentos.find(x=>x.id===m.id);
    expect(c).toMatchObject({pendente:true,venceEm:addDays(hoje,5)});
    expect(c.prazos).toEqual([{de:hoje,para:addDays(hoje,5),em:hoje,motivo:'Não compensou'}]);
    expect(chequesVencidos()).toHaveLength(0);
    expect(chequesVencidos(addDays(hoje,5))).toHaveLength(1);
    expect(vCheques().html).toMatch(/reprogramado 1×/);
  });

  it('novo prazo no passado não é aceito',async()=>{
    const m=await receberEmCheque(hoje);
    formReprogramar(m.id);muda($('#modalRoot [name=para]'),addDays(hoje,-1));
    await expect(salvarModal()).rejects.toThrow(/passado/);
  });
});

describe('editar a venda paga em cheque',()=>{
  const venda={id:'v1',numero:1,data:'2026-10-20',parceiroId:'cli',itens:[item('PP Moído','Preto',100,5)],total:500,totalMat:500,forma:'cheque',contaId:'gaveta',
    pagamentos:[{meio:'cheque',contaId:'gaveta',valor:500,cheque:{titular:'proprio',nome:'',banco:'',numero:'1',bomPara:'2026-11-01'}}],entrada:0,parcelas:0,frete:null,impostoPct:0};
  const mov=extra=>({id:'mv1',tipo:'entrada',valor:500,contaId:'gaveta',data:'2026-10-20',meio:'cheque',cheque:venda.pagamentos[0].cheque,ref:{col:'vendas',id:'v1'},...extra});
  const compra={id:'c1',numero:1,data:'2026-09-01',parceiroId:'cli',total:1000,forma:'pix',itens:[item('PP Moído','Preto',500,2)]};

  it('mantém o prazo reprogramado',async()=>{
    montar({...base(),compras:[compra],vendas:[venda],movimentos:[mov({pendente:true,venceEm:addDays(hoje,3),prazos:[{de:'2026-11-01',para:addDays(hoje,3)}]})]});
    formOp('vendas','v1');await salvarModal();
    expect(S.movimentos.find(m=>m.id==='mv1')).toMatchObject({pendente:true,venceEm:addDays(hoje,3)});
  });

  it('mantém a compensação (data e caixa)',async()=>{
    montar({...base(),compras:[compra],vendas:[venda],movimentos:[mov({compensadoEm:'2026-11-02',data:'2026-11-02',contaId:'banco'})]});
    formOp('vendas','v1');await salvarModal();
    const m=S.movimentos.find(m=>m.id==='mv1');
    expect(m.pendente).toBeUndefined();expect(m).toMatchObject({compensadoEm:'2026-11-02',data:'2026-11-02',contaId:'banco'});
    expect(saldoConta('banco')).toBe(500);
  });

  it('trocar o cheque por PIX tira o lançamento da lista de cheques',()=>{
    const r=comCheque({...mov(),meio:'pix',cheque:null},mov({pendente:true,venceEm:hoje}));
    expect(r.pendente).toBeUndefined();expect(r.venceEm).toBeUndefined();
  });

  it('lançamentos antigos em cheque (de antes desta função) continuam no saldo',()=>{
    montar({...base(),movimentos:[mov()]});
    expect(saldoConta('gaveta')).toBe(500);
    expect(chequesVencidos()).toHaveLength(0);
  });
});
