import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { stripModuleSyntax } from '../story-build.mjs';
import { shouldInjectTournament } from '../rakudai-tournament-calendar.mjs';

// The dev workspace is already required by the project's schema checks. Missing
// yaml is a setup failure, never a reason to substitute JSON.parse or skip tests.
const yaml = createRequire(new URL('../../output/worldbook-calibration/dev/package.json', import.meta.url))('yaml');
const source = fs.readFileSync(new URL('correction.js', import.meta.url), 'utf8');
const results = [];
const clone = value => structuredClone(value);
const plain = value => JSON.parse(JSON.stringify(value));
const configKey = 'rk:correction:connection';
const block = '<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>';
const defaultConnection = { endpoint: 'https://correction.invalid/v1', model: 'offline-model',
  apiKey: 'fixture-secondary-key', maxTokens: 1234, autoApply: true };
const samplePayload = { chat_completion_source: 'custom', model: 'offline-model', stream: false,
  custom_url: defaultConnection.endpoint, messages: [{ role: 'user', content: '{"temperature":0.8,"max_tokens":99,"top_p":0.9}' }],
  temperature: 0.4, max_tokens: 1234, top_p: 0.8, presence_penalty: 0.2 };
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); }
}

// Vendored offline fixtures from SillyTavern commit 8172dcd0ee672d3cd9a5e5f7af134f91a45cd2b8.
// Only export modifiers and the enclosing class closure differ; copied method
// bodies and the backend request/exclusion/serialization statements are unchanged.
// Source paths and SHA-256 of the complete fetched evidence files:
// public/scripts/custom-request.js cf48867dea08c936ab077dd2367458fe308578b33ef2743d5236ef2213e72561
// src/util.js 672779409ba5edd1eb11f7a6c067d44df74eb34ed3acd29cad76057968bee833
// src/endpoints/backends/chat-completions.js 43b70de92b41d0992a957589863b29c7342849e1201ae08c3c26cba6844cf052
const hostServiceSource = `class ChatCompletionService {
    static TYPE = 'openai';

    /**
     * @param {ChatCompletionPayload} custom
     * @returns {ChatCompletionPayload}
     */
    static createRequestData({ stream = false, messages, model, chat_completion_source, max_tokens, temperature, custom_url, reverse_proxy, proxy_password, custom_prompt_post_processing, ...props }) {
        const payload = {
            stream,
            messages,
            model,
            chat_completion_source,
            max_tokens,
            temperature,
            custom_url,
            reverse_proxy,
            proxy_password,
            custom_prompt_post_processing,
            use_sysprompt: true,
            ...props,
        };

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }

    /**
     * Sends a chat completion request
     * @param {ChatCompletionPayload} data Request data
     * @param {boolean?} extractData Extract message from the response. Default true
     * @param {AbortSignal?} signal Abort signal
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async sendRequest(data, extractData = true, signal = null) {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: signal ?? new AbortController().signal,
        });

        if (!data.stream) {
            const json = await response.json();
            if (!response.ok || json.error) {
                throw new Error(String(json.error?.message || 'Response not OK'));
            }

            if (!extractData) {
                return json;
            }

            const result = {
                content: extractMessageFromData(json, this.TYPE),
                reasoning: extractReasoningFromData(json, {
                    mainApi: this.TYPE,
                    textGenType: data.chat_completion_source,
                    ignoreShowThoughts: true,
                }),
            };
            // Try parse JSON
            if (data.json_schema) {
                result.content = JSON.parse(extractJsonFromData(json, { mainApi: this.TYPE, chatCompletionSource: data.chat_completion_source }));
            }
            return result;
        }

        if (!response.ok) {
            const text = await response.text();
            tryParseStreamingError(response, text, { quiet: true });

            throw new Error(\`Got response status \${response.status}\`);
        }

        const eventStream = new EventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();
        return async function* streamData() {
            let text = '';
            const swipes = [];
            const state = { reasoning: '', images: [], signature: '', toolSignatures: {} };
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                const rawData = value.data;
                if (rawData === '[DONE]') return;
                tryParseStreamingError(response, rawData, { quiet: true });
                const parsed = JSON.parse(rawData);

                const reply = getStreamingReply(parsed, state, {
                    chatCompletionSource: data.chat_completion_source,
                    overrideShowThoughts: true,
                });
                if (Array.isArray(parsed?.choices) && parsed?.choices?.[0]?.index > 0) {
                    const swipeIndex = parsed.choices[0].index - 1;
                    swipes[swipeIndex] = (swipes[swipeIndex] || '') + reply;
                } else {
                    text += reply;
                }

                yield { text, swipes: swipes, state };
            }
        };
    }

    /**
     * Process and send a chat completion request with optional preset
     * @param {ChatCompletionPayload} requestData - payload data, overriding preset if given
     * @param {Object} options - Configuration options
     * @param {string?} [options.presetName] - Name of the preset to use for generation settings
     * @param {boolean} [extractData=true] - Whether to extract structured data from response
     * @param {AbortSignal?} [signal] - Abort signal
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async processRequest(requestData, options, extractData = true, signal = null) {
        const { presetName } = options;
        requestData = this.createRequestData(requestData);

        // Apply generation preset if specified
        if (presetName) {
            const presetManager = getPresetManager(this.TYPE);
            if (presetManager) {
                const preset = presetManager.getCompletionPresetByName(presetName);
                if (preset) {
                    // Convert preset to payload and merge with custom parameters
                    requestData = await this.presetToGeneratePayload(preset, {}, requestData);
                } else {
                    console.warn(\`Preset "\${presetName}" not found, continuing with default settings\`);
                }
            } else {
                console.warn('Preset manager not found, continuing with default settings');
            }
        }

        return await this.sendRequest(requestData, extractData, signal);
    }

}`;

