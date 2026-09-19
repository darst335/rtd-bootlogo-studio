# RTD 开机 Logo 工作室 / RTD Boot Logo Studio

> 修改 Realtek RTD2270 / RTD266x 系列显示器 Scaler 固件的开机 Logo —— 直接改 `.bin`，无需编程器知识，改完用编程器刷回即可。
>
> **实测基准（Verified on）**：RTD2270CLW 主控，驱动板版号 **RTD270CLW-R10.1 20.1**。
> ⚠️ **RTD2270 与 RTD2270CLW 是两种不同芯片，固件不通用**（市面上说的「RTD2270C」就是指 RTD2270CLW，RTD2270C = RTD2270CLW）。**其他型号未经测试，请自行测试**（RTD2270 and RTD2270CLW are two different chips with incompatible firmware; "RTD2270C" is just shorthand for RTD2270CLW. Other models are untested — test on your own hardware）。

<div align="center">
  <img src="docs/hyundai-bootlogo.png" width="420" alt="HYUNDAI 开机画面（从固件中渲染还原）">
  <p><sub>▲ 从真实固件中自动识别并渲染出的开机画面（●●⬤HYUNDAI，与实机照片一致）</sub></p>
</div>

## 实测主板 / Verified Hardware

<div align="center">
  <img src="docs/board-rtd270clw.jpg" width="380" alt="实测驱动板 RTD270CLW-R10.1">
  <p><sub>▲ 实测驱动板：版号 RTD270CLW-R10.1 20.1，主控 U3 = RTD2270CLW</sub></p>
</div>

> **关于这张图**：照片取自公开的网络商品页，**已去除卖家水印与标注**，仅用于说明本项目实测所用的主板型号，无任何推广 / 广告意图，亦与原卖家无关。
> *About this photo: taken from a public online marketplace listing with the seller's watermark and annotations removed. It is shown solely to document the hardware this project was verified on — not an advertisement or endorsement of any seller.*

**作者：[darst335](https://github.com/darst335)** · 与 AI 结对开发（2026-09）
全部格式逆向自四块真实固件（乐华 / HY / MAZON / BUBALUS），并经实物刷机逐项验证，**非任何第三方工具的移植或修改**。

---

## 能做什么

- **读取**：打开 `.bin` 固件，自动识别开机 Logo 的存储机制并渲染出原始画面
- **编辑**：内置画笔（支持调色板逐格上色）、文字工具（画布上直接拖拽移动、拉伸缩放，Alt+画笔可在文字区内手绘）、图片导入（缩放 / 拖动定位 / 保留颜色自动匹配调色板近似色 / 反相 / Floyd–Steinberg 抖动）、撤销 / 重做（Ctrl+Z / Ctrl+Y，60 步）
- **写入**：改完直接替换原文件（自动生成 `.bak-时间戳` 备份），或另存新固件
- **多机制支持**（自动识别，详见下表）

## 支持的 Logo 存储机制

| 机制 | 识别特征 | 实证固件 |
|---|---|---|
| 静态 MAP 型 | CDrawLogo 网格 + 紧邻 VLC 字库；支持代码常量精确解析与结构扫描 | 乐华 LM190WH1 |
| 品牌字库·串引用型 | 递增索引字符串引用字库块 | ENVISION 模板 |
| OSD 记录流型 | `COsdFxCodeWrite` 解释器字节流，支持原地写与收缩模式 | MAZON 4、BUBALUS E2215 |
| 瓦片索引表拼图型 | 远离字库的「字模索引表」（如 7×72）+ 大 VLC 瓦片库，按格间笔画边界失配率打分识别 | HYUNDAI（实机开机路径） |

> 关键坑已趟平：VLC 前缀码解码（LSB-first、每 3 字节反序）、墨迹极性逐字库不同（用「墨迹少数派原则」自动判定）、16 色调色板定位（0x204B3 型 LUT，带黑白判据防错位）、OSD 属性区 1024 格上限校验等。

## 快速开始

### 方式一：直接用成品（推荐）

到 [Releases](../../releases) 下载 `RTD开机Logo工作室.exe`，双击即用（Win7 SP1+，内置 Node 运行时，免安装、不联网）。

### 方式二：从源码运行 / 打包

```bash
# 打包单文件 HTML（引擎 + 界面内联，可直接双击用浏览器打开）
node build.js

# 本地服务模式（支持"直接替换原文件"与任意目录挑固件）
node server.js

# 打包 Win7 兼容单文件 exe（需 7-Zip 与 7zSD.sfx，见 exe-build/build-exe.js）
node exe-build/dl.js        # 首次：下载 Node 12 运行时
node exe-build/build-exe.js
```

### 界面版用法

1. 点「打开固件 (.bin)」→ 自动识别并显示原 Logo
2. 「生成新 Logo」里用 文字 / 图片 / 画笔 编辑（画布大小可调，最大受字节预算限制）
3. 点「直接替换原文件」（自动备份）或「生成新固件」用编程器刷回

## 测试

`test-*.js` 为基于真实固件的回归测试。因固件文件涉及版权**不在本仓库分发**，请自备固件并按脚本头部注释放置后运行：

```bash
node test-recordstream.js   # 记录流型 37+ 项
node test-mapgrid.js        # 瓦片索引表型 14 项
node test-engine.js         # VLC 编解码等基础项
```

## ⚠️ 免责声明（Disclaimer，中英双语）

- 刷机有风险，**务必保留原始固件备份**；因刷机造成的任何损失由使用者自行承担
- 本工具不分发任何固件，仅提供读写能力
- 本工具仅在 **RTD2270CLW（板卡版号 RTD270CLW-R10.1 20.1）** 一块实机上完整验证。**RTD2270 与 RTD2270CLW 是两种不同芯片，固件不通用（RTD2270C 就是 RTD2270CLW）**，**其他所有型号均未测试**，请大家自行测试；刷坏了别怪我们 😃
- 遇到问题（识别失败、刷后异常等）请到 [GitHub Issues 留言板](../../issues) 反馈，附上固件大小 / 主控型号等信息更易排查

- Flashing firmware is risky. **Always keep a backup of your original firmware.** Any damage caused by flashing is at your own risk.
- This tool does not distribute any firmware — it only reads/writes the `.bin` files you provide.
- Verified on exactly one real board: **RTD2270CLW scaler, PCB marked RTD270CLW-R10.1 20.1**. RTD2270C and RTD2270 firmware layouts may differ; **all other models are untested** — please test on your own hardware.
- Found a bug or your firmware isn't detected? Please report it on the [GitHub Issues board](../../issues) (mention firmware size / scaler model if possible).

## 归属声明（AUTHORSHIP NOTICE / 中英双语）

本项目由 **darst335** 委托并全程参与制作（提出全部产品需求、提供真实固件样本、刷机实证与逐项验收），与 AI 结对完成，为原创作品，**非抄袭、非二次打包他人成果**。引擎可验证签名：控制台执行 `RTDLogo.verifyAuthor()` → `true`。转载请保留本署名。

> **Authorship (English)**: This project was created by **darst335** (requirements, real-firmware samples, flashing verification and acceptance testing) in pair-programming with an AI assistant. All format reverse-engineering, the engine and the UI are original work — **not copied from or re-packed from any third-party tool**. Verifiable signature: run `RTDLogo.verifyAuthor()` in the browser console → `true`. Please keep this authorship notice when redistributing.

## License

[MIT](LICENSE) © 2026 darst335
