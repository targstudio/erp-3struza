// Monta a tela do ERP no jsdom e carrega dados de teste no estado (modo local).
import fs from 'node:fs';
import path from 'node:path';
import {S,COLS} from '../src/dados.js';

const html=fs.readFileSync(path.resolve(import.meta.dirname,'../src/index.html'),'utf8');
const corpo=html.slice(html.indexOf('<body>')+6,html.indexOf('</body>'));

export function montar(dados={}){
  document.body.innerHTML=corpo;
  localStorage.clear();
  COLS.forEach(c=>S[c]=structuredClone(dados[c]||[]));
}

export const conta=(id,saldoInicial=0,extra={})=>({id,nome:'Conta '+id,tipo:'banco',saldoInicial,ativo:true,...extra});
export const item=(tipo,cor,kg,precoKg,extra={})=>({tipo,cor,embalagem:'granel',qtd:0,pesoUn:0,kg,precoKg,...extra});

// espera o modal fechar depois de um salvamento
export async function salvarModal(){
  const form=document.querySelector('#modalRoot form');
  form.requestSubmit();
  for(let i=0;i<50&&document.querySelector('#modalRoot form');i++)await new Promise(r=>setTimeout(r,10));
  const err=document.querySelector('#mErr');
  if(document.querySelector('#modalRoot form'))throw new Error('o formulário não fechou: '+(err?.textContent||''));
}
