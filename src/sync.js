import {COLS,S,loadLocal,schedule,upsertLocal} from './dados.js';
import {UI} from './estado.js';
import {ask,modal,toast} from './modal.js';
import {renovar} from './regras.js';
import {render} from './render.js';
import {HIST,loadHist} from './telas/historico.js';
import {$,esc} from './util.js';

/* ---- hospedagem própria: Supabase (window.SUPA_CFG vem de config.js) ---- */
// modo de armazenamento: 'loading' | 'local' | 'db' | 'login' | 'supa'
let MODE='loading',DB=null,loaded=new Set();
let SB=null;
async function initSupa(){
  try{SB=window.supabase.createClient(window.SUPA_CFG.url,window.SUPA_CFG.key)}catch(e){$('#view').innerHTML='<div class="empty"><b>Não foi possível conectar ao banco</b>Confira o arquivo config.js.</div>';return}
  // link de redefinição de senha recebido por e-mail: pede a senha nova
  SB.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY')setTimeout(novaSenha,300)});
  const{data:{session}}=await SB.auth.getSession();
  if(session)startSupa(session);else showLogin();
}
function novaSenha(){modal('Criar nova senha',`<p class="hint" style="margin:0">Digite a nova senha de acesso ao ERP.</p>
  <label class="fl">Nova senha<input type="password" name="s1" autocomplete="new-password"></label><label class="fl">Repita a senha<input type="password" name="s2" autocomplete="new-password"></label>`,
  {submit:'Salvar senha',onSubmit:async f=>{const a=f.elements.s1.value,b=f.elements.s2.value;if(a.length<6)throw'Use pelo menos 6 caracteres.';if(a!==b)throw'As senhas não são iguais.';
    const{error}=await SB.auth.updateUser({password:a});if(error)throw error.message;toast('Senha alterada');try{history.replaceState(null,'',location.pathname+'#'+UI.view)}catch(e){}}})}
document.addEventListener('click',async e=>{if(e.target.id!=='lgForgot')return;
  const email=$('#lgEmail').value.trim();$('#lgOk').hidden=true;
  if(!email){$('#lgErr').textContent='Digite seu e-mail acima e clique de novo em “Esqueci minha senha”.';$('#lgErr').hidden=false;$('#lgEmail').focus();return}
  e.target.disabled=true;const{error}=await SB.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});e.target.disabled=false;
  if(error){$('#lgErr').textContent=error.message;$('#lgErr').hidden=false;return}
  $('#lgErr').hidden=true;$('#lgOk').textContent=`Se ${email} tiver acesso, chega um e-mail com o link para criar uma senha nova.`;$('#lgOk').hidden=false});
