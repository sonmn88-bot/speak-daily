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
// 차원별 질문 (직업·관심사와 무관하게 '나'를 알아가는 질문) — 덜 채워진 차원부터
const DEEP = [
  { id: "e_joy", dim: "감정 표현", q: "정말 기쁜 일이 생기면 나는", opts: ["바로 주변에 알린다", "가까운 한두 명에게만 말한다", "혼자 조용히 즐긴다", "축하 자리를 만든다"] },
  { id: "e_angry", dim: "감정 표현", q: "화가 나면 나는", opts: ["그 자리에서 말한다", "티는 나지만 말은 안 한다", "시간이 지나고 차분히 말한다", "그냥 넘긴다"] },
  { id: "e_sad", dim: "감정 표현", q: "속상한 일이 있으면", opts: ["누군가에게 털어놓는다", "혼자 정리한다", "운동이나 취미로 푼다", "맛있는 걸 먹는다"] },
  { id: "st_busy", dim: "스트레스", q: "일이 몰려서 바쁠 때 나는", opts: ["목록을 만들어 하나씩 처리", "급한 것부터 몰아서", "도움을 요청한다", "잠깐 쉬고 다시 시작"] },
  { id: "st_fail", dim: "스트레스", q: "일이 잘 안 풀리면", opts: ["원인을 분석한다", "다른 방법을 바로 시도한다", "잠깐 내려놓는다", "주변에 조언을 구한다"] },
  { id: "h_style", dim: "유머", q: "내 유머 스타일은", opts: ["상황을 재밌게 꼬는 말장난", "나를 낮추는 셀프 디스", "과장된 리액션", "유머는 잘 안 쓰는 편"] },
  { id: "h_when", dim: "유머", q: "농담을 하는 건 주로", opts: ["처음 만난 사람과 어색할 때", "친한 사람과만", "분위기가 무거울 때", "거의 안 해요"] },
  { id: "d_pick", dim: "결정 방식", q: "메뉴를 고를 때 나는", opts: ["바로 정한다", "후기·추천을 찾아본다", "상대에게 맞춘다", "늘 먹던 걸 시킨다"] },
  { id: "d_big", dim: "결정 방식", q: "큰 결정을 할 때는", opts: ["혼자 충분히 고민한다", "믿는 사람과 상의한다", "직감을 따른다", "장단점을 적어본다"] },
  { id: "r_friend", dim: "관계별 말투", q: "친한 친구와 말할 때 나는", opts: ["장난이 많다", "편하지만 차분하다", "리액션이 크다", "주로 들어준다"] },
  { id: "r_work", dim: "관계별 말투", q: "일로 만나는 사람과 말할 때 나는", opts: ["예의 바르고 간결하게", "친근하게 분위기를 푼다", "필요한 말만", "먼저 스몰토크를 건다"] },
  { id: "r_new", dim: "관계별 말투", q: "처음 만난 사람에게 나는 주로", opts: ["질문을 많이 한다", "내 얘기를 먼저 한다", "공통점을 찾는다", "상대가 말하길 기다린다"] },
  { id: "t_love", dim: "좋아하는 화제", q: "시간 가는 줄 모르고 하는 이야기는", opts: ["일·커리어", "돈·재테크", "취미·콘텐츠", "사람·연애·관계"] },
  { id: "t_avoid", dim: "좋아하는 화제", q: "되도록 피하고 싶은 화제는", opts: ["정치·사회 이슈", "개인적인 사생활", "돈 이야기", "딱히 없어요"] },
  { id: "v_value", dim: "가치관", q: "요즘 나에게 가장 중요한 건", opts: ["성장·실력", "여유·건강", "사람·관계", "돈·안정"] },
  { id: "v_proud", dim: "가치관", q: "내가 자랑스러운 순간은", opts: ["목표를 이뤘을 때", "누군가를 도왔을 때", "꾸준히 해냈을 때", "새로운 걸 시도했을 때"] },
  { id: "w_weekend", dim: "생활", q: "완벽한 주말은", opts: ["집에서 푹 쉬기", "약속 꽉 채우기", "혼자 취미 즐기기", "즉흥 나들이"] },
  { id: "w_morning", dim: "생활", q: "아침의 나는", opts: ["일찍 일어나 루틴대로", "알람 여러 번 끄고 겨우", "날마다 다르다", "늦게 자고 늦게 일어난다"] },
  { id: "c_listen", dim: "대화 습관", q: "상대가 길게 이야기하면 나는", opts: ["끝까지 듣는다", "중간중간 질문한다", "내 경험을 덧붙인다", "요점을 정리해준다"] },
  { id: "c_story", dim: "대화 습관", q: "내 이야기를 할 때 나는", opts: ["짧고 굵게", "길고 자세하게", "재밌게 각색해서", "묻는 것만 답한다"] },
];
const DIMS = [...new Set(DEEP.map(d => d.dim))];

