## Context

The client app is a Vue 3 + Vite frontend with an existing chat interface. The goal is a Gemini-inspired, cyberpunk-leaning visual refresh and a left sidebar that supports new chat and history navigation. The backend is unchanged; this is a front-end layout and styling update with light structural changes in the UI.

## Goals / Non-Goals

**Goals:**
- Establish a dark, neon-accented theme with consistent typography, color, and spacing tokens.
- Introduce a left sidebar housing “New Chat” and chat history.
- Keep the chat area focused, readable, and aligned with Gemini-like layout patterns.

**Non-Goals:**
- No backend/API changes or new data persistence.
- No complex routing changes or multi-page navigation.
- No overhaul of business logic; only UI composition and styles.

## Decisions

- **Single-page layout with CSS-driven theming.** Use CSS variables + utility classes to implement the cyberpunk palette and glow effects without adding dependencies. This keeps changes localized and reversible.
- **Sidebar as a composable layout region.** Implement the sidebar in the main chat layout (e.g., `App.vue`) to avoid premature component abstraction while the design stabilizes.
- **Typography pairing: Orbitron (display) + Exo 2 (body).** Provides a futuristic aesthetic while keeping long chat messages readable.
- **Neon accents sparingly.** Constrain neon to borders, buttons, and focus states to avoid eye strain and maintain readability.

## Risks / Trade-offs

- **Dark + neon can reduce accessibility** → Use high-contrast text, muted neon, and visible focus rings.
- **Glows and gradients may impact performance** → Prefer lightweight box-shadows and avoid heavy animations.
- **Sidebar reduces chat width** → Use responsive breakpoints and collapse/compact history on small screens.
