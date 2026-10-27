// ===== 나에 맞춘 레슨: 처음 질문지 · 3일 체크 · 추가 정보 =====
// 답은 서버(Cloudflare)에만 저장. 코드에는 개인 정보를 넣지 않음.
const UNSURE = "?"; // "잘 모르겠어요 · 알아서 넣어주세요"
const CHECK_EVERY = 3; // 3일마다 체크

const PQ = [
  { id: "name", q: "대화에서 불릴 이름", ex: "영어 이름이어도 좋아요. 예: James, Jiwoo", type: "text" },
  { id: "job", q: "하는 일", ex: "가장 가까운 걸 고르세요. 레슨 속 '나'의 직업이 돼요.", type: "one",
    opts: ["교육", "회사원", "서비스·판매", "의료", "IT·개발", "자영업", "학생", "프리랜서·크리에이터"] },
  { id: "place", q: "평일에 주로 있는 곳", ex: "최대 2개. 대화가 일어나는 장소가 돼요.", type: "multi", max: 2,
    opts: ["사무실", "집", "이동이 많음", "수업·상담 공간", "매장·현장"] },
  { id: "people", q: "자주 대화하는 상대", ex: "최대 3개. 레슨 상대역이 이 사람들로 바뀌어요.", type: "multi", max: 3,
    opts: ["동료·상사", "고객·학부모", "친구", "연인", "가족", "처음 보는 사람"] },
  { id: "start", q: "대화할 때 나는", ex: "먼저 말 걸면 질문으로 시작하는 대사가, 받아주면 맞장구 대사가 많아져요.", type: "one",
    opts: ["먼저 말 거는 편", "받아주는 편"] },
  { id: "joke", q: "농담은", ex: "대사에 가벼운 농담을 얼마나 넣을지 정해요.", type: "one", opts: ["자주 해요", "가끔 해요", "거의 안 해요"] },
  { id: "direct", q: "부탁하거나 거절할 때", ex: "돌려 말하면 Would you mind ~? 같은 부드러운 표현이 많아져요.", type: "one",
    opts: ["돌려 말하는 편", "바로 말하는 편"] },
  { id: "habit", q: "한국어로 자주 쓰는 말버릇", ex: "최대 3개. 비슷한 영어 말버릇으로 바꿔 대사에 넣어요. 예: '아 그니까' → I know, right?", type: "multi", max: 3,
    opts: ["진짜?", "아 그니까", "대박", "음… 그러니까", "솔직히", "일단 해보자", "괜찮아 괜찮아", "그치?"] },
  { id: "use", q: "영어를 쓸 것 같은 상황", ex: "최대 4개. 이 상황 레슨이 먼저 나와요.", type: "multi", max: 4,
    opts: ["여행", "외국인 손님·동료", "해외 친구", "일·업무", "면접·발표", "온라인(게임·SNS)"] },
  { id: "likes", q: "관심사·취미", ex: "최대 3개. 스몰토크 소재가 돼요.", type: "multi", max: 3,
    opts: ["여행", "맛집·카페", "운동", "재테크", "영화·드라마", "음악", "패션·쇼핑", "게임", "독서", "반려동물"] },
  { id: "event", q: "앞으로 있을 중요한 일", ex: "있으면 그 상황을 미리 연습하는 레슨을 만들어요.", type: "one",
    opts: ["여행", "면접", "발표", "외국인 만남", "없음"] },
  { id: "eventWhen", q: "언제쯤이에요?", ex: "가까운 일부터 먼저 레슨으로 만들어요.", type: "one", opts: ["이번 주", "이번 달", "1~3개월 안", "더 나중"],
    when: p => { const v = pv(p, "event"); return v.length && !v.includes("없음") && !v.includes(UNSURE); } },
];

