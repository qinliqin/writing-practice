(() => {
  const MIN_CHARS = 300;

  // 中文按字符计数：去掉所有空白后数长度。
  function countChineseChars(text) {
    return text.replace(/\s+/g, "").length;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  // 提交前的四道校验，返回 { ok, error, focus }。
  // focus：error 提示时该聚焦哪个输入框（"claim"/"audience"/null）。
  function validateSubmission(claim, audience, count, hasKey) {
    if (!claim.trim()) {
      return { ok: false, error: "先写主张：我要说的那一句是什么？", focus: "claim" };
    }
    if (!audience.trim()) {
      return { ok: false, error: "先写对象：对谁说？", focus: "audience" };
    }
    if (count < MIN_CHARS) {
      return { ok: false, error: `还差 ${MIN_CHARS - count} 字。`, focus: null };
    }
    if (!hasKey) {
      return { ok: false, error: "还没配置 API Key——点上面的「设置」粘贴 DeepSeek API Key。", focus: null };
    }
    return { ok: true, error: "", focus: null };
  }

  const WP = {
    MIN_CHARS,
    countChineseChars,
    formatTime,
    validateSubmission,
  };

  if (typeof window !== "undefined") {
    window.WP = Object.assign(window.WP || {}, WP);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = WP;
  }
})();
