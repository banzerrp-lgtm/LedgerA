import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRouter } from '../src/router.js';

const originalWindow = globalThis.window;
let hashChangeListener;

afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

function installWindow(hash = '') {
  hashChangeListener = undefined;
  globalThis.window = {
    location: { hash },
    addEventListener: vi.fn((event, listener) => {
      if (event === 'hashchange') hashChangeListener = listener;
    }),
    removeEventListener: vi.fn(),
  };
}

describe('enrutador por hash', () => {
  it('renderiza la ruta actual y escucha cambios de hash', () => {
    installWindow('#/deudores');
    const onRouteChange = vi.fn();

    const stop = createRouter(onRouteChange);
    expect(onRouteChange).toHaveBeenLastCalledWith('deudores');

    window.location.hash = '#/ajustes';
    hashChangeListener();
    expect(onRouteChange).toHaveBeenLastCalledWith('ajustes');

    stop();
    expect(window.removeEventListener).toHaveBeenCalledWith('hashchange', hashChangeListener);
  });

  it('vuelve a Inicio para una ruta desconocida', () => {
    installWindow('#/ruta-inexistente');
    const onRouteChange = vi.fn();

    createRouter(onRouteChange);

    expect(onRouteChange).toHaveBeenCalledWith('inicio');
  });

  it('reconoce el formulario nuevo y el detalle de un pedido', () => {
    installWindow('#/encargos/nuevo');
    const onRouteChange = vi.fn();
    createRouter(onRouteChange);
    expect(onRouteChange).toHaveBeenLastCalledWith('nuevo-encargo');

    window.location.hash = '#/encargo/pedido-123';
    hashChangeListener();
    expect(onRouteChange).toHaveBeenLastCalledWith('encargo/pedido-123');
  });

  it('reconoce Terminados y la ficha de un cliente', () => {
    installWindow('#/terminados');
    const onRouteChange = vi.fn();
    createRouter(onRouteChange);
    expect(onRouteChange).toHaveBeenLastCalledWith('terminados');

    window.location.hash = '#/cliente/cliente-123';
    hashChangeListener();
    expect(onRouteChange).toHaveBeenLastCalledWith('cliente/cliente-123');
  });

  it('reconoce la ruta de Estadísticas', () => {
    installWindow('#/estadisticas');
    const onRouteChange = vi.fn();
    createRouter(onRouteChange);
    expect(onRouteChange).toHaveBeenLastCalledWith('estadisticas');
  });

  it('ignora los parámetros de consulta al resolver una ficha', () => {
    installWindow('#/cliente/cliente-123?origen=historial');
    const onRouteChange = vi.fn();
    createRouter(onRouteChange);
    expect(onRouteChange).toHaveBeenLastCalledWith('cliente/cliente-123');
  });
});
