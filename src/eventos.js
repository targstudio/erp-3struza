import {baixarBackup,baixarBackupJSON} from './backup.js';
import {COLS,S,byId,cfg,del,put} from './dados.js';
import {UI,go} from './estado.js';
import {formAjuste} from './forms/ajuste.js';
import {formConta} from './forms/conta.js';
import {formMov} from './forms/movimento.js';
import {delOp,formOp} from './forms/operacao.js';
import {formParc,verParc} from './forms/parceiro.js';
import {delTitulo,estornar,formBaixa,formTitulo} from './forms/titulo.js';
import {extratoCaixa,recibo,romaneio} from './impressos.js';
import {ask,fv,modal,modalClose,toast} from './modal.js';
import {render} from './render.js';
import {baixarCSV} from './telas/caixa.js';
import {saveCfg} from './telas/configuracoes.js';
import {HIST,descReg,loadHist,verHist} from './telas/historico.js';
import {csvRel,csvTit} from './telas/relatorios.js';
import {rotOp} from './regras.js';
import {addMonths,brl,esc,num} from './util.js';

/* ===================== eventos ===================== */
document.addEventListener('click',async e=>{
  const g=e.target.closest('[data-go]');if(g){e.preventDefault();if(modalClose)modalClose();go(g.dataset.go);return}
  const b=e.target.closest('[data-act]');if(!b||b.tagName==='SELECT')return;
  const a=b.dataset.act,id=b.dataset.id;
  try{switch(a){
    case 'mes':UI.mes=addMonths(UI.mes+'-01',+b.dataset.d).slice(0,7);render();break;
    case 'novaConta':formConta();break;case 'editConta':formConta(id);break;
    case 'mov':formMov(b.dataset.t);break;case 'transf':formMov('transferencia');break;
    case 'editMov':formMov(null,id);break;
    case 'delMov':{const m=byId('movimentos',id);
      if(m.ref){const src=m.ref.col==='titulos'?byId('titulos',m.ref.id):byId(m.ref.col,m.ref.id);
        if(m.ref.col==='titulos'&&src){await estornar(src.id);break}
        if(src){await ask('Lançamento vinculado',`Este lançamento veio da ${rotOp(m.ref.col,src).toLowerCase()}. Para removê-lo, edite ou exclua a ${m.ref.col==='compras'?'compra':'venda'}.`,[]);break}}
      if(await ask('Excluir movimentação',`Excluir <b>${esc(m.descricao)}</b> de ${brl(m.valor)}?`,[{label:'Excluir',cls:'danger',v:true}])){await del('movimentos',id);toast('Excluído')}break}
    case 'filtroConta':UI.filtroConta=UI.filtroConta===id?'':id;render();break;
    case 'per':UI.per=b.dataset.v;render();break;
    case 'csv':baixarCSV();break;case 'extratoImp':extratoCaixa();break;
    case 'csvTit':csvTit(b.dataset.lado);break;case 'csvRel':csvRel(b.dataset.k);break;case 'recibo':recibo(b.dataset.col,id);break;case 'romaneio':romaneio(id);break;
    case 'backup':baixarBackup();break;case 'backupJson':baixarBackupJSON();break;
    case 'caixaMais':UI.caixaLim=(UI.caixaLim||200)+500;render();break;
    case 'filtroT':UI.filtroT=b.dataset.v;render();break;
    case 'cadFiltro':UI.cadFiltro=b.dataset.v;render();break;
    case 'novoTitulo':formTitulo(b.dataset.lado);break;case 'editTitulo':formTitulo(null,id);break;
    case 'baixar':formBaixa(id);break;case 'estornar':await estornar(id);break;case 'delTitulo':await delTitulo(id);break;
    case 'ocultar':UI.ocultar=!UI.ocultar;try{localStorage.setItem('3struza-ocultar',UI.ocultar?'1':'0')}catch(e){}render();break;
    case 'novaCompra':formOp('compras');break;case 'novaVenda':formOp('vendas');break;
    case 'editOp':formOp(b.dataset.col,id);break;case 'delOp':await delOp(b.dataset.col,id);break;
    case 'novoParc':formParc();break;case 'editParc':if(modalClose)modalClose();formParc(id);break;case 'verParc':verParc(id);break;
    case 'delParc':{const p=byId('parceiros',id);const usado=['compras','vendas','titulos','movimentos'].some(c=>S[c].some(x=>x.parceiroId===id));
      if(usado){await ask('Cadastro em uso',`<b>${esc(p.nome)}</b> tem compras, vendas, contas ou lançamentos de caixa vinculados e não pode ser excluído.`,[]);break}
      if(await ask('Excluir cadastro',`Excluir <b>${esc(p.nome)}</b>?`,[{label:'Excluir',cls:'danger',v:true}])){await del('parceiros',id);toast('Cadastro excluído')}break}
    case 'ajuste':formAjuste();break;
    case 'hist':verHist(b.dataset.col,id);break;
    case 'histMais':loadHist(false);break;
    case 'histRestaurar':{const h=HIST.rows.find(x=>x.hid===+id);if(!h||!h.antes)break;
      if(!await ask('Restaurar registro',`Recriar “${esc(descReg(h.col,h.antes))}” como estava antes de ser excluído?`+(h.col==='compras'||h.col==='vendas'?' As parcelas e lançamentos de caixa ligados a ela aparecem no histórico e podem ser restaurados um a um.':''),[{label:'Restaurar',cls:'pri',v:true}]))break;
      await put(h.col,{...h.antes,id:h.id});toast('Registro restaurado');break}
    case 'histToggle':UI.histOpen.has(+id)?UI.histOpen.delete(+id):UI.histOpen.add(+id);render();break;
    case 'histPer':UI.histPer=b.dataset.v;loadHist(true);break;
    case 'dispensar':(UI.dispensados||(UI.dispensados=new Set())).add(id);render();break;
    case 'delAjuste':if(await ask('Excluir ajuste','Excluir este ajuste de estoque?',[{label:'Excluir',cls:'danger',v:true}])){await del('ajustes',id);toast('Ajuste excluído')}break;
    case 'cfgRen':{const k=b.dataset.k,i=+b.dataset.i,old=cfg()[k][i];
      modal('Renomear',`<label class="fl">Novo nome para “${esc(old)}”<input name="v" value="${esc(old)}" required></label>`,{submit:'Renomear',onSubmit:async f=>{
        const v=fv(f,'v');if(!v)throw'Informe o nome.';if(v===old)return;const l=cfg()[k].slice();if(l.includes(v))throw'Esse nome já existe na lista.';
        l[i]=v;await saveCfg({[k]:l});
        const campo=k==='tipos'?'tipo':k==='cores'?'cor':'categoria';let n=0;
        if(campo==='categoria'){for(const col of ['movimentos','titulos'])for(const x of S[col].filter(x=>x.categoria===old)){await put(col,{...x,categoria:v});n++}}
        else{for(const col of ['compras','vendas'])for(const x of S[col].filter(x=>(x.itens||[]).some(it=>it[campo]===old))){await put(col,{...x,itens:x.itens.map(it=>it[campo]===old?{...it,[campo]:v}:it)});n++}
          for(const x of S.ajustes.filter(x=>x[campo]===old)){await put('ajustes',{...x,[campo]:v});n++}
          if(UI.estCor===old)UI.estCor=v;if(UI.estTipo===old)UI.estTipo=v}
        toast(`Renomeado${n?` · ${n} lançamento(s) atualizado(s)`:''}`)}});break}
    case 'cfgDel':{const k=b.dataset.k;const l=cfg()[k].slice();l.splice(+b.dataset.i,1);await saveCfg({[k]:l});break}
    case 'limparEx':{if(!await ask('Remover dados de exemplo','Todos os registros marcados como exemplo serão apagados. Os dados que você lançou continuam.',[{label:'Remover exemplos',cls:'danger',v:true}]))break;
      const usados=new Set();['movimentos','compras','vendas','titulos'].forEach(c=>S[c].filter(x=>!x.exemplo).forEach(x=>[x.contaId,x.contaDestinoId,x.parceiroId].forEach(v=>v&&usados.add(v))));
      let n=0,k=0;for(const col of COLS)for(const x of S[col].filter(x=>x.exemplo)){if((col==='contas'||col==='parceiros')&&usados.has(x.id)){await put(col,x);k++;continue}await del(col,x.id);n++}
      toast(n+' registros removidos'+(k?`, ${k} mantidos por estarem em uso`:''));break}
  }}catch(ex){console.error(ex);toast('Erro: '+(ex?.message||ex?.code||ex))}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.nav a')){e.target.click()}});
document.addEventListener('change',e=>{const a=e.target.dataset?.act;
  if(a==='histUser'){UI.histUser=e.target.value;loadHist(true)}
  if(a==='histCol'){UI.histCol=e.target.value;loadHist(true)}
  if(a==='fConta'){UI.filtroConta=e.target.value;render()}
  if(a==='estTipo'){UI.estTipo=e.target.value;render()}
  if(a==='estCor'){UI.estCor=e.target.value;render()}
  if(a==='estZero'){UI.estZero=e.target.checked;render()}});
let bt=null;document.addEventListener('input',e=>{if(e.target.id==='busca'){UI.busca=e.target.value;clearTimeout(bt);bt=setTimeout(render,180)}});
document.addEventListener('submit',async e=>{const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();
  try{if(f.dataset.form==='cfgAdd'){const k=f.dataset.k;const v=f.elements.v.value.trim();if(!v)return;const l=cfg()[k];if(l.includes(v)){toast('Já existe');return}await saveCfg({[k]:[...l,v]});toast('Adicionado')}
  if(f.dataset.form==='cfgPesos'){await saveCfg({pesoSaco:num(f.elements.pesoSaco.value)||25,pesoBag:num(f.elements.pesoBag.value)||1000});toast('Pesos salvos')}}catch(ex){toast('Erro: '+(ex?.message||ex))}});

export {bt};
