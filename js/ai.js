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
      "1. 一句话概括：把要说的浓缩成一句，放在最前；",
      "2. 理由：为什么我这么认为；",
      "3. 例子：一件具体的事；",
      "4. 结论：回到一句话概括收尾。",
      "",
      `学生写前定的两个锚：一句话概括="${claim}"，对象="${audience}"。`,
      "",
      "你的任务只有一个：查结构四样齐不齐、顺序对不对。一次只指出一处问题。",
      "",
      "【禁止】不要批内容、文采、用词、选材、标点、错别字。哪怕结尾写得平淡、例子选得一般，只要四样齐、顺序对，就是没问题。",
      "",
      "problem 字段只能从下面五个选项里选一个，不许自己编：",
      "- 缺一句话概括",
      "- 缺理由",
      "- 缺例子",
      "- 缺结论",
      "- 顺序乱",
      "",
      "只输出 JSON，不要输出别的文字。格式如下：",
      '{ "hasIssue": true或false, "quote": "问题所在的那一句，从学生原文里一字不差地摘出来；如果问题不是某一句，而是整体缺某样，quote 留空字符串", "problem": "五个选项之一", "fix": "怎么改，给出具体的改法或示范句子", "why": "为什么这样改，一句话" }',
      "",
      "如果四样齐、顺序对，hasIssue 写 false，quote/problem/fix 留空字符串，在 why 里写一句具体的肯定（指出哪里做得好，不要空夸）。",
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
