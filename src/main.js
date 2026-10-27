import './estilos/index.css';
import {TITLES,UI,closeSide,renderNav} from './estado.js';
import {initStore,initSupa} from './sync.js';
import {$} from './util.js';
import './eventos.js';

/* ===================== boot ===================== */
// menu lateral no celular
$('#burger').onclick=()=>{$('#side').classList.add('open');$('#scrim').classList.add('on')};
$('#scrim').onclick=closeSide;
(function(){const h=(location.hash||'').slice(1);if(TITLES[h])UI.view=h})();
renderNav();
(function(){const d=new Date();const s=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});$('#today').textContent=s.charAt(0).toUpperCase()+s.slice(1)})();
if(!window.SUPA_CFG)(async function(){let u=null;try{if(window.claude&&typeof window.claude.use==='function')u=await window.claude.use('user')}catch(e){}
  if(!u){$('#urole').textContent='Modo local';return}
  try{const me=await u.me();const nome=(me&&me.name)||'';const first=nome.split(' ')[0];
    if(first){$('#hello').textContent='Olá, '+first+'!';$('#uname').textContent=nome;$('#av').textContent=first.charAt(0).toUpperCase()}
    const adm=await u.canEdit();$('#urole').textContent=adm?'Administrador':'Colaborador'}catch(e){$('#urole').textContent=''}})();
if(window.SUPA_CFG)initSupa();else initStore();
