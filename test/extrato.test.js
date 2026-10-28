import {describe,it,expect,beforeEach} from 'vitest';
import {UI} from '../src/estado.js';
import {extratoCaixa} from '../src/impressos.js';
import {montar,conta} from './ajuda.js';

const doc=()=>document.querySelector('#impFrame').srcdoc;
describe('extrato dos caixas para apresentar',()=>{
  beforeEach(()=>{montar({contas:[conta('a',1000),conta('b',500)],movimentos:[
    {id:'m0',tipo:'entrada',valor:200,contaId:'a',data:'2026-09-10',descricao:'Antes'},
    {id:'m1',tipo:'entrada',valor:300,contaId:'a',data:'2026-10-05',descricao:'Venda X'},
    {id:'m2',tipo:'saida',valor:100,contaId:'b',data:'2026-10-06',descricao:'Frete'},
    {id:'m3',tipo:'transferencia',valor:400,contaId:'a',contaDestinoId:'b',data:'2026-10-07',descricao:'Transf'}]});
    Object.assign(UI,{per:'mes',mes:'2026-10',filtroConta:''})});
  it('geral: saldo inicial, entradas, saídas e final sem contar transferência',()=>{
    extratoCaixa();const h=doc();
    expect(h).toContain('Extrato geral dos caixas');
    expect(h).toMatch(/Saldo inicial<\/span><b>R\$\s1\.700,00/);
    expect(h).toMatch(/Saldo final<\/span><b>R\$\s1\.900,00/);
    expect(h).toContain('Posição de cada caixa');
  });
  it('um caixa: transferência entra como saída',()=>{
    UI.filtroConta='a';extratoCaixa();const h=doc();
    expect(h).toMatch(/Saldo inicial<\/span><b>R\$\s1\.200,00/);
    expect(h).toMatch(/Saldo final<\/span><b>R\$\s1\.100,00/);
  });
});
