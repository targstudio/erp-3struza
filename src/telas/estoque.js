import {S,parcNome} from '../dados.js';
import {UI} from '../estado.js';
import {EMB,estoque} from '../regras.js';
import {brl,esc,fd,fkg,fnum,swatch} from '../util.js';

/* ---------- Estoque ---------- */
function vEstoque(){
  const todos=estoque();
  let rows=todos.filter(e=>Math.abs(e.kg)>0.0001||Math.abs(e.un)>0.0001);
  const all=rows,zerados=todos.length-rows.length;
  if(UI.estZero)rows=todos;
  if(UI.estTipo)rows=rows.filter(e=>e.tipo===UI.estTipo);
  if(UI.estCor)rows=rows.filter(e=>e.cor===UI.estCor);
  const porTipo={};all.forEach(e=>{const p=porTipo[e.tipo]||(porTipo[e.tipo]={kg:0,valor:0,saco:0,bigbag:0,granel:0,cores:{}});p.kg+=e.kg;p.valor+=e.valor;p[e.embalagem]+=e.embalagem==='granel'?e.kg:e.un;p.cores[e.cor]=(p.cores[e.cor]||0)+e.kg});
  const maxT=Math.max(1,...Object.values(porTipo).map(p=>p.kg));
  const tipos=[...new Set(todos.map(e=>e.tipo))],cores=[...new Set(todos.map(e=>e.cor))];
  // kardex
  const kx=[];
  S.compras.forEach(c=>(c.itens||[]).forEach(it=>kx.push({data:c.data,o:'Compra #'+c.numero,p:parcNome(c.parceiroId),it,s:1})));
  S.vendas.forEach(c=>(c.itens||[]).forEach(it=>kx.push({data:c.data,o:'Venda #'+c.numero,p:parcNome(c.parceiroId),it,s:-1})));
  S.ajustes.forEach(a=>kx.push({data:a.data,o:'Ajuste',p:a.motivo||'',it:a,s:a.sentido==='saida'?-1:1,aj:a.id}));
  kx.sort((a,b)=>b.data.localeCompare(a.data));
  const kxF=kx.filter(k=>(!UI.estTipo||k.it.tipo===UI.estTipo)&&(!UI.estCor||k.it.cor===UI.estCor));
  const filtrado=!!(UI.estTipo||UI.estCor),kxShow=filtrado?kxF:kxF.slice(0,40);
  const totKg=rows.reduce((a,e)=>a+e.kg,0),totVal=rows.reduce((a,e)=>a+e.valor,0);
  return{sub:'Saldo por tipo de material, cor e embalagem',actions:`<button class="btn" data-act="ajuste">Ajuste / estoque inicial</button>`,html:`
  <div class="grid stock">${Object.entries(porTipo).map(([t,p])=>`<div class="sc"><h3>${esc(t)}</h3><b class="num ${p.kg<0?'neg':''}">${fkg(p.kg)}</b><div class="bar"><i style="width:${Math.max(0,p.kg)/maxT*100}%"></i></div>
    <div class="muted" style="font-size:13px">${[p.saco?fnum(p.saco,0)+' sacos':'',p.bigbag?fnum(p.bigbag,0)+' big bags':'',p.granel?fkg(p.granel)+' a granel':''].filter(Boolean).join(' · ')||'—'}</div>
    <div style="font-size:13px;display:flex;flex-wrap:wrap;gap:4px 10px">${Object.entries(p.cores).filter(([,v])=>Math.abs(v)>0.01).map(([c,v])=>`<span>${swatch(c)}${esc(c)} <span class="muted num">${fkg(v)}</span></span>`).join('')}</div>
    <div class="muted" style="font-size:12.5px">Custo estimado ${brl(p.valor)}</div></div>`).join('')||`<div class="card"><div class="empty"><b>Estoque vazio</b>As compras entram no estoque automaticamente. Para material que já está no barracão, use “Ajuste / estoque inicial”.</div></div>`}</div>
  <div class="card"><div class="card-h"><h2>Saldo detalhado</h2><div class="sp toolbar">
    <select class="f" data-act="estTipo" id="estTipo"><option value="">Todos os tipos</option>${tipos.map(t=>`<option ${UI.estTipo===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    <select class="f" data-act="estCor" id="estCor"><option value="">Todas as cores</option>${cores.map(t=>`<option ${UI.estCor===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
    ${zerados?`<label style="display:flex;gap:6px;align-items:center;font-size:13.5px;white-space:nowrap"><input type="checkbox" data-act="estZero" ${UI.estZero?'checked':''}> Mostrar zerados (${zerados})</label>`:''}</div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Material</th><th>Cor</th><th>Embalagem</th><th class="r">Peso da embalagem</th><th class="r">Qtd. embalagens</th><th class="r">Peso total</th><th class="r">Custo médio/kg</th><th class="r">Valor em estoque</th></tr></thead><tbody>
    ${rows.map(e=>`<tr><td>${esc(e.tipo)}</td><td>${swatch(e.cor)}${esc(e.cor)}</td><td>${EMB[e.embalagem]}</td><td class="r">${e.embalagem==='granel'?'—':fkg(e.pesoUn)}</td><td class="r">${e.embalagem==='granel'?'—':fnum(e.un,0)}</td><td class="r ${e.kg<0?'neg':''}"><b>${fkg(e.kg)}</b></td><td class="r">${e.custoKg?brl(e.custoKg):'—'}</td><td class="r">${brl(e.valor)}</td></tr>`).join('')||'<tr><td colspan="8"><div class="empty">Nenhum item para o filtro.</div></td></tr>'}
    </tbody>${rows.length?`<tfoot><tr><td colspan="5">Total</td><td class="r">${fkg(totKg)}</td><td></td><td class="r">${brl(totVal)}</td></tr></tfoot>`:''}</table></div></div>
  <div class="card"><div class="card-h"><h2>Movimentação de estoque</h2><span class="sp muted" style="font-size:13px">${filtrado?`${kxF.length} lançamento(s) de ${esc([UI.estTipo,UI.estCor].filter(Boolean).join(' '))}`:'últimos 40 lançamentos · filtre por tipo ou cor para ver tudo'}</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Origem</th><th>Material</th><th>Embalagem</th><th class="r">Peso</th><th></th></tr></thead><tbody>
    ${kxShow.map(k=>`<tr><td class="num">${fd(k.data)}</td><td>${esc(k.o)} <span class="muted">${esc(k.p)}</span></td><td>${swatch(k.it.cor)}${esc(k.it.tipo)} ${esc(k.it.cor)}</td><td class="muted">${k.it.embalagem==='granel'?'Granel':fnum(k.it.qtd,0)+' × '+EMB[k.it.embalagem]+' '+fnum(k.it.pesoUn,0)+' kg'}</td><td class="r ${k.s>0?'pos':'neg'}">${k.s>0?'+ ':'− '}${fkg(k.it.kg)}</td><td class="acts">${k.aj?`<button class="btn sm danger" data-act="delAjuste" data-id="${k.aj}">Excluir</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Sem movimentação.</div></td></tr>'}
    </tbody></table></div></div>`};
}

export {vEstoque};
