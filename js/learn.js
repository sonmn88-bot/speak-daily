// ===== 학습 탭 + 기록 탭 =====
const RANK = { O: 0, T: 1, X: 2 };
const who = sp => (sp === "A" ? (LS && LS.cast.A && LS.cast.A.name) || "A" : "나");
const vo = sp => (sp === "A" && LS && LS.cast.A && LS.cast.A.gender === "m" ? "C" : sp); // 남성 상대역은 C 음성
const nextLabel = () => (LS.steps[LS.step + 1] || [""])[0];
function mark(ids, r) { for (const id of ids || []) { const p = LS.results[id]; if (!p || RANK[r] > RANK[p]) LS.results[id] = r; } }

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
function newSession(day, w, practice) {
  const s = { id: `${w}-${day.day}${practice ? "p" : ""}`, w, n: dayN(w, day.day), day, practice,
    cast: day.cast || (S.weeks[w] || {}).cast || {}, theme: (S.weeks[w] || {}).theme || "",
    step: 0, results: {}, stats: { start: Date.now(), listenTries: 0 }, measure: null, steps: [], due: [], recs: {} };
  s.diff = difficulty(); s.stats.level = s.diff.lv;
  if (!practice) {
    const srs = S.st.srs, cap = day.type !== "learn" || S.monthly ? 20 : 8;
    s.due = Object.entries(srs)
      .filter(([id, it]) => it.due <= S.st.date && (!it.grad || S.monthly) && S.chunks[id])
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
  if (day.chunks && day.chunks.length) s.steps.push(["표현", study]);
  if (hasLines) s.steps.push(["섀도잉", shadow], ["인출", recall]);
  if (day.roleplay) s.steps.push(["롤플레이", roleplay]);
  if (day.improv && day.improv.length) s.steps.push(["즉흥", improv]);
  if (!practice && (day.type === "review_cum" || (S.monthly && S.dw === 7))) s.steps.push(["측정", measure]);
  if (testItems(day).length) s.steps.push(["마무리", finalTest]);
  s.steps.push(["완료", finish]);
  return s;
}

ROUTES.learn = el => {
  const todayId = `${S.week}-${S.dw}`;
  if (LS && (LS.practice || LS.id === todayId)) return renderLearn(el);
  if (!S.today) { el.innerHTML = `<div class="card"><p class="ko">오늘 콘텐츠가 아직 올라오지 않았어요.</p><p class="muted">${S.week}주차 ${S.dw}일 자료를 기다리는 중이에요.</p></div>`; return; }
  if (S.st.today.done) {
    el.innerHTML = `<header><h1>D+${S.n}</h1><h2>오늘 학습 완료</h2></header>
      <div class="card"><p class="muted">오늘 알림은 더 오지 않아요. 같은 대화를 다시 연습할 수 있어요. 연습은 기록에 저장되지 않아요.</p>
      <button class="go" id="again">오늘 대화 다시 연습</button></div>`;
    $("#again").onclick = () => { LS = newSession(S.today, S.week, true); renderLearn(el); };
    return;
  }
  LS = newSession(S.today, S.week, false);
  renderLearn(el);
};

function renderLearn(el) {
  stopAudio(); RUN++;
  const [, fn] = LS.steps[LS.step];
  el.innerHTML = `<header><h1>D+${LS.n} ${esc(LS.theme)}${LS.practice ? " (연습 모드)" : ""}</h1><h2>${esc(LS.day.title)}</h2></header>
    <p class="muted" style="margin-top:-8px">난이도 ${LS.diff.lv}</p>
    <nav class="map" aria-label="진행 단계">${LS.steps.map(([t], i) => `<div class="st ${i < LS.step ? "pass" : i === LS.step ? "cur" : ""}"><i></i>${t}</div>`).join("")}</nav>
    <button class="vbtn" id="vbtn">🔊 음성 설정</button><div id="vp"></div><section id="stage"></section>`;
  $("#vbtn").onclick = () => voicePanel($("#vp"));
  fn($("#stage"));
  window.scrollTo(0, 0);
}
const next = () => { LS.step++; renderLearn($("#view")); };

// 도전 난이도: 5초 안에 말하지 못하면 정답이 자동으로 열림
function pressure(btnId) {
  if (LS.diff.lv !== "도전") return;
  const b = $("#" + btnId), label = b.textContent; let s = 5;
  const tick = () => { if (!b.isConnected) return; if (s <= 0) return b.click(); b.textContent = `${label} (${s})`; s--; setTimeout(tick, 1000); };
  tick();
}

// ---------- 한국어 → 영어 인출 카드 ----------
function drill(el, items, onDone, record = true) {
  let i = 0;
  const show = () => {
    const it = items[i];
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div>
      ${it.ctx ? `<p class="muted">${esc(it.ctx)}</p>` : ""}<p class="ko">${esc(it.ko)}</p><div id="ans"></div></div>
      <p class="muted">영어로 소리 내 말한 다음 정답을 확인하세요.</p><div id="ctl"><button class="go" id="reveal">정답 보기</button></div>`;
    pressure("reveal");
    $("#reveal").onclick = () => {
      $("#ans").innerHTML = `<div class="en">${esc(it.en)}</div>`;
      speak(it.en, { who: "B" });
      $("#ctl").innerHTML = `<button id="again">🔊 다시 듣기</button>
        <div class="row"><button class="bO" data-r="O">O 바로 말함</button><button class="bT" data-r="T">△ 더듬음</button><button class="bX" data-r="X">X 못 함</button></div>`;
      $("#again").onclick = () => speak(it.en, { who: "B" });
      el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { if (record) mark(it.ids, b.dataset.r); i++; i < items.length ? show() : onDone(); });
    };
  };
  show();
}
function warmup(el) { drill(el, LS.due.map(c => ({ ko: c.ko, en: c.en, ids: [c.id] })), next); }
function recall(el) {
  const L = LS.day.lines, items = [];
  L.forEach((l, i) => { if (l.sp === "B") items.push({ ko: l.ko, en: l.en, ids: l.chunks, ctx: i > 0 ? `${who("A")}: ${L[i - 1].en}` : "" }); });
  drill(el, items, next, false);
}

// ---------- 듣기 ----------
async function playAll(rate) {
  const r = RUN;
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
      if (+b.dataset.i === q.answer) {
        $("#q").innerHTML = `<p class="ko" style="margin-top:18px">정답이에요.</p>${d.pragmatic ? `<p class="muted">💡 ${esc(d.pragmatic)}</p>` : ""}<button class="go" id="nx">다음: ${nextLabel()}</button>`;
        $("#nx").onclick = next;
      } else { b.classList.add("wrong"); b.disabled = true; $("#fb").textContent = "다시 들어보고 골라보세요."; }
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
  const cands = (LS.day.chunks && LS.day.chunks.length ? LS.day.chunks : testItems(LS.day).map(id => S.chunks[id])).slice(0, 5);
  el.innerHTML = `<div class="card"><p class="ko">기록을 저장하면 오늘 알림이 멈춰요.</p><p class="muted">O ${t.O} / △ ${t.T} / X ${t.X}</p></div>
    ${askPrev ? `<div class="card"><h3>어제의 실전 미션</h3><p class="muted">"${esc(prev.stats.mission)}"를 실제 대화나 혼잣말로 써봤나요?</p>
      <div class="row" id="mp"><button data-v="1">써봤다</button><button data-v="0">못 썼다</button></div></div>` : ""}
    ${cands.length ? `<div class="card"><h3>오늘의 실전 미션</h3><p class="muted">내일까지 실제로 한 번 써볼 표현을 하나 고르세요. 누군가에게 말하거나, 혼잣말로 상황을 만들어 써도 돼요.</p>
      <div class="pills" id="mi">${cands.map(c => `<button class="pill" data-v="${esc(c.en)}">${esc(c.en)}</button>`).join("")}</div></div>` : ""}
    <button class="go" id="sv">오늘 학습 완료</button><p class="muted" id="msg"></p>`;
  const pick = (box, key, conv) => el.querySelectorAll(`#${box} button`).forEach(b => b.onclick = () => {
    LS.stats[key] = conv(b.dataset.v); if (key === "missionPrev") LS.stats.missionPrevFor = prev.date;
    el.querySelectorAll(`#${box} button`).forEach(x => x.classList.toggle("go", x === b));
  });
  if (askPrev) pick("mp", "missionPrev", v => v === "1");
  if (cands.length) pick("mi", "mission", v => v);
  $("#sv").onclick = async () => {
    const b = $("#sv"); b.disabled = true; $("#msg").textContent = "저장하는 중…";
    try {
      const r = await fetch(`${API}/api/complete?k=${encodeURIComponent(KEY)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: LS.results, measure: LS.measure,
          stats: { ...LS.stats, type: LS.day.type, minutes: Math.round((Date.now() - LS.stats.start) / 60000) } })
      });
      if (!r.ok) throw new Error(r.status);
      LS = null;
      await loadAll();
      el.innerHTML = `<div class="card"><p class="ko">오늘 학습 완료</p><p class="muted">연속 ${streak()}일째예요. 오늘 알림은 더 오지 않아요.</p></div>
        <div class="row"><button id="h">홈</button><button class="go" id="a">분석 보기</button></div>`;
      $("#h").onclick = () => location.hash = "home";
      $("#a").onclick = () => location.hash = "stats";
    } catch (e) { b.disabled = false; $("#msg").textContent = `저장하지 못했어요. 연결을 확인하고 다시 누르세요. (${e.message})`; }
  };
}

// ---------- 기록 탭: 지난 대화 다시 연습 ----------
ROUTES.review = el => {
  const done = new Set(S.st.history.map(h => h.date));
  let html = `<header><h1>지난 대화</h1><h2>기록</h2></header>`;
  const weeks = Object.keys(S.weeks).map(Number).sort((a, b) => b - a);
  if (!weeks.length) html += `<div class="card"><p class="muted">아직 올라온 콘텐츠가 없어요.</p></div>`;
  for (const w of weeks) {
    const days = S.weeks[w].days.filter(d => dayN(w, d.day) <= S.n && d.lines && d.lines.length).sort((a, b) => b.day - a.day);
    if (!days.length) continue;
    html += `<div class="card"><h3>${w}주차 ${esc(S.weeks[w].theme)}</h3><ul class="list">${days.map(d => {
      const n = dayN(w, d.day), ok = done.has(dateOfN(n));
      return `<li><button class="opt" data-w="${w}" data-d="${d.day}">D+${n} ${esc(d.title)} ${ok ? "✅" : ""}</button></li>`;
    }).join("")}</ul></div>`;
  }
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
    const c = C[i], line = LS.day.lines.find(l => (l.chunks || []).includes(c.id)); let reps = 0;
    const need = LS.diff.lv === "기초" ? 5 : 3;
    const samples = [line, ...(c.ex || [])].filter(Boolean);
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${C.length}</div>
      <p style="font-size:26px;font-weight:800;margin:0">${esc(c.en)}</p><p class="ko" style="font-size:16px">${esc(c.ko)}</p>
      <p class="muted">💡 ${esc(c.note)}</p>
      ${samples.map((e, k) => `<div class="line" id="s${k}"><div class="sp">${k === 0 && line ? "대화 속에서" : "다른 상황"}</div>${esc(e.en)}<div class="muted">${esc(e.ko)}</div></div>`).join("")}
      <button id="ex">🔊 예문 듣기</button></div>
      <p class="muted">표현을 듣고 소리 내 따라 말하세요. ${need}번 따라 하면 넘어갈 수 있어요.</p>
      <button class="go" id="rep">🔊 듣고 따라 말하기 (0/${need})</button>`;
    $("#ex").onclick = async () => {
      const r = RUN;
      for (let k = 0; k < samples.length; k++) {
        if (r !== RUN) return;
        el.querySelectorAll(".line").forEach(x => x.classList.toggle("on", x.id === "s" + k));
        await speak(samples[k].en, { who: "B" }); await sleep(600);
      }
    };
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

// ---------- 유도 롤플레이 ----------
function roleplay(el) {
  const R = LS.day.roleplay; let i = 0;
  const show = () => {
    const t = R.turns[i];
    el.innerHTML = `<div class="card"><p class="muted">${esc(R.situation_ko)}</p><div class="count">${i + 1} / ${R.turns.length}</div>
      <div class="line"><div class="sp">${esc(who("A"))}</div>${esc(t.a)}</div>
      <p class="ko" style="margin-top:14px">${esc(t.intent_ko)}</p><p class="muted">쓸 표현: ${esc(t.hint)}</p><div id="ans"></div></div>
      <button id="hear">🔊 상대 말 다시 듣기</button><div id="ctl"><button class="go" id="rv">말한 뒤 모범 답 보기</button></div>`;
    speak(t.a, { who: vo("A") });
    $("#hear").onclick = () => speak(t.a, { who: vo("A") });
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

// ---------- 마무리 테스트 (틀리면 맞힐 때까지 다시 출제, 첫 결과를 기록) ----------
function testItems(day) {
  const ids = day.chunks && day.chunks.length ? day.chunks.map(c => c.id)
    : [...new Set((day.lines || []).flatMap(l => l.chunks || []))].slice(0, 10);
  return ids.filter(id => S.chunks[id]);
}
function finalTest(el) {
  const q = testItems(LS.day).map(id => ({ c: S.chunks[id], tries: 0 })).sort(() => Math.random() - 0.5);
  const first = {};
  const show = () => {
    if (!q.length) return next();
    const it = q[0], c = it.c;
    el.innerHTML = `<div class="card"><div class="count">남은 문제 ${q.length}</div><p class="muted">힌트 없이 영어로 말해보세요. 틀린 표현은 조금 뒤에 다시 나와요.</p>
      <p class="ko">${esc(c.ko)}</p><div id="ans"></div></div><div id="ctl"><button class="go" id="rv">정답 보기</button></div>`;
    pressure("rv");
    $("#rv").onclick = () => {
      $("#ans").innerHTML = `<div class="en">${esc(c.en)}</div>`;
      speak(c.en, { who: "B" });
      $("#ctl").innerHTML = `<div class="row"><button class="bO" data-r="O">O 바로 말함</button><button class="bT" data-r="T">△ 더듬음</button><button class="bX" data-r="X">X 못 함</button></div>`;
      el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
        const r = b.dataset.r;
        if (!(c.id in first)) { first[c.id] = r; mark([c.id], r); }
        q.shift(); it.tries++;
        if (r !== "O" && it.tries < (LS.diff.lv === "기초" ? 4 : 3)) q.splice(Math.min(2, q.length), 0, it);
        show();
      });
    };
  };
  show();
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
