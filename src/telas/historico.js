import {byId,contaNome,parcNome} from '../dados.js';
import {UI} from '../estado.js';
import {pgTxt} from '../forms/pagamento.js';
import {modal} from '../modal.js';
import {EMB,FORMA,FRETE,TIPOCONTA,codVenda} from '../regras.js';
import {render} from '../render.js';
import {MODE,SB} from '../sync.js';
import {brl,esc,fd,fkg} from '../util.js';

/* ---------- Histórico de alterações ---------- */
const HIST={rows:[],loaded:false,loading:false,more:false,err:''};
const COLNOME={contas:'Conta de saldo',parceiros:'Cadastro',movimentos:'Caixa',compras:'Compra',vendas:'Venda',titulos:'Conta a pagar/receber',ajustes:'Ajuste de estoque',config:'Configurações',orcamentos:'Orçamento',adiantamentos:'Adiantamento de cliente'};
const histBtn=(col,id)=>MODE==='supa'?`<button class="btn sm" data-act="hist" data-col="${col}" data-id="${id}" title="Histórico deste registro" aria-label="Histórico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>`:'';
async function loadHist(reset){
  if(MODE!=='supa'||HIST.loading)return;HIST.loading=true;if(reset){HIST.rows=[];HIST.more=false}
  let q=SB.from('historico').select('*').order('quando',{ascending:false}).range(HIST.rows.length,HIST.rows.length+99);
  if(UI.histPer!=='tudo')q=q.gte('quando',new Date(Date.now()-(+UI.histPer)*864e5).toISOString());
  if(UI.histUser)q=q.eq('usuario_email',UI.histUser);
  if(UI.histCol)q=q.eq('col',UI.histCol);
  const{data,error}=await q;HIST.loading=false;HIST.loaded=true;
  if(error){HIST.err=/historico/.test(error.message||'')?'missing':error.message;render();return}
  HIST.err='';HIST.rows.push(...data);HIST.more=data.length===100;render();
}
const LBL={nome:'Nome',tipo:'Tipo',detalhe:'Detalhe',saldoInicial:'Saldo inicial',ativo:'Ativa',valor:'Valor',data:'Data',descricao:'Descrição',categoria:'Categoria',contaId:'Conta',contaDestinoId:'Conta destino',parceiroId:'Cliente/fornecedor',vencimento:'Vencimento',pago:'Pago',pagoEm:'Pago em',valorPago:'Valor pago',itens:'Itens',total:'Total',totalKg:'Peso total',forma:'Forma de pagamento',frete:'Frete',impostoPct:'Impostos (%)',margemAlvo:'Margem desejada (%)',totalMat:'Total do material',pagamentos:'Contas do pagamento',parcelas:'Parcelas',primeiroVenc:'1º vencimento',numero:'Número',documento:'CPF/CNPJ',telefone:'Telefone',email:'E-mail',cidade:'Cidade',uf:'UF',endereco:'Endereço',fornecedor:'Fornecedor',cliente:'Cliente',obs:'Observações',natureza:'Natureza',modo:'Lançamento',parcela:'Parcela',pessoa:'Pessoa',sentido:'Sentido',kg:'Peso',qtd:'Quantidade',pesoUn:'Peso embalagem',embalagem:'Embalagem',cor:'Cor',custoKg:'Custo/kg',motivo:'Motivo',permutaDesc:'Troca/permuta',tipos:'Tipos de material',cores:'Cores',catPagar:'Categorias a pagar',catReceber:'Categorias a receber',pesoSaco:'Peso do saco',pesoBag:'Peso do big bag',validade:'Válido até',condicao:'Condição de pagamento',vendaId:'Venda',usoAdiant:'Abatido do adiantamento',orcamentoId:'Orçamento'};
const SKIP=new Set(['criadoEm','seqDia','grupo','ref','movimentoId','exemplo','totalParcelas']);
const MONEY=new Set(['saldoInicial','valor','valorPago','total','custoKg','precoKg','usoAdiant']);
function fmtVal(k,v){
  if(v===undefined||v===null||v==='')return '—';
  if(MONEY.has(k))return brl(v);
  if(['data','vencimento','pagoEm','primeiroVenc','validade'].includes(k))return fd(v);
  if(['kg','totalKg','pesoSaco','pesoBag','pesoUn'].includes(k))return fkg(v);
  if(typeof v==='boolean')return v?'Sim':'Não';
  if(k==='contaId'||k==='contaDestinoId')return contaNome(v);
  if(k==='pagamentos'&&Array.isArray(v))return v.map(p=>pgTxt(p)+' · '+contaNome(p.contaId)+' '+brl(p.valor)).join('; ');
  if(k==='cheque'&&v)return pgTxt({meio:'cheque',cheque:v});
  if(k==='frete'&&v)return FRETE[v.tipo]+' · '+brl(v.valor)+(v.cobrar?' (cobrado do cliente)':'')+(v.transportadora?' · '+v.transportadora:'');
  if(k==='totalMat')return brl(v);
  if(k==='parceiroId')return parcNome(v);
  if(k==='forma')return FORMA[v]||v;
  if(k==='tipo'&&TIPOCONTA[v])return TIPOCONTA[v];
  if(k==='tipo'&&v==='devolucao')return 'Devolução';
  if(k==='vendaId'){const x=byId('vendas',v);return x?'Venda '+codVenda(x):'—'}
  if(k==='orcamentoId'){const x=byId('orcamentos',v);return x?'Orçamento nº '+x.numero:'—'}
  if(k==='tipo'&&({entrada:1,saida:1,transferencia:1})[v])return {entrada:'Entrada',saida:'Saída',transferencia:'Transferência'}[v];
  if(k==='sentido')return v==='saida'?'Saída':'Entrada';
  if(k==='natureza')return v==='fixa'?'Fixa':'Variável';
  if(k==='modo')return {unica:'Uma vez',recorrente:'Recorrente',parcelada:'Parcelado'}[v]||v;
  if(k==='embalagem')return EMB[v]||v;
  if(k==='itens'&&Array.isArray(v))return v.map(i=>`${i.tipo} ${i.cor} ${fkg(i.kg)} a ${brl(i.precoKg)}/kg`).join('; ');
  if(Array.isArray(v))return v.join(', ');
  if(typeof v==='object')return JSON.stringify(v);
  return String(v);
}
function descReg(col,d){
  if(!d)return '';
  switch(col){
    case 'contas':return `Conta “${d.nome}”`;
    case 'parceiros':return d.nome||'';
    case 'movimentos':return `${d.tipo==='entrada'?'Entrada':d.tipo==='saida'?'Saída':'Transferência'} de ${brl(d.valor)} · ${d.descricao||''}`;
    case 'compras':return `Compra #${d.numero} · ${parcNome(d.parceiroId)} · ${brl(d.total)}`;
    case 'vendas':return `Venda ${codVenda(d)} · ${parcNome(d.parceiroId)} · ${brl(d.total)}`;
    case 'titulos':return `${d.lado==='pagar'?'Conta a pagar':'Conta a receber'} “${d.descricao}”${d.totalParcelas>1?` ${d.parcela}/${d.totalParcelas}`:''}${d.renova?' (mensal)':''} · ${brl(d.valor)} · venc. ${fd(d.vencimento)}`;
    case 'ajustes':return `${d.sentido==='saida'?'Saída':'Entrada'} de ${fkg(d.kg)} de ${d.tipo} ${d.cor}${d.motivo?' · '+d.motivo:''}`;
    case 'orcamentos':return `Orçamento nº ${d.numero} · ${parcNome(d.parceiroId)} · ${brl(d.total)}`;
    case 'adiantamentos':return `${d.tipo==='devolucao'?'Devolução de adiantamento':'Adiantamento'} nº ${d.numero} · ${parcNome(d.parceiroId)} · ${brl(d.valor)}`;
    case 'config':return 'Configurações gerais';
  }return '';
}
function acaoTxt(h){
  if(h.acao==='alterou'&&h.col==='titulos'&&h.antes&&h.depois&&!h.antes.pago&&h.depois.pago)return['p-ok',h.depois.lado==='pagar'?'Pagou':'Recebeu'];
  if(h.acao==='alterou'&&h.col==='titulos'&&h.antes?.pago&&!h.depois?.pago)return['p-open','Estornou'];
  return{criou:['p-ok','Criou'],alterou:['p-info','Alterou'],excluiu:['p-late','Excluiu']}[h.acao]||['p-grey',h.acao];
}
function diffHtml(h){
  const a=h.antes||{},d=h.depois||{};
  const keys=[...new Set([...Object.keys(a),...Object.keys(d)])].filter(k=>!SKIP.has(k)&&JSON.stringify(a[k])!==JSON.stringify(d[k]));
  if(h.acao==='criou')return keys.filter(k=>d[k]!==''&&d[k]!=null).map(k=>`<span class="k">${esc(LBL[k]||k)}</span><span>${esc(fmtVal(k,d[k]))}</span>`).join('');
  if(h.acao==='excluiu')return Object.keys(a).filter(k=>!SKIP.has(k)&&a[k]!==''&&a[k]!=null).map(k=>`<span class="k">${esc(LBL[k]||k)}</span><span><del>${esc(fmtVal(k,a[k]))}</del></span>`).join('');
  return keys.map(k=>`<span class="k">${esc(LBL[k]||k)}</span><span><del>${esc(fmtVal(k,a[k]))}</del> → <ins>${esc(fmtVal(k,d[k]))}</ins></span>`).join('')||'<span class="k">Sem mudança visível</span><span></span>';
}
function histRow(h,compact){
  const[pc,pl]=acaoTxt(h);const dt=new Date(h.quando);const open=UI.histOpen.has(h.hid);
  return `<tr><td class="num" style="white-space:nowrap">${dt.toLocaleDateString('pt-BR')}<div class="muted" style="font-size:12.5px">${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div></td>
    <td>${esc(h.usuario_email||'—')}</td><td><span class="pill ${pc}">${pl}</span></td>
    ${compact?'':`<td class="muted">${esc(COLNOME[h.col]||h.col)}</td>`}
    <td style="min-width:260px">${esc(descReg(h.col,h.depois||h.antes))}
      <div><button class="link" style="font-size:13px" data-act="histToggle" data-id="${h.hid}">${open?'Ocultar detalhes':'Ver detalhes'}</button></div>
      ${open?`<div class="hrow-diff">${diffHtml(h)}</div>`:''}
      ${h.acao==='excluiu'&&h.antes&&!byId(h.col,h.id)?`<div><button class="btn sm" style="margin-top:6px" data-act="histRestaurar" data-id="${h.hid}">Restaurar</button></div>`:''}</td></tr>`;
}
function vHistorico(){
  if(MODE!=='supa')return{sub:'Quem alterou o quê e quando',html:`<div class="card"><div class="empty"><b>Histórico disponível na versão hospedada</b>Abra o ERP pelo endereço targstudio.github.io/erp-3struza.</div></div>`};
  if(HIST.err==='missing')return{sub:'Quem alterou o quê e quando',html:`<div class="card"><div class="empty"><b>Falta ativar o histórico no banco</b>Rode o arquivo <code>supabase/historico.sql</code> no SQL Editor do Supabase e recarregue a página.</div></div>`};
  const emails=[...new Set(HIST.rows.map(h=>h.usuario_email).filter(Boolean).concat(UI.histUser?[UI.histUser]:[]))].sort();
  return{sub:'Toda criação, alteração e exclusão fica registrada com usuário, data e hora',actions:`<button class="btn" data-act="histPer" data-v="${UI.histPer}">Atualizar</button>`,html:`
  <div class="card"><div class="card-h"><div class="toolbar"><div class="seg">${[['1','Hoje'],['7','7 dias'],['30','30 dias'],['tudo','Tudo']].map(([k,l])=>`<button data-act="histPer" data-v="${k}" class="${UI.histPer===k?'on':''}">${l}</button>`).join('')}</div>
    <select class="f" id="histUser" data-act="histUser"><option value="">Todos os usuários</option>${emails.map(e=>`<option ${UI.histUser===e?'selected':''}>${esc(e)}</option>`).join('')}</select>
    <select class="f" id="histCol" data-act="histCol"><option value="">Todos os módulos</option>${Object.entries(COLNOME).map(([k,l])=>`<option value="${k}" ${UI.histCol===k?'selected':''}>${l}</option>`).join('')}</select></div>
    <span class="sp muted" style="font-size:13px">${HIST.rows.length} registro(s)</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Registro</th></tr></thead><tbody>
    ${HIST.rows.map(h=>histRow(h)).join('')||`<tr><td colspan="5"><div class="empty"><b>${HIST.loading||!HIST.loaded?'Carregando histórico…':'Nenhuma alteração no período'}</b>${HIST.loaded?'Cada lançamento salvo a partir de agora aparece aqui automaticamente.':''}</div></td></tr>`}
    </tbody></table></div>
    ${HIST.more?`<div class="card-b" style="text-align:center"><button class="btn" data-act="histMais">Carregar mais</button></div>`:''}</div>`};
}
async function verHist(col,id){
  const{data,error}=await SB.from('historico').select('*').eq('col',col).eq('id',id).order('quando',{ascending:false}).limit(200);
  const rows=error?[]:data;const cur=byId(col,id);
  const m=modal('Histórico do registro',`<div class="muted">${esc(descReg(col,cur||rows[0]?.depois||rows[0]?.antes))}</div>
    ${error?`<div class="err">${/historico/.test(error.message)?'Rode o arquivo supabase/historico.sql no Supabase para ativar o histórico.':esc(error.message)}</div>`:''}
    <div class="tbl-wrap"><table><thead><tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Alterações</th></tr></thead><tbody>
    ${rows.map(h=>{const[pc,pl]=acaoTxt(h);const dt=new Date(h.quando);return `<tr><td class="num" style="white-space:nowrap">${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td><td>${esc(h.usuario_email||'—')}</td><td><span class="pill ${pc}">${pl}</span></td><td><div class="hrow-diff" style="margin:0">${diffHtml(h)}</div></td></tr>`}).join('')||'<tr><td colspan="4"><div class="empty">Sem registros de histórico para este item.</div></td></tr>'}
    </tbody></table></div>`,{wide:true,submit:''});
}

export {HIST,COLNOME,histBtn,loadHist,LBL,SKIP,MONEY,fmtVal,descReg,acaoTxt,diffHtml,histRow,vHistorico,verHist};
