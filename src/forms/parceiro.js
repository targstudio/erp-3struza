import {S,byId,put} from '../dados.js';
import {fv,modal,toast} from '../modal.js';
import {FORMA,codVenda} from '../regras.js';
import {brl,esc,fd,fkg,nid,num} from '../util.js';

/* --- parceiro --- */
function parcFields(p,pre=''){return `
  <div class="opts"><label><input type="radio" name="${pre}pessoa" value="PJ" ${p.pessoa!=='PF'?'checked':''}>Empresa (PJ)</label><label><input type="radio" name="${pre}pessoa" value="PF" ${p.pessoa==='PF'?'checked':''}>Pessoa física (PF)</label></div>
  <div class="row"><label class="fl">Nome / razão social<input name="${pre}nome" id="${pre}pNome" value="${esc(p.nome||'')}"></label><label class="fl">CPF / CNPJ<input name="${pre}documento" id="${pre}pDoc" value="${esc(p.documento||'')}"></label></div>`}
function formParc(id,preset){
  const p=id?byId('parceiros',id):{pessoa:'PJ',fornecedor:preset==='fornecedor',cliente:preset==='cliente'};
  modal(id?'Editar cadastro':'Novo cadastro',`${parcFields(p)}
    <div class="row"><label class="fl">Telefone / WhatsApp<input name="telefone" id="pTel" value="${esc(p.telefone||'')}"></label><label class="fl">E-mail<input name="email" id="pEmail" value="${esc(p.email||'')}"></label></div>
    <div class="row"><label class="fl">Cidade<input name="cidade" id="pCid" value="${esc(p.cidade||'')}"></label><label class="fl">UF<input name="uf" id="pUf" maxlength="2" value="${esc(p.uf||'')}"></label></div>
    <label class="fl">Endereço<input name="endereco" id="pEnd" value="${esc(p.endereco||'')}"></label>
    <div class="chk"><label><input type="checkbox" name="fornecedor" ${p.fornecedor?'checked':''}> Fornecedor (eu compro dele)</label><label><input type="checkbox" name="cliente" ${p.cliente?'checked':''}> Cliente (eu vendo para ele)</label></div>
    <label class="fl">Observações<textarea name="obs" id="pObs">${esc(p.obs||'')}</textarea></label>`,
  {onSubmit:async f=>{const nome=fv(f,'nome');if(!nome)throw'Informe o nome.';
    await put('parceiros',{...p,id:id||nid(),nome,pessoa:f.elements.pessoa.value,documento:fv(f,'documento'),telefone:fv(f,'telefone'),email:fv(f,'email'),cidade:fv(f,'cidade'),uf:fv(f,'uf').toUpperCase(),endereco:fv(f,'endereco'),fornecedor:f.elements.fornecedor.checked,cliente:f.elements.cliente.checked,obs:fv(f,'obs')});toast('Cadastro salvo')}});
}
function verParc(id){
  const p=byId('parceiros',id);const c=S.compras.filter(x=>x.parceiroId===id),v=S.vendas.filter(x=>x.parceiroId===id);
  const tit=S.titulos.filter(t=>t.parceiroId===id&&!t.pago);
  const hist=[...c.map(x=>({...x,k:'Compra'})),...v.map(x=>({...x,k:'Venda'}))].sort((a,b)=>b.data.localeCompare(a.data));
  modal(esc(p.nome),`
    <div class="muted">${p.pessoa==='PF'?'Pessoa física':'Empresa'}${p.documento?' · '+esc(p.documento):''}${p.telefone?' · '+esc(p.telefone):''}${p.cidade?' · '+esc(p.cidade):''}</div>
    <div class="grid kpis"><div class="kpi"><span>Comprado dele</span><b>${brl(c.reduce((a,x)=>a+num(x.total),0))}</b><small>${fkg(c.reduce((a,x)=>a+num(x.totalKg),0))}</small></div>
    <div class="kpi"><span>Vendido a ele</span><b>${brl(v.reduce((a,x)=>a+num(x.total),0))}</b><small>${fkg(v.reduce((a,x)=>a+num(x.totalKg),0))}</small></div>
    <div class="kpi"><span>Em aberto</span><b>${brl(tit.reduce((a,t)=>a+(t.lado==='receber'?1:-1)*num(t.valor),0))}</b><small>positivo = ele me deve</small></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Operação</th><th>Material</th><th class="r">Peso</th><th class="r">Total</th></tr></thead><tbody>
    ${hist.map(x=>`<tr><td class="num">${fd(x.data)}</td><td><span class="pill ${x.k==='Compra'?'p-info':'p-ok'}">${x.k==='Venda'?'Venda '+codVenda(x):x.k+' #'+x.numero}</span> <span class="muted">${FORMA[x.forma]}</span></td><td>${(x.itens||[]).map(i=>esc(i.tipo+' '+i.cor)).join(', ')}</td><td class="r">${fkg(x.totalKg)}</td><td class="r">${brl(x.total)}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhuma compra ou venda com este cadastro.</div></td></tr>'}
    </tbody></table></div>`,{wide:true,submit:'',extra:`<button type="button" class="btn" data-act="editParc" data-id="${id}">Editar cadastro</button>`});
}

export {parcFields,formParc,verParc};