// 3일 체크의 '자세히 묻는 질문': 지난 답을 바탕으로 아직 안 물은 것부터 하나씩
const has = (p, id, v) => pv(p, id).includes(v);
const DRILL = [
  { id: "d_teach_who", when: p => has(p, "job", "교육"), q: "주로 누구를 가르쳐요?", opts: ["초등학생", "중고등학생", "대학생·성인", "학부모 상담도 많아요"] },
  { id: "d_teach_say", when: p => has(p, "job", "교육"), q: "수업 중 가장 자주 하는 말은?", opts: ["잘했어!", "다시 해볼까?", "이거 시험에 나와", "질문 있어?"] },
  { id: "d_office_meet", when: p => has(p, "job", "회사원"), q: "회의에서 나는 주로", opts: ["의견을 먼저 내요", "정리해요", "듣고 질문해요", "거의 말 안 해요"] },
  { id: "d_office_talk", when: p => has(p, "job", "회사원"), q: "업무 대화 중 가장 많은 건", opts: ["일정 조율", "보고", "부탁", "거절"] },
  { id: "d_shop_say", when: p => has(p, "job", "서비스·판매"), q: "손님에게 가장 자주 하는 말은?", opts: ["뭐 찾으세요?", "이거 인기 많아요", "결제 도와드릴게요", "교환·환불 안내"] },
  { id: "d_med_say", when: p => has(p, "job", "의료"), q: "가장 자주 하는 설명은?", opts: ["증상 묻기", "주의사항", "예약 안내", "검사 설명"] },
  { id: "d_it_talk", when: p => has(p, "job", "IT·개발"), q: "일하면서 자주 하는 대화는?", opts: ["문제 설명", "일정 공유", "코드·작업 리뷰", "아이디어 회의"] },
  { id: "d_own_talk", when: p => has(p, "job", "자영업"), q: "가장 자주 하는 대화는?", opts: ["손님 응대", "거래처 연락", "직원과 대화", "가격 이야기"] },
  { id: "d_student", when: p => has(p, "job", "학생"), q: "학교에서 주로 하는 대화는?", opts: ["수업·과제", "친구와 수다", "동아리", "아르바이트"] },
  { id: "d_free", when: p => has(p, "job", "프리랜서·크리에이터"), q: "일할 때 가장 많은 대화는?", opts: ["클라이언트 미팅", "작업 소개", "가격 협의", "콘텐츠 이야기"] },
  { id: "d_friend", when: p => has(p, "people", "친구"), q: "친구 만나면 주로", opts: ["밥·카페", "술 한잔", "운동", "집에서 수다"] },
  { id: "d_partner", when: p => has(p, "people", "연인"), q: "연인과 자주 하는 대화는?", opts: ["데이트 계획", "하루 있었던 일", "맛집 이야기", "여행 계획"] },
  { id: "d_family", when: p => has(p, "people", "가족"), q: "가족과는 주로", opts: ["안부 전화", "식사 자리", "집안일 상의", "명절·모임"] },
  { id: "d_stranger", when: p => has(p, "people", "처음 보는 사람"), q: "처음 보는 사람과 대화할 때 가장 어려운 건?", opts: ["첫마디", "이어가기", "마무리", "이름 기억하기"] },
  { id: "d_client", when: p => has(p, "people", "고객·학부모"), q: "고객·학부모와 가장 신경 쓰이는 대화는?", opts: ["불만 듣기", "설명하기", "거절하기", "첫 상담"] },
  { id: "d_coworker", when: p => has(p, "people", "동료·상사"), q: "동료와 업무 말고 주로", opts: ["점심 메뉴", "주말 이야기", "회사 이야기", "거의 안 해요"] },
  { id: "d_trip", when: p => has(p, "likes", "여행") || has(p, "use", "여행"), q: "여행 중 가장 걱정되는 순간은?", opts: ["주문할 때", "길 물을 때", "쇼핑할 때", "문제가 생겼을 때"] },
  { id: "d_trip_style", when: p => has(p, "likes", "여행"), q: "여행 가면 나는", opts: ["계획파", "즉흥파", "맛집 위주", "쇼핑 위주"] },
  { id: "d_sport", when: p => has(p, "likes", "운동"), q: "주로 하는 운동은?", opts: ["헬스", "러닝", "필라테스·요가", "구기 종목"] },
  { id: "d_money", when: p => has(p, "likes", "재테크"), q: "주로 이야기하는 건?", opts: ["주식", "부동산", "코인", "절약"] },
  { id: "d_movie", when: p => has(p, "likes", "영화·드라마"), q: "좋아하는 장르는?", opts: ["로맨스", "액션·스릴러", "코미디", "다큐"] },
  { id: "d_cafe", when: p => has(p, "likes", "맛집·카페"), q: "카페에 가면", opts: ["늘 같은 메뉴", "새 메뉴 도전", "디저트 필수", "작업하러 가요"] },
  { id: "d_mood", when: () => true, q: "기분 좋을 때 나는", opts: ["리액션이 커져요", "말이 많아져요", "농담을 해요", "조용히 즐겨요"] },
  { id: "d_favor", when: () => true, q: "곤란한 부탁을 받으면", opts: ["웃으며 미뤄요", "이유를 대고 거절해요", "일단 들어줘요", "생각해보겠다고 해요"] },
  { id: "d_praise", when: () => true, q: "칭찬을 들으면", opts: ["아니에요~ 하고 넘겨요", "고맙다고 해요", "농담으로 받아요", "칭찬을 돌려줘요"] },
  { id: "d_late", when: () => true, q: "약속에 늦을 것 같으면", opts: ["미리 연락해요", "도착해서 사과해요", "농담으로 넘겨요", "거의 안 늦어요"] },
];

