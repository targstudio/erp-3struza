import {S,byId,contaNome,parcNome,put} from './dados.js';
import {contaOpts,fv,modal,toast} from './modal.js';
import {addDays,brl,esc,fd,num,today} from './util.js';
import {pgTxt} from './forms/pagamento.js';

/* ===================== cheques a compensar =====================
   Um pagamento em cheque gera o lançamento de caixa normalmente, mas marcado com pendente:true.
   Enquanto está pendente ele não conta no saldo, no extrato nem nos relatórios.
   - venceEm: data em que o cheque deve compensar (começa no "bom para" e muda quando o prazo é reprogramado)
   - prazos: histórico de reprogramações [{de,para,em,motivo}]
   - compensadoEm: quando o operador confirmou a compensação; a data e o caixa do lançamento passam a ser os da compensação
   - dataOrig / contaOrig: data e caixa do lançamento antes de compensar (para desfazer)
   - cheque.semDados / cheque.prazoDados: a venda aconteceu antes de o cheque chegar; banco, número e bom para
     são registrados depois, até o prazo. Enquanto isso o alerta é o do prazo dos dados, não o do vencimento. */

const ehCheque=m=>m.meio==='cheque'&&(m.pendente||!!m.compensadoEm);
const venceCheque=m=>m.venceEm||m.cheque?.bomPara||m.cheque?.prazoDados||m.data;
const semDados=m=>!!(m.pendente&&m.cheque?.semDados);
// aguardando (prazo ainda não chegou), vencido (prazo chegou: confirmar se compensou) ou compensado;
// sem dados (o cheque ainda não chegou) ou dadosVencidos (passou o prazo para registrar os dados)
function statusCheque(m,hoje=today()){if(!m.pendente)return'compensado';
  if(semDados(m))return m.cheque.prazoDados&&m.cheque.prazoDados<=hoje?'dadosVencidos':'semDados';
  return venceCheque(m)<=hoje?'vencido':'aguardando'}
const chequesPendentes=()=>S.movimentos.filter(m=>m.pendente);
const chequesVencidos=(hoje=today())=>chequesPendentes().filter(m=>!semDados(m)&&venceCheque(m)<=hoje);
const chequesSemDados=()=>chequesPendentes().filter(semDados);
const dadosVencidos=(hoje=today())=>chequesSemDados().filter(m=>(m.cheque.prazoDados||m.data)<=hoje);
// lançamentos que já valem no caixa (sem os cheques que ainda não compensaram)
const efetivos=()=>S.movimentos.filter(m=>!m.pendente);

// aplica o estado de cheque a um lançamento de pagamento que está sendo gravado.
// m0 é o lançamento que já existia (na edição de compra, venda ou adiantamento).
function comCheque(mov,m0){
  const {pendente,venceEm,prazos,compensadoEm,dataOrig,contaOrig,...m}=mov;
  if(m.meio!=='cheque')return m;
  const antes=m0&&m0.meio==='cheque'&&(m0.pendente||m0.compensadoEm)?m0:null;
  // já compensado: mantém a data e o caixa da compensação
  if(antes?.compensadoEm)return{...m,compensadoEm:antes.compensadoEm,data:antes.data,contaId:antes.contaId,dataOrig:m.data,contaOrig:m.contaId,prazos:antes.prazos||[]};
  // prazo reprogramado continua valendo, a não ser que o "bom para" do cheque tenha sido mudado na edição
  const mesmoBom=antes&&(antes.cheque?.bomPara||'')===(m.cheque?.bomPara||'')&&!!antes.cheque?.semDados===!!m.cheque?.semDados;
  return{...m,pendente:true,venceEm:(mesmoBom&&antes.venceEm)||m.cheque?.bomPara||m.cheque?.prazoDados||m.data,prazos:mesmoBom?antes.prazos||[]:[]};
}

const ladoCheque=m=>m.tipo==='saida'?'emitido':'recebido';
function chequeTxt(m){const c=m.cheque||{};const isC=m.tipo==='saida';
  return [c.titular==='terceiro'?(c.nome?'De '+c.nome:'De terceiro'):(isC?'Da 3STRUZA':'Do cliente'),c.semDados?'dados a registrar até '+fd(c.prazoDados):'',c.banco,c.numero?'nº '+c.numero:''].filter(Boolean).join(' · ')}

