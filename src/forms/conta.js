import {byId,put} from '../dados.js';
import {fv,modal,toast} from '../modal.js';
import {TIPOCONTA,saldoConta} from '../regras.js';
import {brl,esc,fnum,nid,num} from '../util.js';

/* --- conta de saldo --- */
function formConta(id){
  const c=id?byId('contas',id):{tipo:'banco',saldoInicial:0,ativo:true};
  modal(id?'Editar conta de saldo':'Nova conta de saldo',`
    <label class="fl">Nome<input name="nome" id="cNome" required value="${esc(c.nome||'')}" placeholder="Ex.: Itaú C/C, Gaveta escritório, Crédito com Recicla Sul"></label>
    <div><div class="hint" style="margin-bottom:6px;font-weight:600">Local do saldo</div><div class="opts">${Object.entries(TIPOCONTA).map(([k,l])=>`<label><input type="radio" name="tipo" value="${k}" ${c.tipo===k?'checked':''}>${l}</label>`).join('')}</div></div>
    <div class="row"><label class="fl">Detalhe<input name="detalhe" id="cDet" value="${esc(c.detalhe||'')}" placeholder="Banco/agência/conta ou com quem está o crédito"></label>
    <label class="fl">Saldo inicial (R$)<input name="saldoInicial" id="cSaldo" inputmode="decimal" value="${fnum(c.saldoInicial)}"></label></div>
    ${id?`<div class="chk"><label><input type="checkbox" name="ativo" ${c.ativo!==false?'checked':''}> Conta ativa</label></div>`:''}`,
  {onSubmit:async f=>{const nome=fv(f,'nome');if(!nome)throw'Informe o nome da conta.';
    if(id&&c.ativo!==false&&!f.elements.ativo.checked){const sd=saldoConta(id);if(Math.abs(sd)>0.005)throw`Esta conta ainda tem saldo de ${brl(sd)}. Transfira o saldo para outra conta antes de inativar.`}
    await put('contas',{...c,id:id||nid(),nome,tipo:f.elements.tipo.value,detalhe:fv(f,'detalhe'),saldoInicial:num(fv(f,'saldoInicial')),ativo:id?f.elements.ativo.checked:true});toast('Conta salva')}});
}

export {formConta};
