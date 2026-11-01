import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Agenda</p>
        <h1>Ledger</h1>
      </div>
      <button class="primary-button" type="button">+ Nuevo encargo</button>
    </header>

    <section class="summary-grid">
      <article class="card accent">
        <span>Por entregar</span>
        <strong>4</strong>
      </article>
      <article class="card">
        <span>Te deben</span>
        <strong>Bs. 1.450</strong>
      </article>
      <article class="card">
        <span>Próximas entregas</span>
        <strong>2</strong>
      </article>
    </section>

    <section class="panel">
      <h2>Resumen</h2>
      <p>La app ya está en marcha. El siguiente paso será crear la lógica de pedidos, pagos y saldos.</p>
    </section>
  </main>
`;
