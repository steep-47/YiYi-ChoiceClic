import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
let resolvePersistence;
const persistence = new Promise(resolve => { resolvePersistence = resolve; });
const message = {
    is_user: false,
    is_system: false,
    mes: '正文\n\n1. 向左\n2. 向右\n3. 留下',
    swipe_id: 0,
    __memoStrictPersistence: persistence,
};
let messageElementQueries = 0;
const renderedChoices = [];
const target = { contains: () => true, querySelector: () => null };

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
        querySelectorAll: () => [],
    },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${source}\nglobalThis.__choiceTest={parse,scan,memoWaiting,memoReady,setRender(fn){render=fn;}};`, sandbox);
sandbox.__choiceTest.setRender((_target, choices) => renderedChoices.push(JSON.parse(JSON.stringify(choices))));

const choices = sandbox.__choiceTest.parse('正文\n\n1. 向左\n2. 向右\n3. 留下');
const expectedChoices = [
    { n: 1, t: '向左' },
    { n: 2, t: '向右' },
    { n: 3, t: '留下' },
];
assert.deepEqual(JSON.parse(JSON.stringify(choices)), expectedChoices);

sandbox.__choiceTest.scan();
assert.ok(messageElementQueries > 0, 'Memo-N持久化进行中仍应扫描当前回复');
assert.deepEqual(renderedChoices, [expectedChoices], 'Memo-N持久化不应阻断选项渲染');
assert.equal(sandbox.__choiceTest.memoWaiting.has(message), true);

resolvePersistence(true);
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(sandbox.__choiceTest.memoReady.has(message), true);
assert.ok(renderedChoices.length >= 2, 'Memo-N持久化完成后应重新校验清理后的消息');

console.log('yiyi-choice Memo-N compatibility PASS: parse=1, renders-during-persistence=1, rescans-after-cleanup=1');
