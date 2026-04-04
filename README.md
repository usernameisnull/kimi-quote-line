# kimi-quota-line

English | [中文文档](README.zh-CN.md)

A lightweight CLI for Claude Code status bar to display Moonshot Kimi Code usage quota.

Inspired by [glm-quota-line](https://github.com/deluo/glm-quota-line), modified to support Kimi.

It fetches the quota API, caches successful results, and outputs a single line suitable for display in the status bar.

## Features

- Compatible with Claude Code `statusLine.command`
- Uses API Key for Kimi authentication (via `ANTHROPIC_AUTH_TOKEN`)
- Force refresh on first session, then cache for 5 minutes
- Supports three styles: `text`, `compact`, and `bar`
- Auto-install and uninstall Claude Code status bar configuration
- Displays both weekly quota and 5-minute window quota with reset dates

## Display Styles

### `bar` (Default)

Displays both weekly quota and 5-minute window quota:

```text
Kimi ■□□□□□□□□□ 94% 4/8 15:41 || ■□□□□□□□□□ 97% 4/4 16:41
```

### `text`

```text
Kimi | 94% left 4/8 15:41 || 97% left 4/4 16:41
```

### `compact`

```text
Kimi 94% 15:41 | 97% 16:41
```

Legend:

- `■` = Used
- `□` = Remaining
- Left side = Weekly quota (resets on the date shown)
- Right side = 5-minute window quota (resets hourly)

## Installation

Install from local repository:

```bash
npm install -g .
```

Or install from npm:

```bash
npm install -g kimi-quota-line
```

## Usage

Install Claude Code status bar:

```bash
kimi-quota-line install
```

Switch styles (default is `bar`):

```bash
kimi-quota-line config set style text
kimi-quota-line config set style compact
kimi-quota-line config set style bar
```

Switch display modes:

```bash
kimi-quota-line config set display left    # Show remaining percentage
kimi-quota-line config set display used    # Show used percentage
kimi-quota-line config set display both    # Show both
```

View current configuration:

```bash
kimi-quota-line config show
```

Uninstall status bar:

```bash
kimi-quota-line uninstall
```

## Environment Variables

Required:

- `ANTHROPIC_AUTH_TOKEN` - Claude Code official environment variable. Set this to your Kimi Code API Key. If you already configured Claude Code with this variable, no additional setup is needed:
  ```bash
  export ANTHROPIC_BASE_URL=https://api.kimi.com/coding/
  export ANTHROPIC_AUTH_TOKEN=sk-your-kimi-api-key
  export ANTHROPIC_MODEL="kimi-k2.5"
  export ANTHROPIC_DEFAULT_OPUS_MODEL="kimi-k2.5"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="kimi-k2.5"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="kimi-k2.5"
  export CLAUDE_CODE_SUBAGENT_MODEL="kimi-k2.5"
  export ENABLE_TOOL_SEARCH="false"
  claude
  ```

Optional:

- `ANTHROPIC_BASE_URL` - Set to `https://api.kimi.com/coding/v1` for Kimi Code platform
- `KIMI_API_KEY` - Alternative way, same as `ANTHROPIC_AUTH_TOKEN`

## Getting API Key

1. Visit [Kimi Code](https://kimi.com)
2. Go to Settings
3. Find API Key management and create a new API Key
4. Set it as environment variable: `export ANTHROPIC_AUTH_TOKEN="your-api-key"`

## Notes

- Displays quota information by default, suitable for bottom status bar
- Shows both weekly quota and 5-minute window quota (separated by `||`)
- Dates are shown as `M/D` format (e.g., `4/8` means April 8th)
- Shows `Kimi | auth expired` when authentication fails
- Shows `Kimi | quota unavailable` when API is unavailable
- `install` won't overwrite existing non-tool `statusLine` by default
- `install --force` overwrites and backs up original config, `uninstall` can restore it
- Supports Kimi Code platform API (`https://api.kimi.com/coding/v1`)
