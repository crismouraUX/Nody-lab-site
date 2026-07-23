# NODY/LAB — Website

Site institucional com animações 3D de scroll. Estático — sem build, sem framework.
Stack: Three.js (herói 3D de partículas), GSAP ScrollTrigger (rails horizontais pinados),
Lenis (smooth scroll). Fontes: Bebas Neue · Instrument Serif · JetBrains Mono · Inter.

## Rodar localmente

```bash
python -m http.server 7900 --directory site
# → http://localhost:7900
```

(Ou pelo Claude Code: launch config `site` em `.claude/launch.json`.)

## Páginas

| Arquivo | Página | Forma 3D | Preset do console |
|---|---|---|---|
| `index.html` | Home | núcleo neural | — |
| `solutions.html` | Soluções / funil | órbitas | — |
| `medical.html` | Setor médico | anéis de pulso | setor `medico` |
| `dental.html` | Setor odonto (caso real) | arcada | setor `odonto` |
| `legal.html` | Setor jurídico | equilíbrio | setor `juridico` |
| `agent-automation.html` | Agente de automação | grade de circuito | agente `automacao` |
| `agent-second-brain.html` | Second Brain | cérebro | agente `second-brain` |

## ⚠ Conectar o funil de leads (1 passo)

Edite `js/console.js`, linha ~13:

```js
const WEBHOOK_URL = 'https://SEU-N8N-OU-MAKE/webhook/site-lead';
```

O console "Build Your Agent" faz `POST` do JSON abaixo a cada deploy.
Enquanto o webhook não estiver configurado (ou se ele falhar), **nenhum lead se
perde**: tudo é espelhado em `localStorage['nody_leads']` no navegador do visitante
e logado no console do browser.

```json
{
  "source": "nodylab.com",
  "page": "…", "path": "/dental.html", "ts": "ISO-8601",
  "sector": "odonto",
  "agent": "retencao",
  "skills": ["resposta-24-7", "agendamento-crm"],
  "contact": { "name": "…", "company": "…", "whatsapp": "…", "email": "…" }
}
```

## Outros ajustes rápidos

- **WhatsApp / Instagram / e-mail do rodapé:** procurar `wa.me` nos `.html`
  (placeholder `5551999999999`).
- **Copy:** direto nos `.html` — são estáticos e independentes.
- **Cores/tipografia:** tokens no topo de `css/main.css` (`--volt`, `--ink`, …).
- **Formas 3D:** `js/nody3d.js` — cada página aponta `data-shape` no `<canvas>`.

## Deploy

Qualquer host estático (Vercel, Netlify, Cloudflare Pages, S3): publicar a pasta
`site/` como raiz. Não há passo de build. CDNs usadas: Google Fonts, cdnjs (GSAP),
unpkg (Lenis), jsDelivr (Three.js).

## Acessibilidade & performance

- `prefers-reduced-motion`: heróis 3D ficam estáticos (já montados), rails viram
  scroll horizontal nativo, reveals aparecem sem animação.
- Mobile (≤768px): rails viram swipe nativo com scroll-snap; partículas reduzidas
  (850 vs 1500); DPR limitado a 2.
- Abas em segundo plano: preloader tem fallback por timer (não trava esperando rAF).
