// ===== 홈 탭 + 분석 탭 =====
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const kstHour = t => new Date(t + 9 * 3600000).getUTCHours() + new Date(t + 9 * 3600000).getUTCMinutes() / 60;
const dayLabel = d => (d <= 5 ? `${d}일` : d === 6 ? "주간" : "누적");

// ---------- 홈 ----------
ROUTES.home = el => {
  const t = S.st.today, done = !!t.done, srs = S.st.srs;
  const dueCount = Object.values(srs).filter(it => it.due <= S.st.date && !it.grad).length;
  const doneDates = new Set(S.st.history.map(h => h.date));
  const cells = [1, 2, 3, 4, 5, 6, 7].map(d => {
    const n = dayN(S.week, d), date = dateOfN(n);
    const cls = doneDates.has(date) ? "done" : n === S.n ? "today" : n < S.n ? "miss" : "";
    return `<div class="${cls}"><b>${doneDates.has(date) ? "✓" : d}</b>${dayLabel(d)}</div>`;
  }).join("");
  el.innerHTML = `<header><h1>${S.st.date} D+${S.n}</h1><h2>${esc(S.st.label)}</h2></header>
    <div class="card"><p class="ko">${done ? "오늘 학습 완료" : "오늘 과제가 남아 있어요"}</p>
      <p class="muted">${done ? "오늘 알림은 더 오지 않아요." : `지금까지 받은 알림 ${t.alarms || 0}번. 완료하면 알림이 멈춰요.`}</p>
      <button class="go" id="start">${done ? "오늘 대화 다시 연습" : LS && !LS.practice ? "이어서 학습하기" : "오늘 학습 시작"}</button></div>
    <div class="card"><h3>${S.week}주차</h3><div class="wk">${cells}</div>
      <p class="muted">연속 ${streak()}일째 학습 중이고, 오늘 복습할 표현이 ${dueCount}개 있어요.</p></div>
    ${missionCard()}${S.st.monthly && S.st.monthly[S.st.date.slice(0, 7)] ? "" : `<div class="card"><p class="ko">이번 달 기준 테스트를 아직 안 했어요</p>
      <p class="muted">매달 같은 질문 3개에 답해 녹음해두면, 달마다 내 말하기가 어떻게 달라졌는지 직접 들을 수 있어요. 약 5분.</p><button id="mt">기준 테스트 하기</button></div>`}
    <div class="row"><button id="rv">🗂 지난 대화</button><button id="an">📈 분석</button></div>`;
  if ($("#mt")) $("#mt").onclick = () => location.hash = "mtest";
  $("#start").onclick = () => { if (LS && LS.practice && !done) LS = null; location.hash = "learn"; };
  $("#rv").onclick = () => location.hash = "review";
  $("#an").onclick = () => location.hash = "stats";
};

function missionCard() {
  const m = [...S.st.history].reverse().find(h => h.stats && h.stats.mission);
  if (!m) return "";
  return `<div class="card"><h3>🎯 실전 미션</h3><p class="ko">${esc(m.stats.mission)}</p><p class="muted">${m.date === S.st.date ? "내일까지" : "다음 학습 전까지"} 실제 대화나 혼잣말에서 한 번 써보세요.</p></div>`;
}

