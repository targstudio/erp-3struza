import {contaNome} from '../dados.js';
import {contaOpts,defaultConta} from '../modal.js';
import {MEIO} from '../regras.js';
import {$,brl,esc,fd,fnum,num,r2} from '../util.js';

/* ---- linhas de pagamento: várias formas e contas no mesmo pagamento ---- */
function pgInit(o){const m0=MEIO[o.forma]?o.forma:'pix';
  const p=(o.pagamentos&&o.pagamentos.length?o.pagamentos:[{contaId:o.contaId||defaultConta(m0),valor:''}]).map(x=>({...x,meio:x.meio||m0,cheque:{titular:'proprio',...(x.cheque||{})},valor:x.valor===''?'':fnum(x.valor)}));
  if(p.length===1)p[0].valor='';return p}
const pgBox=label=>`<div class="hint" style="font-weight:600">${label}</div><div id="pgRows" style="display:flex;flex-direction:column;gap:10px"></div>
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn sm" id="addPg">+ Dividir em outra forma ou caixa</button><span class="hint" id="pgInfo"></span></div>`;
const chqTit=(isC,t)=>t==='terceiro'?'De terceiro':(isC?'Da 3STRUZA':'Do próprio cliente');
function pgMount(pags,alvo,isC){
  const info=()=>{const a=alvo();const vazios=pags.filter(x=>x.valor==='').length;const soma=pags.reduce((s,x)=>s+num(x.valor),0);
    $('#pgRows').querySelectorAll('[data-pgauto]').forEach(el=>el.placeholder=vazios===1?fnum(Math.max(0,r2(a-soma))):'0,00');
    $('#pgInfo').textContent=pags.length<2?'':vazios===1?`O campo vazio fica com ${brl(Math.max(0,a-soma))}`:Math.abs(soma-a)<0.005?'Valores conferem com o total':`Soma ${brl(soma)} de ${brl(a)} · ${soma<a?'faltam':'sobram'} ${brl(Math.abs(a-soma))}`};
  const draw=()=>{$('#pgRows').innerHTML=pags.map((x,i)=>{const ch=x.cheque;return `<div data-pg="${i}" style="display:flex;flex-direction:column;gap:8px;${i?'border-top:1px dashed var(--line);padding-top:10px':''}">
    <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) minmax(0,1fr) auto;gap:8px;align-items:end">
      <label class="fl">${i?'':'Forma'}<select data-pk="meio" aria-label="Forma">${Object.entries(MEIO).map(([k,l])=>`<option value="${k}" ${x.meio===k?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="fl">${i?'':'Caixa / conta'}<select data-pk="contaId" aria-label="Conta">${contaOpts(x.contaId)}</select></label>
      <label class="fl">${i?'':'Valor (R$)'}<input data-pk="valor" data-pgauto inputmode="decimal" value="${esc(x.valor)}" aria-label="Valor"></label>
      <button style="margin-bottom:4px" type="button" class="btn sm danger" data-pgrm="${i}" ${pags.length<2?'disabled':''} aria-label="Remover">×</button></div>
    ${x.meio==='cheque'?`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px">
      <label class="fl">Cheque<select data-ck="titular">${['proprio','terceiro'].map(t=>`<option value="${t}" ${ch.titular===t?'selected':''}>${chqTit(isC,t)}</option>`).join('')}</select></label>
      ${ch.titular==='terceiro'?`<label class="fl">Titular do cheque<input data-ck="nome" value="${esc(ch.nome||'')}" placeholder="Quem emitiu"></label>`:''}
      <label class="fl">Banco<input data-ck="banco" value="${esc(ch.banco||'')}"></label>
      <label class="fl">Nº do cheque<input data-ck="numero" value="${esc(ch.numero||'')}"></label>
      <label class="fl">Bom para<input type="date" data-ck="bomPara" value="${esc(ch.bomPara||'')}"></label></div>`:''}</div>`}).join('');info()};
  const R=$('#pgRows');
  const set=e=>{const r=e.target.closest('[data-pg]');if(!r)return null;const x=pags[+r.dataset.pg];
    if(e.target.dataset.pk)x[e.target.dataset.pk]=e.target.value;if(e.target.dataset.ck)x.cheque[e.target.dataset.ck]=e.target.value;return e.target};
  R.addEventListener('input',e=>{if(set(e))info()});
  R.addEventListener('change',e=>{const t=set(e);if(!t)return;
    if(t.dataset.pk==='meio'){const x=pags[+t.closest('[data-pg]').dataset.pg];const d=defaultConta(x.meio);if(d)x.contaId=d;draw()}
    if(t.dataset.ck==='titular')draw()});
  R.addEventListener('click',e=>{const b=e.target.closest('[data-pgrm]');if(b){pags.splice(+b.dataset.pgrm,1);draw()}});
  $('#addPg').onclick=()=>{const l=pags[pags.length-1]||{};const meio=l.meio==='pix'?'dinheiro':'pix';pags.push({meio,contaId:defaultConta(meio),valor:'',cheque:{titular:'proprio'}});draw()};
  return{draw,info}}
function pgCollect(ps,alvo,rot){
  if(ps.some(x=>!x.contaId))throw'Cadastre uma conta de saldo para registrar o pagamento.';
  if(ps.filter(x=>x.valor==='').length>1)throw'Informe o valor de cada linha (pode deixar só uma em branco para ficar com o restante).';
  const soma=r2(ps.reduce((a,x)=>a+num(x.valor),0));
  const out=ps.map(x=>{const pg={meio:x.meio,contaId:x.contaId,valor:x.valor===''?r2(alvo-soma):r2(num(x.valor))};
    if(x.meio==='cheque'){const c=x.cheque||{};if(c.titular==='terceiro'&&!(c.nome||'').trim())throw'Informe o titular do cheque de terceiro.';
      pg.cheque={titular:c.titular||'proprio',nome:c.titular==='terceiro'?(c.nome||'').trim():'',banco:(c.banco||'').trim(),numero:(c.numero||'').trim(),bomPara:c.bomPara||''}}
    return pg});
  if(out.some(x=>x.valor<=0))throw'Cada linha precisa ter valor maior que zero.';
  const tot=r2(out.reduce((a,x)=>a+x.valor,0));
  if(Math.abs(tot-alvo)>0.005)throw`A soma das formas de pagamento (${brl(tot)}) precisa ser igual ${rot} (${brl(alvo)}).`;
  return out}
function pgTxt(pg,isC){if(pg.meio!=='cheque')return MEIO[pg.meio]||'';const c=pg.cheque||{};
  return 'Cheque '+(c.titular==='terceiro'?'de '+c.nome:(isC?'próprio':'do cliente'))+(c.numero?' nº '+c.numero:'')+(c.banco?' '+c.banco:'')+(c.bomPara?' · bom para '+fd(c.bomPara):'')}
const pgCurto=(p,isC)=>p.meio==='cheque'?'Cheque '+(p.cheque?.titular==='terceiro'?p.cheque.nome:(isC?'próprio':'do cliente')):(MEIO[p.meio]||contaNome(p.contaId));
const pgResumo=(x,isC)=>(x.pagamentos||[]).map(p=>`<span title="${esc(pgTxt(p,isC)+' · '+contaNome(p.contaId))}">${esc(pgCurto(p,isC))} ${brl(p.valor)}</span>`).join('<br>');

export {pgInit,pgBox,chqTit,pgMount,pgCollect,pgTxt,pgCurto,pgResumo};
