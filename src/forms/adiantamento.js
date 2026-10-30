import {S,byId,del,parcNome,put} from '../dados.js';
import {pgBox,pgCollect,pgInit,pgMount,pgTxt} from './pagamento.js';
import {parcFields} from './parceiro.js';
import {formConta} from './conta.js';
import {ask,fv,modal,toast} from '../modal.js';
import {codVenda,creditoCliente,linked,proximoNumero,removeLinked,rotOp} from '../regras.js';
import {$,brl,esc,fd,fnum,nid,num,r2,today} from '../util.js';

/* --- adiantamento de cliente ---
   tipo 'entrada': o cliente adianta dinheiro, entra no caixa e vira crédito para abater numa venda.
   tipo 'devolucao': a 3STRUZA devolve parte do crédito, sai do caixa.
   Pode ficar ligado a uma venda (vendaId), por exemplo quando o cliente paga a mais na hora da venda. */
function formAdiant(id,pre={}){
  if(!S.contas.length){toast('Cadastre uma conta de saldo primeiro');formConta();return}
  const a=id?byId('adiantamentos',id):{tipo:pre.tipo||'entrada',data:today(),parceiroId:pre.parceiroId||'',vendaId:pre.vendaId||'',forma:'pix'};
  const dev=a.tipo==='devolucao';
  const clientes=S.parceiros.slice().sort((x,y)=>(y.cliente-x.cliente)||x.nome.localeCompare(y.nome));
  const pags=pgInit(a);
  const vendasDe=pid=>S.vendas.filter(v=>v.parceiroId===pid).sort((x,y)=>y.data.localeCompare(x.data)).slice(0,30);
  const vendaOpts=(pid,sel)=>`<option value="">Nenhuma · adiantamento avulso</option>`+vendasDe(pid).map(v=>`<option value="${v.id}" ${v.id===sel?'selected':''}>Venda ${codVenda(v)} · ${fd(v.data)} · ${brl(v.total)}</option>`).join('');
  modal((id?'Editar ':'Novo ')+(dev?'devolução de adiantamento':'adiantamento de cliente')+(id?' nº '+a.numero:''),`
    <p class="hint" style="margin:0">${dev?'Devolve ao cliente parte do crédito que ele tem. Sai do caixa e diminui o crédito.':'O cliente adianta um valor, com ou sem venda. O dinheiro entra no caixa e fica como crédito do cliente, para abater numa venda depois.'}</p>
    <div class="row"><label class="fl">Data<input type="date" name="data" value="${a.data}"></label>
      <label class="fl">Cliente<select name="parceiroId" id="adParc"><option value="">Selecione…</option>${clientes.map(p=>`<option value="${p.id}" ${p.id===a.parceiroId?'selected':''}>${esc(p.nome)}${p.cliente?'':' (fornecedor)'}</option>`).join('')}${dev?'':'<option value="__novo">+ Cadastrar novo…</option>'}</select></label></div>
    <div class="box" id="adNovo" hidden><b style="font-size:14px">Novo cliente</b>${parcFields({},'np_')}</div>
    <div class="hint" id="adSaldo"></div>
    <div class="box">${pgBox(dev?'Como foi devolvido (sai de qual conta)':'Como o cliente pagou (entra em qual conta)')}
      <label class="fl">Valor total (R$)<input name="valor" id="adValor" inputmode="decimal" value="${num(a.valor)?fnum(a.valor):''}" placeholder="0,00"></label></div>
    ${dev?'':`<label class="fl">Venda relacionada (opcional)<select name="vendaId" id="adVenda">${vendaOpts(a.parceiroId,a.vendaId)}</select><span class="hint">Use quando o cliente pagou a mais junto com uma venda.</span></label>`}
    <label class="fl">Observações<textarea name="obs" placeholder="${dev?'Motivo da devolução':'Ex.: adiantamento para reservar 2 big bags de PP preto'}">${esc(a.obs||'')}</textarea></label>`,
  {onMount:f=>{
    const alvo=()=>r2(num(fv(f,'valor')));
    const PG=pgMount(pags,alvo,dev);
    const saldo=()=>{const pid=fv(f,'parceiroId');$('#adNovo').hidden=pid!=='__novo';
      $('#adSaldo').textContent=pid&&pid!=='__novo'?`Crédito atual de ${parcNome(pid)}: ${brl(creditoCliente(pid))}`+(id?' (já contando este lançamento)':''):'';
      const sv=$('#adVenda');if(sv)sv.innerHTML=vendaOpts(pid,sv.value)};
    $('#adParc').addEventListener('change',saldo);$('#adValor').addEventListener('input',PG.info);
    saldo();PG.draw();
  },onSubmit:async f=>{
    let parceiroId=fv(f,'parceiroId');if(!parceiroId)throw'Selecione o cliente.';
    const valor=r2(num(fv(f,'valor')));if(valor<=0)throw'Informe o valor.';
    let novoParc=null;
    if(parceiroId==='__novo'){const nome=fv(f,'np_nome');if(!nome)throw'Informe o nome do novo cliente.';parceiroId=nid();
      novoParc={id:parceiroId,nome,pessoa:f.elements.np_pessoa.value,documento:fv(f,'np_documento'),fornecedor:false,cliente:true}}
    // o crédito do cliente nunca pode ficar negativo
    // crédito sem contar este lançamento (na edição)
    const sem=pid=>creditoCliente(pid)-(id&&a.parceiroId===pid?(dev?-1:1)*num(a.valor):0);
    if(id&&!dev&&a.parceiroId!==parceiroId&&sem(a.parceiroId)<-0.005)throw`Este adiantamento já foi usado em vendas de ${parcNome(a.parceiroId)}. Tire o abatimento das vendas antes de trocar o cliente.`;
    const disp=novoParc?0:sem(parceiroId);
    if(dev&&valor>disp+0.005)throw`${parcNome(parceiroId)} tem só ${brl(disp)} de crédito para devolver.`;
    if(!dev&&disp+valor<-0.005)throw`O crédito de ${parcNome(parceiroId)} já foi usado em vendas (${brl(-disp)}). O valor precisa ser pelo menos esse.`;
    const pagamentos=pgCollect(pags,valor,'ao valor');
    if(novoParc)await put('parceiros',novoParc);
    else{const p=byId('parceiros',parceiroId);if(p&&!p.cliente)await put('parceiros',{...p,cliente:true})}
    const aid=id||nid();
    const rec={...a,id:aid,numero:id?a.numero:await proximoNumero('adiantamentos'),tipo:dev?'devolucao':'entrada',data:fv(f,'data')||today(),parceiroId,valor,
      forma:new Set(pagamentos.map(p=>p.meio)).size===1?pagamentos[0].meio:'misto',contaId:pagamentos[0].contaId,pagamentos,vendaId:dev?'':fv(f,'vendaId'),obs:fv(f,'obs'),criadoEm:a.criadoEm||Date.now()};
    await put('adiantamentos',rec);
    // um lançamento de caixa por conta; reaproveita os existentes na edição
    const pn=novoParc?.nome||parcNome(parceiroId);const desc=`${rotOp('adiantamentos',rec)} · ${pn}`;
    const proprios=linked(aid).mov;
    for(const [i,pg] of pagamentos.entries())await put('movimentos',{...(proprios[i]||{id:nid(),criadoEm:Date.now()}),tipo:dev?'saida':'entrada',data:rec.data,valor:pg.valor,contaId:pg.contaId,
      descricao:desc+` (${pgTxt(pg,dev)})`+(pagamentos.length>1?` ${i+1}/${pagamentos.length}`:''),meio:pg.meio,cheque:pg.cheque||null,categoria:dev?'Devolução de adiantamento':'Adiantamento de cliente',parceiroId,ref:{col:'adiantamentos',id:aid}});
    for(const m of proprios.slice(pagamentos.length))await del('movimentos',m.id);
    toast(`${rotOp('adiantamentos',rec)} salvo`);
  }});
}
async function delAdiant(id){
  const a=byId('adiantamentos',id);const dev=a.tipo==='devolucao';
  if(!dev&&creditoCliente(a.parceiroId)-num(a.valor)<-0.005){await ask('Adiantamento já usado',`Parte deste adiantamento já foi abatida em vendas de ${esc(parcNome(a.parceiroId))}. Tire o abatimento das vendas antes de excluir.`,[]);return}
  if(!await ask('Excluir '+rotOp('adiantamentos',a).toLowerCase(),`Excluir ${dev?'a devolução':'o adiantamento'} de ${brl(a.valor)} de ${esc(parcNome(a.parceiroId))} (${fd(a.data)})? O lançamento no caixa também será removido.`,[{label:'Excluir',cls:'danger',v:true}]))return;
  await removeLinked(id);await del('adiantamentos',id);toast('Excluído');
}

export {formAdiant,delAdiant};
