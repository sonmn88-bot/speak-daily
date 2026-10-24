// ===== 학습 탭 + 기록 탭 =====
const RANK = { O: 0, T: 1, X: 2 };
const SOFT_PER_DAY = 2; // 이보다 많이 하면 "몰아서 하면 효과가 줄어요" 안내만 (막지는 않음)
const REVEAL_GATE_MS = 1500; // 정답 보기 전에 최소한 떠올려 보는 시간
const SLOW_MS = 6000; // 이보다 늦게 정답을 열면 O를 고를 수 없음 (△까지)
const who = sp => (sp === "A" ? (LS && LS.cast.A && LS.cast.A.name) || "A" : "나");
const vo = sp => (sp === "A" && LS && LS.cast.A && LS.cast.A.gender === "m" ? "C" : sp); // 남성 상대역은 C 음성
const stepName = () => (LS.steps[LS.step] || [""])[0];
const nextLabel = () => (LS.steps[LS.step + 1] || [""])[0];
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
function mark(ids, r) { if (LS.practice) return; for (const id of ids || []) { if (!S.chunks[id]) continue; const p = LS.results[id]; if (!p || RANK[r] > RANK[p]) LS.results[id] = r; } }

// ---------- 표현 찾기·강조 도우미 ----------
const coreOf = en => en.replace(/~/g, "").replace(/\.\.\.|…/g, "").replace(/[.?!,]+$/, "").replace(/\s+/g, " ").trim();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findCore = (text, c) => text.toLowerCase().includes(coreOf(c.en).toLowerCase());
const chunksIn = text => Object.values(S.chunks).filter(c => coreOf(c.en).length > 3 && findCore(text, c)).map(c => c.id);
function hl(text, ids) {
  let out = esc(text);
  for (const id of ids || []) {
    const c = S.chunks[id]; if (!c) continue;
    const k = esc(coreOf(c.en)); if (k.length < 2) continue;
    out = out.replace(new RegExp(reEsc(k), "i"), m => `<b class="hl">${m}</b>`);
  }
  return out;
}
const blank = (text, c) => text.replace(new RegExp(reEsc(coreOf(c.en)), "i"), "_____");
function buildTarget(c) {
  const words = coreOf(c.en).split(" ");
  if (!c.en.includes("~") && words.length >= 3) return { en: c.en, ko: c.ko };
  const ex = (c.ex || []).filter(e => !e.en.includes("—") && e.en.split(" ").length <= 10);
  return ex.length ? ex[0] : { en: c.en, ko: c.ko };
}

// ---------- 자가 채점: 기준을 버튼에 적고, 늦게 열면 O 막기 ----------
const gradeRow = (slow = false) => `${slow ? `<p class="muted gate">${SLOW_MS / 1000}초가 지나서 열었어요. 실제 대화에선 늦은 답이라 △까지만 고를 수 있어요.</p>` : ""}
  <div class="row grade"><button class="bO" data-g="O" ${slow ? "disabled" : ""}>O<small>3초 안에 정확히</small></button><button class="bT" data-g="T">△<small>느림·표현 다름</small></button><button class="bX" data-g="X">X<small>못 꺼냄</small></button></div>`;
function onGrade(el, cb) { el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => cb(b.dataset.g)); }
// 정답 보기 버튼: 잠깐 잠갔다가 열고, 연 시점까지 걸린 시간을 돌려줌
// 도전 난이도: 5초 안에 못 열면 자동으로 열리고 '늦은 답'(△까지)으로 처리
function gateReveal(btnId, onReveal) {
  const b = $("#" + btnId), t0 = Date.now(), label = b.innerHTML, hard = LS.diff.lv === "도전";
  let auto = false, done = false;
  b.disabled = true; b.innerHTML = "속으로 먼저 말해보세요";
  setTimeout(() => {
    if (!b.isConnected || done) return;
    b.disabled = false; b.innerHTML = label;
    if (!hard) return;
    let s = Math.round((5000 - REVEAL_GATE_MS) / 1000);
    const tick = () => { if (!b.isConnected || done) return; if (s <= 0) { auto = true; return b.click(); } b.textContent = `정답 보기 (${s})`; s--; setTimeout(tick, 1000); };
    tick();
  }, REVEAL_GATE_MS);
  b.onclick = () => { if (done) return; done = true; onReveal(auto || Date.now() - t0 > SLOW_MS); };
}

// 단어 조각을 눌러 문장 만들기 (자동 채점) — 알아보기 연습이라 기억 기록엔 △까지만
function buildWidget(box, target, done) {
  const words = target.split(/\s+/).filter(Boolean), order = shuffle(words.map((w, i) => ({ w, i }))), picked = [];
  const norm = s => s.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
  const draw = () => {
    box.innerHTML = `<div class="ansline">${picked.map((p, k) => `<button class="chip on" data-k="${k}">${esc(p.w)}</button>`).join("") || '<span class="muted">단어를 순서대로 누르세요</span>'}</div>
      <div class="chips">${order.filter(o => !picked.includes(o)).map(o => `<button class="chip" data-i="${o.i}">${esc(o.w)}</button>`).join("")}</div>`;
    box.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { picked.splice(+b.dataset.k, 1); draw(); });
    box.querySelectorAll("[data-i]").forEach(b => b.onclick = () => {
      picked.push(order.find(o => o.i === +b.dataset.i));
      if (picked.length < words.length) return draw();
      draw(); box.querySelectorAll("button").forEach(x => x.disabled = true);
      done(norm(picked.map(p => p.w).join(" ")) === norm(target));
    });
  };
  draw();
}

// 직접 입력해서 떠올리기 (조용한 모드의 생성 연습) — 축약형을 풀어 비교하고 단어 1개 차이까지 O
const CONTR = { "i'm": "i am", "you're": "you are", "it's": "it is", "that's": "that is", "what's": "what is", "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
  "didn't": "did not", "don't": "do not", "doesn't": "does not", "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not", "haven't": "have not", "hasn't": "has not",
  "can't": "can not", "cannot": "can not", "won't": "will not", "wouldn't": "would not", "couldn't": "could not", "shouldn't": "should not",
  "i'd": "i would", "you'd": "you would", "let's": "let us", "how's": "how is", "how've": "how have", "there's": "there is", "here's": "here is", "where's": "where is", "who's": "who is",
  "he's": "he is", "she's": "she is", "we're": "we are", "they're": "they are", "i'll": "i will", "you'll": "you will", "it'll": "it will", "we'll": "we will", "they'll": "they will", "that'll": "that will",
  "im": "i am", "ive": "i have", "ill": "i will", "dont": "do not", "didnt": "did not", "doesnt": "does not", "cant": "can not", "wont": "will not", "isnt": "is not", "thats": "that is", "whats": "what is", "lets": "let us", "theres": "there is", "youre": "you are", "havent": "have not", "wasnt": "was not" };
