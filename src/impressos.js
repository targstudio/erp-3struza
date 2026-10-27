import {byId} from './dados.js';
import {pgTxt} from './forms/pagamento.js';
import {modal} from './modal.js';
import {EMB,FORMA,FRETE,linked,codVenda,rotOp} from './regras.js';
import {brl,esc,fd,fkg,fnum,num} from './util.js';

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

export {romaneio,recibo};
