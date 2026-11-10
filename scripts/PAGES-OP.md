# Pages OP 原片部署

网页继续使用 `https://eriribot.github.io/rakudai-knight/op.mp4`。构建时将 V6 原片放在这个路径，因此已导入的开局页面和旧卡无需修改视频地址。

V6 原片以 `rakudai-asterisk-v6-720p.mp4` 存放在 GitHub Release `mv-v6-original`。Git 仓库保留代码和配置；原片不进入普通 Git 对象。构建不转码，以 `pages-op.json` 中的 **116002353 字节和 SHA-256** 验证下载内容，保持原视频和音频的全部字节。本地 `op.mp4`、DLC 原片与其他素材均不会被构建脚本修改。

仓库 Settings → Pages 的部署来源应设为 **GitHub Actions**。推送 `main` 或手动运行 `Deploy Pages with original V6 OP` 后，工作流构建并部署 `_site/`。其他分支不能通过本工作流发布。

为控制站点大小，仅在部署产物中排除以下开发资料；它们仍保留在 Git 仓库和本地：

- `.agents/`、`.obsidian/`、`.playwright-cli/`：开发技能、编辑器状态和浏览器测试资料。
- `DLC/MV工程/`：剪辑工程、素材和检查截图。
- `DLC/学战研究/`：研究工作区及本地插图目录链接。
- `scratch/`：临时研究及脚本草稿。
- `39688/`：原始 EPUB 资料。
- `output/playwright/`：浏览器验证截图和检查页面。
- `output/imagegen/`：生成图研究与中间结果。
- `resource/knightavatars/research/`：头像考据原始资料。
- `output/asterisk-chapter-alignment-20261106/`：旧实机导出与排查资料。
- `output/asterisk-injector-v2-20261109/before/`、`output/asterisk-avatars-20261110/before/`、`output/bubble-ayato-alias-20261110/before/`：三次组件更新前的历史备份。

`.git`、`.github` 元数据也不发布。其余已跟踪文件按原路径复制，并保留 `.nojekyll`。运行时头像、背景音乐、`DLC/插图/` 和应用页面不变；研究文档指向上述资料目录的链接应在 GitHub 仓库中查看。站点体积以每次构建的摘要为准，计划体积超过 **950 MiB** 时构建直接失败。排除目录先按路径判定，之后只检查实际发布输入的符号链接与越界路径。

部署使用 `actions/deploy-pages@v5.0.1`（Node.js 24）。2026-11-10 的失败发生在 GitHub 端 `syncing_files` 阶段：构建与上传成功，但同步超过 10 分钟。精简上述开发目录和历史备份约 51.45 MiB，以减少同步负担；不将此认定为已经证明的超时根因。GitHub Pages 本身有 10 分钟部署限制，不靠调大 Action 的等待时间绕过。

本地先检查计划（不复制、不下载）：

```bash
python scripts/build-pages.py --dry-run
```

用本地 V6 原片执行完整构建：

```bash
python scripts/build-pages.py --output _site --op-file "DLC/学战都市×落第骑士英雄谭_联合MV_V6_动作帧修复720p.mp4"
```

输出目录必须不存在或为空；脚本不会清空目录。构建失败后可换一个新的输出目录重试。普通构建不传 `--op-file`，会下载并核验 Release 原片。

更换 OP 时先上传新的 Release 附件，再更新 `pages-op.json` 的 URL、字节数和 SHA-256；不要只替换附件而继续沿用旧校验值。
