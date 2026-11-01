import { describe, expect, it } from 'vitest';
import {
  buscarClienteDuplicado,
  normalizarCodigoPais,
  normalizarTelefono,
} from '../src/logic/clientes.js';

describe('lógica de clientes', () => {
  it('normaliza códigos y teléfonos para comparar formatos equivalentes', () => {
    expect(normalizarCodigoPais(' +591 ')).toBe('+591');
    expect(normalizarTelefono('(712) 34-567')).toBe('71234567');
  });

  it('detecta el mismo teléfono y código aunque tengan formato diferente', () => {
    const clients = [
      { id: '1', nombre: 'Ana', codigo_pais: '+591', telefono: '71234567' },
    ];

    expect(buscarClienteDuplicado(clients, {
      codigo_pais: '591',
      telefono: '(712) 34-567',
    })).toEqual(clients[0]);
  });

  it('no considera duplicado al mismo cliente mientras se edita', () => {
    const clients = [
      { id: '1', nombre: 'Ana', codigo_pais: '+591', telefono: '71234567' },
    ];

    expect(buscarClienteDuplicado(clients, clients[0], '1')).toBeUndefined();
  });
});