/* ---- forma de cada recebimento, para as etiquetas dos caixas ---- */
// ORDEM: ordem em que as etiquetas aparecem
const ORDEM=['dinheiro','chequeVista','chequePrazo','cartao','pix','chequeSemDados','outro'];
const TIPOREC={dinheiro:'Dinheiro',chequeVista:'Cheque à vista',chequePrazo:'Cheque a prazo',chequeSemDados:'Cheque sem dados',cartao:'Cartão de crédito',pix:'PIX',outro:'Não informado'};
// cheque à vista: o "bom para" é o próprio dia do recebimento (ou antes); a prazo: depois
function tipoRecebimento(m){
  let meio=m.meio;
  if(!meio&&m.ref){const src=S[m.ref.col]?.find(x=>x.id===m.ref.id);const f=src?.pagamentos?.length===1?src.pagamentos[0].meio:src?.forma;if(['dinheiro','pix','cheque','cartao'].includes(f))meio=f}
  if(meio==='cheque'){const c=m.cheque||{};if(c.semDados&&!c.bomPara)return'chequeSemDados';
    return c.bomPara&&c.bomPara>(m.dataOrig||m.data)?'chequePrazo':'chequeVista'}
  return TIPOREC[meio]&&meio!=='outro'?meio:'outro';
}
// recebimentos de cada caixa no período, por forma. Cheques contam no caixa e no dia em que foram recebidos,
// mesmo os que ainda vão compensar (aPagar mostra quanto disso ainda está fora do saldo)
function recebidosPorConta(ini,fim){const r=new Map();
  for(const m of S.movimentos){if(m.tipo!=='entrada')continue;const d=m.dataOrig||m.data;if(d<ini||d>fim)continue;
    const cid=m.contaOrig||m.contaId;const t=tipoRecebimento(m);
    const c=r.get(cid)||{total:0,tipos:{}};const x=c.tipos[t]||(c.tipos[t]={valor:0,n:0,pendente:0});
    x.valor+=num(m.valor);x.n++;if(m.pendente)x.pendente+=num(m.valor);c.total+=num(m.valor);r.set(cid,c)}
  return r}

