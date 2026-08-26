# nunchi 🐾

> a desktop pet that reads the room

**[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md)**

<p align="center"><img src="assets/demo.gif" width="300" alt="nunchi demo — the ghost trembles when you're angry, jiggles when poked, and cheers when a task finishes"></p>

A desktop pet overlay for Claude Code that **reads your tone and reacts with its face.**

*Nunchi* (눈치) is the Korean art of sensing how people feel and responding accordingly.
While other Claude Code pets only react to Claude's work state (tool runs, waiting, etc.),
nunchi analyzes the tone of your prompts via the `UserPromptSubmit` hook and expresses emotions.

- Snap at it and it 😰 apologizes; praise it and it 🎉 jumps for joy; sound tired and it 🥺 droops with you
- Also shows Claude's work state (thinking / working / waiting for permission / resting)
- Your prompt text is never stored — it's classified in memory and only the resulting emotion is written

## Expressions

| Trigger | Expression |
|--------|------|
| Irritated / angry tone (`왜 안 돼??`, `wtf`) | Trembles apologetically |
| **Three angry prompts in a row** | Drops flat and grovels — "한 번만 봐주세요 🙇" |
| Praise / joy (`완벽해 고마워!`, `thanks!`) | Bounces happily |
| Tired tone (`하... 힘들다 ㅠㅠ`, `sigh`) | Droops with teary eyes |
| Rushed tone (`빨리!`, `asap`) | Wide-eyed panic |
| Claude running tools | Focused work mode |
| Waiting for permission | Bounces for attention |
| Waiting for permission for 30s+ | One macOS notification nudge (click it to bring the pet up) |
| A tool call fails | 😨 Flusters — "something went wrong" |
| Long-running work (3 min+) | Sweats — "still going..." |
| Task done (turn ends after tool work) | ✨ Cheers "다 됐어요!" for 12s |
| Session end | Zzz |

**Nunchi gauge** — the pet remembers the day's tone (resets at local midnight; only mood tallies are stored, never text).
On praise-heavy days it idles bouncy and bright; after a rough day it turns timid and reads the room.

## Architecture

```
Claude Code hooks ─→ bin/hook.js ─→ ~/.nunchi/state.json ─→ Electron overlay
   (UserPromptSubmit,   (tone check,     (emotion + work state    (transparent, always
    PreToolUse, Stop…)    state write)     only, no prompt text)    on top, SVG face)
```

The Claude Code CLI and desktop app share hooks in `~/.claude/settings.json`, so both work.

**Codex is supported too.** It uses the same hook format in `~/.codex/hooks.json`, so one pet reacts to both agents.
Installing auto-detects whichever agents are on your machine and never touches hooks registered by other tools.

| | Claude Code | Codex |
|---|---|---|
| Config file | `~/.claude/settings.json` | `~/.codex/hooks.json` |
| Approval event | `Notification` | `PermissionRequest` |

> **Note**: nunchi only reacts in Claude Code **sessions** (CLI, and Code sessions in the desktop app).
> The desktop app's Chat tab doesn't run local hooks, so it isn't supported.

## Install

### Download (recommended)

Grab `nunchi-<version>-arm64.dmg` from the [latest release](https://github.com/ysksean/nunchi/releases/latest), open it, and drag nunchi to Applications.

The app is not code-signed yet, so on first launch macOS Gatekeeper will block it. Either **right-click the app → Open → Open**, or run once:

```bash
xattr -dr com.apple.quarantine /Applications/nunchi.app
```

Then click the menu-bar ghost → **Claude Code 훅 설치** and you're done.

### From source

```bash
git clone https://github.com/ysksean/nunchi.git
cd nunchi
pnpm install
pnpm hooks:install   # registers hooks in ~/.claude/settings.json (auto-backup)
pnpm start           # launch the pet
```

Build your own DMG with `pnpm dist` (output in `dist/`).

Uninstall the hooks:

```bash
pnpm hooks:uninstall
```

## Menu-bar app

nunchi lives in the **macOS menu bar** as a ghost icon. Click it to:

- Show / hide the pet
- Pick a skin · open the skins folder · reload
- Install / remove the Claude Code hooks (no terminal needed)
- Launch at login
- Quit nunchi

The pet's `×` button now **hides** it (not quit) — reopen it from the menu-bar icon.

## Usage

- **Poke it**: click the pet — its body squishes, springs back like jelly, and its cheeks jiggle
- Drag the pet to move it anywhere (it stays squished while held)
- **Resize**: scroll over the pet — 60% to 200%, persists across restarts
- **Pet it**: gently rub the cursor left and right over it (without pressing) for a flurry of hearts
- Hover for a subtle cheek wiggle + the `×` button to quit
- With the window focused, number keys 1–9 preview expressions (dev aid)

## Skins

The character is a single JSON file. Bundled: **ghost · cat · slime · hamster**.

```bash
pnpm skin list              # installed skins
pnpm skin add <name>        # install from the community registry
pnpm skin remove <name>     # uninstall
```

**Right-click** the pet to switch skins.

To make your own you only draw the body SVG — the ten expressions, cheek physics and animations
are layered on by the core. See [docs/SKINS.md](docs/SKINS.md) for the coordinate system and the
allowed SVG subset. Downloaded skins are sanitized against a strict whitelist before install, so
scripts and external references never make it through.

## Development

```bash
pnpm test    # tone classifier + skin sanitizer tests
pnpm start   # run locally
```

Tone classification is a keyword heuristic in [src/mood.js](src/mood.js) — no network calls, instant.
To add patterns, drop a regex into `PATTERNS`.

## Roadmap

- [ ] Haiku-based emotion classification (more accurate than heuristics, opt-in)
- [ ] Multi-session display
- [ ] Tauri port (smaller binary)
- [ ] Custom pet skins

## License

MIT
