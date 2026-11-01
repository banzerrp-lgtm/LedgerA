import { getRecords } from './db.js';

export async function getStatisticsData() {
  const [clients, orders, lines, payments, types, settings] = await Promise.all([
    getRecords('clientes'),
    getRecords('pedidos'),
    getRecords('lineas'),
    getRecords('pagos'),
    getRecords('tipos_trabajo', { includeDeleted: true }),
    getRecords('ajustes'),
  ]);
  return {
    clients,
    orders,
    lines,
    payments,
    types,
    currencySymbol: settings.find((setting) => setting.clave === 'moneda_simbolo')?.valor ?? 'Bs',
  };
}
