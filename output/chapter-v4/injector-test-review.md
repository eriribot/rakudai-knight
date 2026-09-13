# 剧情注入器离线验收

结果：16/58 项通过。

测试通过 VM 加载实际剧情目录和纯工厂，模拟已核实的 SillyTavern context、Tavern Helper 楼层/活动 swipe 与 MVU 接口；不连接酒馆，不发送生成请求。READY 阶段仅验证候选块；SETTINGS 阶段另外验证最终确认或撤回，只有后者成功才有最近注入记录。另使用本地 EJS 3.1.10 引擎验证 READY→SETTINGS 之间的原位模板展开。

| 场景 | 结果 |
|---|---|
| 普通发送忽略末尾用户变量，读取此前助手的活动 swipe | FAIL |
| 正常发送在生命周期之后新增用户楼层仍使用助手状态 | FAIL |
| 活动 swipe 的变量来源与预览来源一致 | FAIL |
| MVU 返回值与活动回复页不一致时拒绝，不选择看似有效的一份 | PASS |
| 卷十三旧间章别名解析为间章1，不与间章2混淆 | FAIL |
| 最新助手缺 MVU 时失败关闭，不搜索旧楼层或回退卷一第一章 | PASS |
| swipe 排除即将重写的末助手，读取前一助手状态 | FAIL |
| regenerate 在宿主已删除末助手后读取剩余最新助手 | FAIL |
| continue 使用当前助手活动状态，保持卷十六终章Ⅱ的真实键 | FAIL |
| 未建档、v3、非法卷章或阶段都不得伪装为可用剧情 | PASS |
| MVU 不可用不得使用另一个作用域或全局 stat_data 兜底 | PASS |
| 没有主生成票据的 prompt-ready 不注入 | PASS |
| 即使持有主生成票据，宿主确认请求不属于主聊天也拒绝 | FAIL |
| quiet、impersonate、未知生成类型不会获得正文剧情 | PASS |
| 生命周期 dryRun 与 prompt-ready dryRun 分别拒绝 | PASS |
| MVU 额外解析开始前或预算等待期间都不得注入正文剧情 | FAIL |
| 外来生成使旧主票据失效，结束外来生成也不复活票据 | FAIL |
| 后台错误缺少 END 不会永久锁住后续显式主生成 | FAIL |
| 剧情开关按聊天保存，返回原聊天仍记住禁用状态 | FAIL |
| 票据创建后切聊天不得把前一聊天的剧情带入新聊天 | PASS |
| 预算等待期间切聊天、切 swipe 或变更状态均拒绝旧快照 | FAIL |
| 同一 prompt-ready 顺序重入只保留一个剧情块 | FAIL |
| 新请求仅替换旧自有剧情块，保留正文、EJS 与其他插件标记 | FAIL |
| 遇到未闭合的自有剧情块时保留整个请求并拒绝注入 | FAIL |
| 并发 prompt-ready 无法确认归属时拒绝双方，新主生成仍可恢复 | FAIL |
| 多模态用户内容完整保留，EJS 源码与其他系统规则不清洗 | FAIL |
| 三个阶段预览明确区分且不把参考概要写入已发生事件 | FAIL |
| 预算明确拒绝或计量失败时不修改消息并留下原因 | PASS |
| 预算拒绝会消费主票据，后续无新生命周期的请求不能复用 | FAIL |
| 预算计量读取完整候选请求，批准之前不触碰宿主数组 | FAIL |
| 预算等待中正文或包装变量发生编辑时拒绝旧快照 | FAIL |
| 预算等待中其他监听器改动请求时保留其改动并放弃旧候选 | FAIL |
| 预算挂起时结束生成立即解除等待，迟到批准不能注入旧请求 | FAIL |
| 后台生成、关闭开关或卸载也会解除预算等待并拒绝迟到结果 | FAIL |
| 预算等待期间末用户被编辑或新增用户楼层，即使助手状态未变也拒绝 | FAIL |
| 预算批准后重新核对请求归属，期间由匹配变为不匹配时拒绝 | FAIL |
| end 与 dispose 使未完成票据失效 | PASS |
| READY 只建立候选，SETTINGS 浅拷贝通过才记录最近注入 | FAIL |
| SETTINGS 没有 READY 候选时永不创建剧情块 | PASS |
| 最终事件必须保留原始生成类型，normal 不能替代续写重生成或 swipe | FAIL |
| 深复制、消息替换或排序改变无法确认身份，只撤回传入请求的自有块 | PASS |
| READY 后 TH START 会撤回候选，普通或自定义 normal 后台 SETTINGS 都无剧情 | FAIL |
| 多个后台 START 和 quiet 插入事件链不会遗留候选或永久锁定 | FAIL |
| 迟到的旧 SETTINGS 不得撤销或确认新的 pending | FAIL |
| 尾段预算挂起时取消立即完成撤回，迟到批准不影响新请求 | FAIL |
| 后台 START、关闭开关和卸载同样立即取消尾段等待 | FAIL |
| 旧尾段异步回调收尾时不得清空或撤回新主请求的 pending | FAIL |
| 尾段预算期间请求归属由 true 变 false 时撤回候选 | FAIL |
| 尾段预算期间源变量、活动 swipe、用户正文或楼层变化均撤回候选 | FAIL |
| 尾段预算拒绝或请求参数被更新时撤回候选，不留下成功回执 | FAIL |
| 尾段预算等待中其他监听器加字时只撤回自有块，完整保留新增内容 | FAIL |
| 真实 EJS 在 READY 与 SETTINGS 间原位展开系统和助手模板，候选仍可确认 | FAIL |
| SETTINGS 前自有块正文被改写或完整块重复时拒绝并撤回 | FAIL |
| SETTINGS 前同对象的非剧情内容增补纳入最终预算且保留 | FAIL |
| 撤回多模态候选保留原文本图片对象和其他监听器追加 part | PASS |
| 取消遇到先前未闭合标记仍删除完整候选，保留坏标记旁正文且不抛错 | PASS |
| 未知拷贝或重排请求的坏首消息不会阻止撤回后续完整候选 | PASS |
| 准备阶段仍拒绝嵌套或残缺旧标记，不擅自吞掉相邻正文 | PASS |

