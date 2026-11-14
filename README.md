# OutpostOS

OutpostOS is an offline browser game prototype for classroom systems thinking. Students run a lunar or Martian outpost by balancing five coupled consoles: power, life support, radiation shielding, food production, and thermal control.

## The Sol Loop

1. **Plan** power units, crew hours, and mass across the five systems.
2. **Simulate** one sol against a deterministic event forecast.
3. **Survive** as battery, oxygen, food, radiation dose, and thermal balance update.
4. **Debrief** through the Engineer Notebook and Failure Replay cause chain.

The prototype includes Cadet and Pilot difficulty, Base Setup / Solar Flare / Dust Storm scenarios, cooperative crew-role guidance, a deterministic Cascade Engine, local-only play, and a 30-sol win condition. The science model is intentionally simplified and directionally correct; it is not mission-certified.

## Commands

```bash
pnpm install
pnpm dev       # development preview on the configured port
pnpm typecheck
pnpm test
pnpm build     # sharing metadata + TypeScript + Vite + size checks
pnpm smoke     # Playwright smoke flow when Chromium is available
```

The app is a static Three.js/Vite game with a DOM mission-control interface. The simulation lives in `src/game/outpost.ts`; `src/main.ts` owns the UI and restrained habitat backdrop. It requires no account, server, database, or network connection at runtime.

## Classroom extension points

The next natural additions are more event chains, explicit classroom challenge codes, Tamil/Hindi copy, teacher result summaries, and a richer Mars scenario. The current Notebook and Replay surfaces are designed to become the reflection and teacher-review layer.