// 답 꺼내기: { sel: [...], other: "" } 형식
function pv(p, id) { const a = p && p[id]; return a ? [...(a.sel || []), ...(a.other ? [a.other] : [])] : []; }
const profileDone = () => !!(S.st.profile && S.st.profile.name);
const lastCheck = () => (S.st.checkins || []).slice(-1)[0];
function checkDue() {
  if (!profileDone()) return false;
  const base = (lastCheck() || {}).date || S.st.profile.updatedAt;
  return !base || (Date.parse(S.st.date) - Date.parse(base)) / DAYMS >= CHECK_EVERY;
}
function nextDrill() {
  const p = S.st.profile, asked = new Set((S.st.checkins || []).map(c => c.drill && c.drill.id));
  return DRILL.find(d => d.when(p) && !asked.has(d.id)) || DRILL.filter(d => d.when(p))[(S.st.checkins || []).length % 4] || DRILL[22];
}
// 3일 체크 1번 선택지: 내 답에 맞춘 대화 상황
function situations() {
  const p = S.st.profile, out = [];
  const add = (cond, list) => { if (cond) out.push(...list); };
  add(has(p, "people", "동료·상사"), ["회의·업무 대화", "점심 스몰토크"]);
  add(has(p, "people", "고객·학부모"), [has(p, "job", "교육") ? "학부모 상담" : "고객 응대"]);
  add(has(p, "people", "친구"), ["친구 약속·근황 토크"]);
  add(has(p, "people", "연인"), ["데이트 계획"]);
  add(has(p, "people", "가족"), ["가족 안부 통화"]);
  add(has(p, "people", "처음 보는 사람"), ["모임에서 첫인사"]);
  add(has(p, "use", "여행"), ["여행 준비·예약"]);
  add(has(p, "job", "교육"), ["수업 시작·마무리"]);
  add(pv(p, "likes").length, [`${pv(p, "likes").filter(x => x !== UNSURE)[0] || "취미"} 이야기`]);
  out.push("카페·식당 주문", "전화·문자 약속 잡기");
  return [...new Set(out)].slice(0, 8);
}