const normWords = s => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]/g, " ").split(/\s+/).map(w => w.replace(/^'+|'+$/g, "")).filter(Boolean).flatMap(w => (CONTR[w] || w).split(" "));
function wordDist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function typeScore(input, target, c) {
  const a = normWords(input), b = normWords(target);
  if (!a.length) return "X";
  if (wordDist(a, b) <= (b.length > 4 ? 1 : 0)) return "O";
  if (c && normWords(coreOf(c.en)).every(w => a.includes(w))) return "T";
  return "X";
}
function diffHTML(input, target) {
  const a = new Set(normWords(input));
  return target.split(/\s+/).map(w => { const n = normWords(w); return n.every(x => a.has(x)) ? esc(w) : `<b class="miss">${esc(w)}</b>`; }).join(" ");
}
function typeWidget(box, target, c, done) {
  box.innerHTML = `<label class="sr" for="ty">영어로 입력</label><input id="ty" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="영어로 입력하세요">
    <button class="go" id="tyok">확인</button>`;
  const go = () => { const v = $("#ty").value; $("#ty").disabled = true; $("#tyok").remove(); done(typeScore(v, target, c), v); };
  $("#tyok").onclick = go;
  $("#ty").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  setTimeout(() => { try { $("#ty").focus(); } catch (e) {} }, 50);
}

// ---------- 난이도 자동 조절: 최근 3회 결과 기준 ----------
function difficulty() {
  const H = S.st.history.filter(h => h.results && Object.keys(h.results).length).slice(-3);
  if (H.length < 3) return { lv: "보통", why: "기록 3회가 쌓이면 자동 조절돼요." };
  const rates = H.map(h => { const v = Object.values(h.results); return v.filter(r => r === "O").length / v.length; });
  const avgR = rates.reduce((a, b) => a + b, 0) / 3;
  if (rates.every(r => r >= 0.9)) return { lv: "도전", why: "최근 3회 모두 O 90% 이상: 빠른 재생, 5초 안에 말하기, 글자 없이 듣고 대답" };
  if (avgR < 0.6) return { lv: "기초", why: "최근 3회 평균 O 60% 미만: 따라 말하기 5번, 재도전 기회 증가" };
  return { lv: "보통", why: `최근 3회 평균 O ${Math.round(avgR * 100)}%` };
}

// ---------- 세션 만들기 ----------
function testList(day, w, exclude) {
  const srs = S.st.srs, ex = new Set(exclude.map(c => c.id));
  let ids = day.chunks && day.chunks.length ? day.chunks.map(c => c.id)
    : [...new Set((day.lines || []).flatMap(l => l.chunks || []))].slice(0, 10);
  ids = ids.filter(id => S.chunks[id]);
  if (day.type !== "learn" && ids.length) { const f = ids.filter(id => !ex.has(id)); if (f.length) ids = f; } // 복습일: 워밍업에 나온 건 빼고
  if (!ids.length) { // 대화가 없는 복습일: 이번 주와 지난주 표현 중 약한 것 10개 (워밍업 제외)
    ids = Object.values(S.chunks).filter(c => c.week >= w - 1 && c.week <= w && srs[c.id] && !srs[c.id].grad && !ex.has(c.id))
      .sort((a, b) => srs[a.id].level - srs[b.id].level || srs[b.id].x - srs[a.id].x).slice(0, 10).map(c => c.id);
  } else if (day.chunks && day.chunks.length) { // 복습일이 된 지난 표현 2~3개 섞기 (워밍업에 나온 건 제외)
    const old = Object.keys(srs).filter(id => S.chunks[id] && !ids.includes(id) && !ex.has(id) && !srs[id].grad && srs[id].due <= S.st.date)
      .sort((a, b) => srs[a].level - srs[b].level).slice(0, 3);
    ids = ids.concat(old);
  }
  return shuffle(ids.map(id => S.chunks[id]));
}
function newSession(day, w, practice, silentOv) {
  const n = dayN(w, day.day), dw = day.day, monthly = w % 4 === 0 && dw >= 6, learn = day.type === "learn";
  const s = { id: `${w}-${dw}${practice ? "p" : ""}`, w, n, day, practice,
    cast: day.cast || (S.weeks[w] || {}).cast || {}, theme: (S.weeks[w] || {}).theme || "",
    step: 0, results: {}, measure: null, steps: [], due: [], recs: {},
    stats: { start: Date.now(), activeMs: 0, listenTries: 0, listenPlays: 0, hints: 0, replays: 0, slow: 0, drill: {}, mode: "voice" } };
  s.silent = silentOv ?? isSilent(); s.stats.mode = s.silent ? "silent" : "voice";
  s.diff = difficulty(); s.stats.level = s.diff.lv;
  if (!practice) {
    const srs = S.st.srs, cap = monthly ? 15 : !learn ? 10 : 6; // 이동 중 15분 안에 끝나도록
    s.due = Object.entries(srs)
      .filter(([id, it]) => it.due <= S.st.date && (!it.grad || monthly) && S.chunks[id])
      .sort((a, b) => (a[1].due < b[1].due ? -1 : 1)).map(([id]) => S.chunks[id]).slice(0, cap);
    if (!learn && s.due.length < cap) {
      const have = new Set(s.due.map(c => c.id));
      const extra = Object.values(S.chunks).filter(c => !have.has(c.id) && srs[c.id] && !srs[c.id].grad).sort((a, b) => srs[a.id].level - srs[b.id].level);
      s.due = s.due.concat(extra.slice(0, cap - s.due.length));
    }
    if (s.due.length) s.steps.push(["워밍업", warmup]);
  }
  const hasLines = day.lines && day.lines.length;
  if (hasLines) s.steps.push(["듣기", listen]);
  if (day.chunks && day.chunks.length) s.steps.push(["표현", study], ["드릴", drills]);
  if (hasLines) { if (!s.silent) s.steps.push(["섀도잉", shadow]); s.steps.push(["인출", recall]); }
  s.test = testList(day, w, s.due); // 연습 모드에서도 출제하되 기록은 안 함(mark가 막음)
  if (s.test.length) s.steps.push(["마무리", finalTest]); // 기억 기록에 가장 중요한 단계라 롤플레이보다 앞에
  if (day.roleplay) s.steps.push(["롤플레이", roleplay]);
  if (day.improv && day.improv.length) s.steps.push(["즉흥", improv]);
  if (!practice && !s.silent && (day.type === "review_cum" || (monthly && dw === 7))) s.steps.push(["측정", measure]);
  s.steps.push(["완료", finish]);
  return s;
}

