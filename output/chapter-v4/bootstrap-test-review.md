# 剧情注入器宿主适配离线验收

结果：4/7 项通过。

VM 加载实际目录、runtime 和 bootstrap 源码。宿主、父 iframe 和脚本 iframe 同时提供 SillyTavern；模拟 TH 按 iframe 安装 MVU 动态 getter 的等待接口。事件常量按项目固定 TH 4.9.5 / ST 1.18 证据定义。没有连接实机或发送模型请求。

| 场景 | 结果 |
|---|---|
| TH iframe 也有 SillyTavern 时仍向最外层宿主发布唯一 API | FAIL |
| MVU 后加载时每个 iframe 的 wait 安装动态 getter，预览恢复真实卷章 | FAIL |
| 跨 iframe 热重装移除旧监听，旧 pagehide 不会删除新 API | FAIL |
| 实际事件总线仅形成一次候选和一次尾确认，启动不发送模型请求 | PASS |
| TH START 实际常量触发撤回，缺 END 后下一原生主生成仍可确认 | PASS |
| 卸载撤回未确认候选，所有事件监听解除且不改聊天存档 | PASS |
| MVU 等待尚未完成即卸载，迟到就绪不会重新安装监听 | PASS |

仍须实机确认终端读取最外层 API、实际 MVU 初始化顺序及旧脚本停用后的监听清理。

## TH iframe 也有 SillyTavern 时仍向最外层宿主发布唯一 API

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== 2

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:111:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:103:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:107:7
    at ModuleJob.run (node:internal/modules/esm/module_job:430:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:655:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

## MVU 后加载时每个 iframe 的 wait 安装动态 getter，预览恢复真实卷章

```text
AssertionError [ERR_ASSERTION]: Missing expected exception.
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:118:49
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:103:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:115:7
```

## 跨 iframe 热重装移除旧监听，旧 pagehide 不会删除新 API

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== 2

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:131:32
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:103:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-bootstrap.mjs:125:1
```

