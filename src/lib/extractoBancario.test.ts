import { describe, expect, it } from 'vitest';
import { fechaDeTexto, leerCSV, leerOFX, numeroDeTexto, parsearExtracto } from './extractoBancario';

describe('numeroDeTexto', () => {
  it('entiende formato brasileño/argentino e inglés', () => {
    expect(numeroDeTexto('1.234,56')).toBe(1234.56);
    expect(numeroDeTexto('-45,9')).toBe(-45.9);
    expect(numeroDeTexto('1234.56')).toBe(1234.56);
    expect(numeroDeTexto('1,234.56')).toBe(1234.56);
    expect(numeroDeTexto('R$ 1.000')).toBe(1000);
    expect(numeroDeTexto('(45,90)')).toBe(-45.9);
    expect(numeroDeTexto('45,90-')).toBe(-45.9);
    expect(numeroDeTexto('abc')).toBeNull();
  });
});

describe('fechaDeTexto', () => {
  it('lee dd/mm/aaaa, aaaa-mm-dd y aaaammdd y rechaza fechas imposibles', () => {
    expect(fechaDeTexto('25/12/2026')).toBe('2026-12-25');
    expect(fechaDeTexto('2026-11-09')).toBe('2026-11-09');
    expect(fechaDeTexto('20261109120000[-3:BRT]')).toBe('2026-11-09');
    expect(fechaDeTexto('31/02/2026')).toBeNull();
  });
});

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261110120000[-3:BRT]<TRNAMT>-140.00<FITID>abc1<MEMO>PIX ENVIADO UBER</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261111<TRNAMT>300.50<FITID>abc2<NAME>Brenda<MEMO>Brenda</STMTTRN>
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>xx<TRNAMT>1<FITID>abc3</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1500.25<DTASOF>20261112</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('leerOFX', () => {
  it('lee movimientos con signo, FITID, descripción y saldo; omite los inválidos', () => {
    const r = leerOFX(OFX);
    expect(r.movimientos).toEqual([
      { idExterno: 'abc1', fecha: '2026-11-10', monto: -140, descripcion: 'PIX ENVIADO UBER', contraparte: null },
      { idExterno: 'abc2', fecha: '2026-11-11', monto: 300.5, descripcion: 'Brenda', contraparte: null },
    ]);
    expect(r.saldoFinal).toBe(1500.25);
    expect(r.errores).toHaveLength(1);
  });
});

describe('leerCSV', () => {
  it('Nubank: Data,Valor,Identificador,Descrição', () => {
    const r = leerCSV('Data,Valor,Identificador,Descrição\n10/11/2026,-140.00,id-1,"Transferência enviada pelo Pix - Uber"\n11/11/2026,300.50,id-2,Recebida');
    expect(r.movimientos.map((m) => [m.idExterno, m.fecha, m.monto])).toEqual([['id-1', '2026-11-10', -140], ['id-2', '2026-11-11', 300.5]]);
    expect(r.movimientos[0].descripcion).toBe('Transferência enviada pelo Pix - Uber');
  });
  it('separador ";" con débito/crédito, saldo y datos antes del encabezado', () => {
    const r = leerCSV('Conta: 1234\n\nData;Histórico;Débito;Crédito;Saldo\n10/11/2026;Padaria;45,90;;1.000,00\n11/11/2026;Venda;;300,00;1.300,00');
    expect(r.movimientos.map((m) => m.monto)).toEqual([-45.9, 300]);
    expect(r.saldoFinal).toBe(1300);
  });
  it('numera movimientos idénticos y avisa si faltan columnas', () => {
    const r = leerCSV('Data;Valor;Descricao\n10/11/2026;-10,00;Café\n10/11/2026;-10,00;Café');
    expect(r.movimientos.map((m) => m.idExterno)).toEqual(['csv|2026-11-10|-10|Café', 'csv|2026-11-10|-10|Café|2']);
    expect(leerCSV('a;b\n1;2').errores[0]).toContain('columnas');
  });
});

describe('parsearExtracto', () => {
  it('detecta OFX por el contenido aunque la extensión sea .txt', () => {
    expect(parsearExtracto('extrato.txt', OFX).movimientos).toHaveLength(2);
  });
});
