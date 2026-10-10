# EPUB 插图扫描

本地 `39688/` 的22个 EPUB 均可读取。扫描结果 [index.json](./index.json) 索引423张尺寸至少180×180的位图，含封面、彩图、重复方向版本、目录页与黑白插图；这不是423名人物或423张独立头像。

第5–19卷（含第16卷两个版本）提取135个彩色图片引用，按原始位元组 SHA-256 存入 `images/`，生成各卷 `*-color-sheet.jpg` 供检视。彩图筛选按颜色像素比例，因此联系表也可能含彩色目录；身份仍需人工核对。[character-evidence.json](./character-evidence.json) 列原有十二位EPUB插图人物与一位使用者提供图片人物的证据；新增夏洛特另见 [身份核验](./charlotte-evidence.json)。凛奈、碎城雷、福小莉与夏洛特是小说黑白原图的AI上色衍生头像；福小莉当前使用第18卷 `OEBPS/Images/190226.jpg` 中华服图，原第12卷 `OEBPS/Images/014.jpg` 与用户图片的同幅核验继续保留。夏洛特以第5卷正面图按第6卷官方参考上色。鹤屋美琴用使用者提供的黑白人物图上色，原出版载体尚未核实。

清单的 `epub`、图片 `member`、尺寸、哈希与 `references` 可定位原始书、ZIP 成员和出现图片的 XHTML；仅保留短上下文，不复制整章。读取不执行 EPUB 内的脚本。`novel/` 保存选入头像库的小说原图及明确命名的派生图；美琴与小莉上色图另存 `color/`，用户原图存于 `research/user-supplied/`。`prepared/` 才是要上传图床的盾形头像。研究目录不会自动打包进终端。[凛奈上色记录](./rinna-colorization.json)、[碎城雷上色记录](./rai-colorization.json)、[美琴上色记录](./mikoto-colorization.json)、[小莉第12卷上色记录](./xiaoli-colorization.json) 与 [小莉第18卷上色记录](./xiaoli-vol18-colorization.json) 保存最终提示词、编辑模式、颜色参考与AI衍生说明；[第5–9卷核验](./volume-5-9-evidence.json)、[艾茵核验](./ein-evidence.json)、[碎城雷／武曲核验](./bukyoku-evidence.json)、[美琴核验](./mikoto-evidence.json) 和 [小莉核验](./xiaoli-evidence.json) 保留定位细节。小莉的黑长发与较深肤色依据第18卷第四章正文，深棕瞳色为本次上色选择；两枚金钱饰片的金色依据用户指定，未冒充官方彩图证据。

重复扫描（Python + Pillow）：

```powershell
python scripts/黑白ADV轮盘终端/scan-epub-illustrations.py
```

默认源目录与输出路径相对仓库解析；`--extract-from 5` 控制提取彩色参考的起始卷，当前默认即为第5卷。所有书仍会被索引。新增人物必须先核验身份，再更新 `manifest.json` 和 `avatar-fit.json`，运行 `prepare-avatars.mjs` 生成独立头像。

夏洛特正式台版名为 `夏洛特·科黛`，英文为 `Charlotte Cordé`。第5卷 `OEBPS/Images/007.jpg` 与凛奈为同幅人物插图，本次从夏洛特的正面女仆区域单独制作头像，并以第6卷官方彩页核验绿发、紫瞳与黑白女仆装；格纹蝴蝶结的紫红色为本次衍生选色。详见 [夏洛特身份核验](./charlotte-evidence.json) 与 [夏洛特上色记录](./charlotte-colorization.json)。