function showLogin(msg){MODE='login';const l=$('#login');l.hidden=false;$('#lgErr').textContent=msg||'';$('#lgErr').hidden=!msg;setTimeout(()=>$('#lgEmail').focus(),50)}
async function startSupa(session){
  $('#login').hidden=true;
  const u=session.user;const nome=(u.user_metadata&&u.user_metadata.nome)||u.email.split('@')[0];const first=nome.split(/[ .]/)[0];
  $('#hello').textContent='Olá, '+first.charAt(0).toUpperCase()+first.slice(1)+'!';$('#uname').textContent=nome;$('#av').textContent=first.charAt(0).toUpperCase();$('#urole').textContent=u.email;
  $('#foot').title='Sair';$('#foot').style.cursor='pointer';$('#foot').onclick=async()=>{if(await ask('Sair','Deseja sair do ERP?',[{label:'Sair',cls:'pri',v:true}])){await SB.auth.signOut();location.reload()}};
  $('#sync').hidden=false;
  const ok=await loadAll();if(!ok)return;
  MODE='supa';COLS.forEach(c=>loaded.add(c));render();setTimeout(renovar,1500);
  subscribeRT();flush();if(UI.view==='historico')loadHist(true);
  // sincronização contínua: recarrega ao voltar para a aba, ao reconectar e a cada 60 s
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resync()});
  window.addEventListener('online',()=>{flush();resync()});
  window.addEventListener('offline',()=>setSync('off'));
  // com o tempo real ativo as mudanças já chegam sozinhas; a recarga completa fica só como reserva
  setInterval(()=>{if(document.visibilityState==='visible'&&!rtOk)resync()},60000);
  setInterval(()=>{if(document.visibilityState==='visible')resync()},15*60000);
}
/* --- sincronização --- */
const QKEY='3struza-fila';let QUEUE=[];try{QUEUE=JSON.parse(localStorage.getItem(QKEY)||'[]')}catch(e){QUEUE=[]}
const saveQ=()=>{try{localStorage.setItem(QKEY,JSON.stringify(QUEUE))}catch(e){}};
let flushing=false,retryT=null,lastSync=null,rtOk=false;
function enqueue(op){QUEUE.push(op);saveQ();setSync('saving');flush()}
const isNetErr=e=>!navigator.onLine||/fetch|network|Failed to|Load failed|timeout/i.test(String(e?.message||e));
async function flush(){
  if(flushing||!SB)return;flushing=true;
  while(QUEUE.length){
    const op=QUEUE[0];let error=null;
    try{const r=op.t==='put'?await SB.from('docs').upsert({col:op.col,id:op.id,data:op.data,updated_at:new Date().toISOString()}):await SB.from('docs').delete().eq('col',op.col).eq('id',op.id);error=r.error}catch(e){error=e}
    if(error){
      // nunca descarta a alteração: fica na fila até o banco aceitar
      flushing=false;clearTimeout(retryT);
      if(isNetErr(error)){setSync('off');retryT=setTimeout(flush,8000);return}
      console.error(error);
      if(isAuthErr(error)){setSync('auth');reauth();return}
      saveErr=error.message||String(error);setSync('err');retryT=setTimeout(flush,30000);return}
    QUEUE.shift();saveQ();
  }
  flushing=false;saveErr='';lastSync=new Date();setSync('ok');
  if(REAUTH){REAUTH=false;$('#login').hidden=true}
}
let saveErr='';
const isAuthErr=e=>/jwt|token|auth|401|403|42501|PGRST30|permission denied|row-level security|not authorized/i.test(String(e?.message||'')+' '+String(e?.code||'')+' '+String(e?.status||''));
// sessão vencida: pede login de novo sem perder a fila
async function reauth(){
  try{const{data}=await SB.auth.refreshSession();if(data?.session){flush();return}}catch(e){}
  REAUTH=true;const l=$('#login');l.hidden=false;
  $('#lgErr').textContent=`Sua sessão expirou. Entre de novo para salvar ${QUEUE.length} alteração(ões) pendente(s).`;$('#lgErr').hidden=false;
  setTimeout(()=>$('#lgEmail').focus(),50);
}
let REAUTH=false;
function applyQueueLocal(){for(const op of QUEUE){if(!S[op.col])continue;if(op.t==='put')upsertLocal(op.col,{id:op.id,...op.data});else S[op.col]=S[op.col].filter(x=>x.id!==op.id)}}
async function loadAll(){
  const all=[];
  for(let from=0;;from+=1000){let r;try{r=await SB.from('docs').select('col,id,data').range(from,from+999)}catch(e){r={error:e}}
    if(r.error){if(MODE!=='supa')$('#view').innerHTML='<div class="empty"><b>Erro ao carregar dados</b>'+esc(r.error.message||r.error)+'</div>';setSync('off');return false}
    all.push(...r.data);if(r.data.length<1000)break}
  COLS.forEach(c=>S[c]=[]);all.forEach(r=>{if(S[r.col])S[r.col].push({id:r.id,...r.data})});
  applyQueueLocal();lastSync=new Date();setSync(QUEUE.length?'saving':'ok');return true;
}
let resyncing=false;async function resync(){if(resyncing||MODE!=='supa')return;resyncing=true;if(await loadAll())schedule();if(!rtOk)subscribeRT();resyncing=false;if(UI.view==='historico')loadHist(true)}
let RT=null;
function subscribeRT(){
  if(RT){try{SB.removeChannel(RT)}catch(e){}}
  RT=SB.channel('erp-rt')
   .on('postgres_changes',{event:'*',schema:'public',table:'docs'},p=>{
      if(p.eventType==='DELETE'){const r=p.old;if(r&&S[r.col])S[r.col]=S[r.col].filter(x=>x.id!==r.id)}
      else{const r=p.new;if(r&&S[r.col])upsertLocal(r.col,{id:r.id,...r.data})}
      applyQueueLocal();lastSync=new Date();schedule()})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'historico'},p=>{if(p.new&&HIST.loaded){HIST.rows.unshift(p.new);if(UI.view==='historico')schedule()}})
   .subscribe(st=>{rtOk=st==='SUBSCRIBED';if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'||st==='CLOSED'){setTimeout(()=>{if(!rtOk)subscribeRT()},10000)}setSync()});
}
let syncState='ok';
function setSync(st){if(st)syncState=st;const el=$('#sync');if(!el)return;
  const q=QUEUE.length;let cls,txt;
  if(syncState==='off'){cls='off';txt=q?`Sem conexão · ${q} alteração(ões) aguardando`:'Sem conexão · tentando de novo'}
  else if(syncState==='auth'&&q){cls='off';txt=`Sessão expirada · ${q} alteração(ões) aguardando login`}
  else if(syncState==='err'&&q){cls='off';txt=`Erro ao salvar · ${q} pendente(s) · clique para tentar de novo`}
  else if(syncState==='saving'||q){cls='saving';txt='Salvando…'}
  else{cls='ok';txt='Sincronizado'+(lastSync?' · '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'')}
  el.className='syncpill '+cls;el.querySelector('span').textContent=txt;
  el.title=syncState==='err'&&q?'O banco recusou: '+saveErr+'. A alteração continua guardada neste navegador.':rtOk?'Atualização em tempo real ativa':'Tempo real reconectando; os dados são recarregados a cada minuto';
  el.style.cursor=q?'pointer':'';el.onclick=q?()=>{if(syncState==='auth')reauth();else{clearTimeout(retryT);flush()}}:null;
}
document.addEventListener('submit',async e=>{if(e.target.id!=='lgForm')return;e.preventDefault();
  const btn=e.target.querySelector('button');btn.disabled=true;$('#lgErr').hidden=true;
  const{data,error}=await SB.auth.signInWithPassword({email:$('#lgEmail').value.trim(),password:$('#lgPass').value});
  btn.disabled=false;const msg=error&&(error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':error.message);
  if(REAUTH){if(error){$('#lgErr').textContent=msg;$('#lgErr').hidden=false;return}REAUTH=false;$('#login').hidden=true;flush();return}
  if(error){showLogin(msg);return}
  startSupa(data.session)});

async function initStore(){
  let db=null;
  try{if(window.claude&&typeof window.claude.use==='function')db=await window.claude.use('db')}catch(e){db=null}
  if(db){
    DB=db;MODE='db';
    COLS.forEach(c=>{
      db.collection(c).onSnapshot(snap=>{S[c]=snap.docs.map(d=>({id:d.id,...d.data()}));loaded.add(c);schedule()},
        err=>{console.warn(c,err);loaded.add(c);schedule()});
    });
  }else{MODE='local';loadLocal();COLS.forEach(c=>loaded.add(c));render();renovar()}
}

export {SB,initSupa,novaSenha,showLogin,startSupa,QKEY,QUEUE,saveQ,flushing,retryT,lastSync,rtOk,enqueue,isNetErr,flush,saveErr,isAuthErr,reauth,REAUTH,applyQueueLocal,loadAll,resyncing,resync,RT,subscribeRT,syncState,setSync,initStore,MODE,DB,loaded};
