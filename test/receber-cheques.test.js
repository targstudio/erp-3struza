import {describe,it,expect,beforeEach} from 'vitest';
import {UI} from '../src/estado.js';
import {vTitulos} from '../src/telas/titulos.js';
import {montar,conta} from './ajuda.js';
import {addDays,today} from '../src/util.js';

const hoje=today(),mes=hoje.slice(0,7);
const chq=(id,extra)=>({id,tipo:'entrada',valor:1000,contaId:'gaveta',data:hoje,meio:'cheque',cheque:{titular:'proprio',banco:'Itaú',numero:'7',bomPara:hoje},pendente:true,venceEm:hoje,parceiroId:'cli',descricao:'Venda 1 · Cliente X (Cheque)',ref:{col:'vendas',id:'v1'},...extra});
const base=extra=>({contas:[conta('gaveta',0,{tipo:'gaveta'})],parceiros:[{id:'cli',nome:'Cliente X',cliente:true}],...extra});
const ver=()=>{UI.mes=mes;UI.busca='';return vTitulos('receber').html};

describe('cheques em contas a receber',()=>{
  beforeEach(()=>{UI.filtroT='todos'});

  it('venda paga em cheque aparece como a receber até compensar',()=>{
    montar(base({movimentos:[chq('m1',{venceEm:addDays(hoje,0),cheque:{titular:'proprio',banco:'Itaú',numero:'7',bomPara:hoje}})]}));
    const h=ver();
    expect(h).toMatch(/Venda 1 · Cliente X/);expect(h).toMatch(/Venceu · confirmar/);expect(h).toMatch(/data-act="chqOk" data-id="m1"/);
    UI.filtroT='atrasado';expect(ver()).toMatch(/data-id="m1"/);
  });

  it('cheque emitido não aparece em contas a receber',()=>{
    montar(base({movimentos:[chq('m1',{tipo:'saida'})]}));
    expect(ver()).not.toMatch(/data-id="m1"/);
    UI.mes=mes;expect(vTitulos('pagar').html).toMatch(/data-id="m1"/);
  });

  it('conta baixada com cheque que não compensou continua em aberto',()=>{
    montar(base({titulos:[{id:'t1',lado:'receber',descricao:'Parcela',valor:1000,vencimento:hoje,pago:true,pagoEm:hoje,parceiroId:'cli'}],
      movimentos:[chq('m1',{ref:{col:'titulos',id:'t1'},venceEm:addDays(hoje,10)})]}));
    const h=ver();
    expect(h).toMatch(/Cheque a compensar/);expect((h.match(/data-id="m1"/g)||[]).length).toBe(1);
    UI.filtroT='aberto';expect(ver()).toMatch(/Parcela/);
    UI.filtroT='pago';expect(ver()).not.toMatch(/Parcela/);
  });
});