// 답 꺼내기: { sel: [...], other: "" } 형식
function pv(p, id) { const a = p && p[id]; return a ? [...(a.sel || []), ...(a.other ? [a.other] : [])] : []; }
const profileDone = () => !!(S.st.profile && S.st.profile.name);
const lastCheck = () => (S.st.checkins || []).slice(-1)[0];
function checkDue() {
  if (!profileDone()) return false;
  const base = (lastCheck() || {}).date || S.st.profile.updatedAt;
  return !base || (Date.parse(S.st.date) - Date.parse(base)) / DAYMS >= CHECK_EVERY;
}
function askedIds() {
  const ids = new Set();
  for (const c of S.st.checkins || []) { if (c.drill) ids.add(c.drill.id); for (const d of c.deep || []) ids.add(d.id); }
  return ids;
}
function nextDeep(n = 2) {
  const p = S.st.profile, asked = askedIds(), out = [];
  const nc = S.st.nextCheck && Array.isArray(S.st.nextCheck.questions) ? S.st.nextCheck.questions : [];
  for (const q of nc) if (q && q.id && q.q && Array.isArray(q.opts) && q.opts.length >= 2 && !asked.has(q.id) && out.length < n) out.push({ ...q, src: "ai" });
  for (const d of DRILL) if (out.length < n && d.when(p) && !asked.has(d.id) && !out.some(o => o.dim === "직업·관심사")) out.push({ id: d.id, q: d.q, opts: d.opts, dim: "직업·관심사", src: "bank" }); // 직업·관심사는 한 번에 1개까지
  const cover = {}; for (const c of S.st.checkins || []) for (const d of c.deep || []) cover[d.dim] = (cover[d.dim] || 0) + 1;
  const left = DEEP.filter(d => !asked.has(d.id)).sort((a, b) => (cover[a.dim] || 0) - (cover[b.dim] || 0) || DIMS.indexOf(a.dim) - DIMS.indexOf(b.dim));
  for (const d of left) if (out.length < n && !out.some(o => o.dim === d.dim)) out.push({ ...d, src: "bank" });
  for (const d of left) if (out.length < n && !out.some(o => o.id === d.id)) out.push({ ...d, src: "bank" });
  if (out.length < n) { const all = [...DRILL.filter(d => d.when(p)), ...DEEP]; while (out.length < n && all.length) out.push({ ...all[((S.st.checkins || []).length * 7 + out.length) % all.length], src: "again" }); } // 다 물었으면 예전 질문을 다시 (답이 바뀌었는지)
  return out.slice(0, n);
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
ROUTES.profile = (el, parts = []) => {
  const thenLesson = parts[0] === "go"; // 레슨 시작 전에 들어온 경우: 끝나면 바로 레슨으로
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
        <p class="muted">내일 새벽부터 아직 안 한 레슨의 대화 속 '나'가 당신의 상황과 말투로 바뀌어요. ${CHECK_EVERY}일마다 1분짜리 체크가 홈에 나와요. 답은 언제든 고칠 수 있어요.</p>
        ${thenLesson ? `<button class="go" id="gl">레슨 ${S.n} 시작</button><button id="hm">홈으로</button>` : `<button class="go" id="hm">홈으로</button>`}</div>`;
      $("#hm").onclick = () => location.hash = "home"; if ($("#gl")) $("#gl").onclick = startFromGate;
    } catch (e) { el.innerHTML = `<header><h1>나에 맞춘 레슨</h1><h2>저장 실패</h2></header>`; saveFail(el, save); }
  };
  show();
};

// ---------- 3일 체크 (탭 3번) ----------
ROUTES.checkin = (el, parts = []) => {
  const thenLesson = parts[0] === "go";
  if (!profileDone()) { location.hash = "profile"; return; }
  const deep = nextDeep(2), out = {};
  const steps = [
    { id: "soon", q: "앞으로 3일 안에 있을 대화 상황", ex: "최대 2개. 그 상황을 미리 연습하는 레슨이 나와요.", type: "multi", max: 2, opts: situations() },
    ...deep.map((d, k) => ({ id: "deep" + k, q: d.q, ex: d.ex || (d.src === "ai" ? "지난 답을 보고 만든 질문이에요. 점점 더 나다운 대사가 돼요." : "나를 알아가는 질문이에요. 레슨 속 '나'의 말과 행동이 돼요."), type: "one", opts: d.opts })),
    { id: "fit", q: "지난 레슨 대화가 나 같았나요?", ex: "1 = 전혀 나 같지 않음 · 5 = 딱 나예요", type: "one", plain: true, opts: ["1", "2", "3", "4", "5"] },
  ];
  let i = 0;
  const show = () => {
    if (i >= steps.length) return extra();
    el.innerHTML = `<header><h1>3일 체크</h1><h2>약 1~2분</h2></header><section id="pq"></section>`;
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
      const data = { soon: out.soon, deep: deep.map((d, k) => ({ id: d.id, q: d.q, dim: d.dim || "", src: d.src, ...(out["deep" + k] || {}) })), fit: +(out.fit.sel[0] || 0) || 0, want: $("#want") ? $("#want").value.trim() : "", odd: $("#odd") ? $("#odd").value.trim() : "" };
      $("#sv").disabled = true;
      try {
        await postData("/api/checkin", data); (S.st.checkins = S.st.checkins || []).push({ date: S.st.date, ...data }); track("checkin", { fit: data.fit });
        el.innerHTML = `<header><h1>3일 체크</h1><h2>보냈어요</h2></header><div class="card"><p class="muted">내일 새벽에 다음 레슨들에 반영돼요. 다음 체크는 ${CHECK_EVERY}일 뒤예요.</p>
          ${thenLesson ? `<button class="go" id="gl">레슨 ${S.n} 시작</button><button id="hm">홈으로</button>` : `<button class="go" id="hm">홈으로</button>`}</div>`;
        $("#hm").onclick = () => location.hash = "home"; if ($("#gl")) $("#gl").onclick = startFromGate;
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
    <p class="muted">직업, 자주 만나는 사람, 말투를 탭으로 고르면 레슨 속 '나'가 진짜 내가 돼요. 모르면 "알아서"를 눌러도 돼요.</p><button class="go2" id="pf">질문지 시작</button></div>`;
  const due = checkDue();
  return `<div class="card"><h3>나에 맞춘 레슨</h3>${due ? `<p class="ko">3일 체크할 때예요 · 1분</p><p class="muted">앞으로 며칠 안에 있을 대화를 알려주면 그 상황을 미리 연습하는 레슨이 나와요.</p><button class="go2" id="ck">3일 체크하기</button>`
    : `<p class="muted">다음 3일 체크는 ${(lastCheck() || {}).date ? "며칠 뒤" : "곧"} 나와요. 그 전에 알려줄 게 있으면 바로 보내세요.</p>`}
    ${testLine()}
    <div class="row"><button id="nt">추가 정보 보내기</button><button id="pf">내 답 고치기</button></div></div>`;
}
function bindPersonaCard() {
  if ($("#pf")) $("#pf").onclick = () => location.hash = "profile";
  if ($("#ck")) $("#ck").onclick = () => location.hash = "checkin";
  if ($("#nt")) $("#nt").onclick = () => location.hash = "note";
  if ($("#tn")) $("#tn").onclick = () => location.hash = "test/" + $("#tn").dataset.k;
  if ($("#mec")) $("#mec").onclick = () => location.hash = "me";
}

// ---------- 홈 상단 배치·레슨 시작 전 안내 ----------
const gateKey = k => `sd_gate_${S.st.date}_${k}`;
const skipped = k => { try { return localStorage.getItem(gateKey(k)) === "1"; } catch (e) { return false; } };
const skip = k => { try { localStorage.setItem(gateKey(k), "1"); } catch (e) {} };
const personaUrgent = () => !profileDone() || checkDue(); // 할 일이 있으면 홈 맨 위로
function startFromGate() {
  if (LS && LS.practice) LS = null;
  if (S.st.today.done && S.today) startLesson();
  location.hash = "learn";
}
// 레슨 시작을 누르면: 질문지가 없거나 3일 체크 날이면 한 번 물어봄 (그날 '바로 시작'을 고르면 다시 안 물음)
function lessonGate(box, go) {
  const kind = !profileDone() ? "profile" : checkDue() ? "checkin" : null;
  if (!kind || skipped(kind)) return false;
  box.innerHTML = `<div class="card" style="margin-top:12px;border:1px solid var(--now)"><p class="ko">${kind === "profile" ? "3분 질문지를 먼저 할까요?" : "3일 체크할 때예요 · 1분"}</p>
    <p class="muted">${kind === "profile" ? "직업·자주 만나는 사람·말투를 탭으로 고르면, 앞으로의 레슨 대화가 내 이야기로 바뀌어요." : "앞으로 3일 안에 있을 대화를 알려주면, 그 상황을 미리 연습하는 레슨으로 바꿔줘요."} 끝나면 바로 레슨으로 이어져요.</p>
    <button class="go" id="gyes">${kind === "profile" ? "질문지 하고 시작" : "체크하고 시작"}</button><button id="gno">오늘은 바로 레슨 시작</button></div>`;
  $("#gyes").onclick = () => { location.hash = kind + "/go"; };
  $("#gno").onclick = () => { skip(kind); track("gateSkip", { kind }); go(); };
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

// ---------- 처음 온 사람에게 사용법 안내 ----------
const helpSeen = () => { try { return localStorage.getItem("sd_help_seen") === "1"; } catch (e) { return true; } };
function introCard() {
  if (helpSeen()) return "";
  return `<div class="card" id="intro"><p class="ko">처음이세요? 1분 사용법</p><p class="muted">레슨 순서, 채점, 복습 시기를 정리해뒀어요. 오른쪽 위 ? 버튼으로 다시 볼 수 있어요.</p>
    <div class="row"><button class="go2" id="ih">사용법 보기</button><button id="ix">닫기</button></div></div>`;
}
function bindIntro() {
  if (!$("#intro")) return;
  const seen = () => { try { localStorage.setItem("sd_help_seen", "1"); } catch (e) {} };
  $("#ih").onclick = () => { seen(); location.hash = "help"; };
  $("#ix").onclick = () => { seen(); $("#intro").remove(); };
}

// ---------- 도움말 ----------
ROUTES.help = el => {
  try { localStorage.setItem("sd_help_seen", "1"); } catch (e) {}
  const sec = (t, body, open) => `<details class="hp"${open ? " open" : ""}><summary>${t}</summary>${body}</details>`;
  el.innerHTML = `<header><h1>사용법</h1><h2>하루 15분, 이렇게 쓰면 돼요</h2></header><div class="card">
  ${sec("이 앱은 어떻게 말을 늘려주나요?", `<p>보고 이해하는 것보다 <b>직접 떠올려 말해보는 것</b>이 훨씬 오래 남아요. 그래서 레슨 대부분이 "한국어를 보고 → 영어로 먼저 말해보고 → 정답 확인" 순서예요.</p>
    <p>틀리거나 느렸던 표현은 잊어버리기 직전에 다시 나와요(1일·3일·7일·16일·35일 뒤). 그리고 질문지에 답하면 대화 속 '나'가 진짜 내 상황과 말투로 바뀌어서 바로 써먹을 수 있어요.</p>`, true)}
  ${sec("레슨 순서", `<ol><li><b>워밍업</b> · 복습할 때가 된 지난 표현</li><li><b>듣기</b> · 오늘 대화를 듣고 문제 하나</li><li><b>표현</b> · 오늘 표현 5개를 따라 말하기 (내 문장 만들기는 선택)</li><li><b>드릴</b> · 빈칸·조립·상황 고르기</li><li><b>섀도잉</b> · 내 대사를 소리 내 따라 하기</li><li><b>인출</b> · 상대 말을 보고 내 대사를 영어로</li><li><b>마무리</b> · 오늘 표현을 다시 떠올리기 (기억 기록에 가장 중요)</li><li><b>롤플레이</b> · 다른 상황에서 오늘 표현 쓰기</li><li><b>즉흥</b> · 표현과 순서를 보며 말하기 → 모범 답 → 점점 혼자</li></ol>
    <p>중간에 닫아도 다음에 그 단계부터 이어져요.</p>`)}
  ${sec("O · △ · X는 어떻게 고르나요?", `<p><b>O</b> 3초 안에 정확히 말했을 때 · <b>△</b> 느렸거나 표현이 조금 달랐을 때 · <b>X</b> 못 떠올렸을 때.</p><p>정직하게 고를수록 복습이 딱 필요한 때 나와요. 정답을 늦게 열면 O는 못 고르게 돼 있어요.</p>`)}
  ${sec("나에 맞춘 레슨 (질문지 · 3일 체크)", `<p>처음 질문지(3분)와 3일마다 체크(1분)에 답하면, 다음 날 새벽에 <b>아직 안 한 레슨</b>의 대화가 내 상황으로 바뀌어요. 이미 한 레슨은 바뀌지 않아요.</p>
    <p>모르는 질문은 "알아서"를 누르면 돼요. 다가오는 일정이나 배우고 싶은 말은 홈의 <b>추가 정보 보내기</b>로 언제든 알려주세요.</p>`)}
  ${sec("소리 모드 · 조용한 모드", `<p>밖에서 소리 내기 어려우면 홈에서 <b>조용한 모드</b>로 바꾸세요. 말하기 대신 직접 입력하고 고르는 방식이에요. 그래도 일주일에 사흘 이상은 소리 내 말하는 게 좋아요.</p>`)}
  ${sec("이동 중 복습", `<p><b>듣기 모드</b>: 이어폰으로 지난 대화를 듣고 내 차례에 먼저 말해보기, 또는 <b>표현 떠올리기</b>(한국어를 듣고 영어로 먼저 말하기). <b>표현 카드</b>: 배운 표현을 카드로 넘기며 복습.</p>`)}
  ${sec("카톡 알림 · 미리 하기", `<p>오늘 레슨을 끝낼 때까지 하루 최대 4번(8·12·18·21시) 알림이 와요. 끝내면 멈추고, 저녁에 복습 퀴즈 하나가 와요.</p>
    <p>원하면 다음 레슨을 미리 해도 돼요. 다만 하루 2레슨이 넘으면 기억에 남는 양이 줄어서, 남은 시간엔 복습을 추천해요.</p>`)}
  ${sec("월간 기준 테스트", `<p>한 달에 한 번 같은 질문 3개에 답해 녹음해요. 달마다 내 말하기가 어떻게 달라졌는지 직접 비교해 들을 수 있어요.</p>`)}
  </div><button class="go" id="hm">홈으로</button>`;
  $("#hm").onclick = () => location.hash = "home";
};

// ===== 성격·상황·말투 검사 → 캐릭터 시트의 재료 =====
// 성격: Mini-IPIP (Donnellan 외 2006, 공개 IPIP 문항) 20문항을 한국어로 옮김. 공식 한국어판 아님 · 진단 아님 · 캐릭터 설계 참고용
const LIKERT = ["전혀 아니다", "아닌 편이다", "보통이다", "그런 편이다", "매우 그렇다"];
const BF = [ // [문항, 요인, 역채점]
  ["모임에서 분위기를 띄우는 편이다", "E", 0], ["다른 사람의 감정에 공감하는 편이다", "A", 0], ["할 일이 생기면 미루지 않고 바로 한다", "C", 0], ["기분 변화가 잦은 편이다", "N", 0], ["상상력이 풍부한 편이다", "O", 0],
  ["말수가 적은 편이다", "E", 1], ["다른 사람의 고민에는 별로 관심이 없다", "A", 1], ["물건을 제자리에 두는 걸 자주 잊는다", "C", 1], ["대부분의 시간에 마음이 편안하다", "N", 1], ["추상적인 생각에는 흥미가 없다", "O", 1],
  ["모임에서 여러 사람과 두루 이야기한다", "E", 0], ["다른 사람의 기분을 잘 느낀다", "A", 0], ["정리정돈된 상태를 좋아한다", "C", 0], ["쉽게 속상해지는 편이다", "N", 0], ["추상적인 개념은 이해하기 어렵다", "O", 1],
  ["눈에 띄지 않게 뒤에 있는 편이다", "E", 1], ["다른 사람에게 크게 관심이 없다", "A", 1], ["일을 엉망으로 만들 때가 있다", "C", 1], ["우울한 기분은 거의 들지 않는다", "N", 1], ["상상력이 풍부한 편은 아니다", "O", 1],
];
const MBTI = [["에너지", ["E (외향)", "I (내향)"]], ["정보", ["S (감각)", "N (직관)"]], ["판단", ["T (사고)", "F (감정)"]], ["생활", ["J (계획)", "P (즉흥)"]]];
const SITU = [
  ["음식이 주문과 다르게 나왔다", ["그냥 먹는다", "웃으며 조심스럽게 말한다", "바로 정확히 말한다", "같이 간 사람에게 말해달라고 한다"]],
  ["처음 보는 사람이 옆자리에 앉았다", ["먼저 가볍게 말을 건다", "눈인사 정도만 한다", "상대가 말 걸면 반갑게 받는다", "내 할 일에 집중한다"]],
  ["대화 중 모르는 단어가 나왔다", ["바로 무슨 뜻이냐고 묻는다", "맥락으로 짐작하고 넘어간다", "아는 척 고개를 끄덕인다", "나중에 찾아본다"]],
  ["친구가 말없이 30분 늦었다", ["괜찮다고 웃어넘긴다", "농담으로 한마디 한다", "다음엔 미리 연락하라고 솔직히 말한다", "기다리며 내 할 일을 한다"]],
  ["친구와 의견이 부딪쳤다", ["내 의견을 끝까지 설명한다", "상대 말을 먼저 듣고 맞춰준다", "농담으로 분위기를 푼다", "중간 지점을 제안한다"]],
  ["하기 싫은 부탁을 받았다", ["이유를 대고 정중히 거절한다", "일단 들어준다", "생각해보겠다며 시간을 번다", "대신 다른 방법을 제안한다"]],
  ["칭찬을 받았다", ["아니라며 손사래 친다", "고맙다고 웃는다", "농담으로 받는다", "상대 칭찬으로 돌려준다"]],
  ["내 실수로 약속에 늦었다", ["짧게 사과하고 바로 본론", "이유를 자세히 설명하며 사과", "웃으며 사과하고 커피를 산다", "미리 연락해서 양해를 구한다"]],
  ["재밌었던 일을 이야기할 때", ["결론부터 말한다", "처음부터 순서대로 자세히", "표정과 리액션을 크게 섞는다", "짧게 말하고 상대 반응을 본다"]],
  ["상대가 좋은 소식을 전했다", ["크게 리액션한다", "차분하게 축하한다", "어떻게 된 건지 자세히 묻는다", "축하하며 밥이나 선물을 제안한다"]],
  ["모임에서 나는 주로", ["대화를 이끈다", "분위기를 띄운다", "잘 들어준다", "친한 사람과만 이야기한다"]],
  ["서비스가 불만족스러웠다", ["그 자리에서 바로 말한다", "참고 다음에 안 간다", "정중하게 개선을 부탁한다", "후기로 남긴다"]],
  ["처음 가는 곳에서 길을 잃었다", ["바로 사람에게 묻는다", "지도 앱으로 혼자 해결한다", "일행에게 맡긴다", "일단 걸으며 찾아본다"]],
  ["대화가 끊겨 어색해졌다", ["새 화제를 꺼낸다", "상대에게 질문한다", "농담을 던진다", "상대가 말할 때까지 기다린다"]],
  ["누군가에게 고마운 일이 생겼다", ["그 자리에서 말로 고맙다고 한다", "나중에 메시지로 전한다", "밥이나 작은 선물로 갚는다", "행동으로 은근히 표현한다"]],
];
const VOICE = [
  ["친구가 승진했다고 할 때", ["헐 대박! 축하해!!", "오 잘됐다, 고생 많았어", "진짜? 어떻게 된 거야?", "축하해! 오늘 내가 쏠게"]],
  ["카페에서 주문할 때", ["아이스 아메리카노 하나요.", "안녕하세요~ 아이스 아메리카노 하나 주세요!", "음… 여기 뭐가 맛있어요?", "늘 먹던 걸로 주세요"]],
  ["친구가 고민을 털어놓을 때", ["헐… 진짜 힘들었겠다", "그래서 어떻게 할 건데?", "괜찮아, 다 잘될 거야", "일단 맛있는 거 먹으러 가자"]],
  ["약속 시간을 정할 때", ["7시 어때?", "난 아무 때나 괜찮아, 너 편할 때!", "7시랑 8시 중에 골라", "일단 저녁쯤 보고 연락하자"]],
  ["맛있는 걸 먹었을 때", ["와 미쳤다…", "오 맛있네", "이거 뭐 들어간 거지?", "다음에 또 오자"]],
  ["모르는 사람에게 길을 물을 때", ["저기요, 역이 어디예요?", "죄송한데 혹시 역 어떻게 가는지 아세요?", "역 이쪽 맞죠?", "묻기 전에 지도부터 본다"]],
  ["친구 답장이 늦었을 때", ["왜 이제 봐ㅋㅋ", "괜찮아~", "바빴어?", "ㅇㅇ"]],
  ["약속을 거절할 때", ["아 미안, 그날은 안 돼", "가고 싶은데 그날 일이 있어서… 다음엔 꼭!", "음 생각해볼게", "그날은 안 되고, 대신 토요일은?"]],
  ["깜짝 놀랐을 때", ["헐", "진짜?", "말도 안 돼", "오…"]],
  ["헤어지면서", ["나 가볼게!", "오늘 진짜 재밌었다, 또 보자", "조심히 들어가~ 도착하면 연락해", "다음엔 내가 살게"]],
];
const TESTS = {
  bigfive: { name: "성격 검사", time: "약 3분 · 20문항", desc: "평소의 나에 가장 가까운 정도를 고르세요. 정답은 없어요. 대화 속 '나'가 먼저 말을 거는지, 어떻게 반응하는지 정하는 데 써요.",
    qs: () => [...BF.map(([q], i) => ({ id: "b" + (i + 1), q, ex: "평소의 나 기준으로", type: "one", plain: true, opts: LIKERT })),
      ...MBTI.map(([q, o], i) => ({ id: "m" + (i + 1), q: `(선택) MBTI를 안다면 · ${q}`, ex: "몰라도 괜찮아요. '잘 모르겠어요'를 누르세요.", type: "one", opts: o }))] },
  situ: { name: "상황별 반응", time: "약 3분 · 15문항", desc: "이럴 때 실제로 어떻게 하는지 고르세요. 레슨 속 장면에서 '나'가 그렇게 행동해요.",
    qs: () => SITU.map(([q, o], i) => ({ id: "s" + (i + 1), q: q + " → 나는?", ex: "가장 자주 하는 행동 하나", type: "one", opts: o })) },
  voice: { name: "말투 고르기", time: "약 2분 · 10문항", desc: "같은 상황에서 가장 '나 같은' 말을 고르세요. 고른 말투가 영어 대사의 톤과 길이로 옮겨져요.",
    qs: () => VOICE.map(([q, o], i) => ({ id: "v" + (i + 1), q, ex: "가장 나 같은 말 하나", type: "one", opts: o })) },
};
const TORDER = ["bigfive", "situ", "voice"];
const testsDone = () => TORDER.filter(k => S.st.tests && S.st.tests[k]);
function bigFive(ans) { // 요인별 평균 1~5 (N은 정서 안정성으로 뒤집어 표시)
  const sum = {}, cnt = {};
  BF.forEach(([, f, r], i) => { const a = ans["b" + (i + 1)]; const v = a && LIKERT.indexOf((a.sel || [])[0]) + 1; if (!v) return; const x = r ? 6 - v : v; sum[f] = (sum[f] || 0) + x; cnt[f] = (cnt[f] || 0) + 1; });
  const m = f => (cnt[f] ? Math.round((sum[f] / cnt[f]) * 10) / 10 : null);
  return { E: m("E"), A: m("A"), C: m("C"), S: m("N") == null ? null : Math.round((6 - m("N")) * 10) / 10, O: m("O") };
}
const BF_TXT = { E: ["외향성", "대화를 먼저 열고 분위기를 이끄는 편", "먼저 나서기보다 듣고 받아주는 편"], A: ["친화성", "상대 감정에 잘 공감하는 편", "감정보다 사실과 해결에 집중하는 편"],
  C: ["성실성", "계획하고 정리하는 걸 좋아하는 편", "그때그때 유연하게 움직이는 편"], S: ["정서 안정성", "문제가 생겨도 침착한 편", "감정을 솔직하게 드러내는 편"], O: ["개방성", "새로운 것과 아이디어를 즐기는 편", "익숙하고 검증된 걸 좋아하는 편"] };
const bfLine = (k, v) => v == null ? "" : `${BF_TXT[k][0]} ${v}/5 · ${v >= 3.6 ? BF_TXT[k][1] : v <= 2.4 ? BF_TXT[k][2] : "상황에 따라 균형 있게"}`;
function testLine() {
  const done = testsDone(), next = TORDER.find(k => !done.includes(k));
  const old = ["situ", "voice"].find(k => S.st.tests && S.st.tests[k] && (Date.parse(S.st.date) - Date.parse(S.st.tests[k].date)) / DAYMS >= 60);
  if (!next && old) return `<p class="muted" style="margin-top:12px">${TESTS[old].name}를 한 지 두 달이 지났어요. 그사이 달라졌을 수 있어요.</p><div class="row"><button id="tn" data-k="${old}">${TESTS[old].name} 다시 하기</button><button id="mec">내 캐릭터 보기</button></div>`;
  return `<p class="muted" style="margin-top:12px">성격·말투 검사 ${done.length}/3 · 할수록 대사가 더 나다워져요</p><div class="row">${next ? `<button id="tn" data-k="${next}">${TESTS[next].name} (${TESTS[next].time.split(" · ")[0]})</button>` : ""}${done.length ? `<button id="mec">내 캐릭터 보기</button>` : ""}</div>`;
}

ROUTES.test = (el, parts = []) => {
  const kind = TESTS[parts[0]] ? parts[0] : TORDER.find(k => !testsDone().includes(k)) || "bigfive", T = TESTS[kind], qs = T.qs();
  const ans = {}; let i = -1;
  const show = () => {
    if (i < 0) {
      el.innerHTML = `<header><h1>${T.name}</h1><h2>${T.time}</h2></header><div class="card"><p class="muted">${T.desc}</p>
        <p class="muted">답은 레슨 대화를 만드는 데만 쓰여요. 진단이 아니고, 언제든 다시 할 수 있어요.</p><button class="go" id="st">시작</button></div>`;
      $("#st").onclick = () => { i = 0; show(); }; return;
    }
    if (i >= qs.length) return save();
    el.innerHTML = `<header><h1>${T.name}</h1><h2>${T.time.split(" · ")[0]}</h2></header><section id="pq"></section>`;
    askOne($("#pq"), qs[i], ans[qs[i].id], { step: i + 1, total: qs.length, nextText: i === qs.length - 1 ? "저장하기" : "다음",
      onBack: i ? () => { i--; show(); } : null, onDone: a => { ans[qs[i].id] = a; i++; show(); } });
  };
  const save = async () => {
    const data = { kind, answers: ans };
    if (kind === "bigfive") data.scores = bigFive(ans);
    el.innerHTML = `<header><h1>${T.name}</h1><h2>저장 중…</h2></header>`;
    try {
      await postData("/api/test", data); (S.st.tests = S.st.tests || {})[kind] = { ...data, date: S.st.date }; track("test", { kind });
      const next = TORDER.find(k => !testsDone().includes(k));
      el.innerHTML = `<header><h1>${T.name}</h1><h2>저장했어요</h2></header>${meHTML([kind])}
        <div class="card"><p class="muted">내일 새벽부터 아직 안 한 레슨의 '나'에 반영돼요.</p>${next ? `<button class="go" id="nx2">이어서 ${TESTS[next].name} (${TESTS[next].time.split(" · ")[0]})</button>` : ""}<button id="hm">홈으로</button></div>`;
      $("#hm").onclick = () => location.hash = "home"; if ($("#nx2")) $("#nx2").onclick = () => location.hash = "test/" + next;
    } catch (e) { el.innerHTML = `<header><h1>${T.name}</h1><h2>저장 실패</h2></header>`; saveFail(el, save); }
  };
  show();
};

// 결과 요약 (부정적인 표현 없이, 레슨에 어떻게 쓰이는지 중심)
function meHTML(only) {
  const t = S.st.tests || {}, out = [];
  const show = k => (!only || only.includes(k)) && t[k];
  if (show("bigfive")) {
    const sc = t.bigfive.scores || bigFive(t.bigfive.answers || {}), mb = [1, 2, 3, 4].map(n => ((t.bigfive.answers || {})["m" + n] || {}).sel || []).map(x => (x[0] && x[0] !== UNSURE ? x[0][0] : "")).join("");
    out.push(`<div class="card"><h3>성격</h3>${["E", "A", "C", "S", "O"].map(k => sc[k] == null ? "" : `<p class="muted">${esc(bfLine(k, sc[k]))}</p>`).join("")}${mb.length === 4 ? `<p class="muted">MBTI ${esc(mb)}</p>` : ""}</div>`);
  }
  const picks = (k, list, pre) => Object.entries((t[k] || {}).answers || {}).slice(0, 6).map(([id, a]) => { const n = +id.slice(1) - 1; const s0 = (a.sel || [])[0], v = s0 === UNSURE ? "알아서" : s0 || a.other; return list[n] ? `<li>${esc(list[n][0])}: ${esc(v || "")}</li>` : ""; }).join("");
  if (show("situ")) out.push(`<div class="card"><h3>이럴 때 나는</h3><ul>${picks("situ", SITU)}</ul><p class="muted">레슨 속 장면에서 '나'가 이렇게 행동해요.</p></div>`);
  if (show("voice")) out.push(`<div class="card"><h3>내 말투</h3><ul>${picks("voice", VOICE)}</ul><p class="muted">이 말투가 영어 대사의 감탄사·길이·톤으로 옮겨져요.</p></div>`);
  return out.join("");
}
ROUTES.me = el => {
  const done = testsDone();
  el.innerHTML = `<header><h1>내 캐릭터</h1><h2>레슨 속 '나'를 만드는 재료</h2></header>${meHTML() || `<div class="card"><p class="muted">아직 끝낸 검사가 없어요.</p></div>`}
    <div class="card"><h3>검사</h3>${TORDER.map(k => `<button data-t="${k}">${TESTS[k].name} · ${done.includes(k) ? "다시 하기" : TESTS[k].time}</button>`).join("")}</div><button id="hm">홈으로</button>`;
  el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => location.hash = "test/" + b.dataset.t);
  $("#hm").onclick = () => location.hash = "home";
};
