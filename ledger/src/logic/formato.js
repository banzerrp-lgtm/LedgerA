export function formatCurrency(value) {
  const monto = Number(value ?? 0);
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(monto);
}

export function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';
  const fecha = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return dateString;
  return fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
