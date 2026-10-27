// ===== 공통: 서버 연결, 음성, 화면 전환 =====
const API = "https://speak-daily.sonmn88.workers.dev";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAYMS = 86400000;

const qs = new URLSearchParams(location.search);
let KEY = qs.get("k");
try { if (KEY) localStorage.setItem("sd_k", KEY); else KEY = localStorage.getItem("sd_k"); } catch (e) {}

const S = {};     // 서버 상태와 콘텐츠
let LS = null;    // 진행 중인 학습 세션 (learn.js)
let RUN = 0;      // 화면이 바뀌면 진행 중인 재생·타이머를 멈추는 토큰

// ---------- 데이터 ----------
async function loadAll() {
  const r = await fetch(`${API}/api/state?k=${encodeURIComponent(KEY)}`);
  if (!r.ok) throw new Error(r.status);
  S.st = await r.json();
  S.st.history = S.st.history || []; S.st.srs = S.st.srs || {}; S.st.today = S.st.today || {};
  S.st.mine = { ...loadMineLocal(), ...(S.st.mine || {}) }; // 내 문장: 서버 우선, 이 기기 사본으로 보완
  S.n = S.st.n; S.week = Math.ceil(S.n / 7); S.dw = ((S.n - 1) % 7) + 1;
  S.monthly = S.week % 4 === 0 && S.dw >= 6;
  S.weeks = {}; S.chunks = {};
  const ws = Array.from({ length: S.week }, (_, i) => i + 1); // 주차 파일을 동시에 받아 시작 속도 유지
  const pub = w => fetch(`content/w${String(w).padStart(2, "0")}.json`, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  // 맞춤 레슨: 서버가 비공개 저장소에서 내 레슨을 주면 그걸 쓰고, 없으면 공개 레슨
  const mine = w => fetch(`${API}/api/week?k=${encodeURIComponent(KEY)}&w=${w}`, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const got = await Promise.all(ws.map(async w => (S.st.privateContent && (await mine(w))) || pub(w)));
  got.forEach((d, i) => {
    if (!d) return; const w = ws[i]; S.weeks[w] = d;
    for (const dd of d.days) for (const c of dd.chunks || []) S.chunks[c.id] = { ...c, week: w };
  });
  S.today = (S.weeks[S.week] || { days: [] }).days.find(x => x.day === S.dw) || null;
}
const dayN = (w, d) => (w - 1) * 7 + d;
const dateOfN = n => new Date(Date.parse(S.st.date) - (S.n - n) * DAYMS).toISOString().slice(0, 10);
function streak() {
  const ds = new Set(S.st.history.map(h => h.date));
  let d = Date.parse(S.st.date);
  if (!ds.has(S.st.date)) d -= DAYMS; // 오늘 아직 안 했으면 어제부터 셈
  let c = 0;
  while (ds.has(new Date(d).toISOString().slice(0, 10))) { c++; d -= DAYMS; }
  return c;
}

// ---------- 음성 ----------
let VA = null, VB = null, VC = null; // A=상대(여), B=나, C=상대(남)
const BAD = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandpa|Grandma|Eddy|Flo|Reed|Rocko|Sandy|Shelley|Fred|Junior|Ralph|Kathy/i;
const FEMALE = ["Ava", "Samantha", "Allison", "Zoe", "Susan", "Nicky", "Joelle", "Noelle", "Karen", "Moira", "Kate", "Serena"];
const MALE = ["Evan", "Nathan", "Tom", "Aaron", "Alex", "Daniel", "Oliver", "Arthur", "Lee"];
const enVoices = () => speechSynthesis.getVoices().filter(x => /^en/i.test(x.lang) && !BAD.test(x.name));
function vScore(v, names) {
  let s = 0; const i = names.findIndex(n => v.name.includes(n));
  if (i >= 0) s += 100 - i;
  if (/Premium/i.test(v.name)) s += 50; else if (/Enhanced/i.test(v.name)) s += 30;
  if (/en-US/i.test(v.lang)) s += 10;
  return s;
}
function pickVoices() {
  const v = enVoices();
  const best = names => v.slice().sort((a, b) => vScore(b, names) - vScore(a, names))[0] || null;
  VA = best(FEMALE); VB = best(MALE);
  if (VB === VA) VB = v.find(x => x !== VA) || VA;
  VC = v.slice().sort((a, b) => vScore(b, MALE) - vScore(a, MALE)).find(x => x !== VB && x !== VA) || VB;
  try {
    const a = localStorage.getItem("sd_va"), b = localStorage.getItem("sd_vb");
    if (a) VA = v.find(x => x.name === a) || VA;
    if (b) VB = v.find(x => x.name === b) || VB;
  } catch (e) {}
}
if ("speechSynthesis" in window) { pickVoices(); speechSynthesis.onvoiceschanged = pickVoices; }

// 음성 재생은 전부 이 함수를 거침 (나중에 AI 음성으로 바꿀 때 여기만 수정)
function speak(text, { rate = 1, who = "A" } = {}) {
  return new Promise(res => {
    if (!("speechSynthesis" in window)) return res();
    const u = new SpeechSynthesisUtterance(text);
    const ko = who === "K"; // K = 한국어 안내 음성
    u.lang = ko ? "ko-KR" : "en-US"; u.rate = rate;
    const v = ko ? speechSynthesis.getVoices().find(x => /^ko/i.test(x.lang)) : who === "B" ? VB : who === "C" ? VC : VA; if (v) u.voice = v;
    const t = setTimeout(res, 2000 + (ko ? text.length * 180 : text.split(" ").length * 700) / rate); // iOS onend 누락 대비
    u.onend = u.onerror = () => { clearTimeout(t); res(); };
    speechSynthesis.speak(u);
  });
}
// ---------- 내 문장 (표현으로 직접 만든 문장): 서버에 저장 + 이 기기에 사본 ----------
const MKEY = () => "sd_mine_" + String(KEY || "").slice(0, 10);
function loadMineLocal() { try { return JSON.parse(localStorage.getItem(MKEY()) || "{}") || {}; } catch (e) { return {}; } }
async function saveMine(id, text) {
  S.st.mine = S.st.mine || {}; if (text) S.st.mine[id] = text; else delete S.st.mine[id];
  try { localStorage.setItem(MKEY(), JSON.stringify(S.st.mine)); } catch (e) {}
  try { const r = await fetch(`${API}/api/mine?k=${encodeURIComponent(KEY)}`, { method: "POST", body: JSON.stringify({ id, text }) }); return r.ok; } catch (e) { return false; }
}
const stopAudio = () => { try { speechSynthesis.cancel(); } catch (e) {} };
// 조용한 모드: 말하기 대신 단어 조각 맞추기, 자동 재생 끔
const isSilent = () => { try { return localStorage.getItem("sd_silent") === "1"; } catch (e) { return false; } };
const setSilent = v => { try { localStorage.setItem("sd_silent", v ? "1" : "0"); } catch (e) {} };
const auto = (text, w) => (LS && LS.silent ? Promise.resolve() : speak(text, { who: w }));

// ---------- 녹음 (발음 비교·월간 테스트) ----------
let CUR_REC = null;
async function recStart() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream), parts = [];
  mr.ondataavailable = e => e.data.size && parts.push(e.data);
  mr.start();
  const rec = {
    stop: () => new Promise(res => {
      if (mr.state === "inactive") return res(null);
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); CUR_REC = null; res(new Blob(parts, { type: mr.mimeType || "audio/mp4" })); };
      mr.stop();
    })
  };
  CUR_REC = rec;
  return rec;
}
function playUrl(url) {
  return new Promise(res => { const a = new Audio(url); a.onended = a.onerror = res; a.play().catch(res); });
}
const playBlob = blob => playUrl(URL.createObjectURL(blob));
// 서버에 저장된 녹음: iPhone은 범위 요청 없는 오디오 주소를 재생 못 할 수 있어서 먼저 받아서 재생
const playRemote = url => fetch(url).then(r => (r.ok ? r.blob() : Promise.reject(r.status))).then(playBlob);

