import Dexie from 'dexie';

export const db = new Dexie('ledgerDb');

db.version(1).stores({
  pedidos: '++id, cliente, estado, entregado, fechaEntrega',
  pagos: '++id, pedidoId, monto, metodo',
});

export default db;
