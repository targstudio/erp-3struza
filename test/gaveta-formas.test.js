import {describe,it,expect,beforeEach} from 'vitest';
import {S} from '../src/dados.js';
import {formBaixa} from '../src/forms/titulo.js';
import {formMov} from '../src/forms/movimento.js';
import {pgCollect} from '../src/forms/pagamento.js';
import {chequesVencidos,dadosVencidos,formDadosCheque,recebidosPorConta,statusCheque,tipoRecebimento} from '../src/cheques.js';
import {saldoConta} from '../src/regras.js';
import {vCaixa} from '../src/telas/caixa.js';
import {vCheques} from '../src/telas/cheques.js';
import {vPainel} from '../src/telas/painel.js';
import {UI} from '../src/estado.js';
import {addDays,today} from '../src/util.js';
import {montar,conta,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const muda=(el,v)=>{if(el.type==='checkbox')el.checked=v;else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
const hoje=today();

const base=()=>({contas:[conta('banco',0),conta('gaveta',0,{tipo:'gaveta',nome:'Gaveta loja'})],parceiros:[{id:'cli',nome:'Cliente X',cliente:true}],
  titulos:[{id:'t1',lado:'receber',descricao:'Venda 1',valor:1000,vencimento:hoje,parcela:1,totalParcelas:1,grupo:'g',pago:false,parceiroId:'cli'}]});

describe('cheque que ainda não chegou',()=>{
  beforeEach(()=>montar(base()));

  async function receberSemDados(prazo){
    formBaixa('t1');
    muda($('#pgRows [data-pk=meio]'),'cheque');
    muda($('#pgRows [data-ck=semDados]'),true);
    // ao marcar, sugere um prazo de 3 dias e esconde banco e número
    expect($('#pgRows [data-ck=prazoDados]').value).toBe(addDays(hoje,3));
    expect($('#pgRows [data-ck=numero]')).toBeNull();
    if(prazo!==undefined)muda($('#pgRows [data-ck=prazoDados]'),prazo);
    await salvarModal();
    return S.movimentos.find(m=>m.ref?.id==='t1');
  }

  it('registra o recebimento sem banco, número e bom para, mas exige o prazo',async()=>{
    expect(()=>pgCollect([{contaId:'g',valor:'',meio:'cheque',cheque:{titular:'proprio',semDados:true}}],100,'ao total')).toThrow(/prazo/);
    const m=await receberSemDados();
    expect(m).toMatchObject({pendente:true,contaId:'gaveta',meio:'cheque'});
    expect(m.cheque).toMatchObject({semDados:true,prazoDados:addDays(hoje,3),banco:'',numero:''});
    expect(m.descricao).toMatch(/dados pendentes até/);
    expect(S.titulos[0].pago).toBe(true);
    expect(saldoConta('gaveta')).toBe(0);
    expect(statusCheque(m)).toBe('semDados');
    expect(chequesVencidos(addDays(hoje,30))).toHaveLength(0); // sem dados não pede para confirmar compensação
    expect(dadosVencidos()).toHaveLength(0);
    expect(dadosVencidos(addDays(hoje,3))).toHaveLength(1);
  });

  it('no prazo acende o alerta e o botão Registrar dados',async()=>{
    const m=await receberSemDados(hoje);
    expect(statusCheque(m)).toBe('dadosVencidos');
    expect(vCheques().html).toMatch(/sem os dados e o prazo chegou/);
    expect(vCheques().html).toMatch(/data-act="chqDados"/);
    expect(vPainel().html).toMatch(/sem os dados registrados/);
  });

  it('registrar os dados depois atualiza o cheque, o vencimento e o pagamento da conta',async()=>{
    const m=await receberSemDados();
    formDadosCheque(m.id);
    muda($('#modalRoot [name=banco]'),'Itaú');muda($('#modalRoot [name=numero]'),'000777');muda($('#modalRoot [name=bomPara]'),addDays(hoje,20));
    await salvarModal();
    const c=S.movimentos.find(x=>x.id===m.id);
    expect(c.cheque).toEqual({titular:'proprio',nome:'',banco:'Itaú',numero:'000777',bomPara:addDays(hoje,20)});
    expect(c).toMatchObject({pendente:true,venceEm:addDays(hoje,20)});
    expect(c.descricao).toMatch(/nº 000777 Itaú/);expect(c.descricao).not.toMatch(/pendentes/);
    expect(statusCheque(c)).toBe('aguardando');
    expect(S.titulos[0].pagamentos[0].cheque).toMatchObject({numero:'000777',banco:'Itaú'});
    expect(chequesVencidos(addDays(hoje,20))).toHaveLength(1);
  });

  it('não salva os dados sem banco, número e bom para',async()=>{
    const m=await receberSemDados();
    formDadosCheque(m.id);muda($('#modalRoot [name=banco]'),'Itaú');
    await expect(salvarModal()).rejects.toThrow(/número/);
  });
});

describe('formas de recebimento por gaveta',()=>{
  const d='2026-11-10';
  const mv=(id,extra)=>({id,tipo:'entrada',data:d,contaId:'gaveta',valor:100,descricao:'x',...extra});
  const dados=()=>({...base(),movimentos:[
    mv('a',{meio:'dinheiro',valor:50}),
    mv('b',{meio:'cheque',pendente:true,cheque:{bomPara:d},valor:200}),
    mv('c',{meio:'cheque',pendente:true,cheque:{bomPara:'2026-12-10'},valor:300}),
    mv('d',{meio:'cartao',valor:400}),
    mv('e',{meio:'cheque',pendente:true,cheque:{semDados:true,prazoDados:'2026-11-13'},valor:60}),
    // cheque compensado depois no banco: conta na gaveta e no dia em que foi recebido
    mv('f',{meio:'cheque',cheque:{bomPara:'2026-11-12'},compensadoEm:'2026-11-12',data:'2026-11-12',contaId:'banco',dataOrig:d,contaOrig:'gaveta',valor:70}),
    mv('g',{meio:'pix',contaId:'banco',valor:999}),
    mv('h',{valor:5}),
    {id:'s',tipo:'saida',data:d,contaId:'gaveta',valor:30,meio:'dinheiro'},
    {id:'t',tipo:'transferencia',data:d,contaId:'gaveta',contaDestinoId:'banco',valor:10}]});
  beforeEach(()=>montar(dados()));

  it('classifica dinheiro, cheque à vista, cheque a prazo e cartão de crédito',()=>{
    const t=id=>tipoRecebimento(S.movimentos.find(m=>m.id===id));
    expect(['a','b','c','d','e','f','g','h'].map(t)).toEqual(['dinheiro','chequeVista','chequePrazo','cartao','chequeSemDados','chequePrazo','pix','outro']);
  });

  it('soma o que cada caixa recebeu por forma, só entradas',()=>{
    const r=recebidosPorConta('2026-11-01','2026-11-30');
    const g=r.get('gaveta');
    expect(g.total).toBe(50+200+300+400+60+70+5);
    expect(g.tipos.dinheiro.valor).toBe(50);
    expect(g.tipos.chequeVista).toMatchObject({valor:200,pendente:200});
    expect(g.tipos.chequePrazo).toMatchObject({valor:370,pendente:300,n:2});
    expect(g.tipos.cartao.valor).toBe(400);
    expect(r.get('banco').tipos).toEqual({pix:{valor:999,n:1,pendente:0}});
  });

  it('mostra as etiquetas em cada caixa e filtra o extrato pela forma',()=>{
    UI.per='mes';UI.mes='2026-11';UI.filtroConta='';UI.busca='';UI.filtroForma='';
    const h=vCaixa().html;
    expect(h).toMatch(/tg-dinheiro"[^>]*>Dinheiro <span class="v">R\$\s?50,00/);
    expect(h).toMatch(/Cheque à vista/);expect(h).toMatch(/Cheque a prazo/);expect(h).toMatch(/Cartão de crédito/);
    UI.filtroForma='cartao';
    const f=vCaixa().html;const corpo=f.slice(f.indexOf('<tbody>'));
    expect(corpo).toMatch(/tg-cartao/);expect(corpo).not.toMatch(/tg-dinheiro/);
    UI.filtroForma='';
  });

  it('entrada manual guarda a forma de recebimento',async()=>{
    formMov('entrada');
    muda($('#modalRoot [name=valor]'),'80');muda($('#modalRoot [name=descricao]'),'Venda balcão');muda($('#modalRoot [name=contaId]'),'gaveta');muda($('#modalRoot [name=meio]'),'cartao');
    await salvarModal();
    const m=S.movimentos.find(x=>x.descricao==='Venda balcão');
    expect(m.meio).toBe('cartao');expect(tipoRecebimento(m)).toBe('cartao');
  });
});

describe('editar cheque a compensar',()=>{
  const ch={titular:'proprio',nome:'',banco:'',numero:'',bomPara:'2026-11-20'};
  const venda={id:'v1',numero:1,data:'2026-11-10',parceiroId:'cli',itens:[],total:500,forma:'cheque',contaId:'gaveta',pagamentos:[{meio:'cheque',contaId:'gaveta',valor:500,cheque:ch}]};
  const mov=extra=>({id:'mv1',tipo:'entrada',valor:500,contaId:'gaveta',data:'2026-11-10',meio:'cheque',cheque:ch,pendente:true,venceEm:'2026-11-20',descricao:'Venda 1 (Cheque do cliente · bom para 20/11/2026)',ref:{col:'vendas',id:'v1'},...extra});

  it('completa banco e número e muda o bom para, na venda também',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov()]});
    expect(vCheques().html).toMatch(/data-act="chqDados" data-id="mv1">Editar/);
    formDadosCheque('mv1');
    muda($('#modalRoot [name=banco]'),'Caixa');muda($('#modalRoot [name=numero]'),'851');muda($('#modalRoot [name=bomPara]'),'2026-12-05');
    await salvarModal();
    const m=S.movimentos[0];
    expect(m.cheque).toMatchObject({banco:'Caixa',numero:'851',bomPara:'2026-12-05'});
    expect(m).toMatchObject({pendente:true,venceEm:'2026-12-05'});
    expect(m.descricao).toBe('Venda 1 (Cheque do cliente nº 851 Caixa · bom para 05/12/2026)');
    expect(S.vendas[0].pagamentos[0].cheque).toMatchObject({banco:'Caixa',numero:'851',bomPara:'2026-12-05'});
  });

  it('com o mesmo bom para mantém o prazo reprogramado',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov({venceEm:'2026-11-27',prazos:[{de:'2026-11-20',para:'2026-11-27'}]})]});
    formDadosCheque('mv1');muda($('#modalRoot [name=numero]'),'9');await salvarModal();
    expect(S.movimentos[0]).toMatchObject({venceEm:'2026-11-27'});expect(S.movimentos[0].prazos).toHaveLength(1);
  });
});
