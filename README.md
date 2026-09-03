# dsh-personer

在 dsh Web 的「设置」页里直接编辑**全局人设（Persona）**——即用户级 `AGENTS.md`（`$DSH_HOME/AGENTS.md`，默认 `~/.dsh/AGENTS.md`）。它由 dsh 的 `agent-instructions` 包在每个会话注入，作用于所有项目/会话；过去只能手动打开文件编辑，本插件把它变成一处可读、可改、可保存的入口。

> 提示词**生效时机**：全局 AGENTS.md 属于会话的系统提示。保存后，**新消息**与新会话会使用新的全局指令；当前会话通常在下一轮或新会话生效。

## 功能

- **设置页入口**：打开 dsh「设置」弹窗，左侧导航会多出一项 **「Persona」**（图标为齿轮）。点击即打开编辑弹窗。
- **编辑弹窗**：
  - 顶部显示目标文件路径与说明；
  - 主区为**类 CodeMirror 的代码编辑器**（等宽 + 行号 + Tab 缩进，`Ctrl/Cmd+S` 保存），实时显示字节数；
  - 按钮：**加载**（从文件重新读取）、**撤销**（回到最近一次已保存内容）、**用系统应用打开**、**保存**、**关闭**；
  - 每个按钮的操作反馈**直接显示在按钮自身位置**（按钮变绿/红 + 按钮文字短暂变成结果，如「已保存」），不弹 toast。
- **i18n**：按钮/文案跟随 dsh 的语言设置。插件把词典作为 `personer` 命名空间注册进 dsh 的 locale 系统（`ctx.locale.register` + `bind`），翻译函数每次读 active locale，系统语言切换时实时更新；无 locale 服务时退回 `<html lang>` 与内置词典。
- **安全**：读写路径由 host 侧固定为 `$DSH_HOME/AGENTS.md`，绝不使用客户端传来的任意路径；路由带持久化 token 门控。

## 架构

单一插件，host + client 两半，模式与 `dsh-clip` / `dsh-md-preview` 一致。

| 文件 | 作用 |
|---|---|
| `index.js` | host 侧（Cordis 插件）。在 `webServer` 上注册 `/plugins/dsh-personer/prompt`（GET 读 / POST 写）与 `/open`；向 `index.html` 注入 `dsh-personer-token/base` 两个 `<meta>`；写入 token 到 `$DSH_HOME/plugins/dsh-personer.token`。 |
| `client.js` | 客户端（纯 DOM，无 React）。用 `window.__ModuleLoader__.load({ id, factory })` 注册；MutationObserver 在设置弹窗出现时注入「Persona」导航项，点击打开编辑弹窗；从 `<meta>` 读 token/base。 |
| `cordis.patch.yml` | bundle patch，单条 `insert`（`dsh-personer`）。 |

路由约定见 `index.js` 头部注释。

## 安装

```sh
# 从 git 安装到 web profile
dsh plugin --profile web add "github:ywleeo/dsh-personer#main"

# 重启后生效
pnpm dsh web
```

本机开发（file: 依赖安装）：

```sh
# 1) 把 dsh-personer 加到 profile 依赖
#    ~/.dsh/profiles/web/package.json 的 dependencies 加入：
#    "dsh-personer": "file:/Users/leeo/Documents/workspace-ds/dsh-personer"
# 2) 在 ~/.dsh/profiles/web/cordis.patch.yml 追加：
#    - insert:
#        - id: dsh-personer
#          name: dsh-personer
# 3) 链接依赖并重启
cd ~/.dsh/profiles/web && pnpm install
pnpm dsh web
```

改完源码后同步到已安装的 profile 拷贝：

```sh
pnpm sync   # 等价于 bash scripts/sync.sh
```

## 验证

装好并重启后，打开 dsh Web 的「设置」页，左侧应有 **「Persona」** 项；点它能读取当前的 `AGENTS.md`，编辑、保存后：

1. 「保存」按钮变绿并短暂显示「已保存」；
2. 文件内容确实写到了 `~/.dsh/AGENTS.md`（`cat ~/.dsh/AGENTS.md` 比对）；
3. 下一次对话里，注入的系统提示变成新的内容。

## 已知限制（暂无）

- 客户端 UI 是纯 DOM 注入到 React 的设置弹窗里，依赖一个稳定的锚点（设置弹窗的第一个按钮的父容器）。若 dsh 升级改动设置页结构，需同步调整 `injectNav`。
