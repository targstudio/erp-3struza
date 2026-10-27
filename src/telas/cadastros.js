import {S} from '../dados.js';
import {UI} from '../estado.js';
import {histBtn} from './historico.js';
import {brl,esc,num} from '../util.js';

/* ---------- Cadastros ---------- */
function vCadastros(){
  let rows=S.parceiros.slice();
  if(UI.cadFiltro==='fornecedor')rows=rows.filter(p=>p.fornecedor);
  if(UI.cadFiltro==='cliente')rows=rows.filter(p=>p.cliente);
  if(UI.busca){const q=UI.busca.toLowerCase();rows=rows.filter(p=>(p.nome+' '+(p.documento||'')+' '+(p.cidade||'')).toLowerCase().includes(q))}
  rows.sort((a,b)=>a.nome.localeCompare(b.nome));
  const resumo=p=>{const c=S.compras.filter(x=>x.parceiroId===p.id),v=S.vendas.filter(x=>x.parceiroId===p.id);return{c,v,ct:c.reduce((a,x)=>a+num(x.total),0),vt:v.reduce((a,x)=>a+num(x.total),0)}};
  return{sub:'Empresas e pessoas físicas, interligadas entre compra e venda',actions:`<button class="btn pri" data-act="novoParc">+ Novo cadastro</button>`,html:`
  <div class="card"><div class="card-h"><div class="seg">${[['todos','Todos'],['fornecedor','Fornecedores'],['cliente','Clientes']].map(([k,l])=>`<button data-act="cadFiltro" data-v="${k}" class="${UI.cadFiltro===k?'on':''}">${l}</button>`).join('')}</div>
    <div class="sp"><input class="search" id="busca" placeholder="Buscar nome, CPF/CNPJ, cidade…" value="${esc(UI.busca)}"></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Tipo</th><th>CPF / CNPJ</th><th>Contato</th><th>Cidade</th><th>Papel</th><th class="r">Comprado dele</th><th class="r">Vendido a ele</th><th></th></tr></thead><tbody>
    ${rows.map(p=>{const r=resumo(p);return `<tr><td><button class="link" data-act="verParc" data-id="${p.id}">${esc(p.nome)}</button></td><td>${p.pessoa==='PF'?'Pessoa física':'Empresa'}</td><td class="num muted">${esc(p.documento||'—')}</td><td>${esc(p.telefone||'')}${p.email?`<div class="muted" style="font-size:12.5px">${esc(p.email)}</div>`:''}</td><td>${esc([p.cidade,p.uf].filter(Boolean).join(' / '))}</td>
      <td>${p.fornecedor?'<span class="pill p-info">Fornecedor</span> ':''}${p.cliente?'<span class="pill p-ok">Cliente</span>':''}</td>
      <td class="r">${r.c.length?brl(r.ct):'—'}</td><td class="r">${r.v.length?brl(r.vt):'—'}</td>
      <td class="acts"><button class="btn sm" data-act="editParc" data-id="${p.id}">Editar</button> <button class="btn sm danger" data-act="delParc" data-id="${p.id}">Excluir</button> ${histBtn('parceiros',p.id)}</td></tr>`}).join('')||`<tr><td colspan="9"><div class="empty"><b>Nenhum cadastro</b>Cadastre empresas ou pessoas físicas. O mesmo cadastro pode ser fornecedor e cliente.</div></td></tr>`}
    </tbody></table></div></div>`};
}

export {vCadastros};
