import {S,parcNome} from '../dados.js';
import {UI} from '../estado.js';
import {TIPOCONTA,caixaPrevisto,estoque,pillT,saldoConta,saldoTotal,vendasPorMes} from '../regras.js';
import {colunas,linha} from '../graficos.js';
import {needSetup} from '../render.js';
import {ICON,addDays,addMonths,brl,esc,fd,fdShort,fkg,fnum,mLabel,mShort,num,today} from '../util.js';

/* ---------- Painel ---------- */
function vPainel(){
  const t=today(),mes=t.slice(0,7);
  const ab=S.titulos.filter(x=>!x.pago);
  const pagarMes=ab.filter(x=>x.lado==='pagar'&&x.vencimento.slice(0,7)===mes).reduce((a,x)=>a+num(x.valor),0);
  const receberMes=ab.filter(x=>x.lado==='receber'&&x.vencimento.slice(0,7)===mes).reduce((a,x)=>a+num(x.valor),0);
  const atrasP=ab.filter(x=>x.lado==='pagar'&&x.vencimento<t);const atrasR=ab.filter(x=>x.lado==='receber'&&x.vencimento<t);
  const est=estoque();const kgTot=est.reduce((a,e)=>a+Math.max(0,e.kg),0);const valTot=est.reduce((a,e)=>a+Math.max(0,e.valor),0);
  // valor em estoque por tipo de material, maiores primeiro
  const valTipo=[...est.reduce((m,e)=>{if(e.kg>0){const t=m.get(e.tipo)||{kg:0,valor:0};t.kg+=e.kg;t.valor+=Math.max(0,e.valor);m.set(e.tipo,t)}return m},new Map())].sort((a,b)=>b[1].valor-a[1].valor);
  const vendMes=S.vendas.filter(v=>v.data.slice(0,7)===mes);const compMes=S.compras.filter(v=>v.data.slice(0,7)===mes);
  const kgV=vendMes.reduce((a,v)=>a+num(v.totalKg),0),kgC=compMes.reduce((a,v)=>a+num(v.totalKg),0);
  const vV=vendMes.reduce((a,v)=>a+num(v.total),0),vC=compMes.reduce((a,v)=>a+num(v.total),0);
  // chart
  const months=[];for(let i=5;i>=0;i--)months.push(addMonths(mes+'-01',-i).slice(0,7));
  const data=months.map(m=>{let e=0,s=0;S.movimentos.forEach(x=>{if(x.data.slice(0,7)!==m)return;if(x.tipo==='entrada')e+=num(x.valor);if(x.tipo==='saida')s+=num(x.valor)});return{m,e,s}});
  const svg=colunas({rotulo:'Entradas e saídas dos últimos 6 meses',series:[{cor:'var(--pos)'},{cor:'var(--neg)'}],
    grupos:data.map(d=>({rot:mShort(d.m),valores:[d.e,d.s],tip:`<b>${mLabel(d.m)}</b>${tl('var(--pos)','Entradas',brl(d.e))}${tl('var(--neg)','Saídas',brl(d.s))}${tl('','Resultado',(d.e-d.s<0?'− ':'')+brl(Math.abs(d.e-d.s)))}`}))});
  // caixa previsto para os próximos 30 dias
  const prev=caixaPrevisto(30,t);const menor=prev.reduce((a,p)=>p.saldo<a.saldo?p:a,prev[0]);const fimPrev=prev[prev.length-1];
  const svgPrev=linha({rotulo:'Saldo previsto para os próximos 30 dias',
    pontos:prev.map((p,i)=>({v:p.saldo,tip:`<b>${i?fd(p.data):'Hoje'}</b>${tl('','Saldo previsto',brl(p.saldo))}${p.ent?tl('var(--pos)','Entra',brl(p.ent)):''}${p.sai?tl('var(--neg)','Sai',brl(p.sai)):''}${p.atras?`<div class="mu">inclui ${p.atras} conta(s) atrasada(s)</div>`:''}`})),
    rotulos:[0,10,20,30].map(i=>({i,txt:i?fdShort(prev[i].data):'Hoje'}))});
  // vendas dos últimos 6 meses
  const vm=vendasPorMes(6,mes);
  const vAtual=vm[vm.length-1],vMedia=vm.reduce((a,v)=>a+v.total,0)/vm.length;
  const svgVendas=colunas({rotulo:'Vendas dos últimos 6 meses',largura:420,altura:230,series:[{cor:'var(--accent)'}],
    grupos:vm.map(v=>({rot:mShort(v.mes),valores:[v.total],tip:`<b>${mLabel(v.mes)}</b>${tl('','Vendido',brl(v.total))}${tl('','Peso',fkg(v.kg))}${v.kg?tl('','Preço médio',brl(v.total/v.kg)+'/kg'):''}<div class="mu">${v.qtd} venda(s)</div>`}))});
  const prox=ab.filter(x=>x.vencimento<=addDays(t,15)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).slice(0,8);
  const porTipo={};est.forEach(e=>{if(e.kg>0)porTipo[e.tipo]=(porTipo[e.tipo]||0)+e.kg});
  const maxT=Math.max(1,...Object.values(porTipo));
    // saldo ao fim de cada mês (sparkline do card azul)
  const saldoIni=S.contas.filter(c=>c.ativo!==false).reduce((a,c)=>a+num(c.saldoInicial),0);
  const fimMes=months.map(m=>saldoIni+S.movimentos.reduce((a,x)=>x.data.slice(0,7)<=m?(x.tipo==='entrada'?a+num(x.valor):x.tipo==='saida'?a-num(x.valor):a):a,0));
  const varMes=fimMes[5]-fimMes[4];
  const mn=Math.min(...fimMes),mx=Math.max(...fimMes),rg=(mx-mn)||1;
  const pts=fimMes.map((v,i)=>[8+i*(284/5),8+(1-(v-mn)/rg)*52]);
  const spark=`<svg class="spark" viewBox="0 0 300 84" aria-hidden="true"><path d="M${pts.map(p=>p.join(',')).join(' L')} L${pts[5][0]},62 L8,62Z" fill="rgba(255,255,255,.18)"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${pts[5][0]}" cy="${pts[5][1]}" r="4" fill="#fff"/>${months.map((m,i)=>`<text x="${8+i*(284/5)}" y="80" text-anchor="${i===0?'start':i===5?'end':'middle'}" ${i===5?'font-weight="700" style="fill:#fff"':''}>${mShort(m).toLowerCase()}</text>`).join('')}</svg>`;
  const entMes=data[5].e,saiMes=data[5].s,res=entMes-saiMes;
  const abR=ab.filter(x=>x.lado==='receber');const receberTot=abR.reduce((a,x)=>a+num(x.valor),0);
  const late=[...atrasP,...atrasR].filter(x=>!UI.dispensados?.has(x.id)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento));
  const IC={cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>',coin:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11"/>',trend:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',down:'<path d="M12 5v14M5 12l7 7 7-7"/>',box:ICON.estoque,cart:ICON.compras,tag:ICON.vendas,warn:'<path d="M12 3l10 18H2L12 3zM12 10v5M12 18h.01"/>'};
  const ic=(k,c='')=>`<div class="ic ${c}"><svg viewBox="0 0 24 24">${IC[k]}</svg></div>`;
  return{sub:'Caixa, contas, compras, vendas e estoque da 3STRUZA em um só lugar.',actions:`<button class="btn" data-act="novaCompra"><svg viewBox="0 0 24 24">${ICON.compras}</svg>Nova compra</button><button class="btn pri" data-act="novaVenda"><svg viewBox="0 0 24 24">${ICON.vendas}</svg>Nova venda</button>`,html:`
  ${needSetup()}
  ${late.length?`<div class="notice"><h3><svg viewBox="0 0 24 24">${IC.warn}</svg>${late.length===1?'1 conta atrasada para conferir':late.length+' contas atrasadas para conferir'}</h3>
    ${late.filter(x=>!UI.dispensados?.has(x.id)).slice(0,3).map(x=>`<div class="nrow"><div class="t"><b>${esc(x.parceiroId?parcNome(x.parceiroId):x.descricao)}</b> <span class="muted">· ${x.parceiroId?esc(x.descricao)+' · ':''}${x.totalParcelas>1?`parcela ${x.parcela}/${x.totalParcelas} · `:''}venceu em ${fd(x.vencimento)} (${brl(x.valor)})</span></div><button class="btn pri" data-act="baixar" data-id="${x.id}"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>${x.lado==='pagar'?'Registrar pagamento':'Registrar recebimento'}</button><button class="btn dark" data-go="${x.lado}"><svg viewBox="0 0 24 24">${ICON[x.lado]}</svg>Ver em ${x.lado==='pagar'?'contas a pagar':'contas a receber'}</button><button class="btn ghost" data-act="dispensar" data-id="${x.id}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>Dispensar</button></div>`).join('')}
    ${late.length>3?`<div class="hint">e mais ${late.length-3}…</div>`:''}</div>`:''}
  ${(()=>{const cx=saldoTotal(),tot=cx+valTot,pc=tot>0?Math.max(0,Math.min(100,cx/tot*100)):0;
    const pagarTot=ab.filter(x=>x.lado==='pagar').reduce((a,x)=>a+num(x.valor),0);
    return `<div class="card patrimonio"><div class="card-b" style="display:flex;flex-wrap:wrap;gap:18px 32px;align-items:center">
      <div style="min-width:220px"><div class="muted" style="font-weight:600">Valor total da empresa</div><div class="num" style="font-size:34px;font-weight:700;color:var(--brand);letter-spacing:-.02em">${brl(tot)}</div><div class="muted" style="font-size:13px">Caixa + estoque (pelo custo médio)</div></div>
      <div style="flex:1;min-width:260px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--line)" role="img" aria-label="Caixa ${brl(cx)}, estoque ${brl(valTot)}"><i style="width:${pc}%;background:var(--brand)"></i><i style="flex:1;background:var(--graphite)"></i></div>
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:14px"><span><span class="dot" style="display:inline-block;background:var(--brand);margin-right:6px"></span>Caixa <b class="num">${brl(cx)}</b></span><span><span class="dot" style="display:inline-block;background:var(--graphite);margin-right:6px"></span>Estoque <b class="num">${brl(valTot)}</b> <span class="muted">· ${fkg(kgTot)}</span></span></div>
        <div class="muted" style="font-size:13px">Contando também o que está em aberto: + a receber ${brl(receberTot)} − a pagar ${brl(pagarTot)} = <b>${brl(tot+receberTot-pagarTot)}</b></div></div></div></div>`})()}
  <div class="grid heroes">
    <div class="hero blue"><h3>Saldo em caixa</h3>${ic('cal')}<div class="big">${brl(saldoTotal())}</div><span class="chip">${varMes>=0?'▲ +':'▼ −'}${brl(Math.abs(varMes))} vs ${mShort(months[4]).toLowerCase()}</span>${spark}<div class="foot">Soma de banco, gaveta e créditos com terceiros</div></div>
    <div class="hero graph"><h3>A receber</h3>${ic('coin')}<div class="big">${brl(receberTot)}</div><div class="meta">${abR.length} lançamento(s) em aberto · ${brl(receberMes)} vencem neste mês</div><div class="foot">${atrasR.length?`${atrasR.length} atrasado(s) somando ${brl(atrasR.reduce((a,x)=>a+num(x.valor),0))}`:'Nenhum recebimento atrasado'}</div></div>
    <div class="hero green"><h3>Resultado do mês</h3>${ic('trend')}<div class="big">${res<0?'− ':''}${brl(Math.abs(res))}</div><div class="meta">Entradas ${brl(entMes)} · Saídas ${brl(saiMes)}</div><div class="foot">Movimento de caixa de ${mLabel(mes).toLowerCase()}, sem transferências</div></div>
  </div>
  <div class="grid kpis">
    <div class="kpi"><span>A pagar no mês</span>${ic('down','n')}<b>${brl(pagarMes)}</b><small>${atrasP.length?`<span class="neg">${atrasP.length} atrasado(s) · ${brl(atrasP.reduce((a,x)=>a+num(x.valor),0))}</span>`:'Nada atrasado'}</small></div>
    <div class="kpi"><span>Valor em estoque</span>${ic('box','w')}<b>${brl(valTot)}</b><small>${fkg(kgTot)}${kgTot?` · custo médio ${brl(valTot/kgTot)}/kg`:''}${valTipo.length?'<br>'+valTipo.slice(0,2).map(([t,v])=>`${esc(t)} ${fkg(v.kg)} · ${brl(v.valor)}`).join('<br>'):''}</small></div>
    <div class="kpi"><span>Vendas no mês</span>${ic('tag','p')}<b>${brl(vV)}</b><small>${fkg(kgV)} · ${vendMes.length} venda(s)${kgV?` · ${brl(vV/kgV)}/kg`:''}</small></div>
    <div class="kpi"><span>Compras no mês</span>${ic('cart')}<b>${brl(vC)}</b><small>${fkg(kgC)} · ${compMes.length} compra(s)${kgC?` · ${brl(vC/kgC)}/kg`:''}</small></div>
  </div>
  <div class="grid two">
    <div class="card"><div class="card-h"><h2>Entradas e saídas</h2><div class="sp legend"><span><i style="background:var(--pos)"></i>Entradas</span><span><i style="background:var(--neg)"></i>Saídas</span></div></div><div class="card-b">${svg}</div></div>
    <div class="card"><div class="card-h"><h2>Vencimentos próximos</h2><span class="sp muted" style="font-size:13px">até ${fd(addDays(t,15))}</span></div>
      <div class="list">${prox.length?prox.map(x=>`<div class="li"><div class="d">${fdShort(x.vencimento)}</div><div class="m"><div>${esc(x.descricao)}${x.totalParcelas>1?` <span class="muted">${x.parcela}/${x.totalParcelas}</span>`:''}</div><div class="muted" style="font-size:12.5px">${x.lado==='pagar'?'A pagar':'A receber'}${x.parceiroId?' · '+esc(parcNome(x.parceiroId)):''}</div></div><div class="v ${x.lado==='pagar'?'neg':'pos'}">${brl(x.valor)}</div>${pillT(x)}</div>`).join(''):'<div class="empty">Nenhum vencimento nos próximos 15 dias.</div>'}</div></div>
  </div>
  <div class="grid two">
    <div class="card"><div class="card-h"><h2>Caixa previsto</h2><span class="sp muted" style="font-size:13px">próximos 30 dias</span></div><div class="card-b">${svgPrev}
      <div class="prev-res"><div><span>Menor saldo</span><b class="${menor.saldo<0?'neg':''}">${brl(menor.saldo)}</b><small>${menor.data===t?'hoje':fd(menor.data)}</small></div><div><span>Em ${fdShort(fimPrev.data)}</span><b class="${fimPrev.saldo<0?'neg':''}">${brl(fimPrev.saldo)}</b><small>saldo de hoje + a receber − a pagar</small></div></div></div></div>
    <div class="card"><div class="card-h"><h2>Vendas por mês</h2><div class="sp"><button class="link" data-go="vendas">Ver vendas</button></div></div><div class="card-b">${svgVendas}
      <div class="prev-res"><div><span>Neste mês</span><b>${brl(vAtual.total)}</b><small>${fkg(vAtual.kg)} · ${vAtual.qtd} venda(s)</small></div><div><span>Média por mês</span><b>${brl(vMedia)}</b><small>últimos 6 meses</small></div></div></div></div>
  </div>
  <div class="grid two">
    <div class="card"><div class="card-h"><h2>Saldo por local</h2><div class="sp"><button class="link" data-go="caixa">Ver caixa</button></div></div>
      <div class="list">${S.contas.filter(c=>c.ativo!==false).map(c=>`<div class="li"><span class="dot d-${c.tipo}"></span><div class="m"><div>${esc(c.nome)}</div><div class="muted" style="font-size:12.5px">${TIPOCONTA[c.tipo]}${c.detalhe?' · '+esc(c.detalhe):''}</div></div><div class="v">${brl(saldoConta(c.id))}</div></div>`).join('')||'<div class="empty">Nenhuma conta cadastrada.</div>'}</div></div>
    <div class="card"><div class="card-h"><h2>Estoque por material</h2><div class="sp"><button class="link" data-go="estoque">Ver estoque</button></div></div>
      <div class="card-b" style="display:flex;flex-direction:column;gap:12px">${Object.keys(porTipo).length?Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:4px"><span>${esc(k)}</span><b class="num">${fkg(v)}</b></div><div class="bar"><i style="width:${v/maxT*100}%"></i></div></div>`).join(''):'<div class="empty">Sem material em estoque.</div>'}</div></div>
  </div>`};
}
// linha do balão de dica: marcador de cor, nome e valor
const tl=(cor,nome,valor)=>`<div class="tl"><span>${cor?`<i style="background:${cor}"></i>`:''}${nome}</span><b>${valor}</b></div>`;

export {vPainel};
