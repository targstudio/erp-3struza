import {describe,it,expect,beforeEach} from 'vitest';
import {porMaterial,custosMedios,margemVenda,tiposParceiro,estoque} from '../src/regras.js';
import {relDados} from '../src/telas/relatorios.js';
import {UI} from '../src/estado.js';
import {montar,item} from './ajuda.js';
import {S} from '../src/dados.js';

// grão é bem mais caro que moído: a média de um não pode puxar a do outro
const dados=()=>({
  parceiros:[{id:'f1',nome:'Fornecedor',fornecedor:true},{id:'c1',nome:'Cliente grão',cliente:true},{id:'c2',nome:'Cliente moído',cliente:true}],
  compras:[
    {id:'k1',numero:1,data:'2026-10-02',parceiroId:'f1',total:8000,totalKg:2000,itens:[item('PP Granulado','Preto',1000,6),item('PP Moído','Preto',1000,2)]},
    {id:'k2',numero:2,data:'2026-10-05',parceiroId:'f1',total:3000,totalKg:1000,itens:[item('PP Moído','Branco',1000,3)]},
  ],
  vendas:[
    {id:'v1',numero:1,data:'2026-10-10',parceiroId:'c1',total:4000,totalKg:500,itens:[item('PP Granulado','Preto',500,8)]},
    {id:'v2',numero:2,data:'2026-10-11',parceiroId:'c2',total:1400,totalKg:400,itens:[item('PP Moído','Azul',400,3.5)]},
  ],
});

describe('preço médio por material',()=>{
  beforeEach(()=>montar(dados()));
  it('cada tipo tem a sua média de compra, sem misturar grão com moído',()=>{
    const pm=porMaterial(S.compras);
    expect(pm.find(m=>m.tipo==='PP Granulado')).toMatchObject({kg:1000,total:6000,medio:6,qtd:1});
    expect(pm.find(m=>m.tipo==='PP Moído')).toMatchObject({kg:2000,total:5000,medio:2.5,qtd:2});
  });
  it('cor nunca comprada usa o custo médio do próprio tipo, não o geral',()=>{
    const cm=custosMedios();
    expect(cm.get('PP Moído')).toBe(2.5);
    const m=margemVenda(S.vendas.find(v=>v.id==='v2'),cm);
    expect(m.custoMat).toBe(1000);expect(m.semCusto).toBe(false);
  });
  it('estoque de cor sem compra também vale pelo custo do tipo',()=>{
    S.ajustes.push({id:'a1',tipo:'PP Moído',cor:'Verde',embalagem:'granel',qtd:0,pesoUn:0,kg:100,sentido:'entrada'});
    expect(estoque().find(e=>e.cor==='Verde').custoKg).toBe(2.5);
  });
  it('sabe o material de cada cliente e fornecedor',()=>{
    expect(tiposParceiro('vendas','c1')).toEqual(['PP Granulado']);
    expect(tiposParceiro('vendas','c2')).toEqual(['PP Moído']);
    expect(tiposParceiro('compras','f1').sort()).toEqual(['PP Granulado','PP Moído']);
  });
  it('relatório traz compra × venda por material e o material de cada cliente',()=>{
    UI.per='mes';UI.mes='2026-10';
    const d=relDados();
    const g=d.precos.find(p=>p.tipo==='PP Granulado');
    expect(g.c.medio).toBe(6);expect(g.v.medio).toBe(8);
    expect(d.cli.find(c=>c.nome==='Cliente moído').mats.map(m=>m.tipo)).toEqual(['PP Moído']);
  });
});
