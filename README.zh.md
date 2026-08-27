# nunchi 🐾

> 一只会察言观色的桌面宠物

**[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md)**

<p align="center"><img src="assets/demo.gif" width="300" alt="nunchi 演示 — 你发火它发抖，戳它脸颊抖，任务完成它欢呼"></p>

一个与 Claude Code 联动的桌面宠物悬浮窗，**能读懂你的语气并用表情回应。**

*Nunchi*（눈치）是韩语词，指察觉他人情绪并随之应对的能力——也就是"眼力见儿"。
其他 Claude Code 宠物只对 Claude 的工作状态（运行工具、等待等）做出反应，
而 nunchi 通过 `UserPromptSubmit` 钩子分析你输入的语气，用表情表达情绪。

- 你发火它就 😰 瑟瑟发抖地道歉；你夸它就 🎉 开心蹦跳；你累了它就 🥺 陪你一起蔫
- 同时显示 Claude 的工作状态（思考中 / 工作中 / 等待授权 / 休息）
- 你的输入原文不会被保存——仅在内存中分类，只记录情绪结果

## 表情

| 触发 | 表情 |
|--------|------|
| 烦躁 / 生气的语气（`왜 안 돼??`、`wtf`） | 愧疚地发抖 |
| **连续发火 3 次** | 趴平求饶——"就原谅我这一次吧 🙇" |
| 夸奖 / 开心（`완벽해 고마워!`、`thanks!`） | 欢快蹦跳 |
| 疲惫的语气（`하... 힘들다 ㅠㅠ`、`sigh`） | 一起垂头丧气、含泪 |
| 着急的语气（`빨리!`、`asap`） | 瞪大眼睛手忙脚乱 |
| Claude 正在运行工具 | 专注干活模式 |
| 等待授权 | 蹦蹦跳跳提醒你 |
| 等待授权超过 30 秒 | 发送一次 macOS 通知 — 点击即可唤出宠物 |
| 工具执行失败 | 😨 慌张地说"啊，出错了" |
| 耗时较长的任务（3 分钟+） | 冒汗说"还在处理中……" |
| 任务完成（工具作业的回合结束） | ✨ 欢呼"搞定啦！"12 秒 |
| 会话结束 | Zzz |

**眼力见儿仪表** —— 它会记住一天的语气（本地午夜重置；只存情绪计数，绝不存原文）。
被夸得多的日子它平时也蹦蹦跳跳；挨骂多的日子它会变得小心翼翼地看你脸色。

## 架构

```
Claude Code hooks ─→ bin/hook.js ─→ ~/.nunchi/state.json ─→ Electron 悬浮窗
   (UserPromptSubmit,   (语气分类,      (仅情绪 + 工作状态,      (透明·置顶,
    PreToolUse, Stop…)    写入状态)       不含输入原文)           SVG 表情渲染)
```

Claude Code CLI 与桌面应用共享 `~/.claude/settings.json` 中的 hooks，两者都能工作。

**同时支持 Codex。** Codex 在 `~/.codex/hooks.json` 使用相同格式的 hooks，因此同一只宠物会对两个 agent 都有反应。
安装时会自动检测机器上已有的 agent，且不会动其他工具注册的 hooks。

| | Claude Code | Codex |
|---|---|---|
| 配置文件 | `~/.claude/settings.json` | `~/.codex/hooks.json` |
| 等待授权事件 | `Notification` | `PermissionRequest` |

> **注意**：nunchi 只在 Claude Code **会话**（CLI、桌面应用的 Code 会话）中有反应。
> 桌面应用的 Chat 标签页不会运行本地 hooks，因此不受支持。

## 安装

### 下载（推荐）

从[最新发布](https://github.com/ysksean/nunchi/releases/latest)下载 `nunchi-<版本>-arm64.dmg`，打开后把 nunchi 拖到"应用程序"文件夹。

应用尚未代码签名，首次启动时 macOS Gatekeeper 会拦截。**右键点击应用 → 打开 → 打开**，或执行一次：

```bash
xattr -dr com.apple.quarantine /Applications/nunchi.app
```

然后点击菜单栏幽灵图标 → **安装 Claude Code hooks** 即可。

### 从源码运行

```bash
git clone https://github.com/ysksean/nunchi.git
cd nunchi
pnpm install
pnpm hooks:install   # 在 ~/.claude/settings.json 注册钩子（自动备份）
pnpm start           # 启动宠物
```

自行构建 DMG：`pnpm dist`（输出在 `dist/`）。

卸载钩子：

```bash
pnpm hooks:uninstall
```

## 菜单栏应用

启动后会在 **macOS 菜单栏**常驻一个幽灵图标。点击它可以：

- 显示 / 隐藏宠物
- 选择皮肤 · 打开皮肤文件夹 · 刷新
- 安装 / 移除 Claude Code hooks（无需终端）
- 开机自启
- 退出 nunchi

宠物的 `×` 按钮现在是**隐藏**而非退出——可从菜单栏图标重新打开。

## 使用方法

- **戳它**：点击宠物——身体被压扁后像果冻一样弹回，脸颊肉duang duang 抖
- 拖拽宠物移动到任意位置（按住时会保持被压扁的样子）
- **调节大小**：在宠物上滚动鼠标滚轮——60% 到 200%，重启后依然保留
- **摸摸它**：在宠物上左右轻轻蹭动光标（不用按下）就会冒出爱心
- 鼠标悬停时脸颊轻轻抖动 + 显示 `×` 退出按钮
- 窗口聚焦时按数字键 1–9 预览表情（开发用）

## 皮肤

角色就是一个 JSON 文件。内置：**ghost · cat · slime · hamster**。

```bash
pnpm skin list              # 已安装的皮肤（* 为当前选中）
pnpm skin use <名称>         # 应用皮肤——运行中的宠物会实时更新
pnpm skin add <名称>         # 从社区registry安装
pnpm skin remove <名称>      # 卸载
```

**右键点击**宠物即可切换皮肤。

自己做皮肤只需画身体 SVG——十种表情、脸颊物理、动画都由核心自动叠加。
坐标系与允许的 SVG 子集见 [docs/SKINS.md](docs/SKINS.md)。
下载的皮肤在安装前会经过严格白名单净化，脚本和外部引用一律无法通过。

## 开发

```bash
pnpm test    # 语气分类器 + 皮肤净化器测试
pnpm start   # 本地运行
```

语气分类是 [src/mood.js](src/mood.js) 中的关键词启发式规则——无网络请求，即时生效。
想添加模式，往 `PATTERNS` 里加正则即可。

## 路线图

- [ ] 基于 Haiku 的情绪分类（比启发式更准，可选开启）
- [ ] 多会话显示
- [ ] Tauri 移植（更小的二进制）
- [ ] 自定义宠物皮肤

## License

MIT
