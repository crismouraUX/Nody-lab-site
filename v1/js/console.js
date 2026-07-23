/* ==========================================================================
   NODY/LAB — Build Your Agent console
   Terminal-style lead funnel: setor → agente → skills → contato → deploy.
   The prospect assembles a live agent.json while qualifying themselves.

   LEAD DESTINATION:
   Set WEBHOOK_URL to your n8n / Make / Zapier webhook. The payload below
   is POSTed as JSON on deploy. Leads are ALWAYS mirrored to
   localStorage['nody_leads'] as a safety net.
   ========================================================================== */

const WEBHOOK_URL = ''; // e.g. 'https://n8n.nodylab.com/webhook/site-lead'

const STEPS = {
  sector: {
    prompt: 'nody agent --init <span class="g">--select setor</span>',
    q: 'Qual é o seu setor?',
    hint: 'selecione uma opção',
    single: true,
    opts: [
      { id: 'medico',   t: 'Médico',        d: 'Clínicas, consultórios e centros médicos' },
      { id: 'odonto',   t: 'Odontológico',  d: 'Clínicas odontológicas e ortodontia' },
      { id: 'juridico', t: 'Jurídico',      d: 'Escritórios de advocacia e departamentos legais' },
      { id: 'outro',    t: 'Outro',         d: 'Conte pra gente no final — a base é a mesma' },
    ],
  },
  agent: {
    prompt: 'nody agent --type <span class="g">--select agente</span>',
    q: 'Que agente você precisa?',
    hint: 'selecione uma opção',
    single: true,
    opts: [
      { id: 'sdr',          t: 'SDR de IA',            d: 'Prospecta, qualifica e agenda — inbound e outbound' },
      { id: 'financeiro',   t: 'Pagamentos & Financeiro', d: 'Cobrança, boletos, PIX, lembretes e conciliação' },
      { id: 'suporte',      t: 'Suporte ao Cliente',   d: 'Dúvidas e tickets 24/7 com handoff humano' },
      { id: 'secretaria',   t: 'Secretária Virtual',   d: 'Agenda, confirma, reagenda e organiza a rotina' },
      { id: 'voz',          t: 'Agente de Voz',        d: 'Ligações de IA com voz natural: inbound e outbound' },
      { id: 'automacao',    t: 'Automação de Workflows', d: 'Rotinas que rodam sozinhas: n8n, webhooks, integrações' },
      { id: 'second-brain', t: 'Second Brain',         d: 'Sua operação inteira, indexada e consultável pela equipe' },
      { id: 'custom',       t: 'Agente Sob Medida',    d: 'Desenvolvimento do zero ao deploy para seu processo' },
    ],
  },
  skills: {
    prompt: 'nody agent --skills <span class="g">--multi</span>',
    q: 'Monte as skills do agente.',
    hint: 'selecione quantas quiser',
    single: false,
    opts: [
      { id: 'resposta-24-7',    t: 'Resposta 24/7',        d: 'Primeira resposta em menos de 1 minuto, fins de semana inclusos' },
      { id: 'agendamento-crm',  t: 'Agendamento + CRM',    d: 'Consulta horários reais e grava direto na sua agenda' },
      { id: 'qualificacao',     t: 'Qualificação de leads', d: 'Separa curioso de comprador antes de chegar em você' },
      { id: 'follow-up',        t: 'Follow-up automático', d: 'Até 3 toques em leads frios, no tom da sua marca' },
      { id: 'whatsapp-api',     t: 'WhatsApp Business API', d: 'Canal oficial, número verificado, multi-atendente' },
      { id: 'cobranca',         t: 'Cobrança & pagamentos', d: 'Boleto, PIX, lembrete de vencimento e conciliação' },
      { id: 'voz-natural',      t: 'Voz natural',          d: 'Ligações e áudios com voz humana, inbound e outbound' },
      { id: 'segmentacao',      t: 'Segmentação de base',  d: 'Campanhas por perfil, serviço, data e histórico' },
      { id: 'base-conhecimento', t: 'Base de conhecimento', d: 'RAG sobre seus documentos, protocolos e preços' },
    ],
  },
};

const STEP_ORDER = ['sector', 'agent', 'skills', 'contact'];

const state = {
  step: 0,
  sector: null,
  agent: null,
  skills: [],
  name: '', company: '', whatsapp: '', email: '',
};

let modal, stepsEl, jsonEl, progressEl, backBtn, lastFocus;

