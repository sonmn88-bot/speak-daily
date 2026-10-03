// ===== 학습 탭 + 기록 탭 =====
const RANK = { O: 0, T: 1, X: 2 };
const MAX_PER_DAY = 2; // 하루 최대 레슨 수 (서버와 같게)
const who = sp => (sp === "A" ? (LS && LS.cast.A && LS.cast.A.name) || "A" : "나");
const vo = sp => (sp === "A" && LS && LS.cast.A && LS.cast.A.gender === "m" ? "C" : sp); // 남성 상대역은 C 음성
const nextLabel = () => (LS.steps[LS.step + 1] || [""])[0];
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
function mark(ids, r) { for (const id of ids || []) { const p = LS.results[id]; if (!p || RANK[r] > RANK[p]) LS.results[id] = r; } }

// ---------- 표현 찾기·강조 도우미 ----------
const coreOf = en => en.replace(/~/g, "").replace(/\.\.\.|…/g, "").replace(/[.?!,]+$/, "").replace(/\s+/g, " ").trim();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const findCore = (text, c) => text.toLowerCase().includes(coreOf(c.en).toLowerCase());
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
const gradeRow = () => `<div class="row"><button class="bO" data-g="O">O 바로 말함</button><button class="bT" data-g="T">△ 더듬음</button><button class="bX" data-g="X">X 못 함</button></div>`;
function onGrade(el, cb) { el.querySelectorAll("[data-g]").forEach(b => b.onclick = () => cb(b.dataset.g)); }

// 단어 조각을 눌러 문장 만들기 (자동 채점)
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

// ---------- 난이도 자동 조절: 최근 3회 결과 기준 ----------
function difficulty() {
  const H = S.st.history.filter(h => h.results && Object.keys(h.results).length).slice(-3);
  if (H.length < 3) return { lv: "보통", why: "기록 3회가 쌓이면 자동 조절돼요." };
  const rates = H.map(h => { const v = Object.values(h.results); return v.filter(r => r === "O").length / v.length; });
  const avgR = rates.reduce((a, b) => a + b, 0) / 3;
  if (rates.every(r => r >= 0.9)) return { lv: "도전", why: "최근 3회 모두 O 90% 이상: 빠른 재생, 5초 안에 말하기" };
  if (avgR < 0.6) return { lv: "기초", why: "최근 3회 평균 O 60% 미만: 따라 말하기 5번, 재도전 기회 증가" };
  return { lv: "보통", why: `최근 3회 평균 O ${Math.round(avgR * 100)}%` };
}


