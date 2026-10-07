(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    prompt: $("prompt"),
    promptLabel: $("promptLabel"),
    form: $("answerForm"),
    answer: $("answer"),
    wordInput: $("wordInput"),
    sentenceInput: $("sentenceInput"),
    tilesAnswer: $("tilesAnswer"),
    tilesBank: $("tilesBank"),
    checkBtn: $("checkBtn"),
    skipBtn: $("skipBtn"),
    nextBtn: $("nextBtn"),
    after: $("after"),
    wordControls: $("wordControls"),
    sentenceControls: $("sentenceControls"),
    range: $("range"),
    level: $("level"),
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

  // Frequency-ranked subtitle words first, then the everyday dictionary words.
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

  const sentences = SENTENCES.map(([level, tr, en, ...alts]) => ({
    level,
    tr,
    en,
    alts,
    words: en.split(" "),
    accepted: [en, ...alts].map((s) => s.toLowerCase()),
  }));

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

  // ---------- Distractor tiles ----------

  // Grammatical look-alikes: the most useful wrong choices for each word.
  const CONFUSERS = {
    i: ["you", "we", "they"], you: ["I", "we", "they"], we: ["I", "you", "they"], they: ["I", "we", "you"],
    he: ["I", "we", "they"],
    am: ["is", "are", "was"], is: ["are", "am", "was"], are: ["is", "am", "were"], was: ["is", "were"], were: ["was", "are"],
    do: ["does", "did"], does: ["do", "did"], did: ["do", "does"],
    my: ["your", "his", "our"], your: ["my", "his", "our"], his: ["my", "your", "their"],
    our: ["my", "your", "their"], their: ["our", "your", "my"],
    me: ["you", "him", "us"], him: ["me", "us", "them"], us: ["me", "them"], them: ["us", "him"],
    this: ["that", "these"], that: ["this", "these"],
    will: ["did", "was"], have: ["has", "had"], has: ["have", "had"],
    to: ["from", "at"], from: ["to", "at"], at: ["from", "to"], in: ["from"], on: ["from"],
    what: ["who", "where"], who: ["what", "where"], where: ["what", "when"], when: ["where", "what"],
    why: ["how", "where"], how: ["why", "what"],
  };

  // Words that could replace each other in a correct answer — never offer one as a
  // distractor when another from its group is in the answer.
  const SYNONYMS = [
    ["he", "she", "it"],
    ["good", "well", "fine", "nice", "beautiful", "pretty", "great", "lovely", "pleased", "delicious"],
    ["big", "large", "huge", "great", "older"], ["small", "little"], ["a", "an", "one"],
    ["very", "so", "really", "too", "much", "lot"], ["quick", "fast", "quickly", "faster"],
    ["happy", "glad", "pleased"], ["sad", "sorry"], ["house", "home"],
    ["child", "kid", "children", "kids"], ["man", "guy"], ["talk", "speak"],
    ["say", "tell", "said", "told"], ["look", "see", "watch", "saw", "seen"],
    ["start", "begin", "starts"], ["buy", "get", "take", "have", "bought"],
    ["can", "could", "may"], ["will", "would", "shall"], ["maybe", "perhaps", "probably"],
    ["also", "too"], ["brother", "sister", "sibling", "siblings", "brothers"],
    ["movie", "film"], ["mom", "mother"], ["dad", "father"], ["okay", "ok", "fine", "alright"],
    ["scared", "afraid"], ["difficult", "hard"], ["sick", "ill"], ["near", "close"],
    ["something", "anything"], ["nobody", "anyone"], ["everyone", "everybody", "all"],
    ["everything", "all"], ["right", "true", "correct"], ["evening", "tonight", "night"],
    ["road", "way"], ["inside", "in"], ["thanks", "thank"], ["must", "should"],
    ["some", "any"], ["need", "must", "have"],
    ["tired", "sleepy"], ["bill", "check"], ["shop", "store", "market"], ["cupboard", "closet", "wardrobe"],
    ["holiday", "vacation"], ["trousers", "pants"], ["sweater", "jumper"], ["forest", "woods"],
    ["quiet", "silent", "quietly", "silently"], ["hurt", "hurts", "ache", "aches"], ["angry", "mad", "nervous"],
    ["metro", "subway"], ["fridge", "refrigerator"], ["bicycle", "bike"], ["autumn", "fall"],
    ["grandfather", "grandpa"], ["grandmother", "grandma"], ["delicious", "tasty"], ["fresh", "new"],
    ["high", "tall"], ["sweet", "cute"], ["gift", "present"], ["email", "message"], ["online", "internet"],
  ];

  // Distractors never include articles: "a book" / "the book" are often both fine.
  const NEVER = new Set(["a", "an", "the"]);

  const tilePool = [...new Set(sentences.flatMap((s) => s.words))];

  // Same root, e.g. "come"/"coming" or "want"/"wanted".
  function related(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4)) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return short.length >= 3 && long.startsWith(short);
  }

  function pickDistractors(words, count) {
    const answer = words.map((w) => w.toLowerCase());
    const blocked = new Set([...answer, ...NEVER]);
    for (const group of SYNONYMS) {
      if (group.some((w) => answer.includes(w))) group.forEach((w) => blocked.add(w));
    }
    const confusers = shuffle(answer.flatMap((w) => CONFUSERS[w] || []));
    const candidates = [...confusers, ...shuffle(tilePool.slice())];
    const picked = [];
    for (const c of candidates) {
      if (picked.length >= count) break;
      const lc = c.toLowerCase();
      if (blocked.has(lc) || answer.some((a) => related(a, lc))) continue;
      blocked.add(lc);
      picked.push(c);
    }
    return picked;
  }

  // ---------- State ----------

  const STORE_KEY = "turkish-word-bank-v1";
  const emptyStats = () => ({ score: 0, attempts: 0, streak: 0, best: 0 });
  const state = {
    mode: "words", // "words" | "sentences"
    dir: "tr-en",
    range: 100, // quiz the N most common words; 0 = all, "extra" = everyday words only
    level: "all", // sentence difficulty: "all" | "e" | "m" | "h"
    stats: { words: emptyStats(), sentences: emptyStats() },
    deck: [],
    pos: 0,
    current: null,
    answered: false,
    tiles: [], // sentence mode: [{ id, text }]
    picked: [], // sentence mode: tile ids in answer order
  };
  const stats = () => state.stats[state.mode];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      for (const k of ["mode", "dir", "range", "level"]) {
        if (saved[k] !== undefined) state[k] = saved[k];
      }
      if (saved.stats) {
        Object.assign(state.stats.words, saved.stats.words);
        Object.assign(state.stats.sentences, saved.stats.sentences);
      } else {
        // Scores saved before sentences existed belong to the words mode.
        for (const k of ["score", "attempts", "streak", "best"]) {
          if (saved[k] !== undefined) state.stats.words[k] = saved[k];
        }
      }
    } catch (_) { /* storage unavailable — start fresh */ }
  }

  function save() {
    try {
      const { mode, dir, range, level, stats: s } = state;
      localStorage.setItem(STORE_KEY, JSON.stringify({ mode, dir, range, level, stats: s }));
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
    let items;
    if (state.mode === "sentences") {
      items = state.level === "all" ? sentences.slice() : sentences.filter((s) => s.level === state.level);
    } else {
      if (state.range === "extra") items = entries.slice(FREQUENT_WORD_COUNT);
      else items = state.range ? entries.slice(0, state.range) : entries.slice();
    }
    state.deck = shuffle(items);
    // Don't show the same item twice in a row across reshuffles.
    if (last && state.deck.length > 1 && state.deck[0] === last) {
      [state.deck[0], state.deck[1]] = [state.deck[1], state.deck[0]];
    }
    state.pos = 0;
  }

  // ---------- Rendering ----------

  function renderStats() {
    const s = stats();
    els.score.textContent = s.score;
    els.attempts.textContent = s.attempts;
    els.streak.textContent = s.streak;
    els.best.textContent = s.best;
    const noun = state.mode === "sentences" ? "Sentence" : "Word";
    els.progress.textContent = `${noun} ${state.pos} of ${state.deck.length}`;
  }

  function renderMode() {
    const sentenceMode = state.mode === "sentences";
    document.querySelectorAll(".mode button").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === state.mode);
    });
    els.wordControls.hidden = sentenceMode;
    els.sentenceControls.hidden = !sentenceMode;
    els.wordInput.hidden = sentenceMode;
    els.sentenceInput.hidden = !sentenceMode;
    els.prompt.classList.toggle("sentence", sentenceMode);
    els.nextBtn.textContent = sentenceMode ? "Next sentence →" : "Next word →";
    renderDirection();
  }

  function renderDirection() {
    document.querySelectorAll(".direction button").forEach((b) => {
      b.classList.toggle("active", b.dataset.dir === state.dir);
    });
    els.trKeys.hidden = state.dir !== "en-tr";
    els.answer.lang = state.dir === "en-tr" ? "tr" : "en";
  }

  function nextItem() {
    if (state.pos >= state.deck.length) newDeck();
    state.current = state.deck[state.pos++];
    state.answered = false;

    if (state.mode === "sentences") {
      const s = state.current;
      els.prompt.textContent = s.tr;
      els.prompt.lang = "tr";
      els.promptLabel.textContent = "Translate this sentence";
      const extra = pickDistractors(s.words, { e: 3, m: 4, h: 5 }[s.level]);
      state.tiles = shuffle([...s.words, ...extra]).map((text, id) => ({ id, text }));
      state.picked = [];
      renderTiles();
    } else {
      const toEnglish = state.dir === "tr-en";
      els.prompt.textContent = toEnglish ? state.current.tr : state.current.en.split("/").map((s) => s.trim()).join(" / ");
      els.prompt.lang = toEnglish ? "tr" : "en";
      els.promptLabel.textContent = toEnglish ? "Translate to English" : "Translate to Turkish";
      els.answer.value = "";
    }

    setAnsweredUI(false);
    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    renderStats();
    if (state.mode === "words") els.answer.focus();
  }

  function setAnsweredUI(answered) {
    els.answer.disabled = answered;
    els.checkBtn.hidden = answered;
    els.skipBtn.hidden = answered;
    els.after.hidden = !answered;
    els.sentenceInput.classList.toggle("locked", answered);
    if (state.mode === "sentences") els.checkBtn.disabled = !answered && state.picked.length === 0;
    else els.checkBtn.disabled = false;
  }

  // ---------- Sentence tiles ----------

  function tileButton(tile, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile";
    b.textContent = tile.text;
    b.lang = "en";
    b.addEventListener("click", onClick);
    return b;
  }

  function renderTiles() {
    els.tilesAnswer.replaceChildren(
      ...state.picked.map((id) => tileButton(state.tiles[id], () => unpick(id)))
    );
    els.tilesBank.replaceChildren(
      ...state.tiles.map((t) => {
        const b = tileButton(t, () => pick(t.id));
        // Keep a placeholder so the bank layout doesn't jump around.
        if (state.picked.includes(t.id)) {
          b.classList.add("used");
          b.disabled = true;
          b.setAttribute("aria-hidden", "true");
        }
        return b;
      })
    );
    els.checkBtn.disabled = !state.answered && state.picked.length === 0;
  }

  function pick(id) {
    if (state.answered || state.picked.includes(id)) return;
    state.picked.push(id);
    renderTiles();
  }

  function unpick(id) {
    if (state.answered) return;
    state.picked = state.picked.filter((p) => p !== id);
    renderTiles();
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

  // LCS diff of two sequences. Returns which items of each side are part of the match.
  function lcsKeep(a, b, eq) {
    const m = a.length, n = b.length;
    const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }
    const keepA = new Array(m).fill(false);
    const keepB = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (eq(a[i], b[j])) { keepA[i++] = true; keepB[j++] = true; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++;
      else j++;
    }
    return { keepA, keepB };
  }

  // Character diff treating Turkish letters and Latin look-alikes as equal.
  // Returns HTML for the user's answer (wrong chars marked) and the correct answer (missing chars marked).
  function diffHtml(user, correct) {
    const a = Array.from(user);
    const b = Array.from(correct);
    const { keepA, keepB } = lcsKeep(a, b, (x, y) => foldChar(x) === foldChar(y));
    const wrap = (chars, keep, cls) =>
      chars.map((c, k) => (keep[k] || c === " " ? escapeHtml(c) : `<span class="${cls}">${escapeHtml(c)}</span>`)).join("");
    return {
      user: wrap(a, keepA, "diff-wrong"),
      correct: wrap(b, keepB, "diff-missing"),
    };
  }

  // Word-level diff for sentences.
  function wordDiffHtml(userWords, correctWords) {
    const { keepA, keepB } = lcsKeep(userWords, correctWords, (x, y) => x.toLowerCase() === y.toLowerCase());
    const wrap = (words, keep, cls) =>
      words.map((w, k) => (keep[k] ? escapeHtml(w) : `<span class="${cls}">${escapeHtml(w)}</span>`)).join(" ");
    return {
      user: wrap(userWords, keepA, "diff-wrong"),
      correct: wrap(correctWords, keepB, "diff-missing"),
    };
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- Answer handling ----------

  function record(correct, skipped) {
    const s = stats();
    // Skipping doesn't count as answered, but it does break the streak.
    if (!skipped) s.attempts++;
    if (correct) {
      s.score++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    save();
    renderStats();
  }

  function showFeedback(html, correct) {
    state.answered = true;
    els.feedback.innerHTML = html;
    els.feedback.className = `feedback ${correct ? "good" : "bad"}`;
    els.feedback.hidden = false;
    setAnsweredUI(true);
    els.nextBtn.focus();
  }

  function checkSentence(skipped) {
    const s = state.current;
    const userWords = state.picked.map((id) => state.tiles[id].text);
    if (!skipped && userWords.length === 0) return;

    const correct = !skipped && s.accepted.includes(userWords.join(" ").toLowerCase());
    record(correct, skipped);

    let html;
    if (correct) {
      html = `<div class="title">✓ Correct! +1 point</div>`;
    } else if (skipped) {
      html = `<div class="title">Skipped</div>
        <div class="row"><small>Answer:</small> <strong>${escapeHtml(s.en)}</strong></div>`;
    } else {
      // Compare against whichever accepted word order is closest.
      const closest = s.accepted.reduce((best, a) => {
        const d = levenshtein(userWords.map((w) => w.toLowerCase()), a.split(" "));
        return d < best.d ? { a, d } : best;
      }, { a: s.accepted[0], d: Infinity }).a;
      const shown = [s.en, ...s.alts].find((x) => x.toLowerCase() === closest);
      const d = wordDiffHtml(userWords, shown.split(" "));
      html = `<div class="title">✗ Not quite</div>
        <div class="row"><small>You wrote:</small> ${d.user}</div>
        <div class="row"><small>Correct:</small> <strong>${d.correct}</strong></div>`;
    }
    if (s.alts.length) {
      html += `<div class="row meanings"><small>Accepted:</small> ${[s.en, ...s.alts].map(escapeHtml).join(" · ")}</div>`;
    }
    showFeedback(html, correct);
  }

  function checkWord(skipped) {
    const raw = els.answer.value.trim();
    if (!raw && !skipped) {
      els.answer.focus();
      return;
    }

    const isEnglish = state.dir === "tr-en";
    const answers = acceptedAnswers(state.current);
    const userKey = normalize(raw, isEnglish);
    const correct = !skipped && answers.some((a) => normalize(a, isEnglish) === userKey);
    record(correct, skipped);

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
    } else if (skipped) {
      html = `<div class="title">Skipped</div>
        <div class="row"><small>Answer:</small> <strong>${escapeHtml(answers[0])}</strong></div>${all}`;
    } else {
      // Turkish lowercasing turns English "I" into "ı", so only use it for Turkish answers.
      const toLower = (s) => (isEnglish ? s.toLowerCase() : s.toLocaleLowerCase("tr"));
      const lower = toLower(raw);
      // Show the diff against whichever accepted answer is closest to what was typed.
      const closest = answers.reduce((best, a) => {
        const d = levenshtein(fold(lower), fold(toLower(a)));
        return d < best.d ? { a, d } : best;
      }, { a: answers[0], d: Infinity }).a;
      const d = diffHtml(lower, toLower(closest));
      html = `<div class="title">✗ Not quite</div>
        <div class="row"><small>You wrote:</small> ${d.user}</div>
        <div class="row"><small>Correct:</small> <strong>${d.correct}</strong></div>${all}`;
    }
    showFeedback(html, correct);
  }

  function check(skipped) {
    if (state.answered) return;
    if (state.mode === "sentences") checkSentence(skipped);
    else checkWord(skipped);
  }

  // ---------- Events ----------

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    check(false);
  });

  els.skipBtn.addEventListener("click", () => check(true));
  els.nextBtn.addEventListener("click", nextItem);

  function restart() {
    save();
    state.current = null;
    newDeck();
    nextItem();
  }

  els.range.addEventListener("change", () => {
    state.range = els.range.value === "extra" ? "extra" : Number(els.range.value);
    restart();
  });

  els.level.addEventListener("change", () => {
    state.level = els.level.value;
    restart();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && state.answered && document.activeElement !== els.nextBtn) {
      e.preventDefault();
      nextItem();
    } else if (state.mode === "sentences" && !state.answered && !e.target.closest("select")) {
      // Keyboard shortcuts for tiles: Enter checks, Backspace removes the last tile.
      if (e.key === "Enter" && !e.target.closest("button")) {
        e.preventDefault();
        check(false);
      } else if (e.key === "Backspace" && state.picked.length) {
        e.preventDefault();
        unpick(state.picked[state.picked.length - 1]);
      }
    }
  });

  document.querySelectorAll(".mode button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.mode === btn.dataset.mode) return;
      state.mode = btn.dataset.mode;
      renderMode();
      restart();
    });
  });

  document.querySelectorAll(".direction button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.dir === btn.dataset.dir) return;
      state.dir = btn.dataset.dir;
      save();
      renderDirection();
      nextItem();
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
    const what = state.mode === "sentences" ? "sentence" : "word";
    if (!confirm(`Reset your ${what} score and streaks?`)) return;
    state.stats[state.mode] = emptyStats();
    save();
    renderStats();
  });

  // ---------- Start ----------

  load();
  els.range.value = String(state.range);
  els.level.value = state.level;
  renderMode();
  newDeck();
  nextItem();
})();
