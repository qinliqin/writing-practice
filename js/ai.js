(() => {
  const ENDPOINT = "https://api.deepseek.com/chat/completions";
  const MODEL = "deepseek-chat";
  const STORAGE_KEY = "wp_api_key";
  const TIMEOUT_MS = 60000;

  function getApiKey() {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
  }

  function setApiKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }

  function clearApiKey() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function hasApiKey() {
    return getApiKey().length > 0;
  }

  function buildPrompt(claim, audience, text) {
    return [
      "你是一位中文写作老师。学生在练习把一件事或一个观点说清楚：不绕、不啰嗦、对方一听就懂。",
      "",
      "好的文章有结构四样：",
      "1. 主张：我要说的那一句是什么；",
      "2. 理由：为什么我这么认为；",
      "3. 例子：一件具体的事；",
      "4. 结论：回到主张收尾。",
      "",
      `学生写前定的两个锚：主张="${claim}"，对象="${audience}"。`,
      "",
      "你的任务：一次只指出最要命的一处问题，就一处，不要贪多。",
      "按顺序查：",
      "1. 结构四样齐不齐——缺哪一样，就指出缺的那一样；",
      "2. 顺序乱不乱——主张该在最前，结论该在最后；",
      "3. 如果结构完整，再查主张站不站得住、展开的每句是不是都在支持主张。",
      "",
      "只输出 JSON，不要输出别的文字。格式如下：",
      '{ "hasIssue": true或false, "quote": "问题所在的那一句，从学生原文里一字不差地摘出来", "problem": "这一处的问题是什么，一句话说清", "fix": "怎么改，给出具体的改法或改后的句子", "why": "为什么这样改，一句话" }',
      "",
      "如果结构完整、主张也站得住，hasIssue 写 false，quote/problem/fix 留空字符串，在 why 里写一句具体的肯定（指出哪里做得好，不要空夸）。",
      "",
      "学生的文章：",
      text,
    ].join("\n");
  }

  // 清洗 AI 返回：兜住不守规矩的情况。
  // - 数组（AI 一次返回多处）→ 只取第一处
  // - quote 摘的句子原文里找不到 → 置空
  // - fix 为空 → 兜底文案
  // - fix 超过原文六成长（且超过 100 字）→ 视为全文代笔，丢弃
  function sanitizeReview(raw, text) {
    const review = Array.isArray(raw) ? raw[0] : raw;
    if (!review || typeof review !== "object") {
      throw new Error("AI 返回格式不对。");
    }

    const hasIssue = review.hasIssue === true;
    let quote = typeof review.quote === "string" ? review.quote : "";
    let fix = typeof review.fix === "string" ? review.fix : "";

    if (quote && !text.includes(quote)) quote = "";

    if (hasIssue && fix.trim() === "") {
      fix = "（AI 没有给出改法，按「为什么」自己试改。）";
    }
    const textLength = text.replace(/\s+/g, "").length;
    const fixLength = fix.replace(/\s+/g, "").length;
    if (hasIssue && fixLength > Math.max(100, textLength * 0.6)) {
      fix = "（AI 给的是全文重写，已丢弃——看「问题」和「为什么」，自己改这一处。）";
    }

    return {
      hasIssue,
      quote,
      problem: typeof review.problem === "string" ? review.problem : "",
      fix,
      why: typeof review.why === "string" ? review.why : "",
    };
  }

  async function checkTextWithAI(claim, audience, text) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("还没有配置 API Key。");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let data;

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: buildPrompt(claim, audience, text) }],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail =
          errorBody && errorBody.error && errorBody.error.message
            ? errorBody.error.message
            : `status ${response.status}`;
        throw new Error(`DeepSeek 请求失败：${detail}`);
      }

      data = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }

    const content =
      data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
    if (!content) throw new Error("DeepSeek 没有返回内容。");

    let raw;
    try {
      raw = JSON.parse(content);
    } catch {
      throw new Error("DeepSeek 返回的内容无法解析。");
    }
    return sanitizeReview(raw, text);
  }

  const AI = {
    getApiKey,
    setApiKey,
    clearApiKey,
    hasApiKey,
    checkTextWithAI,
    buildPrompt,
    sanitizeReview,
  };

  if (typeof window !== "undefined") {
    window.WP = Object.assign(window.WP || {}, AI);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AI;
  }
})();