// ---------- 세션 만들기 ----------
function testList(day) {
  const own = day.chunks && day.chunks.length ? day.chunks.map(c => c.id)
    : [...new Set((day.lines || []).flatMap(l => l.chunks || []))].slice(0, 10);
  let ids = own.filter(id => S.chunks[id]);
  if (day.chunks && day.chunks.length) { // 지난 표현 2~3개 섞기
    const srs = S.st.srs;
    const old = Object.keys(srs).filter(id => S.chunks[id] && !own.includes(id) && !srs[id].grad)
      .sort((a, b) => srs[a].level - srs[b].level || (srs[a].due < srs[b].due ? -1 : 1)).slice(0, 3);
    ids = ids.concat(old);
  }
  return shuffle(ids.map(id => S.chunks[id]));
}
function newSession(day, w, practice) {
  const n = dayN(w, day.day), dw = day.day, monthly = w % 4 === 0 && dw >= 6;
  const s = { id: `${w}-${dw}${practice ? "p" : ""}`, w, n, day, practice,
    cast: day.cast || (S.weeks[w] || {}).cast || {}, theme: (S.weeks[w] || {}).theme || "",
    step: 0, results: {}, measure: null, steps: [], due: [], recs: {},
    stats: { start: Date.now(), listenTries: 0, listenPlays: 0, hints: 0, replays: 0, drill: {}, mode: "voice" } };
  s.diff = difficulty(); s.stats.level = s.diff.lv;
  if (!practice) {
    const srs = S.st.srs, cap = day.type !== "learn" || monthly ? 20 : 8;
    s.due = Object.entries(srs)
      .filter(([id, it]) => it.due <= S.st.date && (!it.grad || monthly) && S.chunks[id])
      .sort((a, b) => (a[1].due < b[1].due ? -1 : 1)).map(([id]) => S.chunks[id]).slice(0, cap);
    if (day.type !== "learn" && s.due.length < cap) {
      const have = new Set(s.due.map(c => c.id));
      const extra = Object.values(S.chunks).filter(c => !have.has(c.id) && srs[c.id]).sort((a, b) => srs[a.id].level - srs[b.id].level);
      s.due = s.due.concat(extra.slice(0, cap - s.due.length));
    }
    if (s.due.length) s.steps.push(["워밍업", warmup]);
  }
  const hasLines = day.lines && day.lines.length;
  if (hasLines) s.steps.push(["듣기", listen]);
  if (day.chunks && day.chunks.length) s.steps.push(["표현", study], ["드릴", drills]);
  if (hasLines) s.steps.push(["섀도잉", shadow], ["인출", recall]);
  if (day.roleplay) s.steps.push(["롤플레이", roleplay]);
  if (day.improv && day.improv.length) s.steps.push(["즉흥", improv]);
  if (!practice && (day.type === "review_cum" || (monthly && dw === 7))) s.steps.push(["측정", measure]);
  s.test = testList(day);
  if (s.test.length) s.steps.push(["마무리", finalTest]);
  s.steps.push(["완료", finish]);
  return s;
}

ROUTES.learn = el => {
  if (LS && (LS.practice || LS.n === S.n)) return renderLearn(el);
  if (!S.today) { el.innerHTML = `<div class="card"><p class="ko">레슨 ${S.n} 콘텐츠가 아직 올라오지 않았어요.</p><p class="muted">${S.week}주차 ${S.dw}일 자료를 기다리는 중이에요.</p></div>`; return; }
  const t = S.st.today, cnt = t.lessons || (t.done ? 1 : 0);
  if (t.done && cnt >= MAX_PER_DAY) {
    el.innerHTML = `<header><h1>레슨 ${S.n - 1}까지 완료</h1><h2>오늘은 여기까지</h2></header>
      <div class="card"><p class="muted">오늘 ${cnt}레슨을 마쳤어요. 간격을 두고 복습해야 기억에 오래 남아서, 하루 최대 ${MAX_PER_DAY}레슨까지만 진행해요. 기록 탭에서 지난 대화를 다시 연습할 수 있어요.</p>
      <button class="go" id="rv">기록 탭으로</button></div>`;
    $("#rv").onclick = () => location.hash = "review"; return;
  }
  if (t.done) {
    el.innerHTML = `<header><h1>오늘 ${cnt}레슨 완료</h1><h2>다음 레슨도 할까요?</h2></header>
      <div class="card"><p class="muted">오늘 과제는 끝났고 알림도 멈췄어요. 놓친 진도를 채우고 싶을 때만 다음 레슨을 이어서 하세요. 진도에 반영돼요.</p>
      <button class="go" id="more">레슨 ${S.n} 이어서 하기</button><button id="rv">기록 탭에서 복습하기</button></div>`;
    $("#more").onclick = () => { LS = newSession(S.today, S.week, false); renderLearn(el); };
    $("#rv").onclick = () => location.hash = "review"; return;
  }
  LS = newSession(S.today, S.week, false);
  renderLearn(el);
};