## 真实宿主仍需验证

- prompt-ready 与主生成的归属关联，尤其故事神谕及其他后台请求并发；离线票据测试不构成所有扩展隔离的证明。
- 当前版本事件到达顺序、token 计量器可用性、脚本单实例注册与卸载，以及 EJS 真正启用后的身份模板输出。
- 真实发送、重生成、swipe、续写、切聊天与刷新后的状态和开关持久化。

## 失败：普通发送忽略末尾用户变量，读取此前助手的活动 swipe

```text
SyntaxError: "undefined" is not valid JSON
    at JSON.parse (<anonymous>)
    at plain (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:11:29)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:137:20
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:134:7
    at ModuleJob.run (node:internal/modules/esm/module_job:430:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:655:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
```

## 失败：正常发送在生命周期之后新增用户楼层仍使用助手状态

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:153:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:148:1
```

## 失败：活动 swipe 的变量来源与预览来源一致

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== 2

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:160:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:156:7
```

## 失败：卷十三旧间章别名解析为间章1，不与间章2混淆

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== '间章1'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:172:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:170:7
```

## 失败：swipe 排除即将重写的末助手，读取前一助手状态

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(allText(event.chat).includes(resolveStoryChapter(2, '序章').summary))

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:191:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:186:1
```

## 失败：regenerate 在宿主已删除末助手后读取剩余最新助手

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(allText(event.chat).includes(resolveStoryChapter(2, '序章').summary))

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:200:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:196:1
```

## 失败：continue 使用当前助手活动状态，保持卷十六终章Ⅱ的真实键

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== '终章Ⅱ'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:207:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:204:1
```

## 失败：即使持有主生成票据，宿主确认请求不属于主聊天也拒绝

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

false !== true

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:234:30
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:231:1
```

## 失败：MVU 额外解析开始前或预算等待期间都不得注入正文剧情

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'undefined'
- 'function'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:255:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:250:1
```

## 失败：外来生成使旧主票据失效，结束外来生成也不复活票据

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:264:43
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:259:1
```

## 失败：后台错误缺少 END 不会永久锁住后续显式主生成

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:271:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:267:1
```

## 失败：剧情开关按聊天保存，返回原聊天仍记住禁用状态

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:278:44
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:274:1
```

## 失败：预算等待期间切聊天、切 swipe 或变更状态均拒绝旧快照

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'undefined'
- 'function'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:295:12
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:288:7
```

