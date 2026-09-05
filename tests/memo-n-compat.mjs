import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
let resolvePersistence;
const persistence = new Promise(resolve => { resolvePersistence = resolve; });
const firstReply = '正文\n\n1. 向左\n2. 向右\n3. 留下';
const secondReply = '新正文\n\n1. 回屋\n2. 问叔父\n3. 继续家务';
const message = {
    is_user: false,
    is_system: false,
    mes: firstReply,
    swipe_id: 0,
    swipes: [firstReply, secondReply],
    __memoStrictPersistence: persistence,
};
let messageElementQueries = 0;
let panelRemovals = 0;
const renderedChoices = [];
const mountedPanel = { remove: () => { panelRemovals++; } };
const target = { contains: panel => panel === mountedPanel, querySelector: () => null };

const sandbox = {
    console,
    Promise,
    WeakSet,
    Map,
    JSON,
    Number,
    String,
    RegExp,
    Event,
    setTimeout,
    clearTimeout,
    globalThis: null,
    SillyTavern: { getContext: () => ({ chat: [message] }) },
    document: {
        readyState: 'loading',
        addEventListener() {},
        querySelector(selector) {
            if (String(selector).startsWith('#chat .mes')) {
                messageElementQueries++;
                return target;
            }
            return null;
        },
        querySelectorAll: selector => selector === '.yiyi-choice-panel' ? [mountedPanel] : [],
    },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${source}\nglobalThis.__choiceTest={parse,scan,messageText,memoWaiting,memoReady,beginGeneration,finishGeneration,setRender(fn){render=fn;}};`, sandbox);
sandbox.__choiceTest.setRender((_target, choices) => renderedChoices.push(JSON.parse(JSON.stringify(choices))));

const firstChoices = [
    { n: 1, t: '向左' },
    { n: 2, t: '向右' },
    { n: 3, t: '留下' },
];
const secondChoices = [
    { n: 1, t: '回屋' },
    { n: 2, t: '问叔父' },
    { n: 3, t: '继续家务' },
];
assert.deepEqual(JSON.parse(JSON.stringify(sandbox.__choiceTest.parse(firstReply))), firstChoices);

sandbox.__choiceTest.scan();
assert.ok(messageElementQueries > 0, 'Memo-N持久化进行中仍应扫描当前回复');
assert.deepEqual(renderedChoices, [firstChoices], 'Memo-N持久化不应阻断选项渲染');
assert.equal(sandbox.__choiceTest.memoWaiting.has(message), true);

// Quiet/background work must not tear down the visible reply's choices.
sandbox.__choiceTest.beginGeneration('quiet', {}, false);
assert.equal(panelRemovals, 0, '后台生成不应卸下当前选项');

// Reproduce SillyTavern overswipe timing: swipe_id advances while chat.mes can
// still contain the previous reply. The active swipes slot is authoritative.
sandbox.__choiceTest.beginGeneration('swipe', {}, false);
assert.equal(panelRemovals, 1, 'Swipe重新生成开始时应立即卸下旧按钮');
message.swipe_id = 1;
sandbox.__choiceTest.finishGeneration(0);
await new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(renderedChoices.at(-1), secondChoices, 'Swipe完成后应读取当前swipe_id对应的选项');

resolvePersistence(true);
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(sandbox.__choiceTest.memoReady.has(message), true);
assert.deepEqual(renderedChoices.at(-1), secondChoices, 'Memo-N持久化完成后仍应保持当前Swipe选项');

console.log('yiyi-choice compatibility PASS: parse=1, renders-during-persistence=1, active-swipe-refresh=1, rescans-after-cleanup=1');
