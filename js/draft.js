// 草稿存取：storage 参数在浏览器里传 localStorage，测试里传内存假对象。
(() => {
  const DRAFT_STORAGE_KEY = "wp_draft";

  function saveDraft(storage, data) {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  }

  function loadDraft(storage) {
    try {
      const saved = JSON.parse(storage.getItem(DRAFT_STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return null;
      return saved;
    } catch {
      return null;
    }
  }

  function clearDraft(storage) {
    storage.removeItem(DRAFT_STORAGE_KEY);
  }

  const Draft = { saveDraft, loadDraft, clearDraft };

  if (typeof window !== "undefined") {
    window.WP = Object.assign(window.WP || {}, Draft);
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Draft;
  }
})();