## 失败：同一 prompt-ready 顺序重入只保留一个剧情块

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:303:80
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:300:1
```

## 失败：新请求仅替换旧自有剧情块，保留正文、EJS 与其他插件标记

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:312:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:306:1
```

## 失败：遇到未闭合的自有剧情块时保留整个请求并拒绝注入

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /未闭合/. Input:

'缺少绑定世界书读取接口，请更新剧情注入脚本'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:320:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:318:1
```

## 失败：并发 prompt-ready 无法确认归属时拒绝双方，新主生成仍可恢复

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(releases.length >= 1)

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:327:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:323:7
```

## 失败：多模态用户内容完整保留，EJS 源码与其他系统规则不清洗

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

2 !== 3

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:345:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:334:1
```

## 失败：三个阶段预览明确区分且不把参考概要写入已发生事件

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

undefined !== '未开始'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:353:45
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:349:7
```

## 失败：预算拒绝会消费主票据，后续无新生命周期的请求不能复用

```text
AssertionError [ERR_ASSERTION]: 无新票据的请求应在预算阶段前被拒绝

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:369:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:366:1
```

## 失败：预算计量读取完整候选请求，批准之前不触碰宿主数组

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:386:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:374:1
```

## 失败：预算等待中正文或包装变量发生编辑时拒绝旧快照

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:395:16
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:389:7
```

## 失败：预算等待中其他监听器改动请求时保留其改动并放弃旧候选

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:404:3
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:399:7
```

## 失败：预算挂起时结束生成立即解除等待，迟到批准不能注入旧请求

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'undefined'
- 'function'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:411:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:407:7
```

## 失败：后台生成、关闭开关或卸载也会解除预算等待并拒绝迟到结果

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:430:5
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:422:1
```

## 失败：预算等待期间末用户被编辑或新增用户楼层，即使助手状态未变也拒绝

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:441:5
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:434:7
```

## 失败：预算批准后重新核对请求归属，期间由匹配变为不匹配时拒绝

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:451:10
    at check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:15)
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:446:7
```

## 失败：READY 只建立候选，SETTINGS 浅拷贝通过才记录最近注入

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:464:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:461:1
```

## 失败：最终事件必须保留原始生成类型，normal 不能替代续写重生成或 swipe

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(candidate.includes('【RK剧情注入:BEGIN】'))

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:486:14
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:480:1
```

## 失败：READY 后 TH START 会撤回候选，普通或自定义 normal 后台 SETTINGS 都无剧情

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(f.api.getStatus().lastInjection)

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:513:57
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:505:1
```

## 失败：多个后台 START 和 quiet 插入事件链不会遗留候选或永久锁定

```text
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert.ok(f.api.getStatus().lastInjection)

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:523:55
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:517:1
```

## 失败：迟到的旧 SETTINGS 不得撤销或确认新的 pending

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:532:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:526:1
```

## 失败：尾段预算挂起时取消立即完成撤回，迟到批准不影响新请求

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ 'undefined'
- 'function'

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:539:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:536:1
```

## 失败：后台 START、关闭开关和卸载同样立即取消尾段等待

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:556:5
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:549:1
```

## 失败：旧尾段异步回调收尾时不得清空或撤回新主请求的 pending

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:567:44
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:560:1
```

## 失败：尾段预算期间请求归属由 true 变 false 时撤回候选

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:577:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:573:1
```

## 失败：尾段预算期间源变量、活动 swipe、用户正文或楼层变化均撤回候选

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:589:16
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:582:1
```

## 失败：尾段预算拒绝或请求参数被更新时撤回候选，不留下成功回执

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:598:73
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:594:1
```

## 失败：尾段预算等待中其他监听器加字时只撤回自有块，完整保留新增内容

```text
TypeError: release is not a function
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:609:3
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:603:1
```

## 失败：真实 EJS 在 READY 与 SETTINGS 间原位展开系统和助手模板，候选仍可确认

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:629:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:617:1
```

## 失败：SETTINGS 前自有块正文被改写或完整块重复时拒绝并撤回

```text
TypeError: Cannot read properties of undefined (reading 'replace')
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:634:117
    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:637:80
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:633:1
```

## 失败：SETTINGS 前同对象的非剧情内容增补纳入最终预算且保留

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1

    at file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:650:10
    at async check (file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:123:9)
    at async file:///E:/web/%E8%90%BD%E7%AC%AC/scripts/check-plot-injector.mjs:644:1
```

