import {describe,it,expect,beforeEach} from 'vitest';
import {UI} from '../src/estado.js';
import {vTitulos} from '../src/telas/titulos.js';
import {pgDetalhe,pgLinhaDet} from '../src/telas/pagresumo.js';
import {montar,conta} from './ajuda.js';

const chq=(nome,numero,valor,bomPara)=>({meio:'cheque',contaId:'g',valor,cheque:{titular:'terceiro',nome,banco:'BB',numero,bomPara}});
const pags=[{meio:'pix',contaId:'b',valor:110.13},chq('Torres Ltda','1',1317.5,'2026-11-20'),chq('F F Embalagens','2',5321.41,'2026-11-25')];
const titulo={id:'t1',lado:'receber',descricao:'Venda',valor:6749.04,vencimento:'2026-10-30',parcela:1,totalParcelas:1,grupo:'g',pago:true,pagoEm:'2026-11-03',pagamentos:pags};
const mov=(id,p,extra)=>({id,tipo:'entrada',data:'2026-11-03',valor:p.valor,contaId:p.contaId,meio:p.meio,cheque:p.cheque||null,ref:{col:'titulos',id:'t1'},...extra});

describe('resumo das formas de pagamento',()=>{
  beforeEach(()=>{montar({contas:[conta('b'),conta('g',0,{nome:'Gaveta'})],titulos:[titulo],
    movimentos:[mov('m1',pags[0]),mov('m2',pags[1],{compensadoEm:'2026-11-10',data:'2026-11-10',contaId:'b'}),mov('m3',pags[2],{pendente:true,venceEm:'2099-01-01'})]});UI.pgAbertos=new Set();UI.mes='2026-10'});

  it('mostra uma linha agrupada, sem listar cada cheque',()=>{
    const h=pgDetalhe('t1',pags,false);
    expect(h).toMatch(/PIX <b>R\$\s?110,13<\/b>/);
    expect(h).toMatch(/2 cheques <b>R\$\s?6\.638,91<\/b>/);
    expect(h).toMatch(/1 a compensar/);
    expect(h).not.toMatch(/Torres/);
  });

  it('ao abrir, lista cada forma com emitente, bom para e situação',()=>{
    expect(pgLinhaDet('t1',pags,false,7)).toBe('');UI.pgAbertos.add('t1');const h=pgLinhaDet('t1',pags,false,7);
    expect(h).toMatch(/Torres Ltda/);expect(h).toMatch(/Compensado/);expect(h).toMatch(/A compensar/);expect(h).toMatch(/01\/01\/2099/);
  });

  it('pagamento único sem cheque continua simples',()=>{
    expect(pgDetalhe('t1',[pags[0]],false)).toBe('PIX · Conta b');
  });

  it('aparece na tela de contas a receber',()=>{
    UI.filtroT='todos';expect(vTitulos('receber').html).toMatch(/ver detalhes/);
    UI.pgAbertos.add('t1');expect(vTitulos('receber').html).toMatch(/class="pg-row"[\s\S]*Torres Ltda/);
  });
});
