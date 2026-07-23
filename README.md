# NODY/LAB — site

Landing site multi-página da Nody Lab (agentes de IA). Estático, sem build.
Abre direto no navegador (`index.html`) — funciona offline, sem servidor.

## Stack
- HTML/CSS estático + `js/site.js` (vanilla)
- Bibliotecas locais em `js/vendor/`: Three.js (shader do herói), GSAP + ScrollTrigger (scroll/animação)
- Fontes: Geist · Inter · JetBrains Mono (Google Fonts, com fallback do sistema)

## Páginas
| Arquivo | Página |
|---|---|
| `index.html` | Home |
| `solutions.html` | Soluções / funil |
| `medical.html` | Setor médico |
| `dental.html` | Setor odonto (caso real) |
| `legal.html` | Setor jurídico |
| `agent-automation.html` | Agente de automação |
| `agent-second-brain.html` | Second Brain |
| `diagnostic.html` | Teste de animações (não faz parte do site) |

## Rodar localmente
Abra `index.html` no navegador, ou sirva a pasta:
```
python -m http.server 8080
```

## Acessibilidade
Respeita `prefers-reduced-motion`: com "reduzir movimento" ligado no sistema,
o site fica estático de propósito.
