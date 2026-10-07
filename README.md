# taskdeck

A mobile-first to-do app where tasks are cards in a deck: swipe right to complete,
left for later (bottom of the deck), down for tomorrow, up to delete, tap to see the back. It runs
entirely in the browser (installable PWA, works offline, no backend).

**Demo: <https://taskdeck-flax.vercel.app>** (deployed by Vercel from `main`).

**Current state: stage 5 done, the definition of done is reached and features are
frozen.** Installable and offline (service worker with an update prompt), end-to-end
tests with Playwright, metadata, an accessible HH:mm time field. Built on stage 4
(recurrence, deadline escalation, in-app reminders, `.ics` export), stage 3 (decks,
tags, editing, IndexedDB, JSON backup), stage 2 (card UI) and stage 1 (pure domain).
Stage 6 (Android packaging with system notifications) is optional and future.

> **Screenshot (pending):** `docs/screenshot-deck.png`, to be captured by hand on a phone.
>
> **Demo GIF (pending):** `docs/demo.gif`, to be recorded by hand (swipe right, left, up, undo).

## Resumo em português

taskdeck é um app de tarefas em formato de cartas (arrastar para concluir, adiar ou
apagar; tocar para ver o verso), mobile-first e 100% no navegador, sem backend.
Tem baralhos, tags, prazos com recorrência, avisos com o app aberto, exportação para o
calendário (.ics) com alarme e backup em JSON. A etapa 5 fecha o projeto: o app é
instalável e funciona offline (com aviso quando há versão nova, sem recarregar
sozinho), ganhou um campo de hora próprio (HH:mm) e testes de ponta a ponta com
Playwright. Demonstração: <https://taskdeck-flax.vercel.app>.

## Instalar no celular

- **Android (Chrome, Edge):** abra <https://taskdeck-flax.vercel.app>, vá em
  Configurações → App → **Instalar app** (ou no menu do navegador, "Instalar app").
- **iPhone/iPad (Safari):** toque em **Compartilhar → Adicionar à Tela de Início**. O
  app mostra essa dica em Configurações (dá para dispensar).
- Instalado, ele abre em tela cheia e funciona sem internet depois da primeira visita
  (Configurações mostra "Pronto para usar offline"). Quando sai uma versão nova, aparece
  "Nova versão disponível" com **Atualizar** e **Depois**; nada recarrega sozinho.
- Os dados ficam só no aparelho. Exporte um backup de vez em quando (Configurações).

## Pending (manual, not code)

- [ ] `public/og.png` (1200x630) for link previews (`og:image`, `twitter:image` already point to it)
- [ ] `docs/screenshot-deck.png`: a real screenshot of the deck on a phone
- [ ] `docs/demo.gif`: a short recording of the gestures
- [ ] The manual QA scripts above

## Roadmap

1. Domain core (done)
2. Card UI with gestures, buttons/keyboard and undo (done)
3. Decks, tags, editing, local persistence and JSON backup (done)
4. Due dates and recurrence in the UI, in-app reminders, `.ics` export (done)
5. Installable PWA, offline, update prompt, HH:mm time field, Playwright end-to-end tests, metadata, deploy (done)
6. Behaviour package 1 (done): shortcuts legend on pointer devices only, collapsible tag filter, repeating cards only on their day with a Scheduled sheet and daily progress, days of the week in recurrences
7. Themes (done) and snooze until tomorrow with swipe down, "Later" naming and honest empty states (done)

Next (not started):

- **Snooze until a chosen date** (the field already holds a day; the UI only offers
  tomorrow).
- **An animated "ghost" gesture** in the tutorial (respecting reduced motion).
- **Contextual tips** (e.g. the first time Scheduled appears), never blocking.
- **Colour per deck**.
- Optional: Capacitor/Android packaging with local (system) notifications.

## Documentation

- [Features](docs/features.md)
- [Architecture and design decisions](docs/architecture.md)
- [Calendar export (.ics)](docs/calendar-ics.md)
- [Testing and development](docs/testing.md)
- [Manual QA](docs/manual-qa.md)
- [Browser support](docs/browser-support.md)
- [Bugs found and fixed](docs/bugs.md)
- [Known limitations](docs/limitations.md)
