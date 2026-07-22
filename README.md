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
| Praise / joy (`완벽해 고마워!`, `thanks!`) | Bounces happily |
| Tired tone (`하... 힘들다 ㅠㅠ`, `sigh`) | Droops with teary eyes |
| Rushed tone (`빨리!`, `asap`) | Wide-eyed panic |
| Claude running tools | Focused work mode |
| Waiting for permission | Bounces for attention |
| Task done (turn ends after tool work) | ✨ Cheers "다 됐어요!" for 12s |
| Session end | Zzz |

## Architecture

```
Claude Code hooks ─→ bin/hook.js ─→ ~/.nunchi/state.json ─→ Electron overlay
   (UserPromptSubmit,   (tone check,     (emotion + work state    (transparent, always
    PreToolUse, Stop…)    state write)     only, no prompt text)    on top, SVG face)
```

The Claude Code CLI and desktop app share hooks in `~/.claude/settings.json`, so both work.

> **Note**: nunchi only reacts in Claude Code **sessions** (CLI, and Code sessions in the desktop app).
> The desktop app's Chat tab doesn't run local hooks, so it isn't supported.

## Install

```bash
git clone https://github.com/ysksean/nunchi.git
cd nunchi
pnpm install
pnpm hooks:install   # registers hooks in ~/.claude/settings.json (auto-backup)
pnpm start           # launch the pet
```

Uninstall:

```bash
pnpm hooks:uninstall
```

## Usage

- **Poke it**: click the pet — its body squishes, springs back like jelly, and its cheeks jiggle
- Drag the pet to move it anywhere (it stays squished while held)
- Hover for a subtle cheek wiggle + the `×` button to quit
- With the window focused, number keys 1–9 preview expressions (dev aid)

## Development

```bash
pnpm test    # tone classifier tests
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
