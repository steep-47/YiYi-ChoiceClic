import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../index.js', import.meta.url), 'utf8');
let resolvePersistence;
const persistence = new Promise(resolve => { resolvePersistence = resolve; });
const message = { is_user: false, is_system: false, mes: '没有选项', swipe_id: 0, __memoStrictPersistence: persistence };
let messageElementQueries = 0;
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
vm.runInContext(`${source}\nglobalThis.__choiceTest={parse,scan,memoWaiting,memoReady};`, sandbox);

const choices = sandbox.__choiceTest.parse('正文\n\n1. 向左\n2. 向右\n3. 留下');
assert.deepEqual(JSON.parse(JSON.stringify(choices)), [
    { n: 1, t: '向左' },
    { n: 2, t: '向右' },
    { n: 3, t: '留下' },
]);

sandbox.__choiceTest.scan();
assert.equal(messageElementQueries, 0, 'Memo-N持久化完成前不应扫描或挂载选项');
assert.equal(sandbox.__choiceTest.memoWaiting.has(message), true);

resolvePersistence(true);
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(sandbox.__choiceTest.memoReady.has(message), true);
assert.ok(messageElementQueries > 0, 'Memo-N持久化完成后应重新扫描清理后的消息');

console.log('yiyi-choice Memo-N compatibility PASS: parse=1, waits-for-persistence=1, rescans-after-cleanup=1');
