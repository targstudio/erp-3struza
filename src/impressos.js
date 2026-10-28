import {S,byId,contaNome,parcNome} from './dados.js';
import {UI,periodo} from './estado.js';
import {pgTxt} from './forms/pagamento.js';
import {modal} from './modal.js';
import {EMB,FORMA,FRETE,linked,codVenda,rotOp,TIPOCONTA} from './regras.js';
import {brl,esc,fd,fkg,fnum,num,today} from './util.js';

/* ---------- Recibo / comprovante para imprimir ---------- */
// mostra o documento dentro do sistema; o botão imprime só o documento
function verImpresso(titulo,html){
  html=html.replace(/<div class="noprint"[^]*?<\/div>/,'');
  const f=modal(esc(titulo),`<iframe id="impFrame" title="${esc(titulo)}" style="width:100%;height:70vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe>`,
    {wide:true,submit:'',extra:'<button type="button" class="btn pri" id="impPrint">Imprimir ou salvar em PDF</button>'});
  const fr=f.querySelector('#impFrame');fr.srcdoc=html;
  f.querySelector('#impPrint').onclick=()=>fr.contentWindow.print();
}
function romaneio(id){
  const o=byId('vendas',id);if(!o)return;const p=byId('parceiros',o.parceiroId)||{};const fr=o.frete||{};
  const logo=document.querySelector('.login-logo')?.src||'';
  const un=o.itens.reduce((a,i)=>a+(i.embalagem==='granel'?0:num(i.qtd)),0);
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Romaneio · Venda ${codVenda(o)} · 3STRUZA</title><style>
    body{font-family:Inter,system-ui,Arial,sans-serif;color:#1d2330;margin:32px;font-size:13px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:14px 0}
    th,td{padding:8px 6px;border:1px solid #d5dae3;text-align:left}th{font-size:11px;text-transform:uppercase;color:#677085;background:#f4f6f9}.r{text-align:right}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid #0B419E;padding-bottom:14px}.muted{color:#677085}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-top:14px}.ass{margin-top:56px;display:flex;gap:30px}.ass div{flex:1;border-top:1px solid #1d2330;padding-top:6px;text-align:center;font-size:12px}
    @media print{.noprint{display:none}body{margin:12mm}}</style></head><body>
    <div class="noprint" style="margin-bottom:16px"><button onclick="print()" style="padding:8px 14px;font-size:14px">Imprimir ou salvar em PDF</button></div>
    <div class="top"><div>${logo?`<img src="${logo}" style="height:34px">`:'<h1>3STRUZA</h1>'}</div>
      <div style="text-align:right"><h1>Romaneio de carga</h1><div class="muted">Venda ${codVenda(o)} · ${fd(o.data)}</div></div></div>
    <div class="grid"><div><b>Destinatário:</b> ${esc(p.nome||'—')}${p.documento?'<br>'+esc(p.documento):''}${p.endereco||p.cidade?'<br>'+esc([p.endereco,p.cidade,p.uf].filter(Boolean).join(' · ')):''}${p.telefone?'<br>'+esc(p.telefone):''}</div>
      <div>${fr.tipo==='fob'?`<b>Frete:</b> FOB · por conta do cliente${num(fr.valor)?' · '+brl(fr.valor):''}`:''}${[fr.transportadora?'<b>Transportadora:</b> '+esc(fr.transportadora):'',fr.placa?'<b>Placa:</b> '+esc(fr.placa):'',fr.motorista?'<b>Motorista:</b> '+esc(fr.motorista):''].filter(Boolean).map(x=>(fr.tipo==='fob'?'<br>':'')+x).join(fr.tipo==='fob'?'':'<br>')}</div></div>
    <table><thead><tr><th>#</th><th>Material</th><th>Cor</th><th>Embalagem</th><th class="r">Qtd.</th><th class="r">Peso unit.</th><th class="r">Peso total</th><th>Conferido</th></tr></thead><tbody>
      ${o.itens.map((i,k)=>`<tr><td>${k+1}</td><td>${esc(i.tipo)}</td><td>${esc(i.cor)}</td><td>${EMB[i.embalagem]}</td><td class="r">${i.embalagem==='granel'?'—':fnum(i.qtd,0)}</td><td class="r">${i.embalagem==='granel'?'—':fkg(i.pesoUn)}</td><td class="r"><b>${fkg(i.kg)}</b></td><td></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4"><b>Total</b></td><td class="r"><b>${un?fnum(un,0):'—'}</b></td><td></td><td class="r"><b>${fkg(o.totalKg)}</b></td><td></td></tr></tfoot></table>
    <div class="grid"><div><b>Peso na balança (saída):</b> ____________ kg</div><div><b>Peso na balança (chegada):</b> ____________ kg</div></div>
    ${o.obs?`<p><b>Observações:</b> ${esc(o.obs)}</p>`:''}
    <div class="ass"><div>Expedição · 3STRUZA</div><div>Motorista${fr.motorista?' · '+esc(fr.motorista):''}</div><div>Recebido por · ${esc(p.nome||'cliente')}<br><span class="muted">data ___/___/_____</span></div></div></body></html>`;
  verImpresso('Romaneio · Venda '+codVenda(o),html);
}
function recibo(col,id){
  const o=byId(col,id);if(!o)return;const isC=col==='compras';const p=byId('parceiros',o.parceiroId)||{};const{tit}=linked(id);
  const logo=document.querySelector('.login-logo')?.src||'';
  const linhas=(o.itens||[]).map(i=>`<tr><td>${esc(i.tipo)} ${esc(i.cor)}</td><td>${i.embalagem==='granel'?'Granel':fnum(i.qtd,0)+' × '+EMB[i.embalagem]+' '+fnum(i.pesoUn,0)+' kg'}</td><td class="r">${fkg(i.kg)}</td><td class="r">${brl(i.precoKg)}</td><td class="r">${brl(num(i.kg)*num(i.precoKg))}</td></tr>`).join('');
  const pag=o.forma==='credito'?`${num(o.entrada)?`Entrada de ${brl(o.entrada)} + `:''}${tit.length} parcela(s): `+tit.slice().sort((a,b)=>a.parcela-b.parcela).map(t=>`${t.parcela}ª ${fd(t.vencimento)} ${brl(t.valor)}${t.pago?' (paga)':''}`).join(' · '):o.forma==='permuta'?'Troca / permuta'+(o.permutaDesc?': '+esc(o.permutaDesc):''):FORMA[o.forma];
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${rotOp(col,o)} · 3STRUZA</title><style>
    body{font-family:Inter,system-ui,Arial,sans-serif;color:#1d2330;margin:32px;font-size:13px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{padding:8px 6px;border-bottom:1px solid #e3e7ee;text-align:left}th{font-size:11px;text-transform:uppercase;color:#677085}.r{text-align:right}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid #0B419E;padding-bottom:14px}.muted{color:#677085}
    .tot{font-size:16px;font-weight:700}.ass{margin-top:60px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #1d2330;padding-top:6px;text-align:center}
    @media print{.noprint{display:none}body{margin:12mm}}</style></head><body>
    <div class="noprint" style="margin-bottom:16px"><button onclick="print()" style="padding:8px 14px;font-size:14px">Imprimir ou salvar em PDF</button></div>
    <div class="top"><div>${logo?`<img src="${logo}" style="height:34px">`:'<h1>3STRUZA</h1>'}</div>
      <div style="text-align:right"><h1>${isC?'Comprovante de compra #'+o.numero:'Recibo de venda '+codVenda(o)}</h1><div class="muted">Data ${fd(o.data)}</div></div></div>
    <p><b>${isC?'Fornecedor':'Cliente'}:</b> ${esc(p.nome||'—')}${p.documento?' · '+esc(p.documento):''}${p.cidade?'<br>'+esc([p.endereco,p.cidade,p.uf].filter(Boolean).join(' · ')):''}${p.telefone?'<br>'+esc(p.telefone):''}</p>
    <table><thead><tr><th>Material</th><th>Embalagem</th><th class="r">Peso</th><th class="r">R$/kg</th><th class="r">Subtotal</th></tr></thead><tbody>${linhas}</tbody>
      <tfoot>${o.frete?.cobrar&&num(o.frete.valor)?`<tr><td colspan="4">Frete (CIF)</td><td class="r">${brl(o.frete.valor)}</td></tr>`:''}<tr><td colspan="2"><b>Total</b></td><td class="r"><b>${fkg(o.totalKg)}</b></td><td></td><td class="r tot">${brl(o.total)}</td></tr></tfoot></table>
    ${o.frete?.tipo==='fob'?`<p><b>Frete:</b> FOB · por conta do cliente${num(o.frete.valor)?' · '+brl(o.frete.valor):''}${o.frete.transportadora?' · '+esc(o.frete.transportadora):''}${o.frete.placa?' · placa '+esc(o.frete.placa):''}</p>`:''}
    <p><b>Pagamento:</b> ${pag}${(o.pagamentos||[]).length>1||o.pagamentos?.[0]?.meio==='cheque'?'<br>'+o.pagamentos.map(x=>esc(pgTxt(x,isC))+' '+brl(x.valor)).join('<br>'):''}</p>${o.obs?`<p><b>Observações:</b> ${esc(o.obs)}</p>`:''}
    <div class="ass"><div>3STRUZA</div><div>${esc(p.nome||(isC?'Fornecedor':'Cliente'))}</div></div></body></html>`;
  verImpresso(isC?'Comprovante · Compra #'+o.numero:'Recibo · Venda '+codVenda(o),html);
}

/* ---------- Extrato dos caixas para apresentar ---------- */
// usa os mesmos filtros da tela Caixa (um caixa ou todos, e o período escolhido)
function extratoCaixa(){
  const contas=S.contas.filter(c=>c.ativo!==false);const fc=UI.filtroConta;const{ini,fim,label}=periodo();
  const logo=document.querySelector('.login-logo')?.src||'';
  // efeito de um lançamento no saldo de uma conta
  const ef=(m,cid)=>m.tipo==='transferencia'?(m.contaDestinoId===cid?num(m.valor):0)-(m.contaId===cid?num(m.valor):0):m.contaId!==cid?0:m.tipo==='entrada'?num(m.valor):-num(m.valor);
  const efG=m=>fc?ef(m,fc):m.tipo==='entrada'?num(m.valor):m.tipo==='saida'?-num(m.valor):0;
  const ord=S.movimentos.slice().sort((a,b)=>a.data.localeCompare(b.data)||(a.criadoEm||0)-(b.criadoEm||0));
  // posição de cada caixa no período
  const pos=(fc?contas.filter(c=>c.id===fc):contas).map(c=>{let antes=num(c.saldoInicial),e=0,sd=0;
    ord.forEach(m=>{const v=ef(m,c.id);if(!v)return;if(m.data<ini)antes+=v;else if(m.data<=fim){if(v>0)e+=v;else sd-=v}});
    return{c,antes,e,s:sd,depois:antes+e-sd}});
  const tot=pos.reduce((a,x)=>({antes:a.antes+x.antes,e:a.e+x.e,s:a.s+x.s,depois:a.depois+x.depois}),{antes:0,e:0,s:0,depois:0});
  // lançamentos do período com saldo acumulado
  let acc=tot.antes;const movs=[];
  ord.forEach(m=>{if(fc&&m.contaId!==fc&&m.contaDestinoId!==fc)return;if(m.data<ini||m.data>fim)return;const v=efG(m);acc+=v;movs.push({m,v,acc})});
  // no extrato geral as transferências entre caixas não mudam o total
  const entT=movs.reduce((a,x)=>a+Math.max(0,x.v),0),saiT=movs.reduce((a,x)=>a+Math.max(0,-x.v),0);
  const titulo=fc?'Extrato · '+contaNome(fc):'Extrato geral dos caixas';
  const per=UI.per==='tudo'?'Todo o período':(fd(ini)+' a '+fd(fim>today()?today():fim.replace(/-31$/,'-'+String(new Date(+fim.slice(0,4),+fim.slice(5,7),0).getDate()).padStart(2,'0'))));
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · 3STRUZA</title><style>
    body{font-family:Inter,system-ui,Arial,sans-serif;color:#1d2330;margin:32px;font-size:12.5px}h1{font-size:20px;margin:0}h2{font-size:14px;margin:22px 0 6px}
    table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:6px 6px;border-bottom:1px solid #e3e7ee;text-align:left;vertical-align:top}th{font-size:10.5px;text-transform:uppercase;color:#677085}
    .r{text-align:right;white-space:nowrap}.pos{color:#1a7f45}.neg{color:#c0322b}.muted{color:#677085}tfoot td{font-weight:700;border-top:2px solid #1d2330}
    .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid #0B419E;padding-bottom:14px}
    .res{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.res div{border:1px solid #e3e7ee;border-radius:8px;padding:10px 12px}.res span{display:block;font-size:11px;color:#677085;text-transform:uppercase}.res b{font-size:16px}
    .ass{margin-top:50px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #1d2330;padding-top:6px;text-align:center}
    @media print{body{margin:12mm}tr{break-inside:avoid}}</style></head><body>
    <div class="top"><div>${logo?`<img src="${logo}" style="height:34px">`:'<h1>3STRUZA</h1>'}</div>
      <div style="text-align:right"><h1>${esc(titulo)}</h1><div class="muted">${esc(per)} · emitido em ${fd(today())}</div></div></div>
    <div class="res"><div><span>Saldo inicial</span><b>${brl(tot.antes)}</b></div><div><span>Entradas</span><b class="pos">${brl(fc?tot.e:entT)}</b></div><div><span>Saídas</span><b class="neg">${brl(fc?tot.s:saiT)}</b></div><div><span>Saldo final</span><b>${brl(tot.depois)}</b></div></div>
    ${fc?'':`<h2>Posição de cada caixa</h2><table><thead><tr><th>Caixa</th><th>Tipo</th><th class="r">Saldo inicial</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Saldo final</th></tr></thead><tbody>
      ${pos.map(x=>`<tr><td>${esc(x.c.nome)}${x.c.detalhe?`<div class="muted">${esc(x.c.detalhe)}</div>`:''}</td><td>${TIPOCONTA[x.c.tipo]||''}</td><td class="r">${brl(x.antes)}</td><td class="r pos">${brl(x.e)}</td><td class="r neg">${brl(x.s)}</td><td class="r"><b>${brl(x.depois)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="r">${brl(tot.antes)}</td><td class="r">${brl(tot.e)}</td><td class="r">${brl(tot.s)}</td><td class="r">${brl(tot.depois)}</td></tr></tfoot></table>
      <div class="muted">Entradas e saídas por caixa incluem as transferências entre caixas; no resumo do topo elas não entram, porque o dinheiro só mudou de lugar.</div>`}
    <h2>Lançamentos</h2><table><thead><tr><th>Data</th><th>Descrição</th><th>Cliente / fornecedor</th>${fc?'':'<th>Caixa</th>'}<th class="r">Entrada</th><th class="r">Saída</th><th class="r">Saldo</th></tr></thead><tbody>
      <tr><td></td><td class="muted">Saldo inicial</td><td></td>${fc?'':'<td></td>'}<td></td><td></td><td class="r">${brl(tot.antes)}</td></tr>
      ${movs.map(({m,v,acc})=>`<tr><td class="r" style="text-align:left">${fd(m.data)}</td><td>${esc(m.descricao||'')}${m.categoria?`<div class="muted">${esc(m.categoria)}</div>`:''}</td><td>${m.parceiroId?esc(parcNome(m.parceiroId)):''}</td>
        ${fc?'':`<td>${m.tipo==='transferencia'?esc(contaNome(m.contaId))+' → '+esc(contaNome(m.contaDestinoId)):esc(contaNome(m.contaId))}</td>`}
        <td class="r pos">${v>0?brl(v):''}</td><td class="r neg">${v<0?brl(-v):''}${!v&&m.tipo==='transferencia'?`<span class="muted">transf. ${brl(m.valor)}</span>`:''}</td><td class="r">${brl(acc)}</td></tr>`).join('')||`<tr><td colspan="7" class="muted">Nenhum lançamento no período.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="${fc?3:4}">Saldo final</td><td class="r">${brl(fc?tot.e:entT)}</td><td class="r">${brl(fc?tot.s:saiT)}</td><td class="r">${brl(tot.depois)}</td></tr></tfoot></table>
    <div class="ass"><div>Responsável · 3STRUZA</div><div>Conferido por</div></div></body></html>`;
  verImpresso(titulo,html);
}

export {romaneio,recibo,extratoCaixa};