// ---------- 공통: 한 화면에 질문 하나 ----------
function askOne(el, q, cur, { step, total, onDone, onBack, nextText = "다음" }) {
  const sel = new Set((cur && cur.sel) || []); let other = (cur && cur.other) || "";
  const isText = q.type === "text", multi = q.type === "multi";
  const draw = () => {
    el.innerHTML = `<div class="card">${total ? `<div class="count">${step} / ${total}</div>` : ""}<p class="ko">${esc(q.q)}</p>${q.ex ? `<p class="muted">${esc(q.ex)}</p>` : ""}
      ${isText ? `<label class="sr" for="tx">${esc(q.q)}</label><input id="tx" type="text" maxlength="20" autocomplete="off" value="${esc(other)}">`
        : `${q.opts.map((o, i) => `<button class="opt ${sel.has(o) ? "sel" : ""}" data-k="${i}">${esc(o)}</button>`).join("")}
        ${q.plain ? "" : `<button class="opt ${other ? "sel" : ""}" id="oth">기타 (직접 입력)</button><div id="ob" ${other ? "" : "hidden"}><label class="sr" for="ot">기타 내용</label><input id="ot" type="text" maxlength="60" autocomplete="off" placeholder="짧게 적어주세요" value="${esc(other)}"></div>
        <button class="opt ${sel.has(UNSURE) ? "sel" : ""}" id="uns">잘 모르겠어요 · 알아서 넣어주세요</button>`}`}
      ${multi && q.max ? `<p class="muted" id="cap">최대 ${q.max}개 · ${sel.size + (other ? 1 : 0)}개 골랐어요</p>` : ""}</div>
      <div class="row">${onBack ? `<button id="bk">이전</button>` : ""}<button class="go" id="nx">${nextText}</button></div>`;
    const ok = () => (isText ? !!$("#tx").value.trim() : sel.size > 0 || !!other.trim());
    const finish = () => onDone(isText ? { sel: [], other: $("#tx").value.trim() } : { sel: [...sel], other: other.trim() });
    $("#nx").disabled = !ok();
    $("#nx").onclick = () => ok() && finish();
    if (onBack) $("#bk").onclick = onBack;
    if (isText) { $("#tx").oninput = () => { $("#nx").disabled = !ok(); }; $("#tx").onkeydown = e => { if (e.key === "Enter" && ok()) finish(); }; return; }
    el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
      const o = q.opts[+b.dataset.k]; sel.delete(UNSURE);
      if (!multi) { sel.clear(); sel.add(o); other = ""; return finish(); } // 하나 고르는 질문은 누르면 바로 다음
      if (sel.has(o)) sel.delete(o); else if (sel.size + (other ? 1 : 0) < (q.max || 9)) sel.add(o);
      draw();
    });
    if (q.plain) return;
    $("#oth").onclick = () => { $("#ob").hidden = false; $("#ot").focus(); };
    $("#ot").oninput = () => { other = $("#ot").value; if (!multi && other.trim()) sel.clear(); sel.delete(UNSURE); $("#oth").classList.toggle("sel", !!other.trim()); $("#nx").disabled = !ok(); if ($("#cap")) $("#cap").textContent = `최대 ${q.max}개 · ${sel.size + (other.trim() ? 1 : 0)}개 골랐어요`; };
    $("#ot").onkeydown = e => { if (e.key === "Enter" && ok()) { e.preventDefault(); finish(); } };
    $("#uns").onclick = () => { sel.clear(); other = ""; sel.add(UNSURE); multi ? draw() : finish(); };
  };
  draw();
}
async function postData(path, data) {
  const r = await fetch(`${API}${path}?k=${encodeURIComponent(KEY)}`, { method: "POST", body: JSON.stringify({ data }) });
  if (!r.ok) throw new Error("저장 실패 " + r.status);
}
function saveFail(el, retry) {
  el.insertAdjacentHTML("beforeend", `<p class="muted gate">저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러주세요.</p><button class="go" id="rt">다시 저장</button>`);
  $("#rt").onclick = retry;
}

