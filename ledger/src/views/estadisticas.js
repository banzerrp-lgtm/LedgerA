import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { getStatisticsData } from '../db/estadisticas.js';
import { calculateStatistics } from '../logic/estadisticas.js';
import { formatSuggestedPrice } from '../logic/tipos-trabajo.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function money(cents, symbol) {
  const amount = formatSuggestedPrice(Math.abs(cents)).replace(/^Bs\s*/, '');
  return `${cents < 0 ? '−' : ''}${escapeHtml(symbol)} ${amount}`;
}

function displayDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function comparisonText(result, symbol) {
  const amount = money(Math.abs(result.difference), symbol);
  const direction = result.difference > 0 ? 'subieron' : result.difference < 0 ? 'bajaron' : 'se mantuvieron';
  if (!result.previousTotal) {
    return `Antes: ${money(result.previousTotal, symbol)}. En este periodo ${direction}: ${amount}.`;
  }
  const percent = Math.abs(result.changePercent).toFixed(1).replace('.', ',');
  return `Antes: ${money(result.previousTotal, symbol)}. ${direction} ${amount} (${percent} %).`;
}

export function renderEstadisticas() {
  return `
    <section class="statistics-page">
      <a class="back-link" href="#/mas">‹ Más</a>
      <h2>Estadísticas</h2>
      <section class="panel statistics-controls">
        <label for="statistics-period">Periodo de cobros</label>
        <select id="statistics-period">
          <option value="semana">Esta semana</option>
          <option value="mes" selected>Este mes</option>
          <option value="año">Este año</option>
        </select>
        <p class="muted" data-statistics-range></p>
      </section>
      <p class="statistics-feedback" data-statistics-feedback role="status">Cargando estadísticas…</p>
      <div data-statistics-content hidden>
        <div class="summary-grid statistics-summary">
          <article class="card">
            <span>Cobros netos del periodo</span>
            <strong data-statistics-total>—</strong>
            <small data-statistics-comparison></small>
          </article>
          <article class="card">
            <span>Por cobrar actualmente</span>
            <strong data-statistics-receivable>—</strong>
          </article>
        </div>
        <section class="panel statistics-chart-panel">
          <h3>Cobros netos por fecha</h3>
          <div class="statistics-chart"><canvas data-income-chart aria-label="Gráfico de cobros netos" role="img"></canvas></div>
        </section>
        <section class="panel statistics-chart-panel">
          <h3>Ingresos por tipo de trabajo</h3>
          <div class="statistics-chart"><canvas data-type-chart aria-label="Gráfico de ingresos por tipo de trabajo" role="img"></canvas></div>
        </section>
        <section class="panel">
          <h3>Mejores clientes del periodo</h3>
          <ol class="statistics-list" data-top-clients></ol>
          <p class="muted" data-top-clients-empty hidden>No hay cobros en este periodo.</p>
        </section>
      </div>
    </section>
  `;
}

export function mountEstadisticas(root) {
  const periodSelect = root.querySelector('#statistics-period');
  const rangeLabel = root.querySelector('[data-statistics-range]');
  const feedback = root.querySelector('[data-statistics-feedback]');
  const content = root.querySelector('[data-statistics-content]');
  const total = root.querySelector('[data-statistics-total]');
  const comparison = root.querySelector('[data-statistics-comparison]');
  const receivable = root.querySelector('[data-statistics-receivable]');
  const clientsList = root.querySelector('[data-top-clients]');
  const clientsEmpty = root.querySelector('[data-top-clients-empty]');
  const incomeCanvas = root.querySelector('[data-income-chart]');
  const typeCanvas = root.querySelector('[data-type-chart]');
  let chartData;
  let incomeChart;
  let typeChart;

  function render() {
    if (!chartData) return;
    const result = calculateStatistics(chartData, periodSelect.value);
    rangeLabel.textContent = `${displayDate(result.range.from)} – ${displayDate(result.range.to)}`;
    total.textContent = money(result.total, chartData.currencySymbol);
    comparison.textContent = comparisonText(result, chartData.currencySymbol);
    receivable.textContent = money(result.receivable, chartData.currencySymbol);
    clientsList.innerHTML = result.topClients.map((client) => `
      <li><span>${escapeHtml(client.nombre)}</span><strong>${money(client.total, chartData.currencySymbol)}</strong></li>
    `).join('');
    clientsEmpty.hidden = result.topClients.length > 0;
    clientsList.hidden = result.topClients.length === 0;

    const styles = getComputedStyle(document.documentElement);
    const textColor = styles.getPropertyValue('--text-2').trim();
    const borderColor = styles.getPropertyValue('--border').trim();
    const accent = styles.getPropertyValue('--accent').trim();
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => money(context.raw, chartData.currencySymbol),
          },
        },
      },
      scales: {
        x: { ticks: { color: textColor, maxRotation: 0, autoSkip: true }, grid: { color: borderColor } },
        y: {
          ticks: {
            color: textColor,
            callback: (value) => `${chartData.currencySymbol} ${formatSuggestedPrice(Math.round(Math.abs(value))).replace(/^Bs\s*/, '')}`,
          },
          grid: { color: borderColor },
        },
      },
    };

    if (incomeChart) {
      incomeChart.data.labels = result.chartLabels;
      incomeChart.data.datasets[0].data = result.chartValues;
      incomeChart.options = chartOptions;
      incomeChart.update();
    } else {
      incomeChart = new Chart(incomeCanvas, {
        type: 'bar',
        data: {
          labels: result.chartLabels,
          datasets: [{
            data: result.chartValues,
            backgroundColor: accent,
            borderRadius: 4,
          }],
        },
        options: chartOptions,
      });
    }

    if (typeChart) {
      typeChart.data.labels = result.typeBreakdown.map((entry) => entry.nombre);
      typeChart.data.datasets[0].data = result.typeBreakdown.map((entry) => entry.total);
      typeChart.options = chartOptions;
      typeChart.update();
    } else {
      typeChart = new Chart(typeCanvas, {
        type: 'bar',
        data: {
          labels: result.typeBreakdown.map((entry) => entry.nombre),
          datasets: [{
            data: result.typeBreakdown.map((entry) => entry.total),
            backgroundColor: accent,
            borderRadius: 4,
          }],
        },
        options: {
          ...chartOptions,
          indexAxis: 'y',
          scales: {
            x: chartOptions.scales.y,
            y: { ticks: { color: textColor }, grid: { display: false } },
          },
        },
      });
    }
  }

  periodSelect.addEventListener('change', render);
  const dispose = () => {
    incomeChart?.destroy();
    typeChart?.destroy();
    window.removeEventListener('hashchange', dispose);
  };
  window.addEventListener('hashchange', dispose);

  getStatisticsData()
    .then((data) => {
      chartData = data;
      feedback.hidden = true;
      content.hidden = false;
      render();
    })
    .catch((error) => {
      console.error('No se pudieron cargar las estadísticas.', error);
      feedback.textContent = 'No se pudieron cargar las estadísticas. Inténtalo de nuevo.';
      feedback.setAttribute('role', 'alert');
    });
}