// ---------- 분석 계산 ----------
function analyze() {
  const H = S.st.history, srs = S.st.srs, date = S.st.date;
  const res = { O: 0, T: 0, X: 0 };
  H.forEach(h => Object.values(h.results || {}).forEach(r => res[r]++));
  const totalR = res.O + res.T + res.X;
  const listenH = H.filter(h => h.stats && h.stats.listenTries > 0);
  const listen1 = pct(listenH.filter(h => h.stats.listenTries === 1).length, listenH.length);
  const items = Object.entries(srs).filter(([id]) => S.chunks[id]);
  const mastered = items.filter(([, it]) => it.grad).length;
  const risk = items.filter(([, it]) => !it.grad && (it.due < date || it.x >= 2))
    .map(([id, it]) => ({ c: S.chunks[id], it, why: it.due < date ? `복습 ${Math.round((Date.parse(date) - Date.parse(it.due)) / DAYMS)}일 밀림` : `${it.x}번 틀림` }));
  const mins = H.map(h => (h.stats || {}).minutes).filter(x => x > 0);
  const alarms = H.map(h => h.alarms || 0);
  const hours = H.filter(h => h.doneAt).map(h => kstHour(h.doneAt));
  const measures = H.filter(h => h.measure).map(h => ({ date: h.date, ...h.measure }));
  const last7 = H.slice(-7), r7 = { O: 0, T: 0, X: 0 };
  last7.forEach(h => Object.values(h.results || {}).forEach(r => r7[r]++));
  const x7 = pct(r7.X, r7.O + r7.T + r7.X);
  const mAns = H.filter(h => h.stats && typeof h.stats.missionPrev === "boolean");
  const mission = { n: mAns.length, used: mAns.filter(h => h.stats.missionPrev).length };
  return { H, res, totalR, listen1, listenN: listenH.length, items, mastered, risk, mins, alarms, hours, measures, x7, mission };
}

function diagnose(a) {
  const out = [];
  if (!a.H.length) return ["첫 학습을 마치면 진단이 시작돼요."];
  const s = streak();
  if (s >= 7) out.push(`${s}일 연속 학습 중이에요. 습관이 자리 잡는 구간이에요.`);
  else if (s === 0) out.push("연속 기록이 끊겼어요. 오늘 한 번만 하면 다시 시작돼요.");
  const overdue = a.risk.filter(r => r.it.due < S.st.date).length;
  if (overdue >= 5) out.push(`복습이 ${overdue}개 밀려 있어요. 밀린 표현은 워밍업에 자동으로 나오니, 하루도 빠지지 않는 게 가장 효과적이에요.`);
  if (a.listenN >= 3 && a.listen1 < 60) out.push(`듣기 첫 시도 정답률이 ${a.listen1}%예요. 대화를 처음 들을 때 핵심 단어 하나만 잡는 데 집중해보세요.`);
  if (a.H.length >= 3 && a.x7 >= 30) out.push(`최근 7일 인출에서 못 한 비율이 ${a.x7}%예요. 섀도잉 1.0배를 한 번 더 하고 인출로 넘어가 보세요.`);
  else if (a.H.length >= 3 && a.x7 <= 10) out.push(`최근 7일 인출 실패율이 ${a.x7}%로 낮아요. 즉흥 단계에서 새 표현을 더 섞어보세요.`);
  const am = avg(a.alarms);
  if (a.H.length >= 3 && am >= 2) out.push(`평균 ${am.toFixed(1)}번째 알림쯤 완료하고 있어요. 첫 알림 시간을 실제 학습 시간에 맞추면 알림 부담이 줄어요.`);
  if (a.measures.length >= 2) {
    const f = a.measures[0], l = a.measures[a.measures.length - 1];
    if (l.pauses < f.pauses) out.push(`60초 발화의 멈춤이 ${f.pauses}번에서 ${l.pauses}번으로 줄었어요.`);
    if (l.used > f.used) out.push(`60초 발화에서 쓴 표현이 ${f.used}개에서 ${l.used}개로 늘었어요.`);
  }
  if (a.mission.n >= 3) {
    const r = pct(a.mission.used, a.mission.n);
    out.push(r >= 60 ? `실전 미션을 ${r}% 실천했어요. 배운 표현이 실제 말로 옮겨지고 있어요.` : `실전 미션 실천률이 ${r}%예요. 혼잣말로라도 한 번 써보는 것만으로 기억이 훨씬 오래가요.`);
  }
  if (!out.length) out.push("아직 뚜렷한 약점 신호는 없어요. 지금 흐름을 유지하세요.");
  return out;
}