const exclusionSource = `function excludeKeysByYaml(obj, yamlString) {
    if (!yamlString) {
        return;
    }

    try {
        const parsedObject = yaml.parse(yamlString);

        if (Array.isArray(parsedObject)) {
            parsedObject.forEach(key => {
                delete obj[key];
            });
        } else if (typeof parsedObject === 'object') {
            Object.keys(parsedObject).forEach(key => {
                delete obj[key];
            });
        } else if (typeof parsedObject === 'string') {
            delete obj[parsedObject];
        }
    } catch {
        // Do nothing
    }
}`;

const serverRequestSource = `        const requestBody = {
            'messages': isTextCompletion === false ? request.body.messages : undefined,
            'prompt': isTextCompletion === true ? textPrompt : undefined,
            'model': request.body.model,
            'temperature': request.body.temperature,
            'max_tokens': request.body.max_tokens,
            'max_completion_tokens': request.body.max_completion_tokens,
            'stream': request.body.stream,
            'presence_penalty': request.body.presence_penalty,
            'frequency_penalty': request.body.frequency_penalty,
            'top_p': request.body.top_p,
            'top_k': request.body.top_k,
            'stop': isTextCompletion === false ? request.body.stop : undefined,
            'logit_bias': request.body.logit_bias,
            'seed': request.body.seed,
            'n': request.body.n,
            ...bodyParams,
        };

        if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
            excludeKeysByYaml(requestBody, request.body.custom_exclude_body);
        }

        /** @type {import('node-fetch').RequestInit} */
        const config = {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
                ...headers,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        };`;

