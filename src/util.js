/* ===================== utilidades ===================== */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p2=n=>String(n).padStart(2,'0');
const brl=n=>(Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fkg=n=>(Number(n)||0).toLocaleString('pt-BR',{maximumFractionDigits:1})+' kg';
const fnum=(n,d=2)=>(Number(n)||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:d});
const num=v=>{if(typeof v==='number')return v;v=String(v??'').trim().replace(/[R$\s]/g,'');if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');else if(/^-?\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,'');const n=parseFloat(v);return isFinite(n)?n:0};
const r2=n=>Math.round(n*100)/100;
const today=()=>{const d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
const fd=s=>s?s.split('-').reverse().join('/'):'—';
const fdShort=s=>s?s.slice(8,10)+'/'+s.slice(5,7):'';
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mLabel=ym=>MESES[+ym.slice(5,7)-1]+' '+ym.slice(0,4);
const mShort=ym=>MESES[+ym.slice(5,7)-1].slice(0,3);
function addMonths(s,n){const[y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1+n,1);const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();return t.getFullYear()+'-'+p2(t.getMonth()+1)+'-'+p2(Math.min(d,last))}
function addDays(s,n){const[y,m,d]=s.split('-').map(Number);const t=new Date(y,m-1,d+n);return t.getFullYear()+'-'+p2(t.getMonth()+1)+'-'+p2(t.getDate())}
const nid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const ICON={
  relatorios:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  painel:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  caixa:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
  pagar:'<path d="M12 19V5M5 12l7 7 7-7"/>',
  receber:'<path d="M12 5v14M5 12l7-7 7 7"/>',
  compras:'<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  vendas:'<path d="M20 12V8l-8-5-8 5v8l8 5 4-2.5"/><path d="M4 8l8 5 8-5M12 13v8M17 17h5M19.5 14.5v5"/>',
  estoque:'<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  cadastros:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  historico:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  config:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const CORHEX={'Natural':'#EDE6D3','Incolor':'#EEF3F6','Branco':'#FFFFFF','Preto':'#1A1A1A','Azul':'#1F5FD1','Verde':'#2E8B57','Vermelho':'#C8322B','Amarelo':'#E7C021','Cinza':'#8C939C','Laranja':'#E57B22','Marrom':'#7A4E2D','Mista':'linear-gradient(135deg,#1F5FD1,#2E8B57 50%,#E7C021)','Transparente':'#E8F1F6'};
const swatch=c=>`<span class="swatch" style="background:${CORHEX[c]||'#bbb'}"></span>`;

export {$,esc,p2,brl,fkg,fnum,num,r2,today,fd,fdShort,MESES,mLabel,mShort,addMonths,addDays,nid,ICON,CORHEX,swatch};