// ---------- 처음 질문지 (고치기도 같은 화면) ----------
ROUTES.profile = el => {
  const ans = { ...(S.st.profile || {}) }; delete ans.updatedAt;
  const list = () => PQ.filter(q => !q.when || q.when(ans));
  let i = 0;
  const show = () => {
    const L = list();
    if (i >= L.length) return save();
    const q = L[i];
    el.innerHTML = `<header><h1>나에 맞춘 레슨</h1><h2>${profileDone() ? "답 고치기" : "처음 질문지 · 약 3분"}</h2></header><section id="pq"></section>`;
    askOne($("#pq"), q, ans[q.id], { step: i + 1, total: L.length, nextText: i === L.length - 1 ? "저장하기" : "다음",
      onBack: i ? () => { i--; show(); } : null,
      onDone: a => { ans[q.id] = a; if (q.id === "event" && !list().some(x => x.id === "eventWhen")) delete ans.eventWhen; i++; show(); } });
  };
  const save = async () => {
    el.innerHTML = `<header><h1>나에 맞춘 레슨</h1><h2>저장 중…</h2></header>`;
    try {
      await postData("/api/profile", ans); S.st.profile = { ...ans, updatedAt: S.st.date }; track("profile", { n: Object.keys(ans).length });
      el.innerHTML = `<header><h1>나에 맞춘 레슨</h1><h2>저장했어요</h2></header><div class="card"><p class="ko">고마워요, ${esc(pv(ans, "name")[0] || "")}!</p>
        <p class="muted">다음 레슨부터 대화 속 '나'가 당신의 상황과 말투로 바뀌어요. ${CHECK_EVERY}일마다 1분짜리 체크가 홈에 나와요. 답은 언제든 고칠 수 있어요.</p>
        <button class="go" id="hm">홈으로</button></div>`;
      $("#hm").onclick = () => location.hash = "home";
    } catch (e) { el.innerHTML = `<header><h1>나에 맞춘 레슨</h1><h2>저장 실패</h2></header>`; saveFail(el, save); }
  };
  show();
};

// ---------- 3일 체크 (탭 3번) ----------
ROUTES.checkin = el => {
  if (!profileDone()) { location.hash = "profile"; return; }
  const d = nextDrill(), out = {};
  const steps = [
    { id: "soon", q: "앞으로 3일 안에 있을 대화 상황", ex: "최대 2개. 그 상황을 미리 연습하는 레슨이 나와요.", type: "multi", max: 2, opts: situations() },
    { id: "drill", q: d.q, ex: "점점 자세히 물어볼수록 대사가 더 나다워져요.", type: "one", opts: d.opts },
    { id: "fit", q: "지난 레슨 대화가 나 같았나요?", ex: "1 = 전혀 나 같지 않음 · 5 = 딱 나예요", type: "one", plain: true, opts: ["1", "2", "3", "4", "5"] },
  ];
  let i = 0;
  const show = () => {
    if (i >= steps.length) return extra();
    el.innerHTML = `<header><h1>3일 체크</h1><h2>약 1분</h2></header><section id="pq"></section>`;
    askOne($("#pq"), steps[i], out[steps[i].id], { step: i + 1, total: steps.length, onBack: i ? () => { i--; show(); } : null,
      onDone: a => { out[steps[i].id] = a; i++; show(); } });
  };
  const extra = () => { // 마지막: 선택 입력 (건너뛰기 가능)
    el.innerHTML = `<header><h1>3일 체크</h1><h2>마지막 · 선택</h2></header><div class="card">
      <label for="want">지난 3일 동안 "이건 영어로 뭐라고 하지?" 했던 말 (한국어로)</label><input id="want" type="text" maxlength="80" autocomplete="off" placeholder="예: 오늘 수업은 여기까지 할게">
      <label for="odd" style="margin-top:12px;display:block">지난 대화에서 어색했던 점</label><input id="odd" type="text" maxlength="80" autocomplete="off" placeholder="예: 나는 저렇게 길게 말 안 해요"></div>
      <div class="row"><button id="bk">이전</button><button class="go" id="sv">보내기</button></div>`;
    $("#bk").onclick = () => { i = steps.length - 1; show(); };
    const send = async () => {
      const data = { soon: out.soon, drill: { id: d.id, q: d.q, ...out.drill }, fit: +(out.fit.sel[0] || 0) || 0, want: $("#want") ? $("#want").value.trim() : "", odd: $("#odd") ? $("#odd").value.trim() : "" };
      $("#sv").disabled = true;
      try {
        await postData("/api/checkin", data); (S.st.checkins = S.st.checkins || []).push({ date: S.st.date, ...data }); track("checkin", { fit: data.fit });
        el.innerHTML = `<header><h1>3일 체크</h1><h2>보냈어요</h2></header><div class="card"><p class="muted">다음 맞춤 레슨에 반영할게요. 다음 체크는 ${CHECK_EVERY}일 뒤예요.</p><button class="go" id="hm">홈으로</button></div>`;
        $("#hm").onclick = () => location.hash = "home";
      } catch (e) { $("#sv").disabled = false; saveFail(el, send); }
    };
    $("#sv").onclick = send;
  };
  show();
};