// Run real host serialization and server exclusion snippets with an in-memory
// fetch boundary. No network, real API keys, streaming, or host settings access.
function transport() {
  const forwarded = [], finalRequests = [];
  const realm = vm.createContext({ yaml, AbortController, console,
    CHAT_COMPLETION_SOURCES: { CUSTOM: 'custom' },
    getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
    extractMessageFromData: json => json.choices[0].message.content,
    extractReasoningFromData: () => '',
  });
  vm.runInContext(hostServiceSource + '\n' + exclusionSource + '\nglobalThis.Service = ChatCompletionService;', realm);
  realm.fetch = async (url, options) => {
    assert.equal(url, '/api/backends/chat-completions/generate');
    assert.equal(options.method, 'POST');
    assert.equal(options.signal.aborted, false);
    const body = JSON.parse(options.body);
    forwarded.push(clone(body));
    Object.assign(realm, { request: { body }, isTextCompletion: false, textPrompt: undefined,
      bodyParams: {}, apiKey: 'fixture-host-key',
      headers: yaml.parse(body.custom_include_headers || '{}'), controller: { signal: options.signal } });
    // Block scope permits several requests in the same VM, as real route calls do.
    vm.runInContext('{\n' + serverRequestSource + '\nglobalThis.serializedRequest = config;\n}', realm);
    finalRequests.push({ body: JSON.parse(realm.serializedRequest.body), headers: plain(realm.serializedRequest.headers) });
    return { ok: true, json: async () => ({ choices: [{ message: { content: '[]' } }] }) };
  };
  return { Service: realm.Service, forwarded, finalRequests };
}

