# Git 忽略与过时测试清理清单

日期：2026-11-11。实际规则以根目录 `.gitignore` 为准。

本轮清理已被替代的测试、临时检查和生成结果；研究源文件、现行回归测试、构建夹具与正式组件保留。`pages-op.json`、Pages 工作流和 OP 文件不变，网站发布范围等下次打包再调整。

## 本轮新增忽略规则

| 范围 | 用途与保留边界 |
| --- | --- |
| `node_modules/`、`.npm-cache/` | 可重新安装的本地依赖与缓存；保留 package.json、锁文件和测试源码 |
| `/.playwright-cli/` | 浏览器快照及临时观察结果；不扩展到混有源码的 `output/playwright/` |
| `/output/guard-readiness/npm-cache/` | 一次性 npm 缓存 |
| `/map/edge_out_*.png` | 地图迭代截图；显式保留 `edge_out_v17_trans_perfect.png` |
| 根目录七个临时输出 | 精确列出，见下表；不使用 `/*_out.txt` 或 `/*.py` |
| 四个会话导出文件 | `all_user_messages.txt`、`last_user_content.txt`、`last_user_full.txt`、`temp_last_msg.json`；本轮不读取正文、不删除现有文件 |
| `output/dialogue-bubbles/` 的七个旧结果 | 逐文件忽略；保留当前回归读取的 `user-reproduction.txt`、历史组件与其源码 |
| `output/worldbook-preview/00_索引.md`、`条目/`、`渲染/` | 自动生成的预览；保留 `卡片条目更新报告.md` |
| `output/xiaoli-avatar-delivery/`、`worldbook-calendar/`、`oc-profile-avatars-20261101/` | 仅包含已过时结果的目录 |
| `scripts/正文气泡/验证记录/加加美图床-20261012/write-plan.json` | 重复计划；保留 `加加美头像-20261012/` 下逐字相同的副本 |

`.gitignore` 不会自动取消已跟踪文件。现有会话导出和保留的较新浏览器记录仍被跟踪，需另行决定是否从 Git 移除；本轮不将忽略规则误报为已经停止发布。

## 本轮删除范围

共 162 个已跟踪文件，23,534,783 字节，约 22.445 MiB。仅按已核对的精确路径删除；执行前再次检查工作区内绝对路径、链接、文件哈希和已有改动。

| 分组 | 文件数 | 字节 |
| --- | ---: | ---: |
| 一次性检查脚本及对应输出 | 14 | 98,277 |
| 地图 v4–v16 中间截图 | 14 | 15,216,341 |
| 重复的加加美计划 | 1 | 388 |
| 旧 v0.3 气泡结果 | 7 | 289,076 |
| 生成的世界书预览 | 34 | 141,797 |
| 三个旧头像／日历结果目录 | 5 | 78,710 |
| 已被剧情注入修复替代的旧学战审计 | 7 | 466,801 |
| `.playwright-cli/` 内十月快照与结果 | 59 | 6,217,957 |
| `output/guard-readiness/npm-cache/` | 21 | 1,025,436 |

一次性检查脚本与输出均在项目根目录：

| 脚本 | 输出 |
| --- | --- |
| `inspect_ch4.py` | `ch4_out.txt` |
| `read_ch4_growing.py` | `ch4_grow_out.txt` |
| `inspect_ch5_6.py` | `ch5_6_out.txt` |
| `read_epilogue.py` | `epilogue_out.txt` |
| `read_t03.py` | `t03_out.txt` |
| `find_v17_kurono.py` | `v17_kurono_out.txt` |
| `inspect_v19_text.py` | `v19_interlude_out.txt` |

这些脚本只有固定原文路径、行段或关键词打印，没有断言或测试框架；当前代码、CI 与维护说明未发现调用。

旧气泡结果的精确文件名：`artifact-check.json`、`browser-check.json`、`check-results.json`、`runtime-check.json`、`preview.html`、`runtime-player-v0.3.jpg`、`runtime-bubble-proof.jpg`，均位于 `output/dialogue-bubbles/`。其中旧检查记录的四个源码哈希均已不匹配当前源码。归档 v0.2 README 已标记旧宿主报告清理情况，不将当前测试当作历史宿主结论。

`output/asterisk-live-audit-20261109/` 的旧安装快照、专用复放脚本与结果一起清理；其发现的问题已由 `output/asterisk-injector-v2-20261109/` 的正式修复替代。删除后不添加宽泛的目录忽略规则，以免以后隐藏新测试源码。

## 保留清单

- `scripts/**` 中现行 `check-*`、`*-test.*`、构建脚本及其依赖；不按名称批量忽略测试。
- `scripts/正文气泡/验证记录/` 的最新检查、宿主复放、现场证据和未解决性能问题；终端验证记录也保留。
- `output/dialogue-bubbles/user-reproduction.txt`、`output/native-mvu-repair/native-core-*.txt`、`output/chapter-v4/` 的迁移夹具及开局修复基线。
- 世界书编写源、人物研究、各卷资料、头像原稿、组件规格、正式导入文件和正在编辑的 DLC 笔记与插图。
- `map/edge_out_v17_trans_perfect.png`、`map/hot_sample.png` 以及地图实际使用的资源。
- `.playwright-cli/` 内十一月记录，避免把最近一次观察当成过时证据删除。

## 验证与恢复

忽略规则用 `git check-ignore --no-index` 验证，并检查正式组件、回归夹具、最终截图不匹配忽略规则。删除前后核对 204 个受保护文件的 SHA-256，包括 Pages 配置、当前测试源码、发布组件和头像资源。

气泡回归通过只读运行验证：拦截唯一的结果写入，避免清理工作刷新或覆盖最新验收记录。删除前后均为 859/859；日历 17/17、人物档案 17/17。该检查证明这些现行离线回归仍能运行，不代表新增实机验收。

额外运行的两项旧测试未通过，保留源码待修，不通过删除测试消除失败：

- `avatar-test.mjs` 的 DOM 测试桩没有 `document.querySelectorAll`，终端初始化时抛错；测试、构建器及终端源码与 HEAD 相同。
- `check-plot-injector.mjs` 为 15/58；旧 fixture 未提供当前运行代码需要的 `readSettings`，并出现后续断言失败。测试与运行源码未改，读取跟踪显示没有访问本次删除文件；旧报告未覆盖。

全工作区范围检查包含用户正在编辑的 DLC 文件及本次删除的生成 JSON，超过常规行数预算，并有图片无法按行计量的警告；不声称该预算检查全绿。本轮以精确删除清单、162 项索引删除一致性和 204 项保护哈希复核边界。当前 Pages 构建计划校验通过；没有执行打包或部署。

162 项删除已单独记录到 Git 索引；`.gitignore`、本清单及归档 README 修改留在工作区，未提交、未推送。用户原有 DLC 改动没有加入暂存区。

完整逐文件路径、删除前哈希与保护清单暂存于本地 `_site/cleanup-20261111/deletion-plan.json`；该目录已经被 Git 忽略。

所有删除项原先均被 Git 跟踪。提交本次清理前，可按单文件恢复，例如：

```powershell
git restore --source=HEAD --staged --worktree -- 'map/edge_out_v4.png'
```

历史实机截图不能靠运行当前代码精确重建，需从 Git 历史恢复。世界书预览导出器会重建整个目录，恢复预览时应先保留 `卡片条目更新报告.md`。
