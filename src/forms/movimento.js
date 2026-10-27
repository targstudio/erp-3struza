import {S,byId,cfg,put} from '../dados.js';
import {formConta} from './conta.js';
import {contaOpts,defaultConta,fv,modal,opt,toast} from '../modal.js';
import {esc,fnum,nid,num,today} from '../util.js';

/* --- movimento manual --- */
function formMov(tipo,id){
  const m=id?byId('movimentos',id):{tipo,data:today(),contaId:defaultConta('pix')};tipo=m.tipo;
  if(!S.contas.length){toast('Cadastre uma conta de saldo primeiro');formConta();return}
  if(tipo==='transferencia'){
    modal(id?'Editar transferência':'Transferência entre contas',`
      <p class="hint" style="margin:0">Move o mesmo dinheiro de um local para outro. Não conta como entrada nem saída.</p>
      <div class="row"><label class="fl">De<select name="contaId" id="tDe">${contaOpts(m.contaId)}</select></label>
      <label class="fl">Para<select name="contaDestinoId" id="tPara">${contaOpts(m.contaDestinoId||S.contas.find(c=>c.id!==m.contaId)?.id)}</select></label></div>
      <div class="row"><label class="fl">Data<input type="date" name="data" id="tData" value="${m.data}"></label><label class="fl">Valor (R$)<input name="valor" id="tValor" inputmode="decimal" value="${m.valor?fnum(m.valor):''}"></label></div>
      <label class="fl">Descrição<input name="descricao" id="tDesc" value="${esc(m.descricao||'')}" placeholder="Ex.: Depósito do dinheiro da gaveta"></label>`,
    {onSubmit:async f=>{const v=num(fv(f,'valor'));if(v<=0)throw'Informe um valor maior que zero.';if(fv(f,'contaId')===fv(f,'contaDestinoId'))throw'Escolha contas diferentes.';
      await put('movimentos',{...m,id:id||nid(),tipo,contaId:fv(f,'contaId'),contaDestinoId:fv(f,'contaDestinoId'),data:fv(f,'data')||today(),valor:v,descricao:fv(f,'descricao')||'Transferência entre contas',criadoEm:m.criadoEm||Date.now()});toast('Transferência registrada')}});
    return;
  }
  const c=cfg();const cats=tipo==='entrada'?c.catReceber:c.catPagar;
  modal((id?'Editar ':'Nova ')+(tipo==='entrada'?'entrada':'saída'),`
    <div class="row"><label class="fl">Data<input type="date" name="data" id="mData" value="${m.data}"></label><label class="fl">Valor (R$)<input name="valor" id="mValor" inputmode="decimal" value="${m.valor?fnum(m.valor):''}"></label></div>
    <label class="fl">Descrição<input name="descricao" id="mDesc" value="${esc(m.descricao||'')}"></label>
    <div class="row"><label class="fl">Conta<select name="contaId" id="mConta">${contaOpts(m.contaId)}</select></label>
    <label class="fl">Categoria<select name="categoria" id="mCat">${opt(cats,m.categoria,'—')}</select></label></div>
    <label class="fl">Cliente / fornecedor (opcional)<select name="parceiroId" id="mParc"><option value="">—</option>${S.parceiros.slice().sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=>`<option value="${p.id}" ${p.id===m.parceiroId?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></label>`,
  {onSubmit:async f=>{const v=num(fv(f,'valor'));if(v<=0)throw'Informe um valor maior que zero.';if(!fv(f,'descricao'))throw'Informe a descrição.';
    await put('movimentos',{...m,id:id||nid(),tipo,data:fv(f,'data')||today(),valor:v,descricao:fv(f,'descricao'),contaId:fv(f,'contaId'),categoria:fv(f,'categoria'),parceiroId:fv(f,'parceiroId'),criadoEm:m.criadoEm||Date.now()});toast(tipo==='entrada'?'Entrada lançada':'Saída lançada')}});
}

export {formMov};
