import {describe,it,expect,beforeEach} from 'vitest';
import {S} from '../src/dados.js';
import {formOp} from '../src/forms/operacao.js';
import {formAdiant} from '../src/forms/adiantamento.js';
import {recibo,romaneio,orcamento} from '../src/impressos.js';
import {creditoCliente,statusOrc} from '../src/regras.js';
import {montar,conta,item,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const campo=(nome,valor)=>{const f=$('#modalRoot form');const el=f.elements[nome];
  if(el instanceof RadioNodeList){[...el].forEach(r=>r.checked=r.value===valor);[...el].find(r=>r.checked).dispatchEvent(new Event('change',{bubbles:true}))}
  else{el.value=valor;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}};
const preto=()=>{const el=$('#itRows select[data-k="cor"]');el.value='Preto';el.dispatchEvent(new Event('change',{bubbles:true}))};
const preco=v=>{preto();const el=$('#itRows input[data-k="precoKg"]');el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))};
const impresso=()=>$('#impFrame').srcdoc;

const base=()=>({
  contas:[conta('banco',0),conta('gaveta',0,{tipo:'gaveta'})],
  parceiros:[{id:'cli',nome:'Cliente X',cliente:true,fornecedor:false}],
  compras:[{id:'c1',numero:1,data:'2026-09-01',parceiroId:'cli',total:10000,forma:'pix',itens:[item('PP Moído','Preto',5000,2)]}],
});

describe('orçamento',()=>{
  beforeEach(()=>montar(base()));

  it('salva sem mexer no estoque nem no caixa',async()=>{
    formOp('orcamentos');campo('parceiroId','cli');preco('5');campo('condicao','PIX à vista');
    await salvarModal();
    expect(S.orcamentos).toHaveLength(1);
    expect(S.orcamentos[0]).toMatchObject({numero:1,parceiroId:'cli',total:5000,condicao:'PIX à vista'});
    expect(S.vendas).toHaveLength(0);expect(S.movimentos).toHaveLength(0);expect(S.titulos).toHaveLength(0);
  });

  it('vira venda com os mesmos itens e fica marcado como vendido',async()=>{
    S.orcamentos.push({id:'o1',numero:3,data:'2026-10-01',validade:'2026-10-08',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:5000,totalKg:1000,impostoPct:0});
    expect(statusOrc(S.orcamentos[0],'2026-10-30')).toBe('vencido');
    formOp('vendas',null,{orcId:'o1'});
    await salvarModal();
    expect(S.vendas).toHaveLength(1);
    expect(S.vendas[0]).toMatchObject({parceiroId:'cli',total:5000,orcamentoId:'o1'});
    expect(S.vendas[0].itens[0]).toMatchObject({tipo:'PP Moído',cor:'Preto',kg:1000,precoKg:5});
    expect(S.orcamentos[0].vendaId).toBe(S.vendas[0].id);
    expect(statusOrc(S.orcamentos[0])).toBe('vendido');
    expect(S.movimentos.filter(m=>m.tipo==='entrada').reduce((a,m)=>a+m.valor,0)).toBe(5000);
  });

  it('imprime com preços e total',()=>{
    S.orcamentos.push({id:'o1',numero:3,data:'2026-10-01',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:5000,totalKg:1000});
    orcamento('o1');
    expect(impresso()).toContain('Orçamento nº 3');
    expect(impresso()).toContain('R$/kg');
    expect(impresso()).toMatch(/5\.000,00/);
  });
});

