import {S,byId,cfg,del,parcNome,put} from '../dados.js';
import {pgBox,pgCollect,pgInit,pgMount,pgTxt} from './pagamento.js';
import {parcFields} from './parceiro.js';
import {ask,contaOpts,defaultConta,fv,modal,opt,toast} from '../modal.js';
import {AVISTA,EMB,FORMA,FRETE,MEIO,custosMedios,dispMat,faltaEstoque,genTitulos,linked,margemVenda,proximoNumero,removeLinked,ultImposto} from '../regras.js';
import {$,addDays,addMonths,brl,esc,fd,fkg,fnum,nid,num,r2,today} from '../util.js';

/* --- compra / venda --- */
function formOp(col,id){
  const isC=col==='compras';const c=cfg();
  const o=id?byId(col,id):{data:today(),forma:'pix',itens:[{tipo:c.tipos[0],cor:c.cores[0],embalagem:'bigbag',qtd:1,pesoUn:c.pesoBag,kg:c.pesoBag,precoKg:''}],parcelas:1,primeiroVenc:addDays(today(),30)};
  const parcs=S.parceiros.slice().sort((a,b)=>(isC?(b.fornecedor-a.fornecedor):(b.cliente-a.cliente))||a.nome.localeCompare(b.nome));
  let itens=(o.itens||[]).map(i=>({...i}));
  const hasPaid=id&&linked(id).tit.some(t=>t.pago);
  // pagamento à vista (ou entrada) pode sair/entrar de várias contas
  const pags=pgInit(o);const forma0=o.forma==='misto'?pags[0].meio:o.forma;
  const form=modal((id?'Editar ':'Nova ')+(isC?'compra':'venda')+(id?' #'+o.numero:''),`
    ${hasPaid?`<div class="banner">Esta operação tem parcelas já ${isC?'pagas':'recebidas'}. Elas são mantidas ao salvar; se mudar o total ou o número de parcelas, só as parcelas em aberto são recalculadas.</div>`:''}
    <div class="row"><label class="fl">Data<input type="date" name="data" id="oData" value="${o.data}"></label>
      <label class="fl">${isC?'Fornecedor':'Cliente'}<select name="parceiroId" id="oParc"><option value="">Selecione…</option>${parcs.map(p=>`<option value="${p.id}" ${p.id===o.parceiroId?'selected':''}>${esc(p.nome)}${(isC?p.fornecedor:p.cliente)?'':(isC?' (cliente)':' (fornecedor)')}</option>`).join('')}<option value="__novo">+ Cadastrar novo…</option></select></label></div>
    <div class="box" id="novoParc" hidden><b style="font-size:14px">Novo cadastro</b>${parcFields({},'np_')}<span class="hint">Você completa telefone, endereço e outros dados depois em Clientes e fornecedores.</span></div>
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">Itens</div><div class="tbl-wrap"><table class="items"><thead><tr><th style="min-width:150px">Tipo de material</th><th style="min-width:110px">Cor</th><th style="min-width:110px">Embalagem</th><th style="min-width:70px">Qtd.</th><th style="min-width:86px">Peso emb. (kg)</th><th style="min-width:96px">Peso total (kg)</th><th style="min-width:92px">${isC?'Preço':'Valor'} R$/kg</th><th class="r" style="min-width:100px">Subtotal</th><th></th></tr></thead><tbody id="itRows"></tbody></table></div>
      <button type="button" class="btn sm" id="addIt" style="margin-top:6px">+ Adicionar item</button></div>
    <div class="total-line" id="totLine"></div>
    ${isC?'':`<div class="box"><div class="hint" style="font-weight:600">Frete</div>
      <div class="opts">${Object.entries(FRETE).map(([k,l])=>`<label><input type="radio" name="freteTipo" value="${k}" ${(o.frete?.tipo||'nenhum')===k?'checked':''}>${l}</label>`).join('')}</div>
      <div id="frBox" style="display:flex;flex-direction:column;gap:10px">
        <div class="row"><label class="fl">Valor do frete (R$)<input name="freteValor" id="frValor" inputmode="decimal" value="${num(o.frete?.valor)?fnum(o.frete.valor):''}" placeholder="0,00"></label>
          <label class="fl" id="frContaL">Frete pago pela conta<select name="freteConta" id="frConta"><option value="">Não lançar no caixa agora</option>${contaOpts(o.frete?.contaId??'')}</select></label></div>
        <label id="frCobrarL" style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" name="freteCobrar" id="frCobrar" ${o.frete?o.frete.cobrar?'checked':'':'checked'}> Somar o frete ao total cobrado do cliente</label>
        <div class="row"><label class="fl">Transportadora<input name="freteTransp" value="${esc(o.frete?.transportadora||'')}"></label><label class="fl">Placa<input name="fretePlaca" value="${esc(o.frete?.placa||'')}"></label><label class="fl">Motorista<input name="freteMotorista" value="${esc(o.frete?.motorista||'')}"></label></div>
        <span class="hint" id="frHint"></span></div></div>
    <div class="box"><div class="hint" style="font-weight:600">Impostos e lucro</div>
      <div class="row"><label class="fl">Impostos (% sobre a venda)<input name="impostoPct" id="oImp" inputmode="decimal" value="${o.impostoPct!=null&&o.impostoPct!==''?fnum(o.impostoPct,2):(ultImposto()||'')}" placeholder="0"></label>
        <label class="fl">Margem desejada (%)<input name="margemAlvo" id="oMargem" inputmode="decimal" value="${o.margemAlvo!=null&&o.margemAlvo!==''?fnum(o.margemAlvo,2):''}" placeholder="Ex.: 20"></label></div>
      <div id="lucroBox"></div></div>`}
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">Forma de pagamento</div><div class="opts">${Object.entries(FORMA).filter(([k])=>k!=='misto').map(([k,l])=>`<label><input type="radio" name="forma" value="${k}" ${forma0===k?'checked':''}>${l}</label>`).join('')}</div></div>
    <div class="box" id="fpConta">${pgBox(isC?'Como foi pago (sai de qual conta)':'Como o cliente pagou (entra em qual conta)')}</div>
    <div class="box" id="fpCred"><div class="row"><label class="fl">Entrada à vista (R$, opcional)<input name="entrada" id="oEntrada" inputmode="decimal" value="${num(o.entrada)?fnum(o.entrada):''}" placeholder="0"></label><label class="fl">Parcelas<input name="parcelas" id="oParcelas" inputmode="numeric" value="${o.parcelas||1}"></label><label class="fl">1º vencimento<input type="date" name="primeiroVenc" id="oVenc" value="${o.primeiroVenc||addDays(today(),30)}"></label></div><div class="hint" id="credPrev"></div></div>
    <div class="box" id="fpPerm"><label class="fl">O que foi dado/recebido em troca<input name="permutaDesc" id="oPerm" value="${esc(o.permutaDesc||'')}" placeholder="Ex.: 2 big bags de PP preto moído"></label><span class="hint">Troca/permuta não movimenta o caixa. Se o material dado em troca saiu do estoque, lance também a venda/ajuste correspondente.</span></div>
    <label class="fl">Observações<textarea name="obs" id="oObs">${esc(o.obs||'')}</textarea></label>`,
  {wide:true,onMount:f=>{
    const tb=$('#itRows');
    const drawRows=()=>{tb.innerHTML=itens.map((it,i)=>{const av=!isC?dispMat(it.tipo,it.cor,id):null;return `<tr data-i="${i}">
      <td data-l="Tipo de material"><select data-k="tipo">${opt(c.tipos,it.tipo)}</select></td><td data-l="Cor"><select data-k="cor">${opt(c.cores,it.cor)}</select></td>
      <td data-l="Embalagem"><select data-k="embalagem">${Object.entries(EMB).map(([k,l])=>`<option value="${k}" ${it.embalagem===k?'selected':''}>${l}</option>`).join('')}</select></td>
      <td data-l="Qtd."><input data-k="qtd" inputmode="decimal" value="${it.embalagem==='granel'?'':fnum(it.qtd)}" ${it.embalagem==='granel'?'disabled':''}></td>
      <td data-l="Peso emb. (kg)"><input data-k="pesoUn" inputmode="decimal" value="${it.embalagem==='granel'?'':fnum(it.pesoUn)}" ${it.embalagem==='granel'?'disabled':''}></td>
      <td data-l="Peso total (kg)"><input data-k="kg" inputmode="decimal" value="${fnum(it.kg)}">${av!==null?`<div class="avail ${av<num(it.kg)?'low':''}">Em estoque: ${fkg(av)}<span class="muted"> (${esc(it.tipo)} ${esc(it.cor)}, todas as embalagens)</span></div>`:''}</td>
      <td data-l="R$/kg"><input data-k="precoKg" inputmode="decimal" value="${it.precoKg===''?'':fnum(it.precoKg,4)}"></td>
      <td class="r" style="padding-top:12px;font-weight:600" data-l="Subtotal" data-sub>${brl(num(it.kg)*num(it.precoKg))}</td>
      <td><button type="button" class="btn sm danger" data-rm="${i}" ${itens.length<2?'disabled':''} aria-label="Remover item">×</button></td></tr>`}).join('');totals()};
    const totals=()=>{const kgT=itens.reduce((a,i)=>a+num(i.kg),0),t=itens.reduce((a,i)=>a+num(i.kg)*num(i.precoKg),0);const fc=freteCobrado();
      $('#totLine').innerHTML=`<div><span>Peso total</span>${fkg(kgT)}</div><div><span>Média</span>${kgT?brl(t/kgT)+'/kg':'—'}</div>${fc?`<div><span>Material</span>${brl(t)}</div><div><span>Frete</span>${brl(fc)}</div>`:''}<div><span>Total</span>${brl(t+fc)}</div>`;
      if(!isC)lucro();
      tb.querySelectorAll('tr').forEach(tr=>{const it=itens[+tr.dataset.i];tr.querySelector('[data-sub]').textContent=brl(num(it.kg)*num(it.precoKg))});credPrev();if($('#pgInfo'))pgInfo()};
    // frete e lucro (só na venda)
    const freteTipo=()=>isC?'nenhum':(f.elements.freteTipo.value||'nenhum');
    const freteCobrado=()=>freteTipo()==='cif'&&f.elements.freteCobrar.checked?r2(num(fv(f,'freteValor'))):0;
    const totalVenda=()=>r2(itens.reduce((a,i)=>a+num(i.kg)*num(i.precoKg),0)+freteCobrado());
    const lucro=()=>{const ft=freteTipo();$('#frBox').hidden=ft==='nenhum';$('#frContaL').hidden=ft!=='cif';$('#frCobrarL').hidden=ft!=='cif';
      $('#frHint').textContent=ft==='cif'?'CIF: a 3STRUZA paga o frete. O valor entra como custo da venda e, se escolher uma conta, sai do caixa na data da venda.':ft==='fob'?'FOB: o cliente paga o frete direto ao transportador. O valor fica só registrado, não entra no lucro.':'';
      const cm=custosMedios();const v={itens:itens.map(i=>({...i,kg:num(i.kg)})),total:totalVenda(),frete:{tipo:ft,valor:num(fv(f,'freteValor'))},impostoPct:num(fv(f,'impostoPct'))};
      const m=margemVenda(v,cm);const T=v.total,kg=itens.reduce((a,i)=>a+num(i.kg),0);const mat=r2(T-freteCobrado());
      const alvoM=num(fv(f,'margemAlvo'));const tx=v.impostoPct/100;
      // preço por kg para chegar na margem desejada: T(1-t-a)=custo material+frete CIF
      let sug='';if(alvoM&&kg){const d=1-tx-alvoM/100;if(d>0){const Tn=(m.custoMat+m.frete)/d;const p=(Tn-freteCobrado())/kg;sug=`<div class="hint" style="margin-top:6px">Para ter <b>${fnum(alvoM,1)}%</b> de margem, venda a <b>${brl(p)}/kg</b> em média${kg&&mat?` (hoje ${brl(mat/kg)}/kg)`:''}. ${itens.length===1?`<button type="button" class="btn sm" id="aplPreco" data-p="${r2(p*10000)/10000}">Usar este preço</button>`:''}</div>`}else sug='<div class="hint">Margem + impostos passam de 100%.</div>'}
      const ln=(l,v,cls='')=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:3px 0" class="${cls}"><span>${l}</span><b class="num">${v}</b></div>`;
      $('#lucroBox').innerHTML=`<div style="font-size:14px;border-top:1px solid var(--line);padding-top:8px">
        ${ln('Material vendido',brl(mat))}${freteCobrado()?ln('+ Frete cobrado do cliente',brl(freteCobrado())):''}${ln('= Total da venda',brl(T))}
        ${ln('− Custo do material (custo médio)'+(m.semCusto?' *':''),brl(m.custoMat))}${m.frete?ln('− Frete CIF',brl(m.frete)):''}${m.imposto?ln(`− Impostos (${fnum(v.impostoPct,2)}%)`,brl(m.imposto)):''}
        <div style="display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);margin-top:4px;padding-top:6px;font-size:16px"><span><b>Lucro da venda</b></span><b class="num ${m.margem<0?'neg':'pos'}">${brl(m.margem)} <span style="font-size:13px">${T?'· '+fnum(m.margem/T*100,1)+'%':''}</span></b></div>
        ${m.semCusto?'<div class="hint">* Algum material ainda não tem custo (sem compra ou ajuste com custo/kg).</div>':''}${sug}</div>`;
      const ap=$('#aplPreco');if(ap)ap.onclick=()=>{itens[0].precoKg=+ap.dataset.p;drawRows()}};
    const credPrev=()=>{const n=Math.max(1,parseInt(fv(f,'parcelas'))||1);const ent=num(fv(f,'entrada'));const t=totalVenda()-ent;const v=fv(f,'primeiroVenc')||today();
      $('#credPrev').textContent=t>0?`${ent>0?'Entrada de '+brl(ent)+' no caixa + ':''}${n}x de cerca de ${brl(t/n)} · ${isC?'vai para Contas a pagar':'vai para Contas a receber'} de ${fd(v)} até ${fd(addMonths(v,n-1))}`:''};
    tb.addEventListener('input',e=>{const tr=e.target.closest('tr');if(!tr)return;const it=itens[+tr.dataset.i];const k=e.target.dataset.k;
      if(k==='qtd'||k==='pesoUn'||k==='kg'||k==='precoKg'){it[k]=e.target.value;if(k==='qtd'||k==='pesoUn'){it.kg=r2(num(it.qtd)*num(it.pesoUn));tr.querySelector('[data-k=kg]').value=fnum(it.kg)}
        if(!isC&&(k!=='precoKg')){const av=tr.querySelector('.avail');if(av)av.classList.toggle('low',dispMat(it.tipo,it.cor,id)<num(it.kg))}totals()}});
    tb.addEventListener('change',e=>{const tr=e.target.closest('tr');if(!tr)return;const it=itens[+tr.dataset.i];const k=e.target.dataset.k;
      if(k==='tipo'||k==='cor'||k==='embalagem'){it[k]=e.target.value;if(k==='embalagem'){if(it.embalagem==='granel'){it.qtd=0;it.pesoUn=0}else{it.pesoUn=it.embalagem==='saco'?c.pesoSaco:c.pesoBag;it.qtd=it.qtd||1;it.kg=r2(num(it.qtd)*num(it.pesoUn))}}drawRows()}});
    tb.addEventListener('click',e=>{const b=e.target.closest('[data-rm]');if(b){itens.splice(+b.dataset.rm,1);drawRows()}});
    $('#addIt').onclick=()=>{const l=itens[itens.length-1]||{};itens.push({tipo:l.tipo||c.tipos[0],cor:c.cores[0],embalagem:l.embalagem||'bigbag',qtd:1,pesoUn:l.pesoUn||c.pesoBag,kg:l.pesoUn||c.pesoBag,precoKg:l.precoKg||''});drawRows()};
    const alvo=()=>{const v=f.elements.forma.value;return r2(v==='credito'?num(fv(f,'entrada')):totalVenda())};
    if(!isC){f.querySelectorAll('[name=freteTipo]').forEach(r=>r.addEventListener('change',totals));['frValor','frCobrar','oImp','oMargem'].forEach(k=>{$('#'+k).addEventListener('input',totals);$('#'+k).addEventListener('change',totals)})}
    const PG=pgMount(pags,alvo,isC),pgInfo=PG.info;f.__pags=()=>pags;
    const fp=()=>{const v=f.elements.forma.value;$('#fpConta').hidden=!(AVISTA.has(v)||(v==='credito'&&num(fv(f,'entrada'))>0));$('#fpCred').hidden=v!=='credito';$('#fpPerm').hidden=v!=='permuta'};
    f.querySelectorAll('[name=forma]').forEach(r=>r.addEventListener('change',()=>{fp();const v=f.elements.forma.value;if(MEIO[v]&&pags.length===1&&pags[0].meio!==v){pags[0].meio=v;const d=defaultConta(v);if(d&&!id)pags[0].contaId=d;PG.draw()}pgInfo()}));
    $('#oParcelas').addEventListener('input',credPrev);$('#oEntrada').addEventListener('input',()=>{credPrev();fp();pgInfo()});$('#oVenc').addEventListener('change',credPrev);
    $('#oParc').addEventListener('change',e=>{$('#novoParc').hidden=e.target.value!=='__novo'});
    fp();drawRows();PG.draw();
  },onSubmit:async f=>{
    let parceiroId=fv(f,'parceiroId');
    if(!parceiroId)throw`Selecione o ${isC?'fornecedor':'cliente'}.`;
    const its=itens.map(i=>({tipo:i.tipo,cor:i.cor,embalagem:i.embalagem,qtd:i.embalagem==='granel'?0:num(i.qtd),pesoUn:i.embalagem==='granel'?0:num(i.pesoUn),kg:r2(num(i.kg)),precoKg:num(i.precoKg)}));
    if(its.some(i=>i.kg<=0))throw'Todo item precisa ter peso maior que zero.';
    if(its.some(i=>i.precoKg<=0)&&f.elements.forma.value!=='permuta')throw'Informe o preço por kg de todos os itens.';
    const forma=f.elements.forma.value;
    const totalMat=r2(its.reduce((a,i)=>a+i.kg*i.precoKg,0)),totalKg=r2(its.reduce((a,i)=>a+i.kg,0));
    let frete=null,impostoPct=0,margemAlvo='';
    if(!isC){const tp=f.elements.freteTipo.value||'nenhum';const fvv=r2(num(fv(f,'freteValor')));
      if(tp!=='nenhum'&&fvv<0)throw'Valor do frete inválido.';
      frete=tp==='nenhum'?null:{tipo:tp,valor:fvv,cobrar:tp==='cif'&&f.elements.freteCobrar.checked,contaId:tp==='cif'?fv(f,'freteConta'):'',transportadora:fv(f,'freteTransp'),placa:fv(f,'fretePlaca'),motorista:fv(f,'freteMotorista')};
      impostoPct=num(fv(f,'impostoPct'));if(impostoPct<0||impostoPct>=100)throw'Impostos precisam ficar entre 0 e 100%.';
      margemAlvo=fv(f,'margemAlvo')===''?'':num(fv(f,'margemAlvo'))}
    const total=r2(totalMat+(frete?.cobrar?frete.valor:0));
    let novoParc=null;
    if(parceiroId==='__novo'){const nome=fv(f,'np_nome');if(!nome)throw'Informe o nome do novo cadastro.';parceiroId=nid();
      novoParc={id:parceiroId,nome,pessoa:f.elements.np_pessoa.value,documento:fv(f,'np_documento'),fornecedor:isC,cliente:!isC}}
    // venda acima do estoque: avisa e pede um segundo clique para confirmar
    if(!isC){const falta=faltaEstoque(its,id);const sig=JSON.stringify(its.map(i=>[i.tipo,i.cor,i.kg]));
      if(falta.length&&f.dataset.semEstoque!==sig){f.dataset.semEstoque=sig;const btn=f.querySelector('[type=submit]');if(btn)btn.textContent='Vender mesmo assim';
        throw 'Estoque insuficiente: '+falta.map(x=>`${x.tipo} ${x.cor} tem ${fkg(x.tem)} e a venda pede ${fkg(x.pede)}`).join('; ')+'. Confira o material ou clique em “Vender mesmo assim”.'}}
    const opId=id||nid();const data=fv(f,'data')||today();
    const parcelas=forma==='credito'?Math.max(1,Math.min(60,parseInt(fv(f,'parcelas'))||1)):0;
    const primeiroVenc=forma==='credito'?(fv(f,'primeiroVenc')||today()):'';
    // a prazo pode ter entrada à vista; o resto vira parcelas
    const entrada=forma==='credito'?r2(num(fv(f,'entrada'))):0;
    if(entrada<0||(forma==='credito'&&entrada>=total-0.005&&total>0))throw'A entrada precisa ser menor que o total. Se foi tudo à vista, escolha Dinheiro ou PIX.';
    const usaConta=AVISTA.has(forma)||entrada>0;
    const valorCaixa=AVISTA.has(forma)?total:entrada;
    const pagamentos=usaConta?pgCollect(f.__pags(),valorCaixa,forma==='credito'?'à entrada':'ao total'):[];
    const contaId=pagamentos[0]?.contaId||'';
    // à vista com formas diferentes fica como "Vários"
    const formaRec=AVISTA.has(forma)?(new Set(pagamentos.map(p=>p.meio)).size===1?pagamentos[0].meio:'misto'):forma;
    const aPrazo=forma==='credito'?r2(total-entrada):0;
    const lado=isC?'pagar':'receber',categoria=isC?'Compra de material':'Venda de material';
    // edição: decide o que fazer com as parcelas já existentes, sem perder baixas
    let plano='novo';const lk=id?linked(id):{tit:[],mov:[]};const pagos=lk.tit.filter(t=>t.pago);
    if(id&&pagos.length){
      if(o.forma!=='credito'||forma!=='credito')throw`Esta ${isC?'compra':'venda'} tem parcelas já ${isC?'pagas':'recebidas'}. Estorne-as em Contas a ${lado} antes de mudar a forma de pagamento.`;
      const pagoSoma=r2(pagos.reduce((a,t)=>a+num(t.valor),0));
      if(r2(num(o.total)-num(o.entrada))===aPrazo&&num(o.parcelas)===parcelas&&o.primeiroVenc===primeiroVenc)plano='manter';
      else{if(aPrazo<pagoSoma-0.005)throw`Já foram ${isC?'pagos':'recebidos'} ${brl(pagoSoma)} em parcelas, mais que o novo valor a prazo de ${brl(aPrazo)}. Estorne alguma parcela antes.`;
        if(aPrazo-pagoSoma>0.005&&parcelas<=pagos.length)throw`${pagos.length} parcela(s) já ${isC?'paga(s)':'recebida(s)'}. Use mais de ${pagos.length} parcelas para o valor que falta.`;
        plano='refazerAbertas'}}
    if(novoParc)await put('parceiros',novoParc);
    else{const p=byId('parceiros',parceiroId);if(p&&!(isC?p.fornecedor:p.cliente))await put('parceiros',{...p,[isC?'fornecedor':'cliente']:true})}
    const numero=id?o.numero:await proximoNumero(col);
    const rec={...o,id:opId,numero,data,parceiroId,itens:its,total,totalKg,forma:formaRec,contaId,pagamentos,entrada,parcelas,...(isC?{}:{totalMat,frete,impostoPct,margemAlvo}),primeiroVenc,permutaDesc:forma==='permuta'?fv(f,'permutaDesc'):'',obs:fv(f,'obs'),criadoEm:o.criadoEm||Date.now()};
    await put(col,rec);
    const pn=parcNome(parceiroId)!=='—'?parcNome(parceiroId):(novoParc?.nome||'');
    const desc=`${isC?'Compra':'Venda'} #${numero} · ${pn}`;
    const novasParcelas=(n,valor,venc,ini,tot,grupo)=>genTitulos({lado,descricao:desc,parceiroId,categoria,natureza:isC?'variavel':'',ref:{col,id:opId},criadoEm:Date.now()},'parcelada',n,valor,venc).map((x,i)=>({...x,parcela:ini+i,totalParcelas:tot,grupo:grupo||x.grupo}));
    // parcelas
    if(plano==='manter'){for(const t of lk.tit)if(t.descricao!==desc||t.parceiroId!==parceiroId)await put('titulos',{...t,descricao:desc,parceiroId})}
    else if(plano==='refazerAbertas'){
      for(const t of lk.tit.filter(t=>!t.pago))await del('titulos',t.id);
      const ord=pagos.slice().sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
      for(const [i,t] of ord.entries())await put('titulos',{...t,parcela:i+1,totalParcelas:parcelas,descricao:desc,parceiroId});
      const resta=r2(aPrazo-ord.reduce((a,t)=>a+num(t.valor),0));
      if(resta>0.005)for(const x of novasParcelas(parcelas-ord.length,resta,addMonths(primeiroVenc,ord.length),ord.length+1,parcelas,ord[0]?.grupo))await put('titulos',x)}
    else{for(const t of lk.tit)await del('titulos',t.id);
      if(forma==='credito'&&aPrazo>0)for(const x of novasParcelas(parcelas,aPrazo,primeiroVenc,1,parcelas))await put('titulos',x)}
    // lançamento de caixa da própria operação (à vista ou entrada): atualiza no lugar
    const proprios=S.movimentos.filter(m=>m.ref?.col===col&&m.ref.id===opId&&!m.ref.frete);
    // frete CIF pago por nós: uma saída no caixa ligada à venda
    if(!isC){const fm=S.movimentos.filter(m=>m.ref?.col===col&&m.ref.id===opId&&m.ref.frete);
      if(frete?.tipo==='cif'&&frete.valor>0&&frete.contaId){await put('movimentos',{...(fm[0]||{id:nid(),criadoEm:Date.now()}),tipo:'saida',data,valor:frete.valor,contaId:frete.contaId,descricao:`Frete CIF · Venda #${numero} · ${pn}${frete.transportadora?' · '+frete.transportadora:''}`,categoria:'Frete de venda',parceiroId,ref:{col,id:opId,frete:true}});for(const m of fm.slice(1))await del('movimentos',m.id)}
      else for(const m of fm)await del('movimentos',m.id)}
    // um lançamento por conta; reaproveita os existentes na edição
    for(const [i,pg] of pagamentos.entries()){const m0=proprios[i];
      await put('movimentos',{...(m0||{id:nid(),criadoEm:Date.now()}),tipo:isC?'saida':'entrada',data,valor:pg.valor,contaId:pg.contaId,descricao:desc+` (${forma==='credito'?'entrada · ':''}${pgTxt(pg,isC)})`+(pagamentos.length>1?` ${i+1}/${pagamentos.length}`:''),meio:pg.meio,cheque:pg.cheque||null,categoria,parceiroId,ref:{col,id:opId}})}
    for(const m of proprios.slice(pagamentos.length))await del('movimentos',m.id);
    toast(`${isC?'Compra':'Venda'} #${numero} salva`);
  }});
}
async function delOp(col,id){
  const o=byId(col,id);const{tit,mov}=linked(id);
  const ok=await ask(`Excluir ${col==='compras'?'compra':'venda'} #${o.numero}`,`Excluir a ${col==='compras'?'compra':'venda'} de ${fd(o.data)} (${brl(o.total)})? O estoque será recalculado${mov.length?`, ${mov.length} lançamento(s) de caixa`:''}${tit.length?`${mov.length?' e':','} ${tit.length} parcela(s)`:''} também serão removidos.`,[{label:'Excluir',cls:'danger',v:true}]);
  if(!ok)return;await removeLinked(id);await del(col,id);toast('Excluído');
}

export {formOp,delOp};
