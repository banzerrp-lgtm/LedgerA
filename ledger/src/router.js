const routes = new Set([
  'inicio',
  'encargos',
  'deudores',
  'mas',
  'ajustes',
  'clientes',
  'tipos-trabajo',
  'papelera',
  'terminados',
  'estadisticas',
]);

function getRoute() {
  const path = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = path.split('/');
  if (parts[0] === 'encargo' && parts[1]) return `encargo/${parts[1]}`;
  if (parts[0] === 'cliente' && parts[1]) return `cliente/${parts[1]}`;
  if (parts[0] === 'encargos' && parts[1] === 'nuevo') return 'nuevo-encargo';
  const route = parts[0];
  return routes.has(route) ? route : 'inicio';
}

export function createRouter(onRouteChange) {
  const render = () => onRouteChange(getRoute());
  window.addEventListener('hashchange', render);
  render();

  return () => window.removeEventListener('hashchange', render);
}