function renderLearn(el) {
  stopAudio(); RUN++;
  if (LS.lastStep != null && LS.lastStep !== LS.step)
    track("step", { lesson: LS.n, name: LS.steps[LS.lastStep][0], ms: Date.now() - LS.stepAt, practice: LS.practice });
  if (LS.lastStep !== LS.step) { LS.stepAt = Date.now(); LS.lastStep = LS.step; }
  const [, fn] = LS.steps[LS.step];
  el.innerHTML = `<header><h1>레슨 ${LS.n} ${esc(LS.theme)}${LS.practice ? " (연습 모드)" : ""}</h1><h2>${esc(LS.day.title)}</h2></header>
    <p class="muted" style="margin-top:-8px">난이도 ${LS.diff.lv}</p>
    <nav class="map" aria-label="진행 단계">${LS.steps.map(([t], i) => `<div class="st ${i < LS.step ? "pass" : i === LS.step ? "cur" : ""}"><i></i>${t}</div>`).join("")}</nav>
    <button class="vbtn" id="vbtn">🔊 음성 설정</button><div id="vp"></div><section id="stage"></section>`;
  $("#vbtn").onclick = () => voicePanel($("#vp"));
  fn($("#stage"));
  window.scrollTo(0, 0);
}
const next = () => { LS.step++; renderLearn($("#view")); };

