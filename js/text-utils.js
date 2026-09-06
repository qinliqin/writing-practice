(() => {
  // 中文按字符计数：去掉所有空白后数长度。
  function countChineseChars(text) {
    return text.replace(/\s+/g, "").length;
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  window.WP = window.WP || {};
  Object.assign(window.WP, {
    countChineseChars,
    formatTime,
  });
})();
