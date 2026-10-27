import {cfg,put} from '../dados.js';
import {fv,modal,opt,toast} from '../modal.js';
import {EMB} from '../regras.js';
import {fnum,nid,num,r2,today} from '../util.js';

/* --- ajuste de estoque --- */
function formAjuste(){
  const c=cfg();
  modal('Ajuste de estoque',`
    <p class="hint" style="margin:0">Use para lançar o material que já está no barracão (estoque inicial), perdas, quebra de peso ou correções de contagem.</p>
    <div class="opts"><label><input type="radio" name="sentido" value="entrada" checked>Entrada (+)</label><label><input type="radio" name="sentido" value="saida">Saída (−)</label></div>
    <div class="row"><label class="fl">Data<input type="date" name="data" id="aData" value="${today()}"></label><label class="fl">Tipo de material<select name="tipo" id="aTipo">${opt(c.tipos)}</select></label><label class="fl">Cor<select name="cor" id="aCor">${opt(c.cores)}</select></label></div>
    <div class="row"><label class="fl">Embalagem<select name="embalagem" id="aEmb">${Object.entries(EMB).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="fl">Qtd. embalagens<input name="qtd" id="aQtd" inputmode="decimal" value="1"></label><label class="fl">Peso da embalagem (kg)<input name="pesoUn" id="aPeso" inputmode="decimal" value="${fnum(c.pesoSaco)}"></label><label class="fl">Peso total (kg)<input name="kg" id="aKg" inputmode="decimal" value="${fnum(c.pesoSaco)}"></label></div>
    <div class="row"><label class="fl">Custo por kg (opcional)<input name="custoKg" id="aCusto" inputmode="decimal"></label><label class="fl">Motivo<input name="motivo" id="aMot" placeholder="Ex.: Estoque inicial, perda na moagem"></label></div>`,
  {onMount:f=>{const sync=e=>{const emb=fv(f,'embalagem');const g=emb==='granel';f.elements.qtd.disabled=g;f.elements.pesoUn.disabled=g;
      if(e?.target?.name==='embalagem'&&!g)f.elements.pesoUn.value=fnum(emb==='saco'?c.pesoSaco:c.pesoBag);
      if(!g&&e?.target?.name!=='kg')f.elements.kg.value=fnum(num(fv(f,'qtd'))*num(fv(f,'pesoUn')))};
    f.addEventListener('input',sync);f.addEventListener('change',sync)},
   onSubmit:async f=>{const emb=fv(f,'embalagem');const kg=num(fv(f,'kg'));if(kg<=0)throw'Informe o peso.';
    await put('ajustes',{id:nid(),data:fv(f,'data')||today(),sentido:f.elements.sentido.value,tipo:fv(f,'tipo'),cor:fv(f,'cor'),embalagem:emb,qtd:emb==='granel'?0:num(fv(f,'qtd')),pesoUn:emb==='granel'?0:num(fv(f,'pesoUn')),kg:r2(kg),custoKg:num(fv(f,'custoKg')),motivo:fv(f,'motivo'),criadoEm:Date.now()});toast('Ajuste lançado')}});
}

export {formAjuste};
