import {S,byId,cfg,del,parcNome,put} from '../dados.js';
import {formConta} from './conta.js';
import {pgBox,pgCollect,pgInit,pgMount,pgTxt} from './pagamento.js';
import {ask,fv,modal,opt,toast} from '../modal.js';
import {genTitulos,renovar,rotOp} from '../regras.js';
import {$,addMonths,brl,esc,fd,fnum,nid,num,r2,today} from '../util.js';

/* --- título (conta a pagar / receber) --- */
function formTitulo(lado,id){
  const t=id?byId('titulos',id):{lado,natureza:'fixa',modo:'unica',vencimento:today()};lado=t.lado;
  const c=cfg();const cats=lado==='pagar'?c.catPagar:c.catReceber;
  const parcs=S.parceiros.slice().sort((a,b)=>a.nome.localeCompare(b.nome));
  modal(id?'Editar lançamento':(lado==='pagar'?'Nova conta a pagar':'Nova conta a receber'),`
    <label class="fl">Descrição<input name="descricao" id="tiDesc" value="${esc(t.descricao||'')}" placeholder="${lado==='pagar'?'Ex.: Aluguel do barracão, Conta de luz':'Ex.: Venda de PP granulado, Serviço de moagem'}"></label>
    <div class="row"><label class="fl">${lado==='pagar'?'Fornecedor / favorecido':'Cliente / pagador'}<select name="parceiroId" id="tiParc"><option value="">—</option>${parcs.map(p=>`<option value="${p.id}" ${p.id===t.parceiroId?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label class="fl">Categoria<select name="categoria" id="tiCat">${opt(cats,t.categoria,'—')}</select></label></div>
    ${lado==='pagar'?`<div><div class="hint" style="margin-bottom:6px;font-weight:600">Tipo de conta</div><div class="opts"><label><input type="radio" name="natureza" value="fixa" ${t.natureza==='fixa'?'checked':''}>Fixa (todo mês, mesmo valor)</label><label><input type="radio" name="natureza" value="variavel" ${t.natureza!=='fixa'?'checked':''}>Pontual / variável</label></div></div>`:''}
    ${id?`<div class="row"><label class="fl">Vencimento<input type="date" name="vencimento" id="tiVenc" value="${t.vencimento}"></label><label class="fl">Valor (R$)<input name="valor" id="tiValor" inputmode="decimal" value="${fnum(t.valor)}"></label></div>
      ${t.totalParcelas>1||t.renova?`<div class="chk"><label><input type="checkbox" name="propagar"> Aplicar descrição, categoria e valor às próximas parcelas em aberto deste grupo</label></div>`:''}`:`
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">Lançamento</div><div class="opts" id="tiModo">
      <label><input type="radio" name="modo" value="unica" checked>Uma vez só</label>
      <label><input type="radio" name="modo" value="recorrente">Recorrente (mensal)</label>
      <label><input type="radio" name="modo" value="parcelada">Parcelado</label></div></div>
    <div class="row"><label class="fl" id="lValor">Valor (R$)<input name="valor" id="tiValor" inputmode="decimal"></label>
      <label class="fl" id="lVenc">Vencimento<input type="date" name="vencimento" id="tiVenc" value="${t.vencimento}"></label>
      <label class="fl" id="lN" hidden><span id="lNtxt">Quantidade</span><input name="n" id="tiN" inputmode="numeric" value="12"></label></div>
    <div class="chk" id="lRenova" hidden><label><input type="checkbox" name="renova" checked> Renovar sozinho, sem data para acabar (o sistema mantém sempre 12 meses lançados à frente)</label></div>
    <div class="hint" id="tiPrev"></div>`}
    ${id&&t.renova?`<div class="chk"><label><input type="checkbox" name="renovaEdit" checked> Continua renovando sozinho todo mês</label></div>`:''}
    <label class="fl">Observações<textarea name="obs" id="tiObs">${esc(t.obs||'')}</textarea></label>`,
  {onMount:f=>{if(id)return;const upd=()=>{const modo=f.elements.modo.value;const n=Math.max(1,parseInt(fv(f,'n'))||1);const v=num(fv(f,'valor'));
      const ren=modo==='recorrente'&&f.elements.renova.checked;$('#lRenova').hidden=modo!=='recorrente';
      $('#lN').hidden=modo==='unica'||ren;$('#lNtxt').textContent=modo==='recorrente'?'Repetir por quantos meses':'Número de parcelas';
      $('#lValor').firstChild.textContent=modo==='parcelada'?'Valor total (R$)':modo==='recorrente'?'Valor mensal (R$)':'Valor (R$)';
      $('#lVenc').firstChild.textContent=modo==='unica'?'Vencimento':'1º vencimento';
      const venc=fv(f,'vencimento')||today();
      $('#tiPrev').innerHTML=modo==='unica'||!v?'':ren?`${brl(v)} todo mês a partir de ${fd(venc)}, sem data para acabar. Para parar, edite ou exclua “este e os próximos”.`:modo==='recorrente'?`Serão lançados ${n} meses de ${brl(v)}, de ${fd(venc)} até ${fd(addMonths(venc,n-1))}.`:`Serão lançadas ${n} parcelas de cerca de ${brl(v/n)}, de ${fd(venc)} até ${fd(addMonths(venc,n-1))}.`};
    f.addEventListener('input',upd);f.addEventListener('change',upd);upd()},
   onSubmit:async f=>{
    const desc=fv(f,'descricao');if(!desc)throw'Informe a descrição.';const v=num(fv(f,'valor'));if(v<=0)throw'Informe um valor maior que zero.';
    const base={lado,descricao:desc,parceiroId:fv(f,'parceiroId'),categoria:fv(f,'categoria'),natureza:lado==='pagar'?f.elements.natureza.value:'',obs:fv(f,'obs')};
    if(id){await put('titulos',{...t,...base,vencimento:fv(f,'vencimento')||t.vencimento,valor:r2(v)});
      if(t.renova&&f.elements.renovaEdit&&!f.elements.renovaEdit.checked){for(const o of S.titulos.filter(o=>o.grupo===t.grupo&&o.renova))await put('titulos',{...o,renova:false})}
      if(f.elements.propagar?.checked){for(const o of S.titulos.filter(o=>o.grupo===t.grupo&&o.id!==t.id&&!o.pago&&o.parcela>t.parcela))await put('titulos',{...o,descricao:desc,categoria:base.categoria,natureza:base.natureza,parceiroId:base.parceiroId,valor:r2(v)})}
      toast('Lançamento atualizado');return}
    const modo=f.elements.modo.value;const renova=modo==='recorrente'&&f.elements.renova.checked;
    const n=modo==='unica'?1:renova?12:Math.max(1,Math.min(120,parseInt(fv(f,'n'))||1));
    let list=genTitulos({...base,criadoEm:Date.now()},modo,n,v,fv(f,'vencimento')||today());
    if(renova)list=list.map(x=>({...x,id:x.grupo+'-'+x.parcela,renova:true,totalParcelas:0}));
    for(const x of list)await put('titulos',x);
    toast(list.length>1?`${list.length} lançamentos criados`:'Lançamento criado')}});
}
function formBaixa(id){
  const t=byId('titulos',id);if(!S.contas.length){toast('Cadastre uma conta de saldo primeiro');formConta();return}
  const pagar=t.lado==='pagar';
  modal(pagar?'Registrar pagamento':'Registrar recebimento',`
    <div class="box"><div><b>${esc(t.descricao)}</b>${t.totalParcelas>1?` <span class="muted">${t.parcela}/${t.totalParcelas}</span>`:''}</div><div class="muted">Vencimento ${fd(t.vencimento)} · ${brl(t.valor)}${t.parceiroId?' · '+esc(parcNome(t.parceiroId)):''}</div></div>
    <div class="row"><label class="fl">Data do ${pagar?'pagamento':'recebimento'}<input type="date" name="data" id="bData" value="${today()}"></label><label class="fl">Valor ${pagar?'pago':'recebido'} (R$)<input name="valor" id="bValor" inputmode="decimal" value="${fnum(t.valor)}"></label></div>
    <div class="box">${pgBox(pagar?'Como foi pago (sai de qual conta)':'Como recebeu (entra em qual conta)')}</div>
    <div class="box" id="bParcBox" hidden><div class="opts" style="flex-direction:column;align-items:stretch">
      <label><input type="radio" name="parcial" value="sim" checked><span id="bParcTxt">Pagamento parcial</span></label>
      <label><input type="radio" name="parcial" value="nao">Quitar com desconto (o restante não será cobrado)</label></div></div>
    <p class="hint" style="margin:0">Juros ou multa: aumente o valor. Valor menor: escolha se é parcial ou desconto. O lançamento vai para o caixa automaticamente.</p>`,
  {submit:pagar?'Confirmar pagamento':'Confirmar recebimento',
   onMount:f=>{const pags=pgInit({forma:'pix'});f.__pags=()=>pags;const PG=pgMount(pags,()=>r2(num(fv(f,'valor'))),pagar);PG.draw();
     const upd=()=>{PG.info();const v=num(fv(f,'valor'));const falta=r2(num(t.valor)-v);const box=$('#bParcBox');box.hidden=!(v>0&&falta>0.005);
     $('#bParcTxt').textContent=`${pagar?'Pagamento':'Recebimento'} parcial: os ${brl(falta)} restantes continuam em aberto com o mesmo vencimento`};f.addEventListener('input',upd);upd()},
   onSubmit:async f=>{const v=num(fv(f,'valor'));if(v<=0)throw'Informe o valor.';
    const pagamentos=pgCollect(f.__pags(),r2(v),pagar?'ao valor pago':'ao valor recebido');const contaId=pagamentos[0].contaId;
    const mid=nid();const data=fv(f,'data')||today();const falta=r2(num(t.valor)-v);const parcial=falta>0.005&&f.elements.parcial.value==='sim';
    for(const [i,pg] of pagamentos.entries())await put('movimentos',{id:i?nid():mid,tipo:pagar?'saida':'entrada',data,valor:pg.valor,contaId:pg.contaId,descricao:t.descricao+(t.totalParcelas>1?` (${t.parcela}/${t.totalParcelas})`:'')+(pagamentos.length>1||pg.meio==='cheque'?` · ${pgTxt(pg,pagar)}`:''),meio:pg.meio,cheque:pg.cheque||null,categoria:t.categoria||'',parceiroId:t.parceiroId||'',ref:{col:'titulos',id:t.id},criadoEm:Date.now()});
    if(parcial){const rid=nid();
      await put('titulos',{...t,valor:r2(v),valorOriginal:num(t.valorOriginal)||num(t.valor),restoId:rid,pago:true,pagoEm:data,valorPago:r2(v),contaId,pagamentos,movimentoId:mid});
      const{pago,pagoEm,valorPago,movimentoId,contaId,pagamentos,restoId,valorOriginal,...base}=t;
      await put('titulos',{...base,id:rid,valor:falta,restoDe:t.id,pago:false,obs:[t.obs,`Saldo do ${pagar?'pagamento':'recebimento'} parcial de ${fd(data)}`].filter(Boolean).join(' · '),criadoEm:Date.now()});
      toast(`${pagar?'Pagamento':'Recebimento'} parcial registrado · ${brl(falta)} em aberto`);return}
    await put('titulos',{...t,pago:true,pagoEm:data,valorPago:r2(v),contaId,pagamentos,movimentoId:mid});toast(pagar?'Pagamento registrado':'Recebimento registrado');if(t.renova)renovar()}});
}
async function estornar(id){
  const t=byId('titulos',id);
  const ok=await ask('Estornar lançamento',`Desfazer o ${t.lado==='pagar'?'pagamento':'recebimento'} de <b>${esc(t.descricao)}</b> (${brl(t.valorPago||t.valor)})? O valor volta para a conta e o lançamento fica em aberto.`,[{label:'Estornar',cls:'pri',v:true}]);
  if(!ok)return;
  for(const m of S.movimentos.filter(m=>m.ref?.id===t.id))await del('movimentos',m.id);
  const {pago,pagoEm,valorPago,movimentoId,contaId,pagamentos,restoId,valorOriginal,...rest}=t;
  // estorno de pagamento parcial: junta de volta com o saldo que ficou em aberto
  const resto=restoId&&byId('titulos',restoId);
  if(resto&&!resto.pago){await del('titulos',resto.id);await put('titulos',{...rest,valor:r2(num(t.valor)+num(resto.valor)),pago:false})}
  else await put('titulos',{...rest,...(resto?{restoId,valorOriginal}:{}),pago:false});
  toast('Estornado');
}
async function delTitulo(id){
  const t=byId('titulos',id);const futuros=S.titulos.filter(o=>o.grupo===t.grupo&&o.id!==t.id&&!o.pago&&o.vencimento>=t.vencimento);
  if(t.ref){const src=byId(t.ref.col,t.ref.id);if(src){await ask('Lançamento vinculado',`Esta parcela foi gerada pela ${rotOp(t.ref.col,src).toLowerCase()}. Para alterar, edite ou exclua a ${t.ref.col==='compras'?'compra':'venda'}.`,[]);return}}
  const btns=[{label:'Excluir só este',cls:'danger',v:'one'}];if(futuros.length)btns.push({label:`Este e os próximos ${futuros.length} em aberto${t.renova?' (para de renovar)':''}`,cls:'danger',v:'all'});
  const r=await ask('Excluir lançamento',`Excluir <b>${esc(t.descricao)}</b> com vencimento em ${fd(t.vencimento)}?${t.pago?' O pagamento/recebimento registrado no caixa também será removido.':''}`,btns);
  if(!r)return;
  const alvo=r==='all'?[t,...futuros]:[t];
  // excluir a última (ou "este e os próximos") encerra a renovação automática do grupo
  if(t.renova&&(r==='all'||!S.titulos.some(o=>o.grupo===t.grupo&&o.parcela>t.parcela))){for(const o of S.titulos.filter(o=>o.grupo===t.grupo&&o.renova&&!alvo.includes(o)))await put('titulos',{...o,renova:false})}
  for(const x of alvo){for(const m of S.movimentos.filter(m=>m.ref?.id===x.id))await del('movimentos',m.id);await del('titulos',x.id)}
  toast(alvo.length>1?`${alvo.length} lançamentos excluídos`:'Lançamento excluído');
}

export {formTitulo,formBaixa,estornar,delTitulo};