// ---------- 추가 정보 보내기 (언제든) ----------
ROUTES.note = el => {
  const cats = ["다가오는 일정", "말투·성격", "배우고 싶은 말", "레슨 의견", "기타"]; let cat = "";
  el.innerHTML = `<header><h1>추가 정보 보내기</h1><h2>맞춤 레슨에 바로 반영돼요</h2></header><div class="card">
    <p class="muted">어떤 정보인가요?</p>${cats.map((c, i) => `<button class="opt" data-c="${i}">${c}</button>`).join("")}
    <label for="nt" style="margin-top:12px;display:block">내용</label><textarea id="nt" rows="3" maxlength="200" placeholder="예: 다음 주 화요일에 외국인 학부모와 첫 상담이 있어요"></textarea></div>
    <button class="go" id="sv" disabled>보내기</button><p class="muted" id="res"></p>`;
  const ok = () => { $("#sv").disabled = !(cat && $("#nt").value.trim()); };
  el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { cat = cats[+b.dataset.c]; el.querySelectorAll("[data-c]").forEach(x => x.classList.toggle("sel", x === b)); ok(); });
  $("#nt").oninput = ok;
  $("#sv").onclick = async () => {
    $("#sv").disabled = true;
    try { await postData("/api/note", { cat, text: $("#nt").value.trim() }); track("note", { cat }); $("#nt").value = ""; $("#res").textContent = "보냈어요. 다음 맞춤 레슨에 반영할게요."; }
    catch (e) { $("#res").textContent = "보내지 못했어요. 연결을 확인하고 다시 눌러주세요."; ok(); }
  };
};

// 홈에 넣는 카드
function personaCard() {
  if (!profileDone()) return `<div class="card"><h3>나에 맞춘 레슨</h3><p class="ko">3분 질문지로 대화를 내 이야기로 바꿔요</p>
    <p class="muted">직업, 자주 만나는 사람, 말투를 탭으로 고르면 레슨 속 '나'가 진짜 내가 돼요. 모르면 "알아서"를 눌러도 돼요.</p><button class="go" id="pf">질문지 시작</button></div>`;
  const due = checkDue();
  return `<div class="card"><h3>나에 맞춘 레슨</h3>${due ? `<p class="ko">3일 체크할 때예요 · 1분</p><p class="muted">앞으로 며칠 안에 있을 대화를 알려주면 그 상황을 미리 연습하는 레슨이 나와요.</p><button class="go" id="ck">3일 체크하기</button>`
    : `<p class="muted">다음 3일 체크는 ${(lastCheck() || {}).date ? "며칠 뒤" : "곧"} 나와요. 그 전에 알려줄 게 있으면 바로 보내세요.</p>`}
    <div class="row"><button id="nt">추가 정보 보내기</button><button id="pf">내 답 고치기</button></div></div>`;
}
function bindPersonaCard() {
  if ($("#pf")) $("#pf").onclick = () => location.hash = "profile";
  if ($("#ck")) $("#ck").onclick = () => location.hash = "checkin";
  if ($("#nt")) $("#nt").onclick = () => location.hash = "note";
}