describe('adiantamento de cliente',()=>{
  beforeEach(()=>montar(base()));

  it('entra no caixa e vira crédito do cliente',async()=>{
    formAdiant();campo('parceiroId','cli');campo('valor','1.000,00');
    await salvarModal();
    expect(S.adiantamentos).toHaveLength(1);
    const a=S.adiantamentos[0];
    expect(a).toMatchObject({tipo:'entrada',valor:1000,parceiroId:'cli',numero:1});
    const m=S.movimentos.filter(m=>m.ref?.col==='adiantamentos');
    expect(m).toHaveLength(1);expect(m[0]).toMatchObject({tipo:'entrada',valor:1000,categoria:'Adiantamento de cliente'});
    expect(creditoCliente('cli')).toBe(1000);
  });

  it('abate parte da venda e o caixa recebe só o restante',async()=>{
    S.adiantamentos.push({id:'a1',numero:1,tipo:'entrada',data:'2026-10-01',parceiroId:'cli',valor:1000});
    formOp('vendas');campo('parceiroId','cli');preco('5');
    expect($('#adBox').hidden).toBe(false);
    campo('usoAdiant','1000');
    await salvarModal();
    const v=S.vendas[0];
    expect(v).toMatchObject({total:5000,usoAdiant:1000,forma:'pix'});
    expect(S.movimentos.filter(m=>m.ref?.col==='vendas').map(m=>m.valor)).toEqual([4000]);
    expect(creditoCliente('cli')).toBe(0);
    recibo('vendas',v.id);
    expect(impresso()).toContain('Abatido do adiantamento');
  });

  it('venda paga toda com crédito não lança nada no caixa',async()=>{
    S.adiantamentos.push({id:'a1',numero:1,tipo:'entrada',data:'2026-10-01',parceiroId:'cli',valor:6000});
    formOp('vendas');campo('parceiroId','cli');preco('5');
    $('#usoTudo').click();
    await salvarModal();
    expect(S.vendas[0]).toMatchObject({usoAdiant:5000,forma:'adiantamento',pagamentos:[]});
    expect(S.movimentos.filter(m=>m.ref?.col==='vendas')).toHaveLength(0);
    expect(creditoCliente('cli')).toBe(1000);
  });

  it('não deixa usar mais crédito do que o cliente tem',async()=>{
    S.adiantamentos.push({id:'a1',numero:1,tipo:'entrada',data:'2026-10-01',parceiroId:'cli',valor:500});
    formOp('vendas');campo('parceiroId','cli');preco('5');campo('usoAdiant','800');
    await expect(salvarModal()).rejects.toThrow(/só tem/);
  });

  it('devolução tira do caixa e diminui o crédito, sem passar do saldo',async()=>{
    S.adiantamentos.push({id:'a1',numero:1,tipo:'entrada',data:'2026-10-01',parceiroId:'cli',valor:500});
    formAdiant(null,{tipo:'devolucao',parceiroId:'cli'});campo('valor','800');
    await expect(salvarModal()).rejects.toThrow(/só/);
    campo('valor','200');await salvarModal();
    expect(S.movimentos.find(m=>m.ref?.col==='adiantamentos')).toMatchObject({tipo:'saida',valor:200});
    expect(creditoCliente('cli')).toBe(300);
  });
});

describe('impressos da venda',()=>{
  beforeEach(()=>montar({...base(),vendas:[{id:'v1',numero:1,seqDia:1,data:'2026-10-20',parceiroId:'cli',itens:[item('PP Moído','Preto',2000,5,{embalagem:'bigbag',qtd:2,pesoUn:1000})],total:10000,totalKg:2000,forma:'pix',frete:{tipo:'fob',valor:350}}]}));

  it('recibo mostra produto, cor e quantidade em colunas',()=>{
    recibo('vendas','v1');const h=impresso();
    for(const t of ['<th>Produto</th>','<th>Cor</th>','<th class="r">Qtd.</th>','<td>PP Moído</td>','<td>Preto</td>'])expect(h).toContain(t);
  });

  it('romaneio de transporte não mostra valores em R$',()=>{
    romaneio('v1');const h=impresso();
    expect(h).toContain('Romaneio de transporte');
    expect(h).not.toContain('R$');
  });
});

describe('duas vias',()=>{
  beforeEach(()=>montar({...base(),vendas:[{id:'v1',numero:1,seqDia:1,data:'2026-10-20',parceiroId:'cli',itens:[item('PP Moído','Preto',1000,5)],total:5000,totalKg:1000,forma:'pix'}]}));
  it('romaneio e recibo saem com via da 3STRUZA e via do cliente, cada uma com assinatura',()=>{
    for(const abrir of [()=>romaneio('v1'),()=>recibo('vendas','v1')]){abrir();const h=impresso();
      expect(h).toContain('1ª via · 3STRUZA');expect(h).toContain('2ª via · Cliente');
      expect(h.match(/assinatura · data/g)).toHaveLength(2)}
  });
});