// ---------- 아이콘 (선 아이콘, 글자색을 따름) ----------
const IC = {
  speaker: '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  play: '<path d="M7 5l12 7-12 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  wave: '<path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2"/>', book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  slow: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2 2"/>', cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1"/><rect x="17" y="14" width="4" height="6" rx="1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const ic = (n, s = 18) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

function voicePanel(box) {
  if (box.innerHTML) { box.innerHTML = ""; return; }
  const all = enVoices();
  if (!all.length) { box.innerHTML = `<div class="card"><p class="muted">이 브라우저에서 영어 음성을 찾지 못했어요. 사파리로 열어보세요.</p></div>`; return; }
  const opts = sel => all.map(v => `<option value="${esc(v.name)}"${v === sel ? " selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
  box.innerHTML = `<div class="card"><label>상대 목소리<select id="sa">${opts(VA)}</select></label><button id="ta">${ic("play")} 미리듣기</button>
    <label>내 목소리<select id="sb">${opts(VB)}</select></label><button id="tb">${ic("play")} 미리듣기</button>
    <p class="muted">이 브라우저에서 쓸 수 있는 음성 ${all.length}개. 고른 음성은 이 기기에 저장돼요.</p></div>`;
  const set = (id, key, isA) => { const v = all.find(x => x.name === $(id).value); if (isA) VA = v; else VB = v; try { localStorage.setItem(key, v.name); } catch (e) {} };
  $("#sa").onchange = () => set("#sa", "sd_va", true);
  $("#sb").onchange = () => set("#sb", "sd_vb", false);
  $("#ta").onclick = () => { stopAudio(); speak("Hey! Long time no see. How've you been?", { who: "A" }); };
  $("#tb").onclick = () => { stopAudio(); speak("No way! Good for you!", { who: "B" }); };
}

// ---------- 행동 기록 (관리자 분석용) ----------
let EVQ = [];
function track(type, data = {}) { EVQ.push({ t: Date.now(), type, ...data }); if (EVQ.length >= 40) flush(); }
function flush() { // text/plain 전송이라 페이지를 닫는 순간에도 보내짐
  if (!EVQ.length || !KEY) return;
  const url = `${API}/api/events?k=${encodeURIComponent(KEY)}`, body = JSON.stringify({ events: EVQ }); EVQ = [];
  try { if (!(navigator.sendBeacon && navigator.sendBeacon(url, body))) fetch(url, { method: "POST", body, keepalive: true }); } catch (e) {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  if (LS && !LS.practice) track("leave", { lesson: LS.n, step: (LS.steps[LS.step] || [""])[0] });
  flush();
});
function device() {
  const ua = navigator.userAgent;
  const d = /iPhone/.test(ua) ? "iPhone" : /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "기타";
  const app = /KAKAOTALK/i.test(ua) ? "카톡" : navigator.standalone || matchMedia("(display-mode: standalone)").matches ? "홈앱" : "브라우저";
  return { dev: d, app };
}

// ---------- 화면 전환 ----------
const ROUTES = {};
function fail(msg) { $("#view").innerHTML = `<div class="card"><p class="ko">${esc(msg)}</p></div>`; }
function route() {
  stopAudio(); RUN++;
  if (CUR_REC) CUR_REC.stop();
  const parts = (location.hash.slice(1) || "home").split("/");
  const name = ROUTES[parts[0]] ? parts[0] : "home";
  const tabOf = { cards: "home", radio: "home", mtest: "home", profile: "home", checkin: "home", note: "home" }[name] || name;
  document.querySelectorAll(".tab").forEach(t => { const on = t.dataset.r === tabOf; t.classList.toggle("on", on); on ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"); });
  track("view", { r: name });
  ROUTES[name]($("#view"), parts.slice(1));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

async function boot() {
  if (!KEY) return fail("카톡 알림의 버튼으로 한 번 열어주세요. 처음 한 번 열면 이 기기에 접속 정보가 저장돼요.");
  try { await loadAll(); }
  catch (e) { return fail(`서버에 연결하지 못했어요. 네트워크를 확인하고 새로고침하세요. (${e.message})`); }
  track("open", { src: qs.get("src") || "direct", lesson: S.n, ...device() }); flush();
  route();
}
