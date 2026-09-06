// 测试：node tests.js 运行
// 覆盖：字数统计、提交校验、AI 返回清洗、草稿、计时、批改指令
const assert = require("assert");
const utils = require("./js/text-utils.js");
const draft = require("./js/draft.js");
const ai = require("./js/ai.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.log(`❌ ${name} — ${error.message}`);
  }
}

// ---------- A. 字数统计 ----------
test("300 个汉字计 300", () => {
  assert.strictEqual(utils.countChineseChars("你".repeat(300)), 300);
});
test("全空白计 0", () => {
  assert.strictEqual(utils.countChineseChars("  \n\t "), 0);
});
test("中英混合计数", () => {
  assert.strictEqual(utils.countChineseChars("今天abc很好"), 7);
});
test("空字符串计 0", () => {
  assert.strictEqual(utils.countChineseChars(""), 0);
});

// ---------- B. 提交校验 ----------
test("空主张拦截", () => {
  const r = utils.validateSubmission("", "另一个我", 300, true);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("主张"));
});
test("空白主张也拦截", () => {
  const r = utils.validateSubmission("   ", "另一个我", 300, true);
  assert.strictEqual(r.ok, false);
});
test("空对象拦截", () => {
  const r = utils.validateSubmission("要立威", "", 300, true);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("对象"));
});
test("299 字拦截，提示还差 1 字", () => {
  const r = utils.validateSubmission("主张", "对象", 299, true);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("还差 1 字"));
});
test("300 字放行", () => {
  const r = utils.validateSubmission("主张", "对象", 300, true);
  assert.strictEqual(r.ok, true);
});
test("没配 Key 拦截", () => {
  const r = utils.validateSubmission("主张", "对象", 300, false);
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("API Key"));
});

// ---------- C. 批改指令 ----------
test("指令包含两个锚", () => {
  const p = ai.buildPrompt("要立威", "另一个我", "正文");
  assert.ok(p.includes("要立威"));
  assert.ok(p.includes("另一个我"));
});
test("指令包含文章全文", () => {
  const p = ai.buildPrompt("主张", "对象", "今天写了一件绕的事");
  assert.ok(p.includes("今天写了一件绕的事"));
});
test("指令要求一次一处", () => {
  const p = ai.buildPrompt("主张", "对象", "正文");
  assert.ok(p.includes("一次只指出最要命的一处问题"));
});
test("指令要求只输出 JSON", () => {
  const p = ai.buildPrompt("主张", "对象", "正文");
  assert.ok(p.includes("只输出 JSON"));
});

// ---------- D. AI 返回清洗 ----------
test("正常有问题返回，字段保留", () => {
  const r = ai.sanitizeReview(
    { hasIssue: true, quote: "原句", problem: "缺结论", fix: "加一句总结", why: "结构差一步" },
    "这是原句和正文"
  );
  assert.strictEqual(r.hasIssue, true);
  assert.strictEqual(r.quote, "原句");
  assert.strictEqual(r.fix, "加一句总结");
});
test("正常没问题返回，hasIssue=false", () => {
  const r = ai.sanitizeReview({ hasIssue: false, why: "结构完整，例子选得好" }, "正文");
  assert.strictEqual(r.hasIssue, false);
});
test("quote 不在原文里 → 置空", () => {
  const r = ai.sanitizeReview({ hasIssue: true, quote: "不存在的句子", problem: "x", fix: "y" }, "正文里没有这句话");
  assert.strictEqual(r.quote, "");
});
test("fix 为空 → 给兜底文案", () => {
  const r = ai.sanitizeReview({ hasIssue: true, quote: "", problem: "x", fix: "" }, "正文");
  assert.ok(r.fix.includes("没有给出改法"));
});
test("fix 超过原文一半长 → 视为全文代笔，丢弃", () => {
  const text = "字".repeat(300);
  const r = ai.sanitizeReview(
    { hasIssue: true, quote: "", problem: "x", fix: "字".repeat(400) },
    text
  );
  assert.ok(r.fix.includes("全文重写"));
});
test("AI 返回数组（多处问题）→ 只取第一处", () => {
  const r = ai.sanitizeReview(
    [
      { hasIssue: true, quote: "", problem: "第一处", fix: "a" },
      { hasIssue: true, quote: "", problem: "第二处", fix: "b" },
    ],
    "正文"
  );
  assert.strictEqual(r.problem, "第一处");
});

// ---------- E. AI 网络返回解析（mock fetch） ----------
function mockLocalStorage() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
}
function mockFetchReturn(content) {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

test("AI 返回非 JSON → 报错不崩", async () => {
  global.localStorage = mockLocalStorage();
  ai.setApiKey("sk-test");
  mockFetchReturn("这不是 JSON");
  await assert.rejects(
    ai.checkTextWithAI("主张", "对象", "字".repeat(300)),
    /无法解析/
  );
});
test("AI 返回空内容 → 报错不崩", async () => {
  global.localStorage = mockLocalStorage();
  ai.setApiKey("sk-test");
  mockFetchReturn("");
  await assert.rejects(
    ai.checkTextWithAI("主张", "对象", "字".repeat(300)),
    /没有返回内容/
  );
});

// ---------- F. 草稿 ----------
test("草稿保存后能恢复", () => {
  const storage = mockLocalStorage();
  draft.saveDraft(storage, { claim: "主张", audience: "对象", text: "内容" });
  const loaded = draft.loadDraft(storage);
  assert.strictEqual(loaded.claim, "主张");
  assert.strictEqual(loaded.text, "内容");
});
test("损坏的草稿 → 返回 null 不抛错", () => {
  const storage = mockLocalStorage();
  storage.setItem("wp_draft", "{不是JSON");
  assert.strictEqual(draft.loadDraft(storage), null);
});
test("清除草稿后无残留", () => {
  const storage = mockLocalStorage();
  draft.saveDraft(storage, { claim: "主张", audience: "对象", text: "内容" });
  draft.clearDraft(storage);
  assert.strictEqual(draft.loadDraft(storage), null);
});

// ---------- G. 计时格式 ----------
test("0 秒 → 0:00", () => {
  assert.strictEqual(utils.formatTime(0), "0:00");
});
test("65 秒 → 1:05", () => {
  assert.strictEqual(utils.formatTime(65), "1:05");
});
test("600 秒 → 10:00", () => {
  assert.strictEqual(utils.formatTime(600), "10:00");
});

// ---------- 汇总 ----------
console.log("");
console.log(`通过 ${passed} 个，失败 ${failed} 个。`);
if (failed > 0) {
  process.exit(1);
}