function fixture(storage = new Map([[configKey, clone(defaultConnection)]])) {
  let now = 1000000, timerId = 0;
  const timers = new Map(), listeners = new Map(), storageWrites = [];
  const t = transport();
  const mainConfig = { model: 'main-model', custom_url: 'https://main.invalid/v1',
    custom_exclude_body: '["seed"]', apiKey: 'fixture-main-key', temperature: 0.95 };
  const ctx = { chatId: 'exclusions-chat', characterId: 1, groupId: null,
    chat: [{ mes: '正文含 temperature、top_p 和 max_tokens。' + block, is_user: false, swipe_id: 0 }],
    ChatCompletionService: t.Service, oai_settings: clone(mainConfig) };
  let persisted = { stat_data: { 系统: { 结构版本: 4, 开局状态: '已建档' },
    场景: { 当前卷: 1, 当前章: '第一章', 阶段: '进行中', 地点: '校门' },
    玩家: { 姓名: '测试角色', temperature: 8, max_tokens: 99, top_p: 0.9 }, 人际: {} } };
  const mvu = { events: { COMMAND_PARSED: 'mvu:parsed', VARIABLE_UPDATE_ENDED: 'mvu:ended' },
    getMvuData: () => clone(persisted), parseMessage() { throw new Error('No patch expected'); } };
  const guard = { growth: 'G03', growthProtocol: 'final-values-v1', repair: 'P02', repairSource: 'MVU01', storyRepair: 'S01', flexibleRepair: 'F01',
    growthSettlement: 'G04', tournament: 'T01', tournamentEngine: 'T02', parseRepair() { throw new Error('No patch expected'); } };
  const HW = { SillyTavern: { getContext: () => ctx }, Mvu: mvu, __RK_MVU_GUARD_V4__: guard };
  HW.top = HW; HW.parent = HW;
  const helper = { getChatMessages(id) { const m = ctx.chat[id];
    return m ? [{ message_id: id, swipe_id: m.swipe_id, message: m.mes }] : []; },
    eventMakeLast(name, callback) {
      helper.eventRemoveListener(name, callback);
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    eventRemoveListener(name, callback) {
      const remaining = (listeners.get(name) || []).filter(item => item !== callback);
      if (remaining.length) listeners.set(name, remaining); else listeners.delete(name);
    },
    updateVariablesWith() { throw new Error('Empty patch must not write MVU'); } };
  function timer(fn, ms, interval = false) {
    const id = ++timerId; timers.set(id, { fn, due: now + Number(ms), interval: interval ? Number(ms) : 0 }); return id;
  }
  class FixtureDate extends Date { static now() { return now; } }
  const realm = vm.createContext({ HW, window: { parent: HW, top: HW, Mvu: mvu, RakudaiStateController: { shouldInjectTournament } },
    SS: { destroyed: false, disposers: [] }, Date: FixtureDate, AbortController, URL, structuredClone,
    LS: { get: (key, fallback) => storage.has(key) ? clone(storage.get(key)) : fallback,
      set: (key, value) => { storageWrites.push(key); storage.set(key, clone(value)); } },
    generationPending: false, terminalStateReader: { clear() {} }, fn: name => helper[name], emit() {},
    stateService: () => ({ tournamentView: () => ({ calendar: {}, roster: [], warnings: [] }) }),
    setTimeout: (fn, ms) => timer(fn, ms), clearTimeout: id => timers.delete(id),
    setInterval: (fn, ms) => timer(fn, ms, true), clearInterval: id => timers.delete(id),
  });
  const nativeSource = ['rakudai-mvu-structure.mjs', 'rakudai-mvu-native.mjs'].map(file =>
    stripModuleSyntax(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'))).join('\n');
  vm.runInContext(nativeSource + '\n' + source + '\nglobalThis.api = { getCorrectionConfig, saveCorrectionConfig, requestCorrection, ' +
    'getCorrectionStatus, wireAutomaticCorrection, startAutomaticCorrection, endAutomaticCorrection };', realm);
  const api = realm.api, TE = { CHARACTER_MESSAGE_RENDERED: 'host:rendered' };
  api.wireAutomaticCorrection((event, callback) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
  }, TE);
  // 模拟约束桥接在 for_zod 阶段重建 delta；真实校正模块的尾钩子须随后重盖保存收据。
  const tailEvent = mvu.events.VARIABLE_UPDATE_ENDED + '_for_zod';
  listeners.set(tailEvent, [variables => { variables.delta_data = {}; }]);
  const event = (name, ...args) => { for (const cb of listeners.get(name) || []) cb(...args); };
  async function automatic() {
    api.startAutomaticCorrection();
    const previous = clone(persisted), candidate = clone(persisted);
    ctx.chat.push({ mes: '抵达走廊。' + block, is_user: false, swipe_id: 0 });
    candidate.stat_data.场景.地点 = '走廊';
    event(mvu.events.COMMAND_PARSED, candidate, [], ctx.chat.at(-1).mes);
    event(mvu.events.VARIABLE_UPDATE_ENDED, candidate, previous);
    event(tailEvent, candidate, previous);
    assert.ok(candidate.delta_data.$internal.__rk_main_save.id, '主保存必须携带真实校正模块写入的收据');
    persisted = clone(candidate);
    event(TE.CHARACTER_MESSAGE_RENDERED, ctx.chat.length - 1);
    api.endAutomaticCorrection(false, ctx.chat.length);
    const until = now + 2500;
    for (let calls = 0; ; calls++) {
      const next = [...timers].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      assert.ok(calls < 2000, 'Automatic correction timer did not settle');
      const [id, entry] = next; now = entry.due;
      if (entry.interval) entry.due += entry.interval; else timers.delete(id);
      await entry.fn(); await new Promise(resolve => setImmediate(resolve));
    }
    now = until;
    assert.equal(api.getCorrectionStatus().state, 'unchanged');
    assert.equal(api.getCorrectionStatus().mainSave, 'saved');
  }
  return { api, storage, storageWrites, ctx, mainConfig, automatic, ...t,
    save: changes => api.saveCorrectionConfig({ ...api.getCorrectionConfig(), ...changes }) };
}

await check('旧配置默认空列表，首次请求保留输出上限与必需字段', async () => {
  const f = fixture();
  assert.deepEqual(plain(f.api.getCorrectionConfig().excludedParams), []);
  await f.api.requestCorrection();
  assert.equal(f.finalRequests[0].body.max_tokens, defaultConnection.maxTokens);
  assert.equal(f.finalRequests[0].body.model, defaultConnection.model);
  assert.equal(f.finalRequests[0].body.messages.length, 2);
  assert.equal(f.finalRequests[0].body.stream, false);
});

await check('混合分隔符去重并区分大小写，本机保存后重载恢复', () => {
  const f = fixture();
  f.save({ excludedParams: ' temperature，max_tokens;top_p；temperature\nseed\tTop_p ' });
  const expected = ['temperature', 'max_tokens', 'top_p', 'seed', 'Top_p'];
  assert.deepEqual(f.storage.get(configKey).excludedParams, expected);
  assert.deepEqual(plain(fixture(f.storage).api.getCorrectionConfig().excludedParams), expected);
});

await check('保存其他配置未提供排除列表时保留；留空与空数组可清除', () => {
  const f = fixture();
  f.save({ excludedParams: ['max_tokens', 'temperature'] });
  const next = plain(f.api.getCorrectionConfig()); delete next.excludedParams;
  next.maxTokens = 2500;
  f.api.saveCorrectionConfig(next);
  assert.deepEqual(f.storage.get(configKey).excludedParams, ['max_tokens', 'temperature']);
  for (const empty of ['', ' \n,，;； ', []]) {
    f.save({ excludedParams: 'max_tokens' }); f.save({ excludedParams: empty });
    assert.deepEqual(f.storage.get(configKey).excludedParams, []);
  }
});

await check('非法参数名、类型与超限输入不覆盖已保存的配置或密钥', () => {
  const f = fixture(); f.save({ excludedParams: 'max_tokens' });
  const invalid = ['messages[0]', 'a.b', 'temperature: 0', '{"max_tokens":1}', '/temperature',
    '参数', 4, {}, ['top_p', 3], 'x'.repeat(129), 'x'.repeat(4097),
    Array.from({ length: 65 }, (_, i) => 'key_' + i)];
  for (const excludedParams of invalid) {
    const before = clone([...f.storage]), count = f.storageWrites.length;
    assert.throws(() => f.save({ excludedParams, apiKey: 'replacement-key', maxTokens: 9999 }), /排除参数|最多排除/);
    assert.deepEqual([...f.storage], before);
    assert.equal(f.storageWrites.length, count);
    assert.equal(f.api.getCorrectionConfig().maxTokens, defaultConnection.maxTokens);
  }
});

await check('64项、128字符参数名和连字符接受；大小写不同和未知名称不误删', async () => {
  const f = fixture();
  f.save({ excludedParams: Array.from({ length: 63 }, (_, i) => 'key_' + i).concat('x'.repeat(128)) });
  assert.equal(f.api.getCorrectionConfig().excludedParams.length, 64);
  f.save({ excludedParams: 'Max_tokens vendor-option unknown_key' });
  await f.api.requestCorrection();
  assert.equal(f.finalRequests[0].body.max_tokens, defaultConnection.maxTokens);
});

await check('固定上游实现最终序列化时排除三个常见参数，未排除字段及消息JSON不变', async () => {
  const t = transport();
  await t.Service.processRequest(clone(samplePayload), {}, true);
  const baseline = t.finalRequests[0].body;
  assert.equal(baseline.temperature, 0.4); assert.equal(baseline.top_p, 0.8); assert.equal(baseline.max_tokens, 1234);
  await t.Service.processRequest({ ...clone(samplePayload), custom_exclude_body: '["max_tokens","temperature","top_p"]' }, {}, true);
  const expected = clone(baseline); delete expected.max_tokens; delete expected.temperature; delete expected.top_p;
  assert.deepEqual(t.finalRequests[1].body, expected);
  assert.equal(t.forwarded[1].max_tokens, 1234, 'Routing payload must reach the backend intact');
  assert.deepEqual(JSON.parse(t.finalRequests[1].body.messages[0].content), { temperature: 0.8, max_tokens: 99, top_p: 0.9 });
  assert.equal(t.finalRequests[1].body.presence_penalty, 0.2);
});

await check('手动与自动校正经过相同真实宿主排除路径，重载后仍生效', async () => {
  const f = fixture(); f.save({ excludedParams: 'max_tokens temperature top_p' });
  const restored = fixture(f.storage);
  await restored.api.requestCorrection();
  await restored.automatic();
  assert.equal(restored.finalRequests.length, 2);
  for (const [index, request] of restored.finalRequests.entries()) {
    assert.equal(Object.hasOwn(request.body, 'max_tokens'), false);
    assert.deepEqual(JSON.parse(restored.forwarded[index].custom_exclude_body), ['max_tokens', 'temperature', 'top_p']);
    assert.equal(request.body.model, defaultConnection.model);
    assert.equal(request.body.stream, false);
    const data = JSON.parse(request.body.messages[1].content);
    assert.equal(data.当前变量.玩家.max_tokens, 99);
    assert.equal(data.当前变量.玩家.temperature, 8);
    assert.equal(data.当前变量.玩家.top_p, 0.9);
  }
});

await check('清空并保存后后续请求恢复发送参数', async () => {
  const f = fixture(); f.save({ excludedParams: 'max_tokens' });
  await f.api.requestCorrection();
  assert.equal(Object.hasOwn(f.finalRequests[0].body, 'max_tokens'), false);
  f.save({ excludedParams: '' });
  await f.api.requestCorrection();
  assert.equal(f.finalRequests[1].body.max_tokens, defaultConnection.maxTokens);
});

await check('排除仅处理API请求体；显式排除model/messages不破坏副连接路由和认证', async () => {
  const f = fixture();
  f.save({ excludedParams: 'model messages custom_url custom_include_headers chat_completion_source Authorization' });
  await f.api.requestCorrection();
  const forwarded = f.forwarded[0], final = f.finalRequests[0];
  assert.equal(forwarded.custom_url, defaultConnection.endpoint);
  assert.equal(forwarded.chat_completion_source, 'custom');
  assert.equal(forwarded.model, defaultConnection.model);
  assert.equal(forwarded.messages.length, 2);
  assert.equal(Object.hasOwn(final.body, 'model'), false);
  assert.equal(Object.hasOwn(final.body, 'messages'), false);
  assert.equal(final.headers.Authorization, 'Bearer ' + defaultConnection.apiKey);
  assert.equal(Object.hasOwn(final.body, 'custom_exclude_body'), false);
});

await check('保存、手动、自动均不修改主连接配置或借用主连接认证', async () => {
  const f = fixture(); f.save({ excludedParams: 'max_tokens' });
  await f.api.requestCorrection(); await f.automatic();
  assert.deepEqual(f.ctx.oai_settings, f.mainConfig);
  assert.ok(f.storageWrites.every(key => key === configKey || key.startsWith('rk:correction:plot:')));
  for (const final of f.finalRequests) assert.equal(final.headers.Authorization, 'Bearer ' + defaultConnection.apiKey);
  assert.ok(f.finalRequests.every(final => !JSON.stringify(final.body).includes('fixture-main-key')));
});

await check('当前版本导入组件包含排除请求字段与设置输入', () => {
  const version = JSON.parse(fs.readFileSync(new URL('package.json', import.meta.url), 'utf8')).version;
  const card = JSON.parse(fs.readFileSync(new URL('../../世界书规则/MVU/落第骑士-小手机-v' + version + '.json', import.meta.url), 'utf8'));
  assert.ok(card.content.includes(source.replace(/\r\n/g, '\n').trim()), 'Importable script must contain the current correction module');
  assert.match(card.content, /custom_exclude_body: JSON\.stringify\(config\.excludedParams\)/);
  assert.match(card.content, /排除参数/);
});

console.log(JSON.stringify({ total: results.length, passed: results.filter(result => result.passed).length,
  runtime: '真实 correction.js + 固定上游请求与后端排除片段；宿主状态、MVU、网络和时钟为替身，未连接酒馆', results }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