/* ---------- markup ---------- */
function build() {
  modal = document.createElement('div');
  modal.className = 'console';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Build your agent');
  modal.innerHTML = `
    <div class="console__backdrop" data-close></div>
    <div class="console__win">
      <div class="console__bar">
        <i class="volt"></i><i></i><i></i>
        <span class="console__path">nody@lab:~/build-agent — v2.0</span>
        <button class="console__close" data-close aria-label="Fechar console">✕</button>
      </div>
      <div class="console__main">
        <div class="console__steps"></div>
        <div class="console__json" aria-hidden="true"></div>
      </div>
      <div class="console__success">
        <div class="ring">✓</div>
        <div class="big">Agent profile <span class="accent">enfileirado.</span></div>
        <p>Recebemos a configuração do seu agente. Nossa equipe analisa o perfil e entra em contato em até <strong>24h úteis</strong> para desenhar o deploy.</p>
        <button class="btn btn--volt" data-close><span>Fechar console</span></button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  stepsEl = modal.querySelector('.console__steps');
  jsonEl = modal.querySelector('.console__json');

  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e);
  });
}

/* ---------- rendering ---------- */
function renderStep() {
  const key = STEP_ORDER[state.step];

  if (key === 'contact') {
    stepsEl.innerHTML = `
      <div class="console__prompt">➜ nody agent --deploy <span class="g">--contact</span></div>
      <h3 class="console__q">Pra onde mandamos o agente?</h3>
      <div class="console__fields">
        ${field('name', 'nome *', 'Seu nome', 'text')}
        ${field('company', 'empresa / clínica *', 'Nome da operação', 'text')}
        ${field('whatsapp', 'whatsapp *', '+55 (51) 9 9999-9999', 'tel')}
        ${field('email', 'e-mail', 'voce@empresa.com', 'email')}
      </div>
      ${navRow('Deploy agent', true)}`;
  } else {
    const s = STEPS[key];
    stepsEl.innerHTML = `
      <div class="console__prompt">➜ ${s.prompt}</div>
      <h3 class="console__q">${s.q}</h3>
      <div class="console__hint">// ${s.hint}</div>
      <div class="console__opts ${key === 'skills' ? '' : 'console__opts--wide'}">
        ${s.opts.map((o) => `
          <button class="copt ${isSelected(key, o.id) ? 'is-sel' : ''}" data-opt="${o.id}">
            <span class="copt__t">${o.t}</span>
            <span class="copt__d">${o.d}</span>
          </button>`).join('')}
      </div>
      ${navRow(state.step === STEP_ORDER.length - 2 ? 'Skills ok' : 'Próximo')}`;

    stepsEl.querySelectorAll('[data-opt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.opt;
        if (s.single) {
          state[key] = id;
          stepsEl.querySelectorAll('[data-opt]').forEach((b) => b.classList.toggle('is-sel', b === btn));
          setTimeout(next, 260); // auto-advance feels terminal-fast
        } else {
          const i = state.skills.indexOf(id);
          i > -1 ? state.skills.splice(i, 1) : state.skills.push(id);
          btn.classList.toggle('is-sel');
        }
        renderJSON();
      });
    });
  }

  stepsEl.querySelector('[data-next]')?.addEventListener('click', next);
  stepsEl.querySelector('[data-back]')?.addEventListener('click', back);
  stepsEl.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', () => {
      state[inp.name] = inp.value;
      inp.closest('.cfield').classList.remove('is-error');
      renderJSON();
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
  });

  renderJSON();
  stepsEl.querySelector('.copt, input')?.focus({ preventScroll: true });
}

function field(name, label, ph, type) {
  return `<div class="cfield" data-f="${name}">
    <label for="cf-${name}">${label}</label>
    <input id="cf-${name}" name="${name}" type="${type}" placeholder="${ph}" value="${escapeHtml(state[name])}" autocomplete="off">
    <span class="err">// campo obrigatório</span>
  </div>`;
}

function navRow(nextLabel, isDeploy = false) {
  return `<div class="console__nav">
    ${state.step > 0 ? '<button class="console__back" data-back>← voltar</button>' : ''}
    <span class="console__progress">[<b>${state.step + 1}</b>/${STEP_ORDER.length}]</span>
    <button class="btn btn--volt" data-next><span>${nextLabel}</span><span class="btn-arrow">${isDeploy ? '⏎' : '→'}</span></button>
  </div>`;
}

function isSelected(key, id) {
  return key === 'skills' ? state.skills.includes(id) : state[key] === id;
}

/* ---------- live agent.json ---------- */
function renderJSON() {
  const skillsList = state.skills.length
    ? state.skills.map((s) => `    <span class="s">"${s}"</span>`).join('<span class="p">,</span>\n')
    : '    <span class="p">// selecionando…</span>';
  jsonEl.innerHTML =
`<span class="lbl">// live preview — compilado em tempo real</span><span class="p">{</span>
  <span class="k">"agent"</span><span class="p">:</span> <span class="s">"${state.agent ?? '…'}"</span><span class="p">,</span>
  <span class="k">"setor"</span><span class="p">:</span> <span class="s">"${state.sector ?? '…'}"</span><span class="p">,</span>
  <span class="k">"skills"</span><span class="p">: [</span>
${skillsList}
  <span class="p">],</span>
  <span class="k">"contato"</span><span class="p">: {</span>
    <span class="k">"nome"</span><span class="p">:</span> <span class="s">"${escapeHtml(state.name) || '…'}"</span><span class="p">,</span>
    <span class="k">"empresa"</span><span class="p">:</span> <span class="s">"${escapeHtml(state.company) || '…'}"</span><span class="p">,</span>
    <span class="k">"whatsapp"</span><span class="p">:</span> <span class="s">"${escapeHtml(state.whatsapp) || '…'}"</span>
  <span class="p">},</span>
  <span class="k">"runtime"</span><span class="p">:</span> <span class="s">"nodylab/core@2.0"</span>
<span class="p">}</span><span class="cursor"></span>`;
  progressEl = modal.querySelector('.console__progress');
}

/* ---------- flow ---------- */
function next() {
  const key = STEP_ORDER[state.step];
  if (key === 'sector' && !state.sector) return shake();
  if (key === 'agent' && !state.agent) return shake();
  if (key === 'contact') return submit();
  state.step++;
  renderStep();
}
function back() {
  if (state.step === 0) return;
  state.step--;
  renderStep();
}
function shake() {
  stepsEl.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
    { duration: 260, easing: 'ease-out' }
  );
}

function validateContact() {
  let ok = true;
  for (const f of ['name', 'company', 'whatsapp']) {
    const el = stepsEl.querySelector(`[data-f="${f}"]`);
    if (!state[f].trim()) { el.classList.add('is-error'); ok = false; }
  }
  return ok;
}

async function submit() {
  if (!validateContact()) return shake();
  const payload = {
    source: 'nodylab.com',
    page: document.title,
    path: location.pathname,
    ts: new Date().toISOString(),
    sector: state.sector,
    agent: state.agent,
    skills: state.skills,
    contact: { name: state.name, company: state.company, whatsapp: state.whatsapp, email: state.email },
  };

  /* safety net first — never lose a lead */
  try {
    const leads = JSON.parse(localStorage.getItem('nody_leads') || '[]');
    leads.push(payload);
    localStorage.setItem('nody_leads', JSON.stringify(leads));
  } catch { /* storage may be unavailable; webhook still fires */ }

  const btn = stepsEl.querySelector('[data-next] span');
  if (btn) btn.textContent = 'Deploying…';

  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('[nody] webhook falhou — lead preservado em localStorage.nody_leads', err);
    }
  } else {
    console.info('[nody] WEBHOOK_URL não configurado — lead salvo em localStorage.nody_leads', payload);
  }

  modal.classList.add('is-success');
}

/* ---------- open / close ---------- */
export function open(preset = {}) {
  if (!modal) build();
  lastFocus = document.activeElement;
  Object.assign(state, { step: 0, skills: [], sector: null, agent: null, name: '', company: '', whatsapp: '', email: '' });
  if (preset.sector) { state.sector = preset.sector; state.step = 1; }
  if (preset.agent) { state.agent = preset.agent; }
  modal.classList.remove('is-success');
  modal.classList.add('is-open');
  window.nodyLenis?.stop();
  renderStep();
}

function close() {
  modal.classList.remove('is-open');
  window.nodyLenis?.start();
  lastFocus?.focus?.();
}

function trapFocus(e) {
  const focusables = modal.querySelectorAll('button, input, [tabindex]');
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- wire openers ---------- */
document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-console]');
  if (!trigger) return;
  e.preventDefault();
  open({ sector: trigger.dataset.consoleSector, agent: trigger.dataset.consoleAgent });
});