// ---------- 그래프 (직접 그림) ----------
function stackBar(o, t, x) {
  const n = o + t + x || 1;
  return `<div class="bar"><i style="width:${(o / n) * 100}%;background:var(--o)"></i><i style="width:${(t / n) * 100}%;background:var(--t)"></i><i style="width:${(x / n) * 100}%;background:var(--x)"></i></div>`;
}
function meter(label, v, color) {
  return `<div class="brow"><span>${label}</span><div class="bar"><i style="width:${v}%;background:${color}"></i></div><em>${v}%</em></div>`;
}
function lineChart(series) { // series: [{name, color, values}]
  const all = series.flatMap(s => s.values), max = Math.max(1, ...all), n = series[0].values.length;
  const W = 300, H = 100, x = i => (n === 1 ? W / 2 : (i / (n - 1)) * (W - 20) + 10), y = v => H - 10 - (v / max) * (H - 20);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="주간 측정 추세">${series.map(s =>
    `<polyline fill="none" stroke="${s.color}" stroke-width="3" points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>` +
    s.values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${s.color}"/>`).join("")).join("")}</svg>
    <p class="muted">${series.map(s => `<span style="color:${s.color}">●</span> ${s.name}`).join("&nbsp;&nbsp;")}</p>`;
}

// ---------- 분석 탭 ----------
ROUTES.stats = el => {
  const a = analyze();
  const lv = it => (it.grad ? "lvg" : "lv" + it.level);
  let html = `<header><h1>${S.st.date} 기준</h1><h2>분석</h2></header>`;

  // 1. 요약
  html += `<div class="card"><h3>요약</h3><div class="kpi">
    <div><b>${a.H.length}</b><span>총 학습일</span></div><div><b>${streak()}</b><span>연속 학습일</span></div>
    <div><b>${a.mastered}/${a.items.length}</b><span>졸업한 표현 / 배운 표현</span></div>
    <div><b>${a.mins.length ? Math.round(avg(a.mins)) : "-"}</b><span>평균 학습 시간(분)</span></div></div></div>`;

  // 9. 진단 (가장 먼저 보이도록 위에 배치)
  html += `<div class="card"><h3>진단</h3><ul class="list">${diagnose(a).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;

  // 2. 숙련도 지도
  html += `<div class="card"><h3>표현 숙련도</h3>`;
  if (!a.items.length) html += `<p class="muted">학습을 마치면 표현이 여기에 쌓여요.</p>`;
  const byWeek = {};
  a.items.forEach(([id, it]) => (byWeek[S.chunks[id].week] = byWeek[S.chunks[id].week] || []).push([id, it]));
  for (const w of Object.keys(byWeek).sort((x, y) => x - y)) {
    html += `<p class="muted">${w}주차 ${esc((S.weeks[w] || {}).theme)}</p><div class="pills">${byWeek[w].map(([id, it]) =>
      `<button class="pill ${lv(it)}" data-id="${id}">${esc(S.chunks[id].en)}</button>`).join("")}</div>`;
  }
  html += `<div id="pd"></div><p class="muted"><span style="color:var(--x)">●</span> 약함 <span style="color:var(--t)">●</span> 익히는 중 <span style="color:var(--o)">●</span> 거의 익힘, 진한 초록은 졸업</p></div>`;

  // 3. 망각 위험
  html += `<div class="card"><h3>망각 위험</h3>${a.risk.length ? `<ul class="list">${a.risk.slice(0, 10).map(r =>
    `<li><b>${esc(r.c.en)}</b> <span class="muted">${esc(r.c.ko)}</span><br><span class="muted">${r.why}</span></li>`).join("")}</ul>` :
    `<p class="muted">밀리거나 반복해서 틀린 표현이 없어요.</p>`}</div>`;

  // 4. 일별 인출 결과
  const recent = a.H.slice(-14).reverse();
  html += `<div class="card"><h3>일별 결과 (최근 14일)</h3>${recent.length ? recent.map(h => {
    const c = { O: 0, T: 0, X: 0 }; Object.values(h.results || {}).forEach(r => c[r]++);
    return `<div class="brow"><span>${h.date.slice(5)}</span>${stackBar(c.O, c.T, c.X)}<em>${c.O}/${c.O + c.T + c.X}</em></div>`;
  }).join("") + `<p class="muted"><span style="color:var(--o)">●</span> O <span style="color:var(--t)">●</span> △ <span style="color:var(--x)">●</span> X, 오른쪽 숫자는 O 개수 / 전체</p>` :
    `<p class="muted">아직 기록이 없어요.</p>`}</div>`;

  // 5. 단계별 병목
  html += `<div class="card"><h3>단계별 강약</h3>
    ${meter("듣기", a.listen1, "var(--line)")}${meter("인출 O", pct(a.res.O, a.totalR), "var(--o)")}${meter("인출 X", pct(a.res.X, a.totalR), "var(--x)")}
    <p class="muted">듣기는 맥락 질문을 한 번에 맞힌 비율이에요. 둘 중 낮은 쪽이 지금의 병목이에요.</p></div>`;

  // 6. 주제별 강약
  const themes = Object.keys(byWeek).sort((x, y) => x - y).map(w => ({
    name: `${w}주 ${(S.weeks[w] || {}).theme || ""}`,
    v: Math.round((avg(byWeek[w].map(([, it]) => (it.grad ? 4 : it.level))) / 4) * 100)
  }));
  html += `<div class="card"><h3>주제별 숙련도</h3>${themes.length ? themes.map(t => meter(esc(t.name), t.v, "var(--line)")).join("") :
    `<p class="muted">아직 기록이 없어요.</p>`}</div>`;

  // 7. 주간 측정 추세
  html += `<div class="card"><h3>60초 발화 추세</h3>${a.measures.length >= 2 ? lineChart([
    { name: "멈춤 횟수", color: "var(--x)", values: a.measures.map(m => m.pauses) },
    { name: "사용 표현 수", color: "var(--o)", values: a.measures.map(m => m.used) },
    { name: "자신감", color: "var(--now)", values: a.measures.map(m => m.confidence) }]) :
    `<p class="muted">매주 7일차 측정이 두 번 이상 쌓이면 그래프가 보여요. 지금 ${a.measures.length}번.</p>`}</div>`;

  // 8. 학습 습관
  const ac = [0, 1, 2, 3, 4].map(k => a.alarms.filter(x => (k < 4 ? x === k : x >= 4)).length);
  const avgH = a.hours.length ? avg(a.hours) : null;
  html += `<div class="card"><h3>학습 습관</h3>
    <p class="muted">${avgH === null ? "아직 기록이 없어요." : `평균 완료 시각은 ${Math.floor(avgH)}시 ${String(Math.round((avgH % 1) * 60)).padStart(2, "0")}분쯤이에요.`}</p>
    ${a.H.length ? ac.map((c, k) => meter(k === 0 ? "알림 전" : k < 4 ? `${k}번째 뒤` : "4번 이상", pct(c, a.H.length), "var(--now)")).join("") : ""}
    <p class="muted">완료하기 전까지 받은 알림 수 기준이에요.</p>
    ${a.mission.n ? meter("실전 미션", pct(a.mission.used, a.mission.n), "var(--o)") : ""}</div>`;
  const df = difficulty();
  html += `<div class="card"><h3>현재 난이도: ${df.lv}</h3><p class="muted">${esc(df.why)}</p></div>`;
  html += monthlyCard();

  // 월간 요약 코드
  html += `<div class="card"><h3>월간 심층 분석</h3><p class="muted">한 달에 한 번 아래 코드를 복사해서 Claude에게 "월간 분석" 요청과 함께 붙여넣으세요. 다음 달 커리큘럼 조정에 써요.</p>
    <button class="go" id="cp">요약 코드 복사</button><p class="muted" id="cpm"></p></div>`;

  el.innerHTML = html;

  el.querySelectorAll(".pill").forEach(b => b.onclick = () => {
    const c = S.chunks[b.dataset.id], it = S.st.srs[b.dataset.id];
    $("#pd").innerHTML = `<div class="card" style="background:var(--bg)"><p class="ko">${esc(c.en)}</p><p class="muted">${esc(c.ko)}${c.note ? `<br>${esc(c.note)}` : ""}<br>O ${it.o} / △ ${it.t} / X ${it.x}, 다음 복습 ${it.due}</p></div>`;
    speak(c.en, { who: "B" });
  });
  bindMonthly();
  $("#cp").onclick = async () => {
    const code = JSON.stringify(monthlyCode(a));
    try { await navigator.clipboard.writeText(code); $("#cpm").textContent = "복사했어요."; }
    catch (e) { $("#cpm").innerHTML = `<textarea style="width:100%;height:120px" readonly>${esc(code)}</textarea>`; }
  };
};

function monthlyCode(a) {
  const H30 = a.H.slice(-30), r = { O: 0, T: 0, X: 0 };
  H30.forEach(h => Object.values(h.results || {}).forEach(x => r[x]++));
  const weak = a.items.filter(([, it]) => !it.grad).sort((x, y) => (y[1].x * 2 + y[1].t) - (x[1].x * 2 + x[1].t))
    .slice(0, 12).map(([id, it]) => `${S.chunks[id].en}|O${it.o}T${it.t}X${it.x}`);
  return { v: 1, to: S.st.date, n: S.n, days: H30.length, streak: streak(), res: r, listen1: a.listen1,
    avgMin: Math.round(avg(a.mins)), avgAlarm: +avg(a.alarms).toFixed(1), mastered: a.mastered, seen: a.items.length,
    weak, measures: a.measures.slice(-5).map(m => [m.date, m.pauses, m.used, m.confidence]) };
}

// ---------- 월간 기준 테스트 ----------
const MQ = [
  { en: "Tell me about yourself.", ko: "자기소개를 해주세요." },
  { en: "What did you do last weekend?", ko: "지난 주말에 뭐 했어요?" },
  { en: "If you could change one thing about your daily life, what would it be and why?", ko: "일상에서 하나를 바꿀 수 있다면 무엇을, 왜 바꾸고 싶나요?" },
];
function monthlyCard() {
  const M = S.st.monthly || {}, months = Object.keys(M).sort();
  let h = `<div class="card"><h3>월간 기준 테스트</h3>`;
  if (!months.length) return h + `<p class="muted">매달 같은 질문 3개에 60초씩 답하고 녹음해요. 첫 기록이 기준점이 돼요.</p><button class="go" id="mt2">첫 테스트 하기</button></div>`;
  if (months.length >= 2) h += `<div class="brow"><span></span><em style="width:auto;flex:1;text-align:left">월별 멈춤 합계 → ${months.map(m => M[m].answers.reduce((a, x) => a + (x.pauses || 0), 0)).join(" → ")}</em></div>`;
  h += MQ.map((q, i) => `<p class="muted" style="margin-bottom:4px">${i + 1}. ${esc(q.ko)}</p><div class="pills">${months.map(m =>
    `<button class="pill" data-play="${m}-q${i + 1}">▶ ${m}</button>`).join("")}</div>`).join("");
  if (!M[S.st.date.slice(0, 7)]) h += `<button class="go" id="mt2">이번 달 테스트 하기</button>`;
  return h + `<p class="muted">같은 질문에 대한 지난달과 이번 달 내 목소리를 비교해 들어보세요.</p></div>`;
}
function bindMonthly() {
  if ($("#mt2")) $("#mt2").onclick = () => location.hash = "mtest";
  document.querySelectorAll("[data-play]").forEach(b => b.onclick = () => playUrl(`${API}/api/rec?k=${encodeURIComponent(KEY)}&id=${b.dataset.play}`));
}
ROUTES.mtest = el => {
  const month = S.st.date.slice(0, 7), answers = []; let i = 0;
  const show = () => {
    if (i >= MQ.length) return save();
    const q = MQ[i]; let blob = null, rec = null;
    el.innerHTML = `<header><h1>${month} 기준 테스트</h1><h2>질문 ${i + 1} / ${MQ.length}</h2></header>
      <div class="card"><p class="en" style="margin:0">${esc(q.en)}</p><p class="muted">${esc(q.ko)}</p><button id="hq">🔊 질문 듣기</button></div>
      <div class="card"><p class="muted">녹음을 시작하고 60초 동안 답하세요. 완벽하지 않아도 멈추지 말고 계속 말하는 게 중요해요.</p>
      <div class="timer" id="tm">60</div><button class="go" id="rc">🎙 녹음 시작</button><button id="pb" disabled>▶ 내 답 들어보기</button></div>
      <div class="card"><label>3초 넘게 멈춘 횟수<input id="p" type="number" inputmode="numeric" min="0"></label>
      <label>자신감 (1~5)</label><div class="row" id="cf">${[1, 2, 3, 4, 5].map(v => `<button data-v="${v}">${v}</button>`).join("")}</div></div>
      <button class="go" id="nx" disabled>다음</button><p class="muted" id="msg"></p>`;
    let conf = 0;
    const check = () => { $("#nx").disabled = !(blob && conf && $("#p").value !== ""); };
    $("#hq").onclick = () => speak(q.en, { who: "A" });
    $("#p").oninput = check;
    el.querySelectorAll("#cf button").forEach(b => b.onclick = () => { conf = +b.dataset.v; el.querySelectorAll("#cf button").forEach(x => x.classList.toggle("go", x === b)); check(); });
    $("#pb").onclick = () => blob && playBlob(blob);
    const stop = async () => { if (!rec) return; const r = rec; rec = null; blob = await r.stop(); $("#rc").textContent = "🎙 다시 녹음"; $("#pb").disabled = !blob; check(); };
    $("#rc").onclick = async () => {
      if (rec) return stop();
      try { stopAudio(); rec = await recStart(); } catch (e) { $("#msg").textContent = "마이크 권한이 필요해요. 설정에서 허용해주세요."; return; }
      $("#rc").textContent = "⏹ 녹음 멈추기";
      const r = RUN, me = rec;
      for (let s = 60; s > 0; s--) { if (r !== RUN || rec !== me) return; $("#tm").textContent = s; await sleep(1000); }
      if (rec === me) { $("#tm").textContent = "0"; stop(); }
    };
    $("#nx").onclick = () => { answers.push({ q: q.en, id: `${month}-q${i + 1}`, blob, pauses: +$("#p").value, confidence: conf }); i++; show(); };
  };
  const save = async () => {
    el.innerHTML = `<div class="card"><p class="ko">저장하는 중…</p><p class="muted" id="msg"></p></div>`;
    try {
      for (const a of answers) {
        const r = await fetch(`${API}/api/rec?k=${encodeURIComponent(KEY)}&id=${a.id}`, { method: "POST", headers: { "Content-Type": a.blob.type || "audio/mp4" }, body: a.blob });
        if (!r.ok) throw new Error("녹음 " + r.status);
      }
      const r = await fetch(`${API}/api/monthly?k=${encodeURIComponent(KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, answers: answers.map(({ blob, ...x }) => x) }) });
      if (!r.ok) throw new Error(r.status);
      await loadAll();
      el.innerHTML = `<div class="card"><p class="ko">이번 달 기준 테스트 저장 완료</p><p class="muted">다음 달에 같은 질문으로 다시 녹음하면, 분석 탭에서 두 달의 목소리를 비교해 들을 수 있어요.</p></div><button class="go" id="h">분석 보기</button>`;
      $("#h").onclick = () => location.hash = "stats";
    } catch (e) {
      el.innerHTML = `<div class="card"><p class="ko">저장하지 못했어요</p><p class="muted">${esc(e.message)}. 알림 서버를 최신 코드로 바꿨는지 확인하세요.</p></div><button class="go" id="re">다시 저장</button>`;
      $("#re").onclick = save;
    }
  };
  show();
};
