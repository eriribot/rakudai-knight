# 学战都市动画头像

本目录保存 10 张动画官网角色设定图，以及既有女主共享图 `heroines-official.jpg`。原图字节保持不变；正文气泡用 CSS 从设定板中选取单个人物头部，再显示在六边框内。

来源页、原图地址、尺寸与 SHA-256 见 [sources.json](sources.json)。姓名、别名与 CSS 取景坐标维护在 `scripts/正文气泡/asterisk-portraits.json`。

Git Pages 图床根地址：`https://eriribot.github.io/rakudai-knight/resource/asteriskavatars/`，例如 `ayato.jpg` 对应此地址下的同名文件。本地预览直接读取本目录图片。

发布时将图片、清单与生成组件一起 `git add`、`git commit`，再 `git push` 到 `main`，等待 GitHub Pages 部署成功；未被 Git 跟踪的文件不会进入站点。

酒馆需更新正文气泡 **01 姓名与台词**、**03 共享样式**；**02 OC 候选不变**。终端也要重建并更新，以同步 NPC 保留姓名，避免新增角色被误认作 OC。每种组件只保留一份启用。