function formCompensar(id){const m=byId('movimentos',id);if(!m)return;const rec=m.tipo!=='saida';
  modal('Cheque compensado',`
    <div class="box"><div><b>${brl(m.valor)}</b> · ${esc(chequeTxt(m))}</div><div class="muted">${m.parceiroId?esc(parcNome(m.parceiroId))+' · ':''}vencimento ${fd(venceCheque(m))}</div><div class="muted" style="font-size:12.5px">${esc(m.descricao||'')}</div></div>
    <div class="row"><label class="fl">Data da compensação<input type="date" name="data" value="${today()}"></label>
      <label class="fl">${rec?'Caixa onde o dinheiro entrou':'Caixa de onde o dinheiro saiu'}<select name="contaId">${contaOpts(m.contaId)}</select></label></div>
    <p class="hint" style="margin:0">O valor passa a contar no saldo do caixa escolhido, na data da compensação.</p>`,
  {submit:'Confirmar compensação',onSubmit:async f=>{const contaId=fv(f,'contaId');if(!contaId)throw'Escolha o caixa.';const data=fv(f,'data')||today();
    const {pendente,...r}=m;
    await put('movimentos',{...r,compensadoEm:data,data,contaId,dataOrig:m.data,contaOrig:m.contaId});
    toast(`Cheque compensado · ${brl(m.valor)} em ${contaNome(contaId)}`)}});
}
function formReprogramar(id){const m=byId('movimentos',id);if(!m)return;const v=venceCheque(m);
  const sug=v<today()?addDays(today(),7):addDays(v,7);
  modal('Novo prazo do cheque',`
    <div class="box"><div><b>${brl(m.valor)}</b> · ${esc(chequeTxt(m))}</div><div class="muted">${m.parceiroId?esc(parcNome(m.parceiroId))+' · ':''}vencimento atual ${fd(v)}${(m.prazos||[]).length?` · já reprogramado ${m.prazos.length}×`:''}</div></div>
    <div class="row"><label class="fl">Novo vencimento<input type="date" name="para" value="${sug}" required></label>
      <label class="fl">Motivo<select name="motivo"><option>Não compensou</option><option>Atrasou</option><option>Cliente pediu para segurar</option><option>Devolvido pelo banco</option><option>Outro</option></select></label></div>
    <label class="fl">Observação<input name="obs" placeholder="Opcional"></label>
    <p class="hint" style="margin:0">A contagem recomeça: o alerta volta a acender no novo vencimento.</p>`,
  {submit:'Salvar novo prazo',onSubmit:async f=>{const para=fv(f,'para');if(!para)throw'Informe o novo vencimento.';
    if(para<today())throw'O novo vencimento não pode ser no passado.';
    const motivo=[fv(f,'motivo'),fv(f,'obs')].filter(Boolean).join(' · ');
    await put('movimentos',{...m,pendente:true,venceEm:para,prazos:[...(m.prazos||[]),{de:v,para,em:today(),motivo}]});
    toast('Novo prazo: '+fd(para))}});
}
// mesmos dados de cheque (para achar o pagamento correspondente na venda, compra, adiantamento ou conta)
const CHQ_CAMPOS=['titular','nome','banco','numero','bomPara','semDados','prazoDados'];
const mesmoCheque=(a={},b={})=>CHQ_CAMPOS.every(k=>(a[k]||'')===(b[k]||''));
// editar um cheque a compensar: completar os dados de um cheque que ainda não tinha chegado, ou corrigir banco, número, titular e bom para
function formDadosCheque(id){const m=byId('movimentos',id);if(!m||!m.pendente)return;const c=m.cheque||{};const isC=m.tipo==='saida';const reg=!!c.semDados;
  modal(reg?'Registrar dados do cheque':'Editar cheque',`
    <div class="box"><div><b>${brl(m.valor)}</b> · ${m.parceiroId?esc(parcNome(m.parceiroId)):'cheque '+(isC?'emitido':'recebido')}</div><div class="muted">${isC?'Emitido':'Recebido'} em ${fd(m.dataOrig||m.data)}${reg?' · prazo para registrar '+fd(c.prazoDados):''}</div><div class="muted" style="font-size:12.5px">${esc(m.descricao||'')}</div></div>
    <div class="row"><label class="fl">Cheque<select name="titular"><option value="proprio" ${c.titular!=='terceiro'?'selected':''}>${isC?'Da 3STRUZA':'Do próprio cliente'}</option><option value="terceiro" ${c.titular==='terceiro'?'selected':''}>De terceiro</option></select></label>
      <label class="fl">Titular (se for de terceiro)<input name="nome" value="${esc(c.nome||'')}" placeholder="Quem emitiu"></label></div>
    <div class="row"><label class="fl">Banco<input name="banco" value="${esc(c.banco||'')}" ${reg?'required':''}></label>
      <label class="fl">Nº do cheque<input name="numero" value="${esc(c.numero||'')}" ${reg?'required':''}></label>
      <label class="fl">Vencimento (bom para)<input type="date" name="bomPara" value="${esc(c.bomPara||'')}" required></label></div>
    <p class="hint" style="margin:0">${reg?'Depois de registrado, o cheque segue para a lista de a compensar e o alerta passa a ser o do vencimento.':'Valor e caixa vêm da venda, compra ou conta de origem: para mudar, edite por lá.'+((m.prazos||[]).length?' Se mudar o bom para, o vencimento passa a ser a nova data.':'')}</p>`,
  {submit:reg?'Salvar dados do cheque':'Salvar cheque',onSubmit:async f=>{
    const ch={titular:fv(f,'titular')||'proprio',nome:fv(f,'titular')==='terceiro'?fv(f,'nome').trim():'',banco:fv(f,'banco').trim(),numero:fv(f,'numero').trim(),bomPara:fv(f,'bomPara')};
    if(ch.titular==='terceiro'&&!ch.nome)throw'Informe o titular do cheque de terceiro.';
    if(reg&&(!ch.banco||!ch.numero))throw'Informe o banco e o número do cheque.';
    if(!ch.bomPara)throw'Informe o vencimento (bom para) do cheque.';
    const txt0=pgTxt({meio:'cheque',cheque:c},isC),txt1=pgTxt({meio:'cheque',cheque:ch},isC);
    // bom para igual: mantém o vencimento (inclusive um prazo reprogramado); mudou: o vencimento passa a ser o novo bom para
    const mesmo=!reg&&(c.bomPara||'')===ch.bomPara;
    await put('movimentos',{...m,cheque:ch,venceEm:mesmo?venceCheque(m):ch.bomPara,prazos:mesmo?m.prazos||[]:[],descricao:String(m.descricao||'').replace(txt0,txt1),...(reg?{dadosEm:today()}:{})});
    // a compra, venda, adiantamento ou conta de origem guarda o cheque nos pagamentos: atualiza lá também
    const src=m.ref&&byId(m.ref.col,m.ref.id);
    if(src?.pagamentos?.length){const i=src.pagamentos.findIndex(p=>p.meio==='cheque'&&Math.abs(num(p.valor)-num(m.valor))<0.005&&mesmoCheque(p.cheque,c));
      if(i>=0)await put(m.ref.col,{...src,pagamentos:src.pagamentos.map((p,j)=>j===i?{...p,cheque:ch}:p)})}
    toast(reg?'Dados do cheque registrados':'Cheque atualizado')}});
}
async function desfazerCompensacao(id){const m=byId('movimentos',id);if(!m?.compensadoEm)return;
  const {compensadoEm,dataOrig,contaOrig,...r}=m;
  await put('movimentos',{...r,pendente:true,data:dataOrig||m.data,contaId:contaOrig||m.contaId});toast('Compensação desfeita: o cheque voltou para a lista de a compensar')}

export {ehCheque,venceCheque,semDados,statusCheque,chequesPendentes,chequesVencidos,chequesSemDados,dadosVencidos,ORDEM,TIPOREC,tipoRecebimento,recebidosPorConta,formDadosCheque,efetivos,comCheque,ladoCheque,chequeTxt,formCompensar,formReprogramar,desfazerCompensacao};
