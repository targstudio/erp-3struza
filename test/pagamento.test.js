import {describe,it,expect} from 'vitest';
import {pgCollect} from '../src/forms/pagamento.js';

const linha=(contaId,valor,meio='pix',extra={})=>({contaId,valor,meio,...extra});

describe('pgCollect: formas de pagamento de uma operação',()=>{
  it('a linha em branco fica com o restante',()=>{
    const r=pgCollect([linha('a','300,00'),linha('b','','dinheiro')],1000,'ao total');
    expect(r).toEqual([{meio:'pix',contaId:'a',valor:300},{meio:'dinheiro',contaId:'b',valor:700}]);
  });
  it('uma linha só, em branco, recebe o total',()=>{
    expect(pgCollect([linha('a','')],250.75,'ao total')).toEqual([{meio:'pix',contaId:'a',valor:250.75}]);
  });
  it('a soma precisa bater com o total',()=>{
    expect(()=>pgCollect([linha('a','100'),linha('b','100')],300,'ao total')).toThrow(/precisa ser igual ao total/);
  });
  it('só uma linha pode ficar em branco',()=>{
    expect(()=>pgCollect([linha('a',''),linha('b','')],300,'ao total')).toThrow(/só uma em branco/);
  });
  it('toda linha precisa de conta e de valor positivo',()=>{
    expect(()=>pgCollect([linha('','')],300,'ao total')).toThrow(/Cadastre uma conta/);
    expect(()=>pgCollect([linha('a','300'),linha('b','')],300,'ao total')).toThrow(/maior que zero/);
  });
  it('cheque de terceiro exige o nome do titular e guarda os dados',()=>{
    expect(()=>pgCollect([linha('a','','cheque',{cheque:{titular:'terceiro',nome:' '}})],100,'ao total')).toThrow(/titular/);
    const [pg]=pgCollect([linha('a','','cheque',{cheque:{titular:'terceiro',nome:' João ',banco:'Itaú',numero:'123',bomPara:'2026-11-10'}})],100,'ao total');
    expect(pg.cheque).toEqual({titular:'terceiro',nome:'João',banco:'Itaú',numero:'123',bomPara:'2026-11-10'});
  });
});