// ---------- 중간 저장·이어하기 (단계 이름으로 저장, 이 기기에) ----------
const RKEY = () => "sd_resume_" + String(KEY || "").slice(0, 10);
function saveResume() {
  if (!LS || LS.practice) return;
  const d = { n: LS.n, at: Date.now(), stepName: stepName(), silent: LS.silent, results: LS.results, stats: LS.stats, measure: LS.measure,
    due: LS.due.map(c => c.id), test: LS.test.map(c => c.id) };
  try { localStorage.setItem(RKEY(), JSON.stringify(d)); } catch (e) {}
}
function loadResume() {
  try {
    const d = JSON.parse(localStorage.getItem(RKEY()) || "null");
    if (d && d.n === S.n && Date.now() - d.at < 3 * DAYMS && d.stepName) return d;
  } catch (e) {}
  return null;
}
function clearResume() { try { localStorage.removeItem(RKEY()); } catch (e) {} }
function startLesson() {
  const r = loadResume();
  LS = newSession(S.today, S.week, false, r ? r.silent : undefined);
  if (!r) return;
  const pick = ids => ids.map(id => S.chunks[id]).filter(Boolean);
  const at = LS.steps.findIndex(([nm]) => nm === r.stepName);
  Object.assign(LS, { step: at >= 0 ? at : 0, results: r.results || {}, measure: r.measure || null,
    stats: { ...LS.stats, ...r.stats, start: Date.now() }, due: pick(r.due || []), test: pick(r.test || []), resumed: true });
  if (!LS.test.length) LS.steps = LS.steps.filter(([nm]) => nm !== "마무리");
  if (!LS.due.length) LS.steps = LS.steps.filter(([nm]) => nm !== "워밍업");
  LS.step = Math.max(0, LS.steps.findIndex(([nm]) => nm === r.stepName));
  track("resume", { lesson: LS.n, step: stepName() });
}

const doneToday = () => S.st.today.lessons || (S.st.today.done ? 1 : 0);
ROUTES.learn = el => {
  if (LS && (LS.practice || LS.n === S.n)) return renderLearn(el);
  if (!S.today) {
    el.innerHTML = `<header><h1>레슨 ${S.n}</h1><h2>준비된 레슨을 모두 끝냈어요</h2></header>
      <div class="card"><p class="muted">${S.week}주차 ${S.dw}일 자료가 아직 올라오지 않았어요. 그동안 표현 카드나 듣기 모드로 복습해 보세요.</p>
      <div class="row"><button id="cd">표현 카드</button><button id="lm">듣기 모드</button></div></div>`;
    $("#cd").onclick = () => location.hash = "cards"; $("#lm").onclick = () => location.hash = "radio"; return;
  }
  const cnt = doneToday();
  if (S.st.today.done && !loadResume()) { // 중간에 멈춘 레슨이 있으면 묻지 않고 바로 이어서
    el.innerHTML = `<header><h1>오늘 ${cnt}레슨 완료</h1><h2>다음 레슨도 할까요?</h2></header>
      <div class="card"><p class="muted">오늘 과제는 끝났고 알림도 멈췄어요. 원하면 다음 레슨을 미리 해도 돼요. 진도에 반영돼요.</p>
      ${cnt >= SOFT_PER_DAY ? `<p class="muted gate">오늘 벌써 ${cnt}레슨을 했어요. 하루에 몰아서 하면 기억에 남는 양이 줄어서, 남은 시간은 표현 카드 복습을 더 추천해요.</p>` : ""}
      <button class="go" id="more">레슨 ${S.n} 시작</button><button id="rv">기록 탭에서 복습하기</button></div>`;
    $("#more").onclick = () => { startLesson(); renderLearn($("#view")); };
    $("#rv").onclick = () => location.hash = "review"; return;
  }
  startLesson();
  renderLearn(el);
};

function renderLearn(el) {
  stopAudio(); RUN++;
  if (LS.lastStep != null && LS.lastStep !== LS.step) {
    const ms = Date.now() - LS.stepAt;
    LS.stats.activeMs = (LS.stats.activeMs || 0) + Math.min(ms, 10 * 60000); // 한 단계에서 10분 넘게 멈춰 있던 시간은 빼고 셈
    track("step", { lesson: LS.n, name: LS.steps[LS.lastStep][0], ms, practice: LS.practice });
  }
  if (LS.lastStep !== LS.step) { LS.stepAt = Date.now(); LS.lastStep = LS.step; }
  saveResume();
  const [, fn] = LS.steps[LS.step];
  el.innerHTML = `<header><h1>레슨 ${LS.n} · ${esc(LS.theme)}${LS.practice ? " · 연습" : ""}</h1><h2>${esc(LS.day.title)}</h2></header>
    <div class="meta"><span>난이도 ${LS.diff.lv}</span><span>${LS.silent ? "조용한 모드" : "소리 모드"}</span><button class="vbtn" id="vbtn" aria-label="음성 설정">${ic("speaker", 16)} 음성</button>${LS.practice ? `<button class="vbtn" id="qp">연습 그만두기</button>` : ""}</div>
    <nav class="map" aria-label="진행 단계 ${LS.step + 1} / ${LS.steps.length}">${LS.steps.map(([t], i) => `<div class="st ${i < LS.step ? "pass" : i === LS.step ? "cur" : ""}"><i></i>${t}</div>`).join("")}</nav>
    ${LS.resumed ? `<p class="muted resume">이어서 학습해요. ${esc(stepName())} 단계부터 다시 시작해요.</p>` : ""}
    <div id="vp"></div><section id="stage"></section>`;
  LS.resumed = false;
  $("#vbtn").onclick = () => voicePanel($("#vp"));
  if (LS.practice) $("#qp").onclick = () => { LS = null; location.hash = "learn"; ROUTES.learn($("#view")); };
  fn($("#stage"));
  window.scrollTo(0, 0);
}
const next = () => { LS.step++; renderLearn($("#view")); };

