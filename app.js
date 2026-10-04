(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    prompt: $("prompt"),
    promptLabel: $("promptLabel"),
    form: $("answerForm"),
    answer: $("answer"),
    checkBtn: $("checkBtn"),
    skipBtn: $("skipBtn"),
    nextBtn: $("nextBtn"),
    after: $("after"),
    range: $("range"),
    feedback: $("feedback"),
    trKeys: $("trKeys"),
    score: $("score"),
    attempts: $("attempts"),
    streak: $("streak"),
    best: $("best"),
    progress: $("progress"),
    resetBtn: $("resetBtn"),
  };

  // ---------- Normalisation ----------

  // Fold one character so Turkish letters match their Latin look-alikes.
  const FOLD = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

  function foldChar(ch) {
    const lower = ch.toLocaleLowerCase("tr"); // İ → i, I → ı
    if (FOLD[lower]) return FOLD[lower];
    return lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function fold(str) {
    return Array.from(str).map(foldChar).join("");
  }

  // Full normalisation for comparing answers.
  // Expand English contractions so "I'm sorry" matches "I am sorry".
  function expandContractions(s) {
    return s
      .replace(/[’`]/g, "'")
      // Apostrophe-less forms people type on phones (skipping real words like "its", "were", "ill").
      .replace(/\b(do|does|did|is|are|was|could|should|would|have|has|had|ca|wo|must|need)nt\b/g, "$1n't")
      .replace(/\bim\b/g, "i'm").replace(/\blets\b/g, "let's")
      .replace(/\b(you|they)re\b/g, "$1're").replace(/\b(i|you|we|they)ve\b/g, "$1've")
      .replace(/\bcan't\b/g, "can not").replace(/\bcannot\b/g, "can not")
      .replace(/\bwon't\b/g, "will not")
      .replace(/n't\b/g, " not")
      .replace(/'m\b/g, " am")
      .replace(/'re\b/g, " are")
      .replace(/'ll\b/g, " will")
      .replace(/'ve\b/g, " have")
      .replace(/'d\b/g, " would")
      .replace(/\blet's\b/g, "let us")
      .replace(/\b(it|that|what|he|she|there|here|who|where)'s\b/g, "$1 is");
  }

  function normalize(str, isEnglish) {
    let s = fold(str);
    if (isEnglish) s = expandContractions(s);
    s = s
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
      .replace(/['-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (isEnglish) s = s.replace(/^(to|a|an|the) /, "");
    return s;
  }

  // "you (plural)/you" → ["you (plural)", "you"], also accept the bracket-free form.
  function alternatives(str) {
    const out = [];
    for (const part of str.split("/")) {
      const p = part.trim();
      if (!p) continue;
      out.push(p);
      const noParens = p.replace(/\s*\([^)]*\)\s*/g, " ").trim();
      if (noParens && noParens !== p) out.push(noParens);
    }
    return out;
  }

  // ---------- Data ----------

  const entries = WORDS.map(([tr, en], i) => ({
    id: i,
    tr,
    en,
    trAlts: alternatives(tr),
    enAlts: alternatives(en),
  }));
  entries.forEach((e) => {
    e.trKeys = new Set(e.trAlts.map((a) => normalize(a, false)));
    e.enKeys = new Set(e.enAlts.map((a) => normalize(a, true)));
  });

  // Every accepted answer (display form) for an entry in the current direction.
  function acceptedAnswers(entry) {
    if (state.dir === "tr-en") return entry.enAlts;
    // EN → TR: any Turkish word that shares an English meaning with the prompt is fine.
    const answers = [...entry.trAlts];
    for (const other of entries) {
      if (other === entry || [...other.enKeys].some((k) => entry.enKeys.has(k))) {
        for (const a of other.trAlts) if (!answers.includes(a)) answers.push(a);
      }
    }
    return answers;
  }

  // ---------- State ----------

  const STORE_KEY = "turkish-word-bank-v1";
  const state = {
    dir: "tr-en",
    range: 100, // quiz the N most common words; 0 = all
    score: 0,
    attempts: 0,
    streak: 0,
    best: 0,
    deck: [],
    pos: 0,
    current: null,
    answered: false,
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      for (const k of ["dir", "range", "score", "attempts", "streak", "best"]) {
        if (saved[k] !== undefined) state[k] = saved[k];
      }
    } catch (_) { /* storage unavailable — start fresh */ }
  }

  function save() {
    try {
      const { dir, range, score, attempts, streak, best } = state;
      localStorage.setItem(STORE_KEY, JSON.stringify({ dir, range, score, attempts, streak, best }));
    } catch (_) { /* ignore */ }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newDeck() {
    const last = state.current;
    state.deck = shuffle(state.range ? entries.slice(0, state.range) : entries.slice());
    // Don't show the same word twice in a row across reshuffles.
    if (last && state.deck.length > 1 && state.deck[0] === last) {
      [state.deck[0], state.deck[1]] = [state.deck[1], state.deck[0]];
    }
    state.pos = 0;
  }

  // ---------- Rendering ----------

  function renderStats() {
    els.score.textContent = state.score;
    els.attempts.textContent = state.attempts;
    els.streak.textContent = state.streak;
    els.best.textContent = state.best;
    els.progress.textContent = `Word ${state.pos} of ${state.deck.length}`;
  }

  function renderDirection() {
    document.querySelectorAll(".direction button").forEach((b) => {
      b.classList.toggle("active", b.dataset.dir === state.dir);
    });
    els.trKeys.hidden = state.dir !== "en-tr";
    els.answer.lang = state.dir === "en-tr" ? "tr" : "en";
  }

  function nextWord() {
    if (state.pos >= state.deck.length) newDeck();
    state.current = state.deck[state.pos++];
    state.answered = false;

    const toEnglish = state.dir === "tr-en";
    els.prompt.textContent = toEnglish ? state.current.tr : state.current.en.split("/").map((s) => s.trim()).join(" / ");
    els.prompt.lang = toEnglish ? "tr" : "en";
    els.promptLabel.textContent = toEnglish ? "Translate to English" : "Translate to Turkish";

    els.answer.value = "";
    setAnsweredUI(false);
    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    renderStats();
    els.answer.focus();
  }

  function setAnsweredUI(answered) {
    els.answer.disabled = answered;
    els.checkBtn.hidden = answered;
    els.skipBtn.hidden = answered;
    els.after.hidden = !answered;
  }

  // ---------- Diff ----------

  function levenshtein(a, b) {
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  }

  // Character diff (LCS) treating Turkish letters and Latin look-alikes as equal.
  // Returns HTML for the user's answer (wrong chars marked) and the correct answer (missing chars marked).
  function diffHtml(user, correct) {
    const a = Array.from(user);
    const b = Array.from(correct);
    const fa = a.map(foldChar);
    const fb = b.map(foldChar);
    const m = a.length, n = b.length;
    const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        L[i][j] = fa[i] === fb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    const keepA = new Array(m).fill(false);
    const keepB = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (fa[i] === fb[j]) { keepA[i++] = true; keepB[j++] = true; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    const wrap = (chars, keep, cls) =>
      chars.map((c, k) => (keep[k] || c === " " ? escapeHtml(c) : `<span class="${cls}">${escapeHtml(c)}</span>`)).join("");
    return {
      user: wrap(a, keepA, "diff-wrong"),
      correct: wrap(b, keepB, "diff-missing"),
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Answer handling ----------

  function check(skipped) {
    if (state.answered) return;
    const raw = els.answer.value.trim();
    if (!raw && !skipped) {
      els.answer.focus();
      return;
    }

    const isEnglish = state.dir === "tr-en";
    const answers = acceptedAnswers(state.current);
    const userKey = normalize(raw, isEnglish);
    const correct = !skipped && answers.some((a) => normalize(a, isEnglish) === userKey);

    state.answered = true;
    // Skipping only reveals the answer; it doesn't affect the score or streak.
    if (!skipped) {
      state.attempts++;
      if (correct) {
        state.score++;
        state.streak++;
        state.best = Math.max(state.best, state.streak);
      } else {
        state.streak = 0;
      }
      save();
      renderStats();
    }

    // Always list every meaning (TR → EN) or every accepted Turkish word (EN → TR).
    const list = isEnglish ? state.current.en.split("/").map((s) => s.trim()) : answers;
    const shownList = list.slice(0, 12).map(escapeHtml).join(", ") + (list.length > 12 ? ", …" : "");
    const all = `<div class="row meanings"><small>${isEnglish ? "All meanings:" : "Accepted:"}</small> ${shownList}</div>`;

    let html;
    if (correct) {
      const exact = answers.find((a) => normalize(a, isEnglish) === userKey);
      // e.g. typed "guzel" → show the proper spelling "güzel".
      const note = !isEnglish && exact.toLocaleLowerCase("tr") !== raw.toLocaleLowerCase("tr")
        ? `<div class="row"><small>Spelling:</small> <strong>${escapeHtml(exact)}</strong></div>` : "";
      html = `<div class="title">✓ Correct! +1 point</div>${note}${all}`;
    } else {
      // Turkish lowercasing turns English "I" into "ı", so only use it for Turkish answers.
      const toLower = (s) => (isEnglish ? s.toLowerCase() : s.toLocaleLowerCase("tr"));
      const lower = toLower(raw);
      // Show the diff against whichever accepted answer is closest to what was typed.
      const closest = answers.reduce((best, a) => {
        const d = levenshtein(fold(lower), fold(toLower(a)));
        return d < best.d ? { a, d } : best;
      }, { a: answers[0], d: Infinity }).a;
      if (skipped) {
        html = `<div class="title">Skipped</div>
          <div class="row"><small>Answer:</small> <strong>${escapeHtml(answers[0])}</strong></div>${all}`;
      } else {
        const d = diffHtml(lower, toLower(closest));
        html = `<div class="title">✗ Not quite</div>
          <div class="row"><small>You wrote:</small> ${d.user}</div>
          <div class="row"><small>Correct:</small> <strong>${d.correct}</strong></div>${all}`;
      }
    }

    els.feedback.innerHTML = html;
    els.feedback.className = `feedback ${correct ? "good" : "bad"}`;
    els.feedback.hidden = false;
    setAnsweredUI(true);
    els.nextBtn.focus();
  }

  // ---------- Events ----------

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    check(false);
  });

  els.skipBtn.addEventListener("click", () => check(true));
  els.nextBtn.addEventListener("click", nextWord);

  els.range.addEventListener("change", () => {
    state.range = Number(els.range.value);
    save();
    state.current = null;
    newDeck();
    nextWord();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state.answered && document.activeElement !== els.nextBtn) {
      e.preventDefault();
      nextWord();
    }
  });

  document.querySelectorAll(".direction button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.dir === btn.dataset.dir) return;
      state.dir = btn.dataset.dir;
      save();
      renderDirection();
      nextWord();
    });
  });

  // Turkish letter buttons: insert at the cursor without losing input focus.
  els.trKeys.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      if (els.answer.disabled) return;
      const input = els.answer;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + btn.textContent + input.value.slice(end);
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    });
  });

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Reset your score and streaks?")) return;
    Object.assign(state, { score: 0, attempts: 0, streak: 0, best: 0 });
    save();
    renderStats();
  });

  // ---------- Start ----------

  load();
  els.range.value = String(state.range);
  renderDirection();
  newDeck();
  nextWord();
})();
