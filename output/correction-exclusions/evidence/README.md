# 副 API 参数排除：固定源核对

核对日期：2026-10-05（Asia/Shanghai）。本目录保存公共上游源码证据，不含用户密钥或聊天。没有连接实际酒馆实例，不能代表用户宿主版本已验证。

## 来源与版本

- 项目：SillyTavern/SillyTavern
- 固定 commit：`8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8`（技能来源目录标记为 1.18.0）
- `public__scripts__custom-request.js` ← https://raw.githubusercontent.com/SillyTavern/SillyTavern/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/custom-request.js
- `src__endpoints__backends__chat-completions.js` ← https://raw.githubusercontent.com/SillyTavern/SillyTavern/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/src/endpoints/backends/chat-completions.js
- `src__util.js` ← https://raw.githubusercontent.com/SillyTavern/SillyTavern/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/src/util.js
- `public__scripts__openai.js` ← https://raw.githubusercontent.com/SillyTavern/SillyTavern/8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8/public/scripts/openai.js

## 结论与精确行号

1. `custom-request.js:428–454` 的 `ChatCompletionService.createRequestData` 保留 `...props`，仅移除 `undefined` 值。因此 `custom_exclude_body` 可直接放在第一参数内传递。`ChatCompletionPayload` 也是 `Record<string, any>`（L58）。
2. `custom-request.js:544–564` 的 `processRequest` 仅在 `options.presetName` 为真时套用预设。现有 `processRequest(payload, {}, true, signal)` 不继承主连接预设，不会重添 `temperature`、`top_p` 等默认参数。默认添加的是 `stream: false`、`use_sysprompt: true`。
3. 后端 `chat-completions.js:2304–2320` 先由 `request.body.custom_url` 设置地址、读取本机 custom secret，再合并 `custom_include_body` 与 `custom_include_headers`。
4. 后端 `chat-completions.js:2553–2569` 构造发往外部端点的最终 `requestBody`；L2572–2573 调用 `excludeKeysByYaml(requestBody, request.body.custom_exclude_body)`；L2584 再 `JSON.stringify(requestBody)`，L2590 发出。删除发生在参数组装及 include 合并之后，没有后续补回参数。
5. `util.js:849–872` 用 `yaml.parse` 读取排除配置，再对 `obj[key]` 使用 `delete`。数组是公开注释明确描述的输入格式，JSON 编码字符串数组也是合法 YAML 输入。最小接口为 `custom_exclude_body: JSON.stringify(names)`，不能直接传 JS 数组，也不应拼接未经转义的 YAML。
6. 排除机制只匹配最终 JSON 的顶层精确键，区分大小写，不支持点路径、通配符、嵌套查找或参数别名。例：`reasoning.effort` 只尝试删除同名顶层键，不会删除嵌套 `reasoning.effort`。
7. 排除机制只修改 `requestBody`，不修改原始 `request.body` 或 `headers`。`custom_url`、`chat_completion_source`、`custom_include_headers`、`Authorization` 等控制/认证内容不能通过 body 排除表取消。请求 URL 已在 L2527–2529 决定，认证头在 L2579–2583 单独组装，`...headers` 在默认 Authorization 后覆盖。
8. `model`、`messages`、`stream` 确实是最终 body 字段，原生机制允许删除；终端可以将它们列为必要字段，防止删除引起模型路由丢失、空提示词、前后端流式模式不一致。若屏蔽应明确反馈，不能静默忽略用户输入。

## 输出上限字段改名

- 后端 custom 路径 L2558–2559 分别读取 `max_tokens` 与 `max_completion_tokens`，不进行模型别名转换。
- `openai.js:2981–2984` 和 L3005–3007 的确存在 `max_tokens` → `max_completion_tokens` 转换，但属于 `createGenerationParameters`，且按模型/源条件触发。
- 当前无 `presetName` 调用不进入这个函数。调用链只有 `custom-request.js:575–605` 的 `presetToGeneratePayload` 在 L601 进入它。
- 若未来启用预设，这些转换发生在后端最终排除之前。排除名仍按最终键解释；不要默认为 `max_tokens` 与 `max_completion_tokens` 互为别名。

## 建议实现范围

- 副 API 配置存储顶层参数名列表；UI 接受逗号/空白分隔后规范化、去重，空表保持现有行为。
- 使用宿主 `custom_exclude_body` 实现最后阶段删除。若同时从本地 payload 删除参数，仅删除模型请求参数，绝不能泛删地址、来源、认证、`custom_exclude_body` 等控制元数据。
- 独立保持当前 `processRequest(payload, {}, true, signal)` 调用，无需修改宿主全局设置、主连接或主 API 预设。
- 必测：空表兼容；排除 `max_tokens`；排除被组装/补入的 `temperature`、`top_p`；密钥/地址保留；非排除字段不受影响；未知键无害；大小写与顶层键语义；保存并重载后仍有效。
- 待验收：用户实际宿主版本、配置界面交互、真实转发请求体以及副 API 端点接受情况。

## 技能路由凭证

主技能 `sillytavern-api-reference`；通过 `consult-tavernweave-library` 的同名路由，快照 `2026-08-18`；只加载与多后端请求匹配的 `ST-D3`，它仅作导航。没有采用设计/动效候选。这里是固定公共源码核对，不是实际宿主验收。
