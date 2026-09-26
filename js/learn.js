// ===== 학습 탭 + 기록 탭 =====
const RANK = { O: 0, T: 1, X: 2 };
const who = sp => (sp === "A" ? (LS && LS.cast.A && LS.cast.A.name) || "A" : "나");
const nextLabel = () => (LS.steps[LS.step + 1] || [""])[0];
function mark(ids, r) { for (const id of ids || []) { const p = LS.results[id]; if (!p || RANK[r] > RANK[p]) LS.results[id] = r; } }

// ---------- 세션 만들기 ----------
function newSession(day, w, practice) {
  const s = { id: `${w}-${day.day}${practice ? "p" : ""}`, w, n: dayN(w, day.day), day, practice,
    cast: (S.weeks[w] || {}).cast || {}, theme: (S.weeks[w] || {}).theme || "",
    step: 0, results: {}, stats: { start: Date.now(), listenTries: 0 }, measure: null, steps: [], due: [] };
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
  if (day.lines && day.lines.length) s.steps.push(["듣기", listen], ["섀도잉", shadow], ["인출", recall]);
  if (day.improv && day.improv.length) s.steps.push(["즉흥", improv]);
  if (!practice && (day.type === "review_cum" || (S.monthly && S.dw === 7))) s.steps.push(["측정", measure]);
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
    <nav class="map" aria-label="진행 단계">${LS.steps.map(([t], i) => `<div class="st ${i < LS.step ? "pass" : i === LS.step ? "cur" : ""}"><i></i>${t}</div>`).join("")}</nav>
    <button class="vbtn" id="vbtn">🔊 음성 설정</button><div id="vp"></div><section id="stage"></section>`;
  $("#vbtn").onclick = () => voicePanel($("#vp"));
  fn($("#stage"));
  window.scrollTo(0, 0);
}
const next = () => { LS.step++; renderLearn($("#view")); };

// ---------- 한국어 → 영어 인출 카드 ----------
function drill(el, items, onDone) {
  let i = 0;
  const show = () => {
    const it = items[i];
    el.innerHTML = `<div class="card"><div class="count">${i + 1} / ${items.length}</div>
      ${it.ctx ? `<p class="muted">${esc(it.ctx)}</p>` : ""}<p class="ko">${esc(it.ko)}</p><div id="ans"></div></div>
      <p class="muted">영어로 소리 내 말한 다음 정답을 확인하세요.</p><div id="ctl"><button class="go" id="reveal">정답 보기</button></div>`;
    $("#reveal").onclick = () => {
      $("#ans").innerHTML = `<div class="en">${esc(it.en)}</div>`;
      speak(it.en, { who: "B" });
      $("#ctl").innerHTML = `<button id="again">🔊 다시 듣기</button>
        <div class="row"><button class="bO" data-r="O">O 바로 말함</button><button class="bT" data-r="T">△ 더듬음</button><button class="bX" data-r="X">X 못 함</button></div>`;
      $("#again").onclick = () => speak(it.en, { who: "B" });
      el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { mark(it.ids, b.dataset.r); i++; i < items.length ? show() : onDone(); });
    };
  };
  show();
}
function warmup(el) { drill(el, LS.due.map(c => ({ ko: c.ko, en: c.en, ids: [c.id] })), next); }
function recall(el) {
  const L = LS.day.lines, items = [];
  L.forEach((l, i) => { if (l.sp === "B") items.push({ ko: l.ko, en: l.en, ids: l.chunks, ctx: i > 0 ? `${who("A")}: ${L[i - 1].en}` : "" }); });
  drill(el, items, next);
}

// ---------- 듣기 ----------
async function playAll(rate) {
  const r = RUN;
  for (const l of LS.day.lines) { if (r !== RUN) return; await speak(l.en, { rate, who: l.sp }); await sleep(250); }
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
  const L = LS.day.lines, rates = [0.8, 1]; let pass = 0;
  el.innerHTML = `<div class="card"><p class="muted">한 줄 듣고, 멈추는 동안 똑같이 따라 말하세요. 0.8배 한 번, 1.0배 한 번 진행해요.</p>
    ${L.map((l, i) => `<div class="line" id="l${i}"><div class="sp">${esc(who(l.sp))}</div><div>${esc(l.en)}</div><div class="muted">${esc(l.ko)}</div></div>`).join("")}</div>
    <button class="go" id="go">▶ 0.8배로 시작</button>`;
  const b = $("#go");
  b.onclick = async () => {
    if (pass >= 2) return next();
    const r = RUN; b.disabled = true;
    for (let i = 0; i < L.length; i++) {
      if (r !== RUN) return;
      el.querySelectorAll(".line").forEach(x => x.classList.remove("on"));
      const le = $("#l" + i); le.classList.add("on"); le.scrollIntoView({ block: "center", behavior: "smooth" });
      const t0 = Date.now();
      await speak(L[i].en, { rate: rates[pass], who: L[i].sp });
      await sleep(Math.max(1200, (Date.now() - t0) * 1.1 + 500)); // 따라 말할 시간
    }
    if (r !== RUN) return;
    pass++; b.disabled = false;
    b.textContent = pass < 2 ? "▶ 1.0배로 시작" : `다음: ${nextLabel()}`;
  };
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
  $("#hear").onclick = () => speak(it.starter_en, { who: "A" });
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
  el.innerHTML = `<div class="card"><p class="ko">기록을 저장하면 오늘 알림이 멈춰요.</p><p class="muted">O ${t.O} / △ ${t.T} / X ${t.X}</p></div>
    <button class="go" id="sv">오늘 학습 완료</button><p class="muted" id="msg"></p>`;
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
