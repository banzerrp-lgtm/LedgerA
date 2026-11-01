import { createRecord, db, getRecord, updateRecord } from './db.js';
import { parseSuggestedPrice } from '../logic/tipos-trabajo.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = new Set(['efectivo', 'qr', 'transferencia', 'otro']);
const PAYMENT_TYPES = new Set(['cobro', 'devolucion']);

function validatePaymentDate(date) {
  if (!DATE_PATTERN.test(date)) throw new Error('La fecha del pago debe tener el formato AAAA-MM-DD.');
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    throw new Error('La fecha del pago no es válida.');
  }
}

function validatePayment(payment) {
  if (!payment.pedido_id) throw new Error('No se indicó el pedido del pago.');
  if (!Number.isSafeInteger(payment.monto) || payment.monto <= 0) {
    throw new Error('El monto del pago debe ser mayor que cero.');
  }
  if (!PAYMENT_TYPES.has(payment.tipo)) throw new Error('El tipo de pago no es válido.');
  if (!METHODS.has(payment.metodo)) throw new Error('El método de pago no es válido.');
  if (typeof payment.nota !== 'string') throw new Error('La nota del pago no es válida.');
  validatePaymentDate(payment.fecha);
}

export async function savePayment(payment) {
  payment = { ...payment, nota: payment.nota ?? '' };
  validatePayment(payment);
  return db.transaction(
    'rw',
    db.table('pedidos'),
    db.table('lineas'),
    db.table('pagos'),
    async () => {
      const order = await getRecord('pedidos', payment.pedido_id);
      if (!order) throw new Error('El pedido no existe o está en la papelera.');

      if (payment.linea_id) {
        const line = await getRecord('lineas', payment.linea_id);
        if (!line || line.pedido_id !== payment.pedido_id) {
          throw new Error('La línea elegida no pertenece a este pedido.');
        }
      }

      if (payment.id) {
        const existing = await getRecord('pagos', payment.id);
        if (!existing || existing.pedido_id !== payment.pedido_id) {
          throw new Error('El pago que intentas editar no existe.');
        }
        return await updateRecord('pagos', payment.id, {
          linea_id: payment.linea_id || null,
          monto: payment.monto,
          tipo: payment.tipo,
          metodo: payment.metodo,
          fecha: payment.fecha,
          nota: payment.nota.trim(),
        });
      }

      return await createRecord('pagos', {
        pedido_id: payment.pedido_id,
        linea_id: payment.linea_id || null,
        monto: payment.monto,
        tipo: payment.tipo,
        metodo: payment.metodo,
        fecha: payment.fecha,
        nota: payment.nota.trim(),
      });
    },
  );
}

export async function savePaymentFromForm({ monto, ...payment }) {
  const amountInCents = parseSuggestedPrice(monto);
  if (amountInCents === null || amountInCents <= 0) {
    throw new Error('El monto del pago debe ser mayor que cero.');
  }
  return savePayment({ ...payment, monto: amountInCents });
}
