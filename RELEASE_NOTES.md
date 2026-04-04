## Initial Release (v0.1.0)

A lightweight CLI for Claude Code status bar to display Moonshot Kimi Code usage quota.

### Features

- 🎯 Compatible with Claude Code `statusLine.command`
- 🔑 Uses `ANTHROPIC_AUTH_TOKEN` environment variable (shares config with Claude Code)
- 📊 Default `bar` style for quota progress visualization
- 🌍 Bilingual README (English & Chinese)
- ⚡ 5-minute caching to avoid frequent API requests

### Installation

```bash
npm install -g kimi-quota-line
```

### Environment Setup

```bash
export ANTHROPIC_BASE_URL=https://api.kimi.com/coding/
export ANTHROPIC_AUTH_TOKEN=sk-your-kimi-api-key
```

### Usage

```bash
kimi-quota-line install                                 # Install to Claude Code status bar
kimi-quota-line config set style text|compact|bar       # Switch display styles
kimi-quota-line config set display left|used|both       # Switch display modes
```

### Display Styles

- **bar** (default): `Kimi ■□□□□□□□□□ 87% | 15:41`
- **text**: `Kimi | 87% left | reset 15:41`
- **compact**: `Kimi 87% | 15:41`

---

**Full Changelog**: https://github.com/usernameisnull/kimi-quote-line/commits/v0.1.0
