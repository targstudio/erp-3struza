import {esc,fnum} from './util.js';

/* ===================== gráficos (SVG desenhado como texto) =====================
   Dicas ao passar o mouse: qualquer elemento com data-tip mostra o balão #tip
   (ligado uma vez em main.js por ligarDicas). O data-tip vira HTML: texto digitado pelo usuário precisa passar por esc() antes. */

// passo "redondo" para as linhas de grade (1, 2, 5 × 10ⁿ)
function passo(max){const raw=max/4;const p=Math.pow(10,Math.floor(Math.log10(raw)));const n=raw/p;return(n<=1?1:n<=2?2:n<=5?5:10)*p}
const rotEixo=v=>Math.abs(v)>=1000?fnum(v/1000,Math.abs(v)>=10000?0:1)+' mil':fnum(v,0);
// barra com as pontas de cima arredondadas e a base reta no eixo
function barra(x,y0,w,h,cor){if(h<=0)return '';const r=Math.min(4,w/2,h);
  return `<path d="M${x},${y0} V${y0-h+r} Q${x},${y0-h} ${x+r},${y0-h} H${x+w-r} Q${x+w},${y0-h} ${x+w},${y0-h+r} V${y0} Z" fill="${cor}"/>`}

/* colunas agrupadas: grupos=[{rot,valores:[n…],tip}], series=[{cor}] */
function colunas({grupos,series,rotulo,altura=220,largura=620}){
  const W=largura,H=altura,L=66,R=8,T=10,B=26,ch=H-T-B,cw=(W-L-R)/grupos.length;
  const max=Math.max(1,...grupos.flatMap(g=>g.valores));const st=passo(max);const top=Math.ceil(max/st)*st;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(rotulo)}">`;
  for(let v=0;v<=top+1e-9;v+=st){const y=T+ch-(v/top)*ch;s+=`<line class="gl" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text x="${L-8}" y="${y+4}" text-anchor="end">${rotEixo(v)}</text>`}
  const n=series.length,gap=2,bw=Math.min(28,(cw*.62-gap*(n-1))/n),gw=n*bw+gap*(n-1);
  grupos.forEach((g,i)=>{const x0=L+i*cw+(cw-gw)/2;
    s+=`<g class="grp" data-tip="${esc(g.tip)}"><rect class="hit" x="${L+i*cw}" y="${T}" width="${cw}" height="${ch}"/>`;
    g.valores.forEach((v,j)=>{s+=barra(x0+j*(bw+gap),T+ch,bw,(v/top)*ch,series[j].cor)});
    s+=`<text x="${L+i*cw+cw/2}" y="${H-8}" text-anchor="middle">${esc(g.rot)}</text></g>`});
  return s+'</svg>';
}

/* linha com área: pontos=[{v,tip}], rotulos=[{i,txt}] marcam o eixo x */
function linha({pontos,rotulos=[],rotulo,cor='var(--accent)',altura=220,largura=620}){
  const W=largura,H=altura,L=66,R=12,T=12,B=26,ch=H-T-B,n=pontos.length;
  const vs=pontos.map(p=>p.v);let mn=Math.min(0,...vs),mx=Math.max(1,...vs);
  const st=passo(mx-mn||1);mn=Math.floor(mn/st)*st;mx=Math.ceil(mx/st)*st;
  const X=i=>L+(n<2?0:i*(W-L-R)/(n-1)),Y=v=>T+ch-((v-mn)/(mx-mn))*ch;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(rotulo)}">`;
  for(let v=mn;v<=mx+1e-9;v+=st){const y=Y(v);s+=`<line class="gl${Math.abs(v)<1e-9&&mn<0?' zero':''}" x1="${L}" x2="${W-R}" y1="${y}" y2="${y}"/><text x="${L-8}" y="${y+4}" text-anchor="end">${rotEixo(v)}</text>`}
  const pts=pontos.map((p,i)=>[X(i),Y(p.v)]);const base=Y(Math.max(mn,0));
  s+=`<path d="M${pts.map(p=>p.join(',')).join(' L')} L${pts[n-1][0]},${base} L${pts[0][0]},${base}Z" fill="${cor}" opacity=".08"/>`;
  s+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  rotulos.forEach(r=>{s+=`<text x="${X(r.i)}" y="${H-8}" text-anchor="${r.i===0?'start':r.i===n-1?'end':'middle'}">${esc(r.txt)}</text>`});
  // faixa invisível por ponto: guia vertical e marcador aparecem no hover
  const cw=n<2?W-L-R:(W-L-R)/(n-1);
  pontos.forEach((p,i)=>{const[x,y]=pts[i];
    s+=`<g class="pt" data-tip="${esc(p.tip)}"><rect class="hit" x="${x-cw/2}" y="${T}" width="${cw}" height="${ch}"/><line class="guia" x1="${x}" x2="${x}" y1="${T}" y2="${T+ch}"/><circle cx="${x}" cy="${y}" r="4.5" fill="${cor}" stroke="var(--surface)" stroke-width="2"/></g>`});
  return s+'</svg>';
}

// balão das dicas: um só para a página toda
// esconde o balão (ex.: ao abrir uma janela por cima)
const esconderDica=()=>{const t=document.getElementById('tip');if(t)t.hidden=true};
function ligarDicas(){
  const tip=document.createElement('div');tip.id='tip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);
  let atual=null;
  const pos=e=>{const r=tip.getBoundingClientRect();let x=e.clientX+14,y=e.clientY+14;
    if(x+r.width>innerWidth-8)x=e.clientX-r.width-14;if(y+r.height>innerHeight-8)y=e.clientY-r.height-14;
    tip.style.left=Math.max(8,x)+'px';tip.style.top=Math.max(8,y)+'px'};
  document.addEventListener('pointermove',e=>{const el=e.target.closest?.('[data-tip]');
    if(!el){if(atual){atual=null;tip.hidden=true}return}
    if(el!==atual){atual=el;tip.innerHTML=el.dataset.tip;tip.hidden=false}pos(e)});
  document.addEventListener('pointerleave',()=>{atual=null;tip.hidden=true});
  document.addEventListener('scroll',()=>{atual=null;tip.hidden=true},true);
}

export {passo,colunas,linha,ligarDicas,esconderDica};
