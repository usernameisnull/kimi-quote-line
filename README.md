# kimi-quota-line

本项目借鉴自 `https://github.com/deluo/glm-quota-line` 并修改以支持 kimi，用于在 Claude Code 中显示使用量配额状态。

`kimi-quota-line` 是一个给 Claude Code 底部状态栏使用的轻量 CLI，用来显示 Moonshot Kimi Code 的使用配额状态。

它会读取配额接口、缓存成功结果，并输出一行适合状态栏展示的短文本。

## 功能

- 适配 Claude Code `statusLine.command`
- 通过请求 header 中的 authorization 获取 Kimi 登录凭证
- 新会话首次强制刷新，之后 5 分钟内走缓存
- 支持 `text`、`compact`、`bar` 三种样式
- 支持自动安装和卸载 Claude Code 的状态栏配置

## 展示效果

`text`

```text
Kimi | 5h left 91% | reset 14:47
```

`compact`

```text
Kimi 91% | 14:47
```

`bar`

```text
Kimi ■□□□□□□□□□ 91% | 14:47
```

说明：

- `■` 表示已用
- `□` 表示未用

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

切换样式(默认为 `bar`)：

```bash
kimi-quota-line config set style text
kimi-quota-line config set style compact
kimi-quota-line config set style bar
```

切换显示模式：

```bash
kimi-quota-line config set display left
kimi-quota-line config set display used
kimi-quota-line config set display both
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

- `ANTHROPIC_AUTH_TOKEN` - Claude Code 官方环境变量，设置为你的 Kimi Code API Key, 如果你的Claude Code接入的时候就是通过ANTHROPIC_AUTH_TOKEN环境变量设置的则不需要重复设置,比如: 
    ```powershell
    export ANTHROPIC_BASE_URL=https://api.kimi.com/coding/
    export ANTHROPIC_AUTH_TOKEN=sk-kimi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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
4. 将 API Key 设置为环境变量：`export KIMI_API_KEY="your-api-key"`

## 说明

- 默认只显示一行文本，适合底部状态栏
- 鉴权失效时显示 `Kimi | auth expired`
- 接口异常时显示 `Kimi | quota unavailable`
- `install` 默认不会覆盖已有的非本工具 `statusLine`
- `install --force` 会覆盖并备份原配置，`uninstall` 时可恢复
- 支持 Kimi Code 平台 API (`https://api.kimi.com/coding/v1`)
