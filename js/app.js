(() => {

  const practiceScreen = document.getElementById("practiceScreen");
  const resultsScreen = document.getElementById("resultsScreen");
  const resultsHeading = document.getElementById("results-heading");

  const timerChip = document.getElementById("timerChip");
  const wordCountChip = document.getElementById("wordCountChip");
  const claimInput = document.getElementById("claimInput");
  const audienceInput = document.getElementById("audienceInput");
  const structureClaim = document.getElementById("structureClaim");
  const writingForm = document.getElementById("writingForm");
  const writingInput = document.getElementById("writingInput");
  const charCounter = document.getElementById("charCounter");
  const submitBtn = document.getElementById("submitBtn");
  const formError = document.getElementById("formError");
  const reviewCard = document.getElementById("reviewCard");
  const anotherSetBtn = document.getElementById("anotherSetBtn");

  const settingsToggle = document.getElementById("settingsToggle");
  const settingsPanel = document.getElementById("settingsPanel");
  const settingsStatus = document.getElementById("settingsStatus");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
  const clearApiKeyBtn = document.getElementById("clearApiKeyBtn");

  let sessionStartTime = null;
  let timerInterval = null;

  function saveDraft() {
    window.WP.saveDraft(localStorage, {
      claim: claimInput.value,
      audience: audienceInput.value,
      text: writingInput.value,
    });
  }

  function restoreDraft() {
    const saved = window.WP.loadDraft(localStorage);
    if (!saved) return;
    if (typeof saved.claim === "string") {
      claimInput.value = saved.claim;
      structureClaim.textContent = saved.claim || "（上面填了自动显示）";
    }
    if (typeof saved.audience === "string") audienceInput.value = saved.audience;
    if (typeof saved.text === "string" && saved.text.trim()) {
      writingInput.value = saved.text;
      handleWritingInput();
    }
  }

  function clearDraft() {
    window.WP.clearDraft(localStorage);
  }

  function elapsedSeconds() {
    return Math.floor((Date.now() - sessionStartTime) / 1000);
  }

  function updateTimerChip() {
    timerChip.textContent = `用时：${window.WP.formatTime(elapsedSeconds())}`;
  }

  function startTimerIfNeeded() {
    if (sessionStartTime !== null) return;
    sessionStartTime = Date.now();
    timerInterval = setInterval(updateTimerChip, 1000);
    updateTimerChip();
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function showScreen(screen) {
    practiceScreen.hidden = screen !== practiceScreen;
    resultsScreen.hidden = screen !== resultsScreen;
  }

  function handleWritingInput() {
    const text = writingInput.value;
    const count = window.WP.countChineseChars(text);
    wordCountChip.textContent = `字数：${count}`;
    charCounter.textContent = `${count} 字`;
    submitBtn.disabled = count < window.WP.MIN_CHARS;
    if (count > 0) startTimerIfNeeded();
    if (!formError.hidden) {
      formError.hidden = true;
      formError.textContent = "";
    }
  }

  function renderReview(review) {
    reviewCard.textContent = "";

    if (!review.hasIssue) {
      const praise = document.createElement("div");
      praise.className = "review-praise";
      praise.textContent = review.why || "结构完整，今天写得清楚。";
      reviewCard.appendChild(praise);
      return;
    }

    const quote = document.createElement("blockquote");
    quote.className = "review-quote";
    quote.textContent = review.quote || "（没有摘出原文）";

    const problem = document.createElement("p");
    problem.className = "review-line";
    problem.textContent = `问题：${review.problem || ""}`;

    const fix = document.createElement("p");
    fix.className = "review-line";
    fix.textContent = `改法：${review.fix || ""}`;

    const why = document.createElement("p");
    why.className = "review-line review-why";
    why.textContent = `为什么：${review.why || ""}`;

    reviewCard.appendChild(quote);
    reviewCard.appendChild(problem);
    reviewCard.appendChild(fix);
    reviewCard.appendChild(why);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const text = writingInput.value.trim();
    const count = window.WP.countChineseChars(text);
    const validation = window.WP.validateSubmission(
      claimInput.value,
      audienceInput.value,
      count,
      window.WP.hasApiKey()
    );
    if (!validation.ok) {
      showError(validation.error);
      if (validation.focus === "claim") claimInput.focus();
      else if (validation.focus === "audience") audienceInput.focus();
      return;
    }

    stopTimer();
    submitBtn.disabled = true;
    submitBtn.textContent = "批改中……";
    formError.hidden = true;

    try {
      const review = await window.WP.checkTextWithAI(claimInput.value.trim(), audienceInput.value.trim(), text);
      clearDraft();
      renderReview(review);
      showScreen(resultsScreen);
      resultsHeading.focus();
    } catch (error) {
      showError(error.message || "批改失败，稍后再试。");
      submitBtn.textContent = "提交批改";
      submitBtn.disabled = false;
      startTimerIfNeeded();
    }
  }

  function showError(message) {
    formError.hidden = false;
    formError.textContent = message;
  }

  function startNewPiece() {
    clearDraft();
    stopTimer();
    sessionStartTime = null;
    writingInput.value = "";
    writingInput.disabled = false;
    submitBtn.textContent = "提交批改";
    handleWritingInput();
    showScreen(practiceScreen);
    claimInput.focus();
  }

  function syncSettingsStatus() {
    settingsStatus.textContent = window.WP.hasApiKey()
      ? "已配置 DeepSeek API Key，可以批改。"
      : "还没配置 API Key——去 https://platform.deepseek.com 申请一个，粘贴进来。";
  }

  // 初始化
  restoreDraft();
  syncSettingsStatus();
  showScreen(practiceScreen);
  if (!claimInput.value && !audienceInput.value) claimInput.focus();

  writingInput.addEventListener("input", () => {
    handleWritingInput();
    saveDraft();
  });
  claimInput.addEventListener("input", () => {
    structureClaim.textContent = claimInput.value.trim() || "（上面填了自动显示）";
    saveDraft();
  });
  audienceInput.addEventListener("input", saveDraft);
  writingForm.addEventListener("submit", handleSubmit);
  anotherSetBtn.addEventListener("click", startNewPiece);

  settingsToggle.addEventListener("click", () => {
    const isOpen = !settingsPanel.hidden;
    settingsPanel.hidden = isOpen;
    settingsToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  saveApiKeyBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) return;
    window.WP.setApiKey(key);
    apiKeyInput.value = "";
    syncSettingsStatus();
  });

  clearApiKeyBtn.addEventListener("click", () => {
    window.WP.clearApiKey();
    apiKeyInput.value = "";
    syncSettingsStatus();
  });
})();