// ---------- 대화 인출 (연습용, 기록 안 함) ----------
function recall(el) {
  const L = LS.day.lines, items = [], audio = LS.diff.lv === "도전";
  L.forEach((l, i) => { if (l.sp === "B") items.push({ ko: l.ko, en: l.en, ids: l.chunks, ctx: i > 0 ? `${who("A")}: ${L[i - 1].en}` : "", ctxEn: i > 0 ? L[i - 1].en : "" }); });
  let i = 0;
  const show = () => {
    const it = items[i], aud = audio && it.ctxEn;
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div>
      ${aud ? `<p class="muted">글자 없이 상대 말을 듣고, 내 대사를 영어로 말하세요.</p><button id="ctxp">🔊 상대 말 듣기</button>`
            : `${it.ctx ? `<p class="muted">${esc(it.ctx)}</p>` : ""}<p class="ko">${esc(it.ko)}</p>`}<div id="ans"></div></div>
      <p class="muted">영어로 소리 내 말한 다음 정답을 확인하세요.</p><div id="ctl"><button class="go" id="reveal">정답 보기</button></div>`;
    if (aud) { $("#ctxp").onclick = () => { LS.stats.replays++; speak(it.ctxEn, { who: vo("A") }); }; speak(it.ctxEn, { who: vo("A") }); }
    else pressure("reveal");
    $("#reveal").onclick = () => {
      $("#ans").innerHTML = `${aud ? `<p class="muted">${esc(it.ko)}</p>` : ""}<div class="en">${hl(it.en, it.ids)}</div>`;
      speak(it.en, { who: "B" });
      $("#ctl").innerHTML = `<button id="again">🔊 다시 듣기</button>${gradeRow()}`;
      $("#again").onclick = () => { LS.stats.replays++; speak(it.en, { who: "B" }); };
      onGrade(el, () => { i++; i < items.length ? show() : next(); });
    };
  };
  show();
}

// ---------- 워밍업·마무리: 말하기와 문장 조립을 섞어 출제, 틀리면 다시 ----------
function quiz(el, list, onDone) {
  const q = list.map(c => ({ c, tries: 0, fmt: Math.random() < 0.35 ? "build" : "speak" })), first = {};
  const show = () => {
    if (!q.length) return onDone();
    const it = q[0], c = it.c;
    el.innerHTML = `<div class="card"><div class="count">남은 문제 ${q.length}</div><div id="q"></div><div id="ans"></div></div><div id="ctl"></div>`;
    const grade = r => {
      if (!(c.id in first)) { first[c.id] = r; mark([c.id], r); }
      q.shift(); it.tries++;
      if (r !== "O" && it.tries < (LS.diff.lv === "기초" ? 4 : 3)) { it.fmt = "speak"; q.splice(Math.min(2, q.length), 0, it); }
      show();
    };
    if (it.fmt === "build") {
      const t = buildTarget(c);
      $("#q").innerHTML = `<p class="muted">단어를 순서대로 눌러 문장을 완성하세요.</p><p class="ko">${esc(t.ko)}</p><div id="bw"></div>`;
      buildWidget($("#bw"), t.en, ok => {
        $("#ans").innerHTML = `<p class="ko" style="color:${ok ? "var(--o)" : "var(--x)"}">${ok ? "정답!" : "정답은"}</p><div class="en">${hl(t.en, [c.id])}</div>`;
        speak(t.en, { who: "B" });
        $("#ctl").innerHTML = `<button class="go" id="nx">다음</button>`; $("#nx").onclick = () => grade(ok ? "O" : "X");
      });
      return;
    }
    $("#q").innerHTML = `<p class="muted">힌트 없이 영어로 말해보세요. 틀린 표현은 조금 뒤에 다시 나와요.</p><p class="ko">${esc(c.ko)}</p>`;
    $("#ctl").innerHTML = `<button class="go" id="rv">정답 보기</button>`; pressure("rv");
    $("#rv").onclick = () => {
      $("#ans").innerHTML = `<div class="en">${esc(c.en)}</div>${c.sound ? `<p class="muted">🗣 ${esc(c.sound)}</p>` : ""}`;
      speak(c.en, { who: "B" }); $("#ctl").innerHTML = gradeRow(); onGrade(el, grade);
    };
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
    <button class="go" id="play">▶ 대화 듣기</button><div id="q"></div></div>`;
  $("#play").onclick = async () => {
    const b = $("#play"); b.disabled = true; await playAll(1);
    if (!$("#play")) return; b.disabled = false; b.textContent = "▶ 다시 듣기";
    if (!asked) { asked = true; showQ(); }
  };
  function showQ() {
    const q = d.listen_q;
    $("#q").innerHTML = `<p class="ko" style="margin-top:18px">${esc(q.q)}</p>${q.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}<p class="muted" id="fb"></p>`;
    $("#q").querySelectorAll(".opt").forEach(b => b.onclick = () => {
      LS.stats.listenTries++;
      if (+b.dataset.i !== q.answer) { b.classList.add("wrong"); b.disabled = true; $("#fb").textContent = "다시 들어보고 골라보세요."; return; }
      $("#q").innerHTML = `<p class="ko" style="margin-top:18px">정답이에요.</p>${d.pragmatic ? `<p class="muted">💡 ${esc(d.pragmatic)}</p>` : ""}
        <p class="muted" style="margin-top:14px">대본: 표시된 부분이 오늘 표현이에요. 문맥 속에서 어떻게 쓰였는지 보세요.</p>
        ${d.lines.map(l => `<div class="line"><div class="sp">${esc(who(l.sp))}</div>${hl(l.en, l.chunks)}<div class="muted">${esc(l.ko)}</div></div>`).join("")}
        <button class="go" id="nx">다음: ${nextLabel()}</button>`;
      $("#nx").onclick = next;
    });
  }
}

// ---------- 섀도잉 ----------
function shadow(el) {
  const L = LS.day.lines; let pass = 0, rate = LS.diff.lv === "도전" ? 1.15 : 1;
  el.innerHTML = `<div class="card"><p class="muted">한 줄 듣고, 멈추는 동안 똑같이 따라 말하세요. 어려우면 끝나고 천천히 한 번 더 할 수 있어요.</p>
    ${L.map((l, i) => `<div class="line" id="l${i}"><div class="sp">${esc(who(l.sp))}</div><div>${esc(l.en)}</div><div class="muted">${esc(l.ko)}</div></div>`).join("")}</div>
    <button class="go" id="go">▶ 따라 말하기 시작</button><div id="slow"></div>`;
  const b = $("#go");
  const run = async () => {
    const r = RUN; b.disabled = true; $("#slow").innerHTML = "";
    for (let i = 0; i < L.length; i++) {
      if (r !== RUN) return;
      el.querySelectorAll(".line").forEach(x => x.classList.remove("on"));
      const le = $("#l" + i); le.classList.add("on"); le.scrollIntoView({ block: "center", behavior: "smooth" });
      const t0 = Date.now();
      await speak(L[i].en, { rate, who: vo(L[i].sp) });
      await sleep(Math.max(1200, (Date.now() - t0) * 1.1 + 500)); // 따라 말할 시간
    }
    if (r !== RUN) return;
    pass++; b.disabled = false;
    b.textContent = `다음: ${nextLabel()}`; b.onclick = next;
    $("#slow").innerHTML = `<button id="sl">🐢 0.8배로 한 번 더</button>${compareHTML(L)}`;
    $("#sl").onclick = () => { rate = 0.8; run(); };
    bindCompare(L);
  };
  b.onclick = run;
}

// ---------- 즉흥 ----------
function countdown(sec, el) {
  const r = RUN;
  return new Promise(async res => {
    for (let s = sec; s > 0; s--) { if (r !== RUN) return; el.textContent = s; await sleep(1000); }
    el.textContent = "0"; res();
  });
}
function improv(el) {
  const it = LS.day.improv[0], rounds = [90, 60, 45]; let k = 0;
  el.innerHTML = `<div class="card"><p class="ko">${esc(it.situation_ko)}</p><p class="en">“${esc(it.starter_en)}”</p><button id="hear">🔊 상대 말 듣기</button></div>
    <div class="card"><p class="muted">같은 내용을 점점 짧은 시간 안에 말해요. 막혀도 멈추지 말고 아는 표현으로 돌려 말하세요.</p>
    <div class="timer" id="tm">${rounds[0]}</div><button class="go" id="go">▶ ${rounds[0]}초 시작</button></div>`;
  $("#hear").onclick = () => speak(it.starter_en, { who: vo("A") });
  const b = $("#go");
  b.onclick = async () => {
    if (k >= rounds.length) return next();
    b.disabled = true; await countdown(rounds[k], $("#tm"));
    if (!$("#go")) return;
    k++; b.disabled = false;
    if (k < rounds.length) { b.textContent = `▶ ${rounds[k]}초 시작`; $("#tm").textContent = rounds[k]; }
    else b.textContent = `다음: ${nextLabel()}`;
  };
}

// ---------- 60초 측정 ----------
function measure(el) {
  let conf = 0;
  el.innerHTML = `<div class="card"><p class="ko">60초 자유 발화</p>
    <p class="muted">이번 주에 있었던 일을 배운 표현을 최대한 넣어 60초 동안 말하세요. 폰 음성 메모로 녹음해두면 나중에 비교할 수 있어요.</p>
    <div class="timer" id="tm">60</div><button class="go" id="go">▶ 60초 시작</button></div>
    <div class="card"><label>3초 넘게 멈춘 횟수<input id="p" type="number" inputmode="numeric" min="0"></label>
    <label>이번 주 표현을 쓴 개수<input id="u" type="number" inputmode="numeric" min="0"></label>
    <label>자신감 (1~5)</label><div class="row" id="cf">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div></div>
    <button class="go" id="sv" disabled>기록하고 다음으로</button>`;
  $("#go").onclick = async () => { $("#go").disabled = true; await countdown(60, $("#tm")); if ($("#go")) $("#go").disabled = false; };
  const check = () => { $("#sv").disabled = !(conf && $("#p").value !== "" && $("#u").value !== ""); };
  $("#p").oninput = $("#u").oninput = check;
  el.querySelectorAll("#cf button").forEach(b => b.onclick = () => {
    conf = +b.dataset.v; el.querySelectorAll("#cf button").forEach(x => x.classList.toggle("go", x === b)); check();
  });
  $("#sv").onclick = () => { LS.measure = { pauses: +$("#p").value, used: +$("#u").value, confidence: conf }; next(); };
}


// ---------- 완료 ----------
function finish(el) {
  const t = { O: 0, T: 0, X: 0 }; Object.values(LS.results).forEach(r => t[r]++);
  if (LS.practice) {
    el.innerHTML = `<div class="card"><p class="ko">연습 끝</p><p class="muted">연습은 기록에 저장되지 않아요. O ${t.O} / △ ${t.T} / X ${t.X}</p></div>
      <button class="go" id="home">홈으로</button>`;
    $("#home").onclick = () => { LS = null; location.hash = "home"; };
    return;
  }
  const prev = [...S.st.history].reverse().find(h => h.date < S.st.date && h.stats && h.stats.mission);
  const askPrev = prev && !S.st.history.some(h => h.stats && h.stats.missionPrevFor === prev.date);
  const cands = (LS.day.chunks && LS.day.chunks.length ? LS.day.chunks : LS.test).slice(0, 5);
  el.innerHTML = `<div class="card"><p class="ko">기록을 저장하면 오늘 알림이 멈춰요.</p><p class="muted">O ${t.O} / △ ${t.T} / X ${t.X}</p></div>
    ${askPrev ? `<div class="card"><h3>지난 실전 미션</h3><p class="muted">"${esc(prev.stats.mission)}"를 실제 대화나 혼잣말로 써봤나요?</p>
      <div class="row" id="mp"><button data-v="1">써봤다</button><button data-v="0">못 썼다</button></div></div>` : ""}
    ${cands.length ? `<div class="card"><h3>오늘의 실전 미션</h3><p class="muted">다음 학습 전까지 실제로 한 번 써볼 표현을 고르세요. 누군가에게 말하거나, 혼잣말로 상황을 만들어 써도 돼요.</p>
      <div class="pills" id="mi">${cands.map(c => `<button class="pill" data-v="${esc(c.en)}">${esc(c.en)}</button>`).join("")}</div></div>` : ""}
    <button class="go" id="sv">레슨 ${LS.n} 완료</button><p class="muted" id="msg"></p>`;
  const pick = (box, key, conv) => el.querySelectorAll(`#${box} button`).forEach(b => b.onclick = () => {
    LS.stats[key] = conv(b.dataset.v); if (key === "missionPrev") LS.stats.missionPrevFor = prev.date;
    el.querySelectorAll(`#${box} button`).forEach(x => x.classList.toggle("go", x === b));
  });
  if (askPrev) pick("mp", "missionPrev", v => v === "1");
  if (cands.length) pick("mi", "mission", v => v);
  $("#sv").onclick = async () => {
    const b = $("#sv"); b.disabled = true; $("#msg").textContent = "저장하는 중…";
    try {
      const minutes = Math.round((Date.now() - LS.stats.start) / 60000);
      const r = await fetch(`${API}/api/complete?k=${encodeURIComponent(KEY)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: LS.n, results: LS.results, measure: LS.measure, stats: { ...LS.stats, type: LS.day.type, minutes } })
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(res.error || r.status);
      track("complete", { lesson: LS.n, minutes, O: t.O, T: t.T, X: t.X, mode: LS.stats.mode }); flush();
      LS = null;
      await loadAll();
      const cnt = S.st.today.lessons || 1, can = cnt < MAX_PER_DAY && S.today;
      el.innerHTML = `<div class="card"><p class="ko">레슨 완료</p><p class="muted">오늘 ${cnt}레슨 완료, 연속 ${streak()}일째예요. 오늘 알림은 더 오지 않아요.</p>
        ${can ? `<button class="go" id="more">레슨 ${S.n} 이어서 하기</button><p class="muted">놓친 진도를 채울 때만 추천해요. 하루 최대 ${MAX_PER_DAY}레슨.</p>` : ""}</div>
        <div class="row"><button id="h">홈</button><button id="a">분석 보기</button></div>`;
      if (can) $("#more").onclick = () => { LS = newSession(S.today, S.week, false); renderLearn(el); };
      $("#h").onclick = () => location.hash = "home";
      $("#a").onclick = () => location.hash = "stats";
    } catch (e) { b.disabled = false; $("#msg").textContent = `저장하지 못했어요. (${e.message})`; }
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
      return `<li><button class="opt" data-w="${w}" data-d="${d.day}">레슨 ${n} ${esc(d.title)} ${done.has(n) ? "✅" : ""}</button></li>`;
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
    const need = LS.diff.lv === "기초" ? 5 : 3;
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${C.length}</div>
      <p style="font-size:26px;font-weight:800;margin:0">${esc(c.en)}</p><p class="ko" style="font-size:16px">${esc(c.ko)}</p>
      ${c.use_ko ? `<p class="muted">📍 이럴 때: ${esc(c.use_ko)}</p>` : ""}<p class="muted">💡 ${esc(c.note)}</p>
      ${c.sound ? `<p class="muted">🗣 소리: ${esc(c.sound)}</p>` : ""}
      ${line ? `<div class="line on"><div class="sp">대화 속에서</div>${hl(line.en, [c.id])}<div class="muted">${esc(line.ko)}</div></div>` : ""}</div>
      ${(c.ex || []).length ? `<div class="card"><p class="muted">예문의 한국어를 보고 먼저 영어로 말해본 뒤 확인하세요.</p>
        ${c.ex.map((e, k) => `<div class="line"><div>${esc(e.ko)}</div><div id="e${k}"></div><button class="vbtn" style="margin-top:6px" data-e="${k}">영어 보기</button></div>`).join("")}</div>` : ""}
      <p class="muted">표현을 듣고 소리 내 따라 말하세요. ${need}번 따라 하면 넘어갈 수 있어요.</p>
      <button class="go" id="rep">🔊 듣고 따라 말하기 (0/${need})</button>`;
    el.querySelectorAll("[data-e]").forEach(b => b.onclick = () => {
      const e = c.ex[b.dataset.e]; $("#e" + b.dataset.e).innerHTML = `<div class="en" style="font-size:17px">${hl(e.en, [c.id])}</div>`;
      b.remove(); speak(e.en, { who: "B" });
    });
    const b = $("#rep");
    b.onclick = async () => {
      b.disabled = true; await speak(c.en, { who: "B" }); await sleep(1500);
      if (!$("#rep")) return;
      reps++; b.disabled = false;
      if (reps < need) b.textContent = `🔊 듣고 따라 말하기 (${reps}/${need})`;
      else { b.textContent = i < C.length - 1 ? "다음 표현" : `다음: ${nextLabel()}`; b.onclick = () => { i++; i < C.length ? show() : next(); }; }
    };
  };
  show();
}

// ---------- 드릴: 빈칸 고르기, 상황 고르기, 문장 조립 ----------
function drillItems(day) {
  const C = day.chunks || [], pool = Object.values(S.chunks).filter(x => !C.some(c => c.id === x.id));
  const opts = c => shuffle([c, ...shuffle(pool).slice(0, 3)]); // 오답은 다른 날 표현에서 (비슷한 표현끼리 헷갈리지 않게)
  const items = [];
  C.forEach((c, k) => {
    const src = [...(day.lines || []).filter(l => (l.chunks || []).includes(c.id)), ...(c.ex || [])].find(s => findCore(s.en, c) && coreOf(c.en).length > 2);
    if (src) items.push({ kind: "cloze", c, s: src, opts: opts(c) });
    items.push(k % 2 === 0 && c.use_ko ? { kind: "use", c, opts: opts(c) } : { kind: "build", c });
  });
  return shuffle(items);
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
      speak(ans, { who: "B" });
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
      : `<p class="ko">📍 ${esc(it.c.use_ko)}</p>`) + it.opts.map(o => `<button class="opt" data-id="${o.id}">${esc(o.en)}</button>`).join("");
    el.querySelectorAll("[data-id]").forEach(b => b.onclick = () => {
      const ok = b.dataset.id === it.c.id;
      el.querySelectorAll("[data-id]").forEach(x => { x.disabled = true; if (x.dataset.id === it.c.id) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      done(ok, it.kind === "cloze" ? it.s.en : it.c.en);
    });
  };
  show();
}

// ---------- 유도 롤플레이: 의도만 보고 먼저 시도, 막히면 힌트 ----------
function roleplay(el) {
  const R = LS.day.roleplay; let i = 0;
  const show = () => {
    const t = R.turns[i];
    el.innerHTML = `<div class="card"><p class="muted">${esc(R.situation_ko)}</p><div class="count">${i + 1} / ${R.turns.length}</div>
      <div class="line"><div class="sp">${esc(who("A"))}</div>${esc(t.a)}</div>
      <p class="ko" style="margin-top:14px">${esc(t.intent_ko)}</p><div id="hint"><button class="vbtn" id="hb">💡 힌트 보기</button></div><div id="ans"></div></div>
      <button id="hear">🔊 상대 말 다시 듣기</button><div id="ctl"><button class="go" id="rv">말한 뒤 모범 답 보기</button></div>`;
    speak(t.a, { who: vo("A") });
    $("#hear").onclick = () => { LS.stats.replays++; speak(t.a, { who: vo("A") }); };
    $("#hb").onclick = () => {
      LS.stats.hints++; $("#hint").innerHTML = `<p class="muted">쓸 표현: ${esc(t.hint)}</p>`;
      mark((LS.day.chunks || []).filter(c => findCore(t.hint, c)).map(c => c.id), "T"); // 힌트를 본 표현은 복습에 △로 반영
    };
    $("#rv").onclick = () => {
      $("#ans").innerHTML = `<div class="line on"><div class="sp">모범 답</div>${esc(t.model)}</div>`;
      speak(t.model, { who: "B" });
      $("#ctl").innerHTML = `<button id="ag">🔊 모범 답 다시 듣기</button><button class="go" id="nx">${i < R.turns.length - 1 ? "다음 턴" : `다음: ${nextLabel()}`}</button>`;
      $("#ag").onclick = () => speak(t.model, { who: "B" });
      $("#nx").onclick = () => { i++; i < R.turns.length ? show() : next(); };
    };
  };
  show();
}

// 도전 난이도: 5초 안에 말하지 못하면 정답이 자동으로 열림
function pressure(btnId) {
  if (LS.diff.lv !== "도전") return;
  const b = $("#" + btnId), label = b.textContent; let s = 5;
  const tick = () => { if (!b.isConnected) return; if (s <= 0) return b.click(); b.textContent = `${label} (${s})`; s--; setTimeout(tick, 1000); };
  tick();
}


// ---------- 내 발음 녹음 비교 (내 대사만) ----------
function compareHTML(L) {
  return `<div class="card" style="margin-top:14px"><h3>🎙 내 발음 비교</h3><p class="muted">내 대사를 녹음해서 원어민 음성과 번갈아 들어보세요. 차이가 들리는 부분이 교정 포인트예요. 녹음은 저장되지 않아요.</p>
    ${L.map((l, i) => l.sp !== "B" ? "" : `<div class="line"><div>${esc(l.en)}</div>
      <div class="row"><button data-n="${i}">🔊 원어민</button><button data-r="${i}">🎙 녹음</button><button data-m="${i}" ${LS.recs[i] ? "" : "disabled"}>▶ 내 목소리</button></div></div>`).join("")}</div>`;
}
function bindCompare(L) {
  document.querySelectorAll("[data-n]").forEach(b => b.onclick = () => { stopAudio(); speak(L[b.dataset.n].en, { who: "B" }); });
  document.querySelectorAll("[data-m]").forEach(b => b.onclick = () => playBlob(LS.recs[b.dataset.m]));
  document.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
    const i = b.dataset.r;
    if (b.rec) { const blob = await b.rec.stop(); b.rec = null; b.textContent = "🎙 다시 녹음"; if (blob) { LS.recs[i] = blob; document.querySelector(`[data-m="${i}"]`).disabled = false; } return; }
    try { stopAudio(); b.rec = await recStart(); b.textContent = "⏹ 멈추기"; setTimeout(() => b.rec && b.click(), 10000); }
    catch (e) { b.textContent = "마이크 권한 필요"; }
  });
}
