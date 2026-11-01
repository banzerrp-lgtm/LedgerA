import { renderIcon } from './icons.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderEstadoVacio({
  icon = 'package',
  title,
  description,
  buttonLabel = '',
  href = '',
  positive = false,
} = {}) {
  return `
    <div class="empty-state${positive ? ' empty-state--positive' : ''}">
      <span class="empty-state-icon">${renderIcon(icon)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${buttonLabel && href
        ? `<a class="primary-button button-link" href="${escapeHtml(href)}">${escapeHtml(buttonLabel)}</a>`
        : ''}
    </div>
  `;
}