// ---------- 대화 인출: 내 대사를 말하고 채점 → 기억 기록에 반영 ----------
function recall(el) {
  if (LS.silent) return recallSilent(el);
  const L = LS.day.lines, items = [], audio = LS.diff.lv === "도전";
  L.forEach((l, i) => { if (l.sp === "B") items.push({ ko: l.ko, en: l.en, ids: l.chunks, ctx: i > 0 ? `${who("A")}: ${L[i - 1].en}` : "", ctxEn: i > 0 ? L[i - 1].en : "" }); });
  let i = 0;
  const show = () => {
    const it = items[i], aud = audio && it.ctxEn;
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div>
      ${aud ? `<p class="muted">글자 없이 상대 말을 듣고, 내 대사를 영어로 말하세요.</p><button id="ctxp">${ic("speaker")} 상대 말 듣기</button>`
            : `${it.ctx ? `<p class="muted">${esc(it.ctx)}</p>` : ""}<p class="ko">${esc(it.ko)}</p>`}<div id="ans"></div></div>
      <p class="muted">영어로 소리 내 말한 다음 정답을 확인하세요.</p><div id="ctl"><button class="go" id="reveal">정답 보기</button></div>`;
    if (aud) { $("#ctxp").onclick = () => { LS.stats.replays++; speak(it.ctxEn, { who: vo("A") }); }; speak(it.ctxEn, { who: vo("A") }); }
    gateReveal("reveal", slow => {
      if (slow) LS.stats.slow++;
      $("#ans").innerHTML = `${aud ? `<p class="muted">${esc(it.ko)}</p>` : ""}<div class="en">${hl(it.en, it.ids)}</div>`;
      speak(it.en, { who: "B" });
      $("#ctl").innerHTML = `<button id="again">${ic("speaker")} 다시 듣기</button>${gradeRow(slow)}`;
      $("#again").onclick = () => { LS.stats.replays++; speak(it.en, { who: "B" }); };
      onGrade(el, r => { mark(it.ids, r); i++; i < items.length ? show() : next(); });
    });
  };
  show();
}

// 조용한 모드 인출: 짧은 대사는 직접 입력(기록 반영), 긴 대사는 3지선다(기록 안 함)
function recallSilent(el) {
  const L = LS.day.lines, items = L.map((l, i) => ({ l, prev: L[i - 1] })).filter(x => x.l.sp === "B"), mine = items.map(x => x.l);
  let i = 0;
  const show = () => {
    if (i >= items.length) return next();
    const { l, prev } = items[i], long = l.en.split(" ").length > 12;
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div>${prev ? `<p class="muted">${esc(who("A"))}: ${esc(prev.en)}</p>` : ""}
      <p class="ko">${esc(l.ko)}</p><p class="muted">${long ? "알맞은 내 대사를 고르세요." : "내 대사를 영어로 입력하세요. 핵심 표현이 맞으면 돼요."}</p><div id="bw"></div><div id="res"></div></div><div id="ctl"></div>`;
    const done = (r, typed) => {
      const ok = r === "O";
      $("#res").innerHTML = `<p class="ko" style="margin-top:12px;color:${ok ? "var(--o)" : r === "T" ? "var(--t)" : "var(--x)"}">${ok ? "정답!" : r === "T" ? "핵심 표현은 맞아요" : "정답은"}</p>
        <div class="en">${typed != null && !ok ? diffHTML(typed, l.en) : hl(l.en, l.chunks)}</div>`;
      $("#ctl").innerHTML = `<button class="go" id="nx">${i < items.length - 1 ? "다음" : `다음: ${nextLabel()}`}</button>`;
      $("#nx").onclick = () => { i++; show(); };
    };
    if (!long) return typeWidget($("#bw"), l.en, null, (r, v) => { const rr = r === "X" && (l.chunks || []).some(id => normWords(coreOf(S.chunks[id] ? S.chunks[id].en : "")).every(w => normWords(v).includes(w))) ? "T" : r; mark(l.chunks, rr); done(rr, v); });
    const opts = shuffle([l, ...shuffle(mine.filter(x => x !== l)).slice(0, 2)]);
    $("#bw").innerHTML = opts.map((o, k) => `<button class="opt" data-o="${k}">${esc(o.en)}</button>`).join("");
    el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => {
      el.querySelectorAll("[data-o]").forEach(x => { x.disabled = true; if (opts[+x.dataset.o] === l) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      done(opts[+b.dataset.o] === l ? "O" : "X");
    });
  };
  show();
}

// ---------- 워밍업·마무리: 말하기(소리)·입력(조용)·조립을 섞어 출제, 틀리면 다시 ----------
function quiz(el, list, onDone) {
  const fmt = () => (LS.silent ? (Math.random() < 0.25 ? "build" : "type") : Math.random() < 0.25 ? "build" : "speak");
  const q = list.map(c => ({ c, tries: 0, fmt: fmt() })), first = {};
  const show = () => {
    if (!q.length) return onDone();
    const it = q[0], c = it.c;
    el.innerHTML = `<div class="card"><div class="count">남은 문제 ${q.length}</div><div id="q"></div><div id="ans"></div></div><div id="ctl"></div>`;
    const grade = r => {
      if (!(c.id in first)) { first[c.id] = r; mark([c.id], r); }
      q.shift(); it.tries++;
      if (r !== "O" && it.tries < (LS.diff.lv === "기초" ? 4 : 3)) { it.fmt = LS.silent ? "type" : "speak"; q.splice(Math.min(2, q.length), 0, it); }
      show();
    };
    const t = buildTarget(c);
    if (it.fmt === "build") {
      $("#q").innerHTML = `<p class="muted">단어를 순서대로 눌러 문장을 완성하세요.</p><p class="ko">${esc(t.ko)}</p><div id="bw"></div>`;
      buildWidget($("#bw"), t.en, ok => {
        $("#ans").innerHTML = `<p class="ko" style="color:${ok ? "var(--o)" : "var(--x)"}">${ok ? "정답!" : "정답은"}</p><div class="en">${hl(t.en, [c.id])}</div>`;
        auto(t.en, "B");
        // 조각 맞추기는 보고 고르는 연습이라 맞혀도 △로 기록 (다시 떠올려 말할 기회를 줌)
        $("#ctl").innerHTML = `<button class="go" id="nx">다음</button>`; $("#nx").onclick = () => grade(ok ? "T" : "X");
      });
      return;
    }
    if (it.fmt === "type") {
      $("#q").innerHTML = `<p class="muted">영어로 입력하세요. 틀린 표현은 조금 뒤에 다시 나와요.</p><p class="ko">${esc(t.ko)}</p><div id="bw"></div>`;
      typeWidget($("#bw"), t.en, c, (r, v) => {
        $("#ans").innerHTML = `<p class="ko" style="color:${r === "O" ? "var(--o)" : r === "T" ? "var(--t)" : "var(--x)"}">${r === "O" ? "정답!" : r === "T" ? "핵심 표현은 맞아요" : "정답은"}</p>
          <div class="en">${r === "O" ? hl(t.en, [c.id]) : diffHTML(v, t.en)}</div>${c.sound ? `<p class="muted">${ic("wave", 14)} ${esc(c.sound)}</p>` : ""}`;
        $("#ctl").innerHTML = `<button class="go" id="nx">다음</button>`; $("#nx").onclick = () => grade(r);
      });
      return;
    }
    $("#q").innerHTML = `<p class="muted">힌트 없이 영어로 말해보세요. 틀린 표현은 조금 뒤에 다시 나와요.</p><p class="ko">${esc(c.ko)}</p>`;
    $("#ctl").innerHTML = `<button class="go" id="rv">정답 보기</button>`;
    gateReveal("rv", slow => {
      if (slow) LS.stats.slow++;
      $("#ans").innerHTML = `<div class="en">${esc(c.en)}</div>${c.sound ? `<p class="muted">${ic("wave", 14)} ${esc(c.sound)}</p>` : ""}`;
      speak(c.en, { who: "B" }); $("#ctl").innerHTML = gradeRow(slow); onGrade(el, grade);
    });
  };
  show();
}
function warmup(el) { quiz(el, LS.due, next); }
function finalTest(el) { quiz(el, LS.test, next); }

// ---------- 듣기 ----------
async function playAll(rate) {
  const r = RUN; LS.stats.listenPlays++;
  for (const l of LS.day.lines) { if (r !== RUN) return; await speak(l.en, { rate, who: vo(l.sp) }); await sleep(250); }
}
function listen(el) {
  const d = LS.day; let asked = false;
  el.innerHTML = `<div class="card"><p class="muted">${esc(d.context_ko)}</p><p class="muted">자막 없이 끝까지 들어보세요.</p>
    <button class="go" id="play">${ic("play")} 대화 듣기</button>${LS.silent ? `<button id="read">${ic("book")} 소리 없이 대본 읽기</button>` : ""}<div id="q"></div></div>`;
  if (LS.silent) $("#read").onclick = () => {
    $("#read").remove();
    $("#q").insertAdjacentHTML("beforebegin", `<div id="tx">${d.lines.map(l => `<div class="line"><div class="sp">${esc(who(l.sp))}</div>${esc(l.en)}</div>`).join("")}</div>`);
    if (!asked) { asked = true; showQ(); }
  };
  $("#play").onclick = async () => {
    const b = $("#play"); b.disabled = true; await playAll(1);
    if (!$("#play")) return; b.disabled = false; b.innerHTML = `${ic("play")} 다시 듣기`;
    if (!asked) { asked = true; showQ(); }
  };
  function showQ() {
    const q = d.listen_q;
    if (!q) { $("#q").innerHTML = `<button class="go" id="nx">다음: ${nextLabel()}</button>`; $("#nx").onclick = next; return; }
    $("#q").innerHTML = `<p class="ko" style="margin-top:18px">${esc(q.q)}</p>${q.options.map((o, i) => [o, i]).sort(() => Math.random() - .5).map(([o, i]) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}<p class="muted" id="fb"></p>`;
    $("#q").querySelectorAll(".opt").forEach(b => b.onclick = () => {
      LS.stats.listenTries++;
      if (+b.dataset.i !== q.answer) { b.classList.add("wrong"); b.disabled = true; $("#fb").textContent = "다시 들어보고 골라보세요."; return; }
      if ($("#tx")) $("#tx").remove();
      $("#q").innerHTML = `<p class="ko" style="margin-top:18px">정답이에요.</p>${d.pragmatic ? `<p class="muted">${ic("bulb", 14)} ${esc(d.pragmatic)}</p>` : ""}
        <p class="muted" style="margin-top:14px">대본: 표시된 부분이 오늘 표현이에요. 문맥 속에서 어떻게 쓰였는지 보세요.</p>
        ${d.lines.map(l => `<div class="line"><div class="sp">${esc(who(l.sp))}</div>${hl(l.en, l.chunks)}<div class="muted">${esc(l.ko)}</div></div>`).join("")}
        <button class="go" id="nx">다음: ${nextLabel()}</button>`;
      $("#nx").onclick = next;
    });
  }
}

// ---------- 섀도잉: 기본은 표현이 든 줄만, 원하면 전체 / 멈춤 가능 ----------
function shadow(el) {
  const all = LS.day.lines, key = all.filter(l => l.sp === "B" && (l.chunks || []).length); // 기본: 오늘 표현이 든 내 대사만
  let L = key.length >= 4 ? key : all, rate = LS.diff.lv === "도전" ? 1.15 : 1, stop = false, running = false;
  const draw = () => {
    el.innerHTML = `<div class="card"><p class="muted">한 줄 듣고, 멈추는 동안 똑같이 따라 말하세요. ${L === all ? "전체 대화" : `표현이 든 ${L.length}줄`}로 진행해요.</p>
      ${L.map((l, i) => `<div class="line" id="l${i}"><div class="sp">${esc(who(l.sp))}</div><div>${hl(l.en, l.chunks)}</div><div class="muted">${esc(l.ko)}</div></div>`).join("")}</div>
      <div class="row"><button class="go" id="go">${ic("play")} 따라 말하기 시작</button><button id="stp" hidden>${ic("stop")} 멈추기</button></div><div id="slow"></div>`;
    $("#go").onclick = run;
    $("#stp").onclick = () => { stop = true; stopAudio(); };
  };
  const run = async () => {
    if (running) return; running = true; stop = false;
    const r = RUN; $("#go").disabled = true; $("#stp").hidden = false; $("#slow").innerHTML = "";
    for (let i = 0; i < L.length; i++) {
      if (r !== RUN || stop) break;
      el.querySelectorAll(".line").forEach(x => x.classList.remove("on"));
      const le = $("#l" + i); le.classList.add("on"); le.scrollIntoView({ block: "center", behavior: "smooth" });
      const t0 = Date.now();
      await speak(L[i].en, { rate, who: vo(L[i].sp) });
      if (stop) break;
      await sleep(Math.max(1200, (Date.now() - t0) * 1.1 + 500)); // 따라 말할 시간
    }
    running = false;
    if (r !== RUN) return;
    const b = $("#go"); b.disabled = false; $("#stp").hidden = true;
    if (stop) { b.innerHTML = `${ic("play")} 처음부터 다시`; $("#slow").innerHTML = `<button id="sk">이 단계 건너뛰기</button>`; $("#sk").onclick = next; return; }
    b.innerHTML = `다음: ${nextLabel()}`; b.onclick = next;
    $("#slow").innerHTML = `<div class="row"><button id="sl">${ic("slow")} 0.8배로 한 번 더</button>${L !== all ? `<button id="fu">전체 대화로 한 번 더</button>` : ""}</div>${compareHTML(L)}`;
    $("#sl").onclick = () => { rate = 0.8; run(); };
    if ($("#fu")) $("#fu").onclick = () => { L = all; draw(); run(); };
    bindCompare(L);
  };
  draw();
}

// ---------- 즉흥: 학습일 60·45·30초, 복습일 90·60·45초 (같은 내용을 점점 빠르게) ----------
function countdown(sec, el) {
  const r = RUN;
  return new Promise(async res => {
    for (let s = sec; s > 0; s--) { if (r !== RUN) return; el.textContent = s; await sleep(1000); }
    el.textContent = "0"; res();
  });
}
function improv(el) {
  const it = LS.day.improv[0], rounds = LS.day.type === "learn" ? [60, 45, 30] : [90, 60, 45]; let k = 0;
  const head = `<div class="card"><p class="ko">${esc(it.situation_ko)}</p><p class="en">“${esc(it.starter_en)}”</p>${LS.silent ? "" : `<button id="hear">${ic("speaker")} 상대 말 듣기</button>`}</div>`;
  if (LS.silent) { // 조용한 모드: 90초 안에 3문장 써보기 (채점 없음)
    el.innerHTML = `${head}<div class="card"><p class="muted">90초 안에 영어로 세 문장 이상 써보세요. 오늘 표현을 최대한 넣어보세요.</p>
      <div class="timer" id="tm">90</div><label class="sr" for="ta">답 쓰기</label><textarea id="ta" rows="4" placeholder="영어로 써보세요"></textarea><button class="go" id="go">${ic("play")} 시작</button></div>`;
    $("#go").onclick = async () => { $("#go").disabled = true; $("#ta").focus(); await countdown(90, $("#tm")); if (!$("#go")) return; LS.stats.improvChars = $("#ta").value.length; $("#go").disabled = false; $("#go").textContent = `다음: ${nextLabel()}`; $("#go").onclick = next; };
    return;
  }
  el.innerHTML = `${head}<div class="card"><p class="muted">같은 내용을 점점 짧은 시간 안에 말해요. 막혀도 멈추지 말고 아는 표현으로 돌려 말하세요.</p>
    <div class="timer" id="tm">${rounds[0]}</div><button class="go" id="go">${ic("play")} ${rounds[0]}초 시작</button><button id="sk" hidden>이번 라운드 끝냈어요</button></div>`;
  $("#hear").onclick = () => speak(it.starter_en, { who: vo("A") });
  const b = $("#go"); let cur = 0;
  const finishRound = () => {
    cur++; RUN++; // 카운트다운 중단
    k++; b.disabled = false; $("#sk").hidden = true;
    if (k < rounds.length) { b.innerHTML = `${ic("play")} ${rounds[k]}초 시작`; $("#tm").textContent = rounds[k]; }
    else b.textContent = `다음: ${nextLabel()}`;
  };
  $("#sk").onclick = () => { if (b.disabled) finishRound(); };
  b.onclick = async () => {
    if (k >= rounds.length) return next();
    b.disabled = true; $("#sk").hidden = false; const my = cur; await countdown(rounds[k], $("#tm"));
    if (!$("#go") || my !== cur) return;
    finishRound();
  };
}

// ---------- 60초 측정 ----------
function measure(el) {
  let conf = 0;
  el.innerHTML = `<div class="card"><p class="ko">60초 자유 발화</p>
    <p class="muted">이번 주에 있었던 일을 배운 표현을 최대한 넣어 60초 동안 말하세요. 폰 음성 메모로 녹음해두면 나중에 비교할 수 있어요.</p>
    <div class="timer" id="tm">60</div><button class="go" id="go">${ic("play")} 60초 시작</button></div>
    <div class="card"><label>3초 넘게 멈춘 횟수<input id="p" type="number" inputmode="numeric" min="0"></label>
    <label>이번 주 표현을 쓴 개수<input id="u" type="number" inputmode="numeric" min="0"></label>
    <label>자신감 (1~5)</label><div class="row" id="cf">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div></div>
    <button class="go" id="sv" disabled>기록하고 다음으로</button>`;
  $("#go").onclick = async () => { $("#go").disabled = true; await countdown(60, $("#tm")); if ($("#go")) $("#go").disabled = false; };
  const check = () => { $("#sv").disabled = !(conf && $("#p").value !== "" && $("#u").value !== ""); };
  $("#p").oninput = $("#u").oninput = check;
  el.querySelectorAll("#cf button").forEach(b => b.onclick = () => {
    conf = +b.dataset.v; el.querySelectorAll("#cf button").forEach(x => x.classList.toggle("sel", x === b)); check();
  });
  $("#sv").onclick = () => { LS.measure = { pauses: +$("#p").value, used: +$("#u").value, confidence: conf }; next(); };
}

// ---------- 완료 ----------
function finish(el) {
  const t = { O: 0, T: 0, X: 0 }; Object.values(LS.results).forEach(r => t[r]++);
  if (LS.practice) {
    el.innerHTML = `<div class="card"><p class="ko">연습 끝</p><p class="muted">연습은 기록에 저장되지 않아요.</p></div>
      <button class="go" id="home">홈으로</button>`;
    $("#home").onclick = () => { LS = null; location.hash = "home"; };
    return;
  }
  const prev = [...S.st.history].reverse().find(h => h.date < S.st.date && h.stats && h.stats.mission);
  const askPrev = prev && !S.st.history.some(h => h.stats && h.stats.missionPrevFor === prev.date);
  const cands = (LS.day.chunks && LS.day.chunks.length ? LS.day.chunks : LS.test).slice(0, 5);
  el.innerHTML = `<div class="card"><p class="ko">저장하면 오늘 알림이 멈춰요</p><p class="score"><b class="sO">맞음 ${t.O}</b><b class="sT">애매 ${t.T}</b><b class="sX">못 함 ${t.X}</b></p>
    <button class="go" id="sv">저장하고 레슨 ${LS.n} 끝내기</button><p class="muted" id="msg" role="status"></p></div>
    ${askPrev ? `<div class="card"><h3>지난 실전 미션</h3><p class="muted">"${esc(prev.stats.mission)}"를 실제 대화나 혼잣말로 써봤나요?</p>
      <div class="row" id="mp"><button data-v="1">써봤다</button><button data-v="0">못 썼다</button></div></div>` : ""}
    ${cands.length ? `<div class="card"><h3>오늘의 실전 미션</h3><p class="muted">다음 학습 전까지 실제로 한 번 써볼 표현을 고르세요. 누군가에게 말하거나, 혼잣말로 상황을 만들어 써도 돼요.</p>
      <div class="pills" id="mi">${cands.map(c => `<button class="pill" data-v="${esc(c.en)}">${esc(c.en)}</button>`).join("")}</div><p class="muted">미션은 저장하기 전에 골라주세요.</p></div>` : ""}`;
  const pick = (box, key, conv) => el.querySelectorAll(`#${box} button`).forEach(b => b.onclick = () => {
    LS.stats[key] = conv(b.dataset.v); if (key === "missionPrev") LS.stats.missionPrevFor = prev.date;
    el.querySelectorAll(`#${box} button`).forEach(x => x.classList.toggle("sel", x === b));
  });
  if (askPrev) pick("mp", "missionPrev", v => v === "1");
  if (cands.length) pick("mi", "mission", v => v);
  $("#sv").onclick = async () => {
    const b = $("#sv"); b.disabled = true; $("#msg").textContent = "저장하는 중…";
    const minutes = Math.max(1, Math.round(((LS.stats.activeMs || 0) + Math.min(Date.now() - LS.stepAt, 10 * 60000)) / 60000));
    let r, res;
    try {
      r = await fetch(`${API}/api/complete?k=${encodeURIComponent(KEY)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: LS.n, results: LS.results, measure: LS.measure, stats: { ...LS.stats, type: LS.day.type, minutes } })
      });
      res = await r.json().catch(() => ({}));
    } catch (e) { b.disabled = false; $("#msg").textContent = `저장하지 못했어요. 연결을 확인하고 다시 누르세요. (${e.message})`; return; }
    if (r.status === 409) { // 다른 기기에서 진도가 바뀜
      clearResume(); LS = null;
      $("#msg").innerHTML = `${esc(res.error || "진도가 바뀌었어요.")} <button class="go" id="rl">새로고침</button>`; $("#rl").onclick = () => location.reload(); return;
    }
    if (!r.ok) { b.disabled = false; $("#msg").textContent = `저장하지 못했어요. 다시 눌러주세요. (${res.error || r.status})`; return; }
    track("complete", { lesson: LS.n, minutes, O: t.O, T: t.T, X: t.X, mode: LS.stats.mode }); flush();
    LS = null; clearResume();
    try { await loadAll(); }
    catch (e) { el.innerHTML = `<div class="card"><p class="ko">레슨 완료, 저장됐어요</p><p class="muted">화면을 새로 불러오지 못했어요. 새로고침해 주세요.</p><button class="go" id="rl">새로고침</button></div>`; $("#rl").onclick = () => location.reload(); return; }
    const cnt = doneToday();
    el.innerHTML = `<div class="card"><p class="ko">레슨 완료</p><p class="muted">오늘 ${cnt}레슨 완료, 연속 ${streak()}일째예요. 오늘 알림은 더 오지 않아요.</p>
      ${S.today ? `<button class="${cnt >= SOFT_PER_DAY ? "" : "go"}" id="more">레슨 ${S.n} 미리 하기</button><p class="muted">${cnt >= SOFT_PER_DAY ? "오늘 이미 많이 했어요. 하루에 몰아서 하면 기억 효과가 줄어서, 내일 하는 걸 더 추천해요." : "원하면 다음 레슨도 이어서 할 수 있어요."}</p>` : ""}</div>
      <div class="row"><button id="h" class="${S.today && cnt < SOFT_PER_DAY ? "" : "go"}">홈</button><button id="a">분석 보기</button></div>`;
    if (S.today) $("#more").onclick = () => { startLesson(); renderLearn($("#view")); }; // 완료 카드 안이 아니라 화면 전체에 새 레슨
    $("#h").onclick = () => location.hash = "home";
    $("#a").onclick = () => location.hash = "stats";
  };
}

// ---------- 기록 탭: 완료한 레슨 다시 연습 ----------
ROUTES.review = el => {
  const done = new Set(S.st.history.map(h => h.n));
  let html = `<header><h1>완료한 레슨</h1><h2>기록</h2></header>`, any = false;
  for (const w of Object.keys(S.weeks).map(Number).sort((a, b) => b - a)) {
    const days = S.weeks[w].days.filter(d => dayN(w, d.day) < S.n && d.lines && d.lines.length).sort((a, b) => b.day - a.day);
    if (!days.length) continue; any = true;
    html += `<div class="card"><h3>${w}주차 ${esc(S.weeks[w].theme)}</h3><ul class="list">${days.map(d => {
      const n = dayN(w, d.day);
      return `<li><button class="opt" data-w="${w}" data-d="${d.day}">레슨 ${n} ${esc(d.title)}${done.has(n) ? ` <span class="ok">완료</span>` : ""}</button></li>`;
    }).join("")}</ul></div>`;
  }
  if (!any) html += `<div class="card"><p class="muted">레슨을 완료하면 여기서 다시 연습할 수 있어요.</p></div>`;
  html += `<p class="muted">다시 연습한 결과는 기록에 저장되지 않아요.</p>`;
  el.innerHTML = html;
  el.querySelectorAll("[data-w]").forEach(b => b.onclick = () => {
    const w = +b.dataset.w, day = S.weeks[w].days.find(x => x.day === +b.dataset.d);
    LS = newSession(day, w, true); location.hash = "learn";
  });
};

// ---------- 표현 익히기 ----------
function study(el) {
  const C = LS.day.chunks; let i = 0;
  const show = () => {
    const c = C[i], line = (LS.day.lines || []).find(l => (l.chunks || []).includes(c.id)); let reps = 0;
    const need = LS.diff.lv === "기초" ? 5 : 2;
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${C.length}</div>
      <p class="chunk">${esc(c.en)}</p><p class="ko" style="font-size:16px">${esc(c.ko)}</p>
      ${c.use_ko ? `<p class="muted">${ic("pin", 14)} 이럴 때: ${esc(c.use_ko)}</p>` : ""}<p class="muted">${ic("bulb", 14)} ${esc(c.note)}</p>
      ${c.sound ? `<p class="muted">${ic("wave", 14)} 소리: ${esc(c.sound)}</p>` : ""}
      ${line ? `<div class="line on"><div class="sp">대화 속에서</div>${hl(line.en, [c.id])}<div class="muted">${esc(line.ko)}</div></div>` : ""}</div>
      ${(c.ex || []).length ? `<div class="card"><p class="muted">예문의 한국어를 보고 먼저 영어로 말해본 뒤 확인하세요.</p>
        ${c.ex.map((e, k) => `<div class="line"><div>${esc(e.ko)}</div><div id="e${k}"></div><button class="vbtn" style="margin-top:6px" data-e="${k}">영어 보기</button></div>`).join("")}</div>` : ""}
      <p class="muted">${LS.silent ? "표현을 속으로 세 번 읽으며 실제로 말하는 장면을 떠올려보세요." : `표현을 듣고 소리 내 따라 말하세요. ${need}번 따라 하면 넘어갈 수 있어요.`}</p>
      <button class="go" id="rep">${ic("speaker")} 듣고 따라 말하기 (0/${need})</button>`;
    el.querySelectorAll("[data-e]").forEach(b => b.onclick = () => {
      const e = c.ex[b.dataset.e]; $("#e" + b.dataset.e).innerHTML = `<div class="en" style="font-size:17px">${hl(e.en, [c.id])}</div>`;
      b.remove(); auto(e.en, "B");
    });
    const b = $("#rep");
    if (LS.silent) {
      b.textContent = i < C.length - 1 ? "속으로 세 번 읽었어요 · 다음 표현" : `속으로 세 번 읽었어요 · ${nextLabel()}`;
      b.onclick = () => { i++; i < C.length ? show() : next(); };
      return;
    }
    b.onclick = async () => {
      b.disabled = true; await speak(c.en, { who: "B" }); await sleep(1500);
      if (!$("#rep")) return;
      reps++; b.disabled = false;
      if (reps < need) b.innerHTML = `${ic("speaker")} 듣고 따라 말하기 (${reps}/${need})`;
      else { b.textContent = i < C.length - 1 ? "다음 표현" : `다음: ${nextLabel()}`; b.onclick = () => { i++; i < C.length ? show() : next(); }; }
    };
  };
  show();
}

// ---------- 드릴: 표현마다 1문제 (상황 고르기·빈칸·문장 조립을 돌아가며) ----------
function drillItems(day) {
  const C = day.chunks || [], pool = Object.values(S.chunks).filter(x => !C.some(c => c.id === x.id));
  const opts = c => shuffle([c, ...shuffle(pool.length >= 3 ? pool : C.filter(x => x !== c)).slice(0, 3)]); // 오답은 다른 날 표현에서
  return shuffle(C.map((c, k) => {
    const src = [...(day.lines || []).filter(l => (l.chunks || []).includes(c.id)), ...(c.ex || [])].find(s => findCore(s.en, c) && coreOf(c.en).length > 2);
    const kinds = ["use", "cloze", "build"], want = kinds[k % 3];
    if (want === "use" && c.use_ko) return { kind: "use", c, opts: opts(c) };
    if (want !== "build" && src) return { kind: "cloze", c, s: src, opts: opts(c) };
    return { kind: "build", c };
  }));
}
function drills(el) {
  const items = drillItems(LS.day); let i = 0;
  const title = { cloze: "빈칸에 들어갈 표현은?", use: "이 상황에 맞는 표현은?", build: "단어를 순서대로 눌러 문장을 완성하세요" };
  const rec = (kind, ok) => { const d = LS.stats.drill[kind] = LS.stats.drill[kind] || { n: 0, ok: 0 }; d.n++; if (ok) d.ok++; };
  const show = () => {
    if (i >= items.length) return next();
    const it = items[i];
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div><p class="muted">${title[it.kind]}</p><div id="q"></div><div id="res"></div></div><div id="ctl"></div>`;
    const done = (ok, ans) => {
      rec(it.kind, ok);
      $("#res").innerHTML = `<p class="ko" style="margin-top:12px;color:${ok ? "var(--o)" : "var(--x)"}">${ok ? "정답!" : "정답은"}</p><div class="en">${hl(ans, [it.c.id])}</div>`;
      auto(ans, "B");
      $("#ctl").innerHTML = `<button class="go" id="nx">${i < items.length - 1 ? "다음 문제" : `다음: ${nextLabel()}`}</button>`;
      $("#nx").onclick = () => { i++; show(); };
    };
    if (it.kind === "build") {
      const t = buildTarget(it.c);
      $("#q").innerHTML = `<p class="ko">${esc(t.ko)}</p><div id="bw"></div>`;
      buildWidget($("#bw"), t.en, ok => done(ok, t.en));
      return;
    }
    $("#q").innerHTML = (it.kind === "cloze"
      ? `<p class="en" style="font-size:18px">${esc(blank(it.s.en, it.c))}</p><p class="muted">${esc(it.s.ko)}</p>`
      : `<p class="ko">${ic("pin", 16)} ${esc(it.c.use_ko)}</p>`) + it.opts.map(o => `<button class="opt" data-id="${esc(o.id)}">${esc(o.en)}</button>`).join("");
    el.querySelectorAll("[data-id]").forEach(b => b.onclick = () => {
      const ok = b.dataset.id === it.c.id;
      el.querySelectorAll("[data-id]").forEach(x => { x.disabled = true; if (x.dataset.id === it.c.id) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      done(ok, it.kind === "cloze" ? it.s.en : it.c.en);
    });
  };
  show();
}

// ---------- 유도 롤플레이: 의도만 보고 먼저 말하기 → (힌트) → 모범 답 → 채점 ----------
function roleplay(el) {
  const R = LS.day.roleplay; let i = 0;
  const show = () => {
    const t = R.turns[i], hintIds = t.hint ? chunksIn(t.hint) : [], ids = [...new Set([...hintIds, ...chunksIn(t.model)])];
    const nxt = i < R.turns.length - 1 ? "다음 턴" : `다음: ${nextLabel()}`;
    el.innerHTML = `<div class="card"><p class="muted">${esc(R.situation_ko)}</p><div class="count">${i + 1} / ${R.turns.length}</div>
      <div class="line"><div class="sp">${esc(who("A"))}</div>${esc(t.a)}</div>
      <p class="ko" style="margin-top:14px">${esc(t.intent_ko)}</p>
      <div id="hint">${t.hint ? `<button class="vbtn" id="hb">${ic("bulb", 16)} 힌트 보기</button>` : `<p class="muted">힌트 없이 스스로 말해보는 턴이에요.</p>`}</div><div id="ans"></div></div>
      ${LS.silent ? "" : `<button id="hear">${ic("speaker")} 상대 말 다시 듣기</button>`}<div id="ctl"><button class="go" id="rv">말한 뒤 모범 답 보기</button></div>`;
    auto(t.a, vo("A"));
    if ($("#hear")) $("#hear").onclick = () => { LS.stats.replays++; speak(t.a, { who: vo("A") }); };
    let hinted = false;
    if ($("#hb")) $("#hb").onclick = () => { hinted = true; LS.stats.hints++; $("#hint").innerHTML = `<p class="muted">쓸 표현: ${esc(t.hint)}</p>`; };
    const models = `<div class="line on"><div class="sp">모범 답</div>${hl(t.model, ids)}</div>${t.model_alt ? `<div class="line"><div class="sp">이렇게 말해도 돼요</div>${esc(t.model_alt)}</div>` : ""}`;
    if (LS.silent) {
      const opts = shuffle([t.model, ...shuffle(R.turns.filter(x => x !== t).map(x => x.model)).slice(0, 2)]);
      $("#ctl").innerHTML = `<p class="muted">알맞은 대답을 고르세요.</p>` + opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join("");
      el.querySelectorAll("#ctl [data-k]").forEach(b => b.onclick = () => {
        el.querySelectorAll("#ctl [data-k]").forEach(x => { x.disabled = true; if (opts[+x.dataset.k] === t.model) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
        if (opts[+b.dataset.k] !== t.model) mark(ids, "X");
        $("#ctl").insertAdjacentHTML("beforeend", `<button class="go" id="nx">${nxt}</button>`);
        $("#nx").onclick = () => { i++; i < R.turns.length ? show() : next(); };
      });
      return;
    }
    gateReveal("rv", slow => {
      if (slow) LS.stats.slow++;
      $("#ans").innerHTML = models;
      speak(t.model, { who: "B" });
      $("#ctl").innerHTML = `<button id="ag">${ic("speaker")} 모범 답 다시 듣기</button>${gradeRow(slow)}`;
      $("#ag").onclick = () => speak(t.model, { who: "B" });
      onGrade(el, r => { mark(ids, hinted && r === "O" ? "T" : r); i++; i < R.turns.length ? show() : next(); }); // 힌트를 봤으면 최대 △
    });
  };
  show();
}


// ---------- 내 발음 녹음 비교 (내 대사만) ----------
function compareHTML(L) {
  return `<div class="card" style="margin-top:14px"><h3>${ic("mic")} 내 발음 비교</h3><p class="muted">내 대사를 녹음해서 원어민 음성과 번갈아 들어보세요. 차이가 들리는 부분이 교정 포인트예요. 녹음은 저장되지 않아요.</p>
    ${L.map((l, i) => l.sp !== "B" ? "" : `<div class="line"><div>${esc(l.en)}</div>
      <div class="row"><button data-n="${i}">${ic("speaker")} 원어민</button><button data-r="${i}">${ic("mic")} 녹음</button><button data-m="${i}" ${LS.recs[i] ? "" : "disabled"}>${ic("play")} 내 목소리</button></div></div>`).join("")}</div>`;
}
function bindCompare(L) {
  const box = $("#stage"); // 화면 전체가 아니라 이 단계 안에서만 찾기 (하단 탭도 data-r을 씀)
  box.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { stopAudio(); speak(L[b.dataset.n].en, { who: "B" }); });
  box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => playBlob(LS.recs[b.dataset.m]));
  box.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
    const i = b.dataset.r;
    if (b.rec) { const blob = await b.rec.stop(); b.rec = null; b.innerHTML = `${ic("mic")} 다시 녹음`; if (blob) { LS.recs[i] = blob; const m = box.querySelector(`[data-m="${i}"]`); if (m) m.disabled = false; } return; }
    try {
      stopAudio(); const rec = await recStart(); b.rec = rec; b.innerHTML = `${ic("stop")} 멈추기`;
      setTimeout(() => { if (b.rec === rec) b.click(); }, 10000); // 이 녹음일 때만 자동 정지
    } catch (e) { b.textContent = "마이크 권한 필요"; }
  });
}
