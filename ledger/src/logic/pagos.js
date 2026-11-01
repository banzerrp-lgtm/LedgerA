export function calculatePaymentTotals(total, payments) {
  const paid = payments.reduce(
    (sum, payment) => sum + (payment.tipo === 'devolucion' ? -payment.monto : payment.monto),
    0,
  );
  return { total, paid, balance: total - paid };
}
