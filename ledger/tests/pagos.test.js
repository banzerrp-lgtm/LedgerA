import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/db.js';
import { savePayment, savePaymentFromForm } from '../src/db/pagos.js';
import { calculatePaymentTotals } from '../src/logic/pagos.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pagos', () => {
  it('calcula saldo cero al registrar un adelanto de 100 y un pago de 200 sobre 300', () => {
    const totals = calculatePaymentTotals(30000, [
      { monto: 10000, tipo: 'cobro' },
      { monto: 20000, tipo: 'cobro' },
    ]);

    expect(totals).toEqual({ total: 30000, paid: 30000, balance: 0 });
  });

  it('guarda el monto del formulario como centavos enteros', async () => {
    const orders = db.table('pedidos');
    const payments = db.table('pagos');
    vi.spyOn(db, 'transaction').mockImplementation(async (...args) =>
      args[args.length - 1](),
    );
    vi.spyOn(orders, 'get').mockResolvedValue({ id: 'pedido-1', eliminado: false });
    const add = vi.spyOn(payments, 'add').mockResolvedValue('pago-1');

    await savePaymentFromForm({
      pedido_id: 'pedido-1',
      monto: '100,00',
      tipo: 'cobro',
      metodo: 'efectivo',
      fecha: '2026-11-01',
    });

    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      pedido_id: 'pedido-1',
      monto: 10000,
      tipo: 'cobro',
    }));
  });

  it('resta las devoluciones del total pagado', () => {
    const totals = calculatePaymentTotals(30000, [
      { monto: 15000, tipo: 'cobro' },
      { monto: 5000, tipo: 'devolucion' },
    ]);

    expect(totals).toEqual({ total: 30000, paid: 10000, balance: 20000 });
  });

  it('rechaza montos inválidos antes de iniciar una transacción', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    await expect(savePayment({
      pedido_id: 'pedido-1',
      monto: 0,
      tipo: 'cobro',
      metodo: 'efectivo',
      fecha: '2026-11-01',
    })).rejects.toThrow('mayor que cero');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rechaza métodos de pago desconocidos', async () => {
    const transaction = vi.spyOn(db, 'transaction');
    await expect(savePayment({
      pedido_id: 'pedido-1',
      monto: 100,
      tipo: 'cobro',
      metodo: 'cheque',
      fecha: '2026-11-01',
    })).rejects.toThrow('método de pago no es válido');
    expect(transaction).not.toHaveBeenCalled();
  });
});
