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
import {montar,conta,item,salvarModal} from './ajuda.js';

const $=s=>document.querySelector(s);
const muda=(el,v)=>{if(el.type==='checkbox')el.checked=v;else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
const hoje=today();
const ck=k=>$('#pgRows [data-ck='+k+']');

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
    formDadosCheque(m.id);muda(ck('semDados'),false);
    muda(ck('banco'),'Itaú');muda(ck('numero'),'000777');muda(ck('bomPara'),addDays(hoje,20));
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
    formDadosCheque(m.id);muda(ck('semDados'),false);muda(ck('banco'),'Itaú');muda(ck('bomPara'),addDays(hoje,20));
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
    muda(ck('banco'),'Caixa');muda(ck('numero'),'851');muda(ck('bomPara'),'2026-12-05');
    await salvarModal();
    const m=S.movimentos[0];
    expect(m.cheque).toMatchObject({banco:'Caixa',numero:'851',bomPara:'2026-12-05'});
    expect(m).toMatchObject({pendente:true,venceEm:'2026-12-05'});
    expect(m.descricao).toBe('Venda 1 (Cheque do cliente nº 851 Caixa · bom para 05/12/2026)');
    expect(S.vendas[0].pagamentos[0].cheque).toMatchObject({banco:'Caixa',numero:'851',bomPara:'2026-12-05'});
  });

  it('com o mesmo bom para mantém o prazo reprogramado',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov({venceEm:'2026-11-27',prazos:[{de:'2026-11-20',para:'2026-11-27'}]})]});
    formDadosCheque('mv1');muda(ck('numero'),'9');await salvarModal();
    expect(S.movimentos[0]).toMatchObject({venceEm:'2026-11-27'});expect(S.movimentos[0].prazos).toHaveLength(1);
  });
});

describe('dividir o cheque em vários cheques e outras formas',()=>{
  const ch={titular:'proprio',nome:'',banco:'',numero:'',bomPara:'',semDados:true,prazoDados:'2026-11-20'};
  const venda={id:'v1',numero:1,data:'2026-11-10',parceiroId:'cli',itens:[],total:3000,forma:'cheque',contaId:'gaveta',pagamentos:[{meio:'cheque',contaId:'gaveta',valor:3000,cheque:ch}]};
  const mov={id:'mv1',tipo:'entrada',valor:3000,contaId:'gaveta',data:'2026-11-10',meio:'cheque',cheque:ch,pendente:true,venceEm:'2026-11-20',descricao:'Venda 1 · Cliente X (Cheque do cliente · dados pendentes até 20/11/2026)',ref:{col:'vendas',id:'v1'},parceiroId:'cli'};
  const linha=i=>$(`#pgRows [data-pg="${i}"]`);
  const set=(i,k,v)=>muda(linha(i).querySelector(`[data-pk=${k}],[data-ck=${k}]`),v);

  it('2 cheques + PIX: um lançamento por parte e a venda fica com as 3 formas',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov]});
    formDadosCheque('mv1');
    set(0,'semDados',false);set(0,'banco','Itaú');set(0,'numero','1');set(0,'bomPara','2026-12-01');set(0,'valor','1000');
    $('#addPg').click();set(1,'meio','cheque');set(1,'banco','Itaú');set(1,'numero','2');set(1,'bomPara','2027-01-01');set(1,'valor','1500');
    $('#addPg').click();set(2,'meio','pix');set(2,'contaId','banco');
    muda($('#modalRoot [name=dataOutras]'),'2026-11-13');
    await salvarModal();
    const ms=S.movimentos.filter(m=>m.ref?.id==='v1');
    expect(ms).toHaveLength(3);
    expect(ms[0]).toMatchObject({id:'mv1',valor:1000,pendente:true,venceEm:'2026-12-01',data:'2026-11-10'});
    expect(ms[1]).toMatchObject({valor:1500,pendente:true,venceEm:'2027-01-01',meio:'cheque'});
    expect(ms[2]).toMatchObject({valor:500,meio:'pix',contaId:'banco',data:'2026-11-13'});expect(ms[2].pendente).toBeUndefined();
    expect(ms[2].descricao).toBe('Venda 1 · Cliente X (PIX 3/3)');
    expect(saldoConta('banco')).toBe(500);
    expect(S.vendas[0].forma).toBe('misto');
    expect(S.vendas[0].pagamentos.map(p=>[p.meio,p.valor])).toEqual([['cheque',1000],['cheque',1500],['pix',500]]);
  });

  it('a soma precisa fechar o valor do cheque',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov]});
    formDadosCheque('mv1');set(0,'valor','1000');$('#addPg').click();set(1,'meio','dinheiro');set(1,'valor','500');
    await expect(salvarModal()).rejects.toThrow(/soma/);
  });

  it('trocar tudo por dinheiro tira da lista de cheques e entra no saldo',async()=>{
    montar({...base(),vendas:[venda],movimentos:[mov]});
    formDadosCheque('mv1');set(0,'meio','dinheiro');await salvarModal();
    const m=S.movimentos[0];
    expect(m.pendente).toBeUndefined();expect(m.meio).toBe('dinheiro');expect(m.cheque).toBeNull();
    expect(saldoConta('gaveta')).toBe(3000);expect(S.vendas[0].forma).toBe('dinheiro');
  });
});

describe('editar a venda depois de dividir',()=>{
  it('cada cheque continua ligado ao seu lançamento, mesmo fora de ordem',async()=>{
    const c1={titular:'proprio',nome:'',banco:'A',numero:'1',bomPara:'2026-12-01'},c2={titular:'proprio',nome:'',banco:'B',numero:'2',bomPara:'2027-01-01'};
    const venda={id:'v1',numero:1,data:'2026-11-10',parceiroId:'cli',itens:[item('PP Moído','Preto',500,5)],total:2500,totalMat:2500,entrada:0,parcelas:0,frete:null,impostoPct:0,forma:'cheque',contaId:'gaveta',pagamentos:[{meio:'cheque',contaId:'gaveta',valor:1000,cheque:c1},{meio:'cheque',contaId:'gaveta',valor:1500,cheque:c2}]};
    const mv=(id,v,c,extra)=>({id,tipo:'entrada',valor:v,contaId:'gaveta',data:'2026-11-10',meio:'cheque',cheque:c,pendente:true,venceEm:c.bomPara,ref:{col:'vendas',id:'v1'},...extra});
    // na ordem do banco, o segundo cheque vem primeiro e já foi reprogramado
    montar({...base(),compras:[{id:'c1',numero:1,data:'2026-09-01',parceiroId:'cli',total:2000,forma:'pix',itens:[item('PP Moído','Preto',1000,2)]}],vendas:[venda],movimentos:[mv('m2',1500,c2,{venceEm:'2027-02-01',prazos:[{de:'2027-01-01',para:'2027-02-01'}]}),mv('m1',1000,c1)]});
    const {formOp}=await import('../src/forms/operacao.js');
    formOp('vendas','v1');await salvarModal();
    expect(S.movimentos.find(m=>m.id==='m2')).toMatchObject({valor:1500,venceEm:'2027-02-01'});
    expect(S.movimentos.find(m=>m.id==='m1')).toMatchObject({valor:1000,venceEm:'2026-12-01'});
  });
});
