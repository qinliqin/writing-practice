(() => {
  const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const MODEL = "gemini-2.5-flash";
  const STORAGE_KEY = "wp_gemini_api_key";
  const TIMEOUT_MS = 30000;

  const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
      hasIssue: { type: "BOOLEAN" },
      quote: { type: "STRING" },
      problem: { type: "STRING" },
      fix: { type: "STRING" },
      why: { type: "STRING" },
    },
    required: ["hasIssue"],
  };

  function getGeminiApiKey() {
    return (localStorage.getItem(STORAGE_KEY) || "").trim();
  }

  function setGeminiApiKey(key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  }

  function clearGeminiApiKey() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function hasGeminiKey() {
    return getGeminiApiKey().length > 0;
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
      "输出格式：",
      '- hasIssue: 是否有要指出的问题。没有则写 false，quote/problem/fix/why 都留空字符串。',
      "- quote: 问题所在的那一句，从学生原文里一字不差地摘出来。",
      "- problem: 这一处的问题是什么，一句话说清。",
      "- fix: 怎么改，给出具体的改法或改后的句子。",
      "- why: 为什么这样改，一句话。",
      "",
      "如果结构完整、主张也站得住，hasIssue 写 false，并在 why 里写一句具体的肯定（指出哪里做得好，不要空夸）。",
      "",
      "学生的文章：",
      text,
    ].join("\n");
  }

  function extractResponseText(data) {
    const candidate = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
    const part = candidate && candidate.content && Array.isArray(candidate.content.parts) ? candidate.content.parts[0] : null;
    return part && typeof part.text === "string" ? part.text : "";
  }

  async function checkTextWithGemini(claim, audience, text) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("还没有配置 Gemini API Key。");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let data;

    try {
      const response = await fetch(`${ENDPOINT_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(claim, audience, text) }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const detail = errorBody && errorBody.error && errorBody.error.message ? errorBody.error.message : `status ${response.status}`;
        throw new Error(`Gemini 请求失败：${detail}`);
      }

      data = await response.json();
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = extractResponseText(data);
    if (!rawText) throw new Error("Gemini 没有返回内容。");

    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error("Gemini 返回的内容无法解析。");
    }
  }

  window.WP = window.WP || {};
  Object.assign(window.WP, {
    getGeminiApiKey,
    setGeminiApiKey,
    clearGeminiApiKey,
    hasGeminiKey,
    checkTextWithGemini,
  });
})();
