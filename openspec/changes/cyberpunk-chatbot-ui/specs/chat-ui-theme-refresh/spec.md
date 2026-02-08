## ADDED Requirements

### Requirement: Cyberpunk visual theme applied
The client chat UI SHALL use a dark, neon-accented theme with consistent color, typography, and spacing tokens.

#### Scenario: Core surface uses dark theme
- **WHEN** a user opens the chat page
- **THEN** the background and main surfaces render with the defined dark theme tokens

### Requirement: Readability is preserved in dark mode
Text and interactive elements SHALL maintain readable contrast and visible focus states in the themed UI.

#### Scenario: Focus ring visible on interactive elements
- **WHEN** a user navigates with keyboard focus
- **THEN** focused buttons and inputs display a visible focus ring

### Requirement: Neon accents are scoped to emphasis
Neon glow and accent colors SHALL be limited to key affordances (buttons, borders, highlights) to avoid visual fatigue.

#### Scenario: Accents appear only on emphasis elements
- **WHEN** the UI renders buttons and selected items
- **THEN** neon accents appear on those elements and not on body text
