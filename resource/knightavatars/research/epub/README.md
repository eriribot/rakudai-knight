# EPUB 插图扫描

本地 `39688/` 的22个 EPUB 均可读取。扫描结果 [index.json](./index.json) 索引423张尺寸至少180×180的位图，含封面、彩图、重复方向版本、目录页与黑白插图；这不是423名人物或423张独立头像。

第5–19卷（含第16卷两个版本）提取135个彩色图片引用，按原始位元组 SHA-256 存入 `images/`，生成各卷 `*-color-sheet.jpg` 供检视。彩图筛选按颜色像素比例，因此联系表也可能含彩色目录；身份仍需人工核对。[character-evidence.json](./character-evidence.json) 列十一位EPUB插图人物与一位使用者提供图片人物的证据。凛奈与碎城雷是小说黑白原图的AI上色衍生头像；鹤屋美琴用使用者提供的黑白人物图上色，原出版载体尚未核实。

清单的 `epub`、图片 `member`、尺寸、哈希与 `references` 可定位原始书、ZIP 成员和出现图片的 XHTML；仅保留短上下文，不复制整章。读取不执行 EPUB 内的脚本。`novel/` 保存选入头像库的小说原图及明确命名的派生图；美琴上色图另存 `color/`，原截图库存于 `research/user-supplied/`。`prepared/` 才是要上传图床的盾形头像。研究目录不会自动打包进终端。[凛奈上色记录](./rinna-colorization.json)、[碎城雷上色记录](./rai-colorization.json) 与 [美琴上色记录](./mikoto-colorization.json) 保存最终提示词、编辑模式、颜色参考与AI衍生说明；[第5–9卷核验](./volume-5-9-evidence.json)、[艾茵核验](./ein-evidence.json)、[碎城雷／武曲核验](./bukyoku-evidence.json) 和 [美琴核验](./mikoto-evidence.json) 保留定位细节。

重复扫描（Python + Pillow）：

```powershell
python scripts/黑白ADV轮盘终端/scan-epub-illustrations.py
```

默认源目录与输出路径相对仓库解析；`--extract-from 5` 控制提取彩色参考的起始卷，当前默认即为第5卷。所有书仍会被索引。新增人物必须先核验身份，再更新 `manifest.json` 和 `avatar-fit.json`，运行 `prepare-avatars.mjs` 生成独立头像。
