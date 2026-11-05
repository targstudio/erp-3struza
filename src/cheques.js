import {S,byId,contaNome,parcNome,put} from './dados.js';
import {contaOpts,fv,modal,toast} from './modal.js';
import {addDays,brl,esc,fd,today} from './util.js';

/* ===================== cheques a compensar =====================
   Um pagamento em cheque gera o lançamento de caixa normalmente, mas marcado com pendente:true.
   Enquanto está pendente ele não conta no saldo, no extrato nem nos relatórios.
   - venceEm: data em que o cheque deve compensar (começa no "bom para" e muda quando o prazo é reprogramado)
   - prazos: histórico de reprogramações [{de,para,em,motivo}]
   - compensadoEm: quando o operador confirmou a compensação; a data e o caixa do lançamento passam a ser os da compensação
   - dataOrig / contaOrig: data e caixa do lançamento antes de compensar (para desfazer) */

const ehCheque=m=>m.meio==='cheque'&&(m.pendente||!!m.compensadoEm);
const venceCheque=m=>m.venceEm||m.cheque?.bomPara||m.data;
// aguardando (prazo ainda não chegou), vencido (prazo chegou: confirmar se compensou) ou compensado
function statusCheque(m,hoje=today()){if(!m.pendente)return'compensado';return venceCheque(m)<=hoje?'vencido':'aguardando'}
const chequesPendentes=()=>S.movimentos.filter(m=>m.pendente);
const chequesVencidos=(hoje=today())=>chequesPendentes().filter(m=>venceCheque(m)<=hoje);
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
  const mesmoBom=antes&&(antes.cheque?.bomPara||'')===(m.cheque?.bomPara||'');
  return{...m,pendente:true,venceEm:(mesmoBom&&antes.venceEm)||m.cheque?.bomPara||m.data,prazos:mesmoBom?antes.prazos||[]:[]};
}

const ladoCheque=m=>m.tipo==='saida'?'emitido':'recebido';
function chequeTxt(m){const c=m.cheque||{};const isC=m.tipo==='saida';
  return [c.titular==='terceiro'?'De '+c.nome:(isC?'Da 3STRUZA':'Do cliente'),c.banco,c.numero?'nº '+c.numero:''].filter(Boolean).join(' · ')}

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
async function desfazerCompensacao(id){const m=byId('movimentos',id);if(!m?.compensadoEm)return;
  const {compensadoEm,dataOrig,contaOrig,...r}=m;
  await put('movimentos',{...r,pendente:true,data:dataOrig||m.data,contaId:contaOrig||m.contaId});toast('Compensação desfeita: o cheque voltou para a lista de a compensar')}

export {ehCheque,venceCheque,statusCheque,chequesPendentes,chequesVencidos,efetivos,comCheque,ladoCheque,chequeTxt,formCompensar,formReprogramar,desfazerCompensacao};
