<div align="center">

<img src="docs/images/mark.svg" width="72" height="72" alt="Slide Studio 标志">

# Slide Studio

### 像编辑幻灯片一样操作，保留 HTML 的自由。

为 HTML 演示文稿准备的可视化工作台。<br>
直接改文字、调整布局，也能随时回到清晰可读的源码。

**[在线体验 →](https://html-slide-editor-sepia.vercel.app/)** &nbsp; · &nbsp; [开始使用](#开始使用) &nbsp; · &nbsp; [完整指南](docs/guide.zh-CN.md) &nbsp; · &nbsp; [English](README.md)

`网页版 + macOS` &nbsp; `标准 HTML` &nbsp; `中文 · English · 日本語`

</div>

[![Slide Studio 编辑器：页面缩略图、实时画布和元素属性面板](docs/images/editor-overview.jpg)](https://html-slide-editor-sepia.vercel.app/)

<p align="center"><sub>真实界面截图。首次打开，即可从内置五页教学开始练习。</sub></p>

## 从 AI 生成，到自己调整

让 AI 写出第一版 HTML，或打开你已有的幻灯片。接下来的小改动，可以自己完成：改一个标题，移动图片，对齐卡片，调整页序。文件仍是普通 HTML，人工和 AI 都能继续修改。

| 直接做出修改 | 始终掌握内容 |
| --- | --- |
| **在画布上编辑**：双击文字输入，Esc 结束。 | **源码同步定位**：选中元素，下方高亮对应 HTML。 |
| **用鼠标调整布局**：拖动、缩放、吸附、多选与组合。 | **保存前查看差异**：并排对比原 HTML 与修改结果。 |
| **整理你的演示**：拖动缩略图排序、新增页面、替换图片。 | **带走你的作品**：导出 HTML、PDF 或 PowerPoint `.pptx`。 |

## 点击画布，也就找到了源码

可视化编辑和源码编辑使用同一份文档。点击文本框，源码自动滚动、高亮并显示行号；即使存在重复文字，也能定位到具体元素。你也可以直接改 HTML，再应用到画布。

![选中标题后，源码面板定位并高亮对应标签](docs/images/source-sync.jpg)

## 为你的工作方式留出空间

<table>
<tr>
<td width="50%" valign="top">

### 图片，直接在画面中调整

选中图片即可缩放、替换和裁剪。用按钮添加图片，或直接拖进画布。

[![图片选框、缩放控制点与属性面板](docs/images/image-tools.jpg)](docs/images/image-tools.jpg)

</td>
<td width="50%" valign="top">

### 更大的画布，熟悉的语言

需要专注时，折叠左侧预览栏。切换中、英、日界面，内置教学也同步切换。

[![日文教学与折叠后的左侧预览栏](docs/images/japanese-focus.jpg)](docs/images/japanese-focus.jpg)

</td>
</tr>
</table>

## 开始使用

### 打开，试一试，再换成你的内容。

1. **[打开在线编辑器](https://html-slide-editor-sepia.vercel.app/)**：无需安装，无需注册。
2. **体验五页教学**：练习文字、布局、图片、多选组合和导出。切换语言时，保留你自定义的文字和布局。
3. **导入自己的幻灯片**：选择自带资源的 HTML；若图片和 CSS 是独立文件，就选择完整文件夹。可保存浏览器草稿，也可导出 HTML 备份。

### 选择适合你的工作台

| | 网页版 | Mac App | 本地浏览器 |
| --- | --- | --- | --- |
| **如何开始** | [直接打开](https://html-slide-editor-sepia.vercel.app/) | [构建 Mac 应用](desktop/macos/README.md) | 运行下方 Python 服务 |
| **打开文件** | 导入 HTML 或文件夹 | 原生文件／文件夹选择器 | 项目目录内的幻灯片文件夹 |
| **保存方式** | 当前浏览器草稿、下载 HTML | 保存本地文件并备份 | 保存本地文件并备份 |
| **适合场景** | 快速体验、跨平台使用 | 在 Mac 上长期编辑本地文件 | 配合代码编辑器或 AI 工作 |

<details>
<summary><strong>本地浏览器启动</strong> · Python 3.9+，无需安装额外包</summary>

```sh
git clone https://github.com/donaldhxp0127/HTML-Slide-Editor.git
cd HTML-Slide-Editor
python3 slide-editor/server.py
```

打开 [127.0.0.1:8765](http://127.0.0.1:8765/)，保持终端运行。Mac 也可双击 `slide-editor/启动编辑器.command`。

将幻灯片文件夹放在 `slide-editor/` 同级，保持 CSS、JS 和图片的相对路径。刷新编辑器后，选择文件并点击「打开」。

</details>

<details>
<summary><strong>构建 Mac App</strong> · macOS 与 Xcode Command Line Tools</summary>

```sh
./desktop/macos/build.sh
```

打开生成的 `dist/Slide Studio.app`，无需 Python、Node.js 或终端。构建适用于当前主机架构，已测试 Apple Silicon。当前采用本地临时签名，未做公开分发所需的开发者签名和公证。详见 [Mac 版说明](desktop/macos/README.md)。

</details>

## 文件始终是你的 HTML

- **普通文件**：保留 HTML 标签和 class，视觉样式覆盖写入标准行内 CSS，没有专有幻灯片格式。浏览器序列化可能规范化部分排版。
- **本机处理**：网页版在浏览器中处理导入文件，草稿属于当前浏览器和设备；桌面版与本地服务读写本地文件。文稿中引用的远程资源仍可能联网加载。
- **明确的导出方式**：HTML 可继续编辑；PDF 和 PPTX 以高清页面图片保留外观，文字不能单独编辑，后续修改请继续使用 HTML。

### 请带上一份 HTML 幻灯片

当前支持 **`.slide` 容器、1280 × 720 画布的静态 HTML 幻灯片**，不会自动把任意网页转换成幻灯片。编辑时暂停原始脚本，因此动态内容和交互图表需要静态版本。

浏览器草稿可能被清理，请导出 HTML 做长期备份。远程资源需要联网，图片导出还可能需要 CORS 支持。文件限制、操作细节及部署方式请查看 [完整使用指南](docs/guide.zh-CN.md)。

## 继续探索

| | |
| --- | --- |
| [中文使用指南](docs/guide.zh-CN.md) | 操作方式、快捷键、源码联动和文件保存 |
| [English user guide](docs/guide.md) | 完整英文文档 |
| [部署到 Vercel](docs/guide.md#deploy-on-vercel) | 静态部署，无需数据库或服务端函数 |
| [教学示例源码](examples/landing-page/) | 修改教学内容，重新生成离线版本 |
| [反馈问题](https://github.com/donaldhxp0127/HTML-Slide-Editor/issues) | 提交可复现的问题，或提出改进建议 |

---

<sub>界面截图使用内置教学，改编自 [Start Bootstrap Landing Page](https://github.com/StartBootstrap/startbootstrap-landing-page)，保留其 [MIT 许可](examples/landing-page/LICENSE)。导出依赖及许可见 [第三方说明](slide-editor/vendor/README.md)。</sub>

<div align="center">

**直接调整画面，保留源码自由。**<br>
[打开 Slide Studio →](https://html-slide-editor-sepia.vercel.app/)

</div>
