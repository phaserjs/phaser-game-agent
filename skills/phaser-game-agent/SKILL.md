---
name: phaser-game-agent
description: Build and ship complete, playable Phaser web games on a managed cloud workspace via the Phaser Game Agent (pga_* tools). Use whenever the user wants to make, prototype, or extend a browser game.
---

# Phaser Game Agent

Build real, playable Phaser games on a managed cloud sandbox — reusable blocks assembled on
a batteries-included engine, type-checked, screenshotted, and published to the user's Phaser
account. You build on your own subscription.

## Connect first (one time)

The build tools live in the **Phaser Game Agent MCP**. If the `pga_*` tools are not already
available in this session, ask the user to connect it:

```bash
npx @phaserjs/game-agent
```

This signs them in (their own Phaser subscription) and writes the MCP config for this CLI;
then restart this CLI so the tools load. A skill file alone cannot register an MCP server —
this step is what actually wires it up.

## Once connected

Drive the `phaser_game_agent_*` tools. Always start with `phaser_game_agent_guide`, then:

1. `phaser_game_agent_open_project` → a `projectId` (one cloud workspace holds many games).
2. `phaser_game_agent_guide` + read `engine/raster/index.md` via `phaser_game_agent_read_files` — reference to USE, never edit.
3. **Reuse first**: `search_games` / `search_blocks`, then `phaser_game_agent_add_blocks` / `phaser_game_agent_seed_game`
   deliver known-good code to disk. Adapt the delivered files — never hand-type block code.
4. Author `src/` + `spec/manifest.md` with `phaser_game_agent_write_files` (batched).
5. `phaser_game_agent_verify` until green → `phaser_game_agent_preview`. It returns a **`playUrl`**:
   a public, directly-playable build. **Load `playUrl` in your own browser and DRIVE the game** —
   press keys, click, play through the parts you changed (title, gameplay, win/lose, game-over) and
   screenshot to verify. There is no server screenshot; you test the game yourself. Fix → preview →
   re-test as needed.
6. `phaser_game_agent_finish` when the game is done — pauses the workspace, stops billing, and its
   `note` reports the run cost + remaining credits (repeat it to the user).

The engine is prebuilt; never reimplement it. The MCP's own instructions and `phaser_game_agent_guide`
are the source of truth — follow them over this summary.
