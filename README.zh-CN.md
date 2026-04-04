# kimi-quota-line

[English](README.md) | 中文文档

`kimi-quota-line` 是一个给 Claude Code 底部状态栏使用的轻量 CLI，用来显示 Moonshot Kimi Code 的使用配额状态。

本项目借鉴自 [glm-quota-line](https://github.com/deluo/glm-quota-line) 并修改以支持 Kimi。

它会读取配额接口、缓存成功结果，并输出一行适合状态栏展示的短文本。

## 功能

- 适配 Claude Code `statusLine.command`
- 通过 API Key 进行 Kimi 身份验证（使用 `ANTHROPIC_AUTH_TOKEN`）
- 新会话首次强制刷新，之后 5 分钟内走缓存
- 支持 `text`、`compact`、`bar` 三种样式
- 支持自动安装和卸载 Claude Code 的状态栏配置
- 同时显示周限额和5分钟窗口配额，并显示重置日期

## 展示效果

### `bar`（默认）

同时显示周限额和5分钟窗口配额：

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

说明：

- `■` 表示已用
- `□` 表示未用
- 左侧 = 周限额（在所示日期重置）
- 右侧 = 5分钟窗口配额（每小时重置）

## 安装

本地仓库安装：

```bash
npm install -g .
```

npm 发布后安装：

```bash
npm install -g kimi-quota-line
```

## 使用

安装 Claude Code 状态栏：

```bash
kimi-quota-line install
```

切换样式（默认为 `bar`）：

```bash
kimi-quota-line config set style text
kimi-quota-line config set style compact
kimi-quota-line config set style bar
```

切换显示模式：

```bash
kimi-quota-line config set display left    # 显示剩余百分比
kimi-quota-line config set display used    # 显示已用百分比
kimi-quota-line config set display both    # 两者都显示
```

查看当前配置：

```bash
kimi-quota-line config show
```

卸载状态栏：

```bash
kimi-quota-line uninstall
```

## 环境变量

必需：

- `ANTHROPIC_AUTH_TOKEN` - Claude Code 官方环境变量，设置为你的 Kimi Code API Key。如果你配置 Claude Code 时已经使用了此变量，则无需重复设置：
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

可选：

- `ANTHROPIC_BASE_URL` - 设置为 `https://api.kimi.com/coding/v1` (Kimi Code 平台)
- `KIMI_API_KEY` - 备选方式，与 `ANTHROPIC_AUTH_TOKEN` 作用相同

## 获取 API Key

1. 访问 [Kimi Code](https://kimi.com)
2. 进入设置页面
3. 找到 API Key 管理，创建新的 API Key
4. 将 API Key 设置为环境变量：`export ANTHROPIC_AUTH_TOKEN="your-api-key"`

## 说明

- 默认显示配额信息，适合底部状态栏
- 同时显示周限额和5分钟窗口配额（用 `||` 分隔）
- 日期显示为 `M/D` 格式（如 `4/8` 表示4月8日）
- 鉴权失效时显示 `Kimi | auth expired`
- 接口异常时显示 `Kimi | quota unavailable`
- `install` 默认不会覆盖已有的非本工具 `statusLine`
- `install --force` 会覆盖并备份原配置，`uninstall` 时可恢复
- 支持 Kimi Code 平台 API (`https://api.kimi.com/coding/v1`)
