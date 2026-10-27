import {describe,it,expect} from 'vitest';
import {num,r2,addMonths,addDays,brl,fd} from '../src/util.js';

describe('num: lê valores digitados no formato brasileiro',()=>{
  it.each([
    ['1.234,56',1234.56],['1234,5',1234.5],['R$ 2.500,00',2500],['1.000',1000],['12.345.678',12345678],
    ['3.5',3.5],['-10,25',-10.25],['',0],[null,0],['abc',0],[42,42]
  ])('%s → %s',(entrada,esperado)=>expect(num(entrada)).toBe(esperado));
});

describe('datas',()=>{
  it('addMonths respeita o último dia do mês',()=>{
    expect(addMonths('2026-01-31',1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31',1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15',2)).toBe('2027-01-15');
  });
  it('addDays atravessa meses',()=>expect(addDays('2026-10-30',3)).toBe('2026-11-02'));
  it('fd formata dd/mm/aaaa',()=>expect(fd('2026-10-27')).toBe('27/10/2026'));
});

it('r2 arredonda centavos',()=>{expect(r2(0.1+0.2)).toBe(0.3);expect(r2(10.005)).toBeCloseTo(10.01,2)});
it('brl formata reais',()=>expect(brl(1234.5).replace(/\s/g,' ')).toBe('R$ 1.234,50'));
