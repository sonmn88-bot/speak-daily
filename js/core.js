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
  S.n = S.st.n; S.week = Math.ceil(S.n / 7); S.dw = ((S.n - 1) % 7) + 1;
  S.monthly = S.week % 4 === 0 && S.dw >= 6;
  S.weeks = {}; S.chunks = {};
  for (let w = 1; w <= S.week; w++) {
    try {
      const res = await fetch(`content/w${String(w).padStart(2, "0")}.json`, { cache: "no-cache" });
      if (!res.ok) continue;
      const d = await res.json(); S.weeks[w] = d;
      for (const dd of d.days) for (const c of dd.chunks || []) S.chunks[c.id] = { ...c, week: w };
    } catch (e) {}
  }
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
let VA = null, VB = null;
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
    u.lang = "en-US"; u.rate = rate;
    const v = who === "B" ? VB : VA; if (v) u.voice = v;
    const t = setTimeout(res, 2000 + text.split(" ").length * 700 / rate); // iOS onend 누락 대비
    u.onend = u.onerror = () => { clearTimeout(t); res(); };
    speechSynthesis.speak(u);
  });
}
const stopAudio = () => { try { speechSynthesis.cancel(); } catch (e) {} };

function voicePanel(box) {
  if (box.innerHTML) { box.innerHTML = ""; return; }
  const all = enVoices();
  if (!all.length) { box.innerHTML = `<div class="card"><p class="muted">이 브라우저에서 영어 음성을 찾지 못했어요. 사파리로 열어보세요.</p></div>`; return; }
  const opts = sel => all.map(v => `<option value="${esc(v.name)}"${v === sel ? " selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
  box.innerHTML = `<div class="card"><label>상대 목소리<select id="sa">${opts(VA)}</select></label><button id="ta">▶ 미리듣기</button>
    <label>내 목소리<select id="sb">${opts(VB)}</select></label><button id="tb">▶ 미리듣기</button>
    <p class="muted">이 브라우저에서 쓸 수 있는 음성 ${all.length}개. 고른 음성은 이 기기에 저장돼요.</p></div>`;
  const set = (id, key, isA) => { const v = all.find(x => x.name === $(id).value); if (isA) VA = v; else VB = v; try { localStorage.setItem(key, v.name); } catch (e) {} };
  $("#sa").onchange = () => set("#sa", "sd_va", true);
  $("#sb").onchange = () => set("#sb", "sd_vb", false);
  $("#ta").onclick = () => { stopAudio(); speak("Hey! Long time no see. How've you been?", { who: "A" }); };
  $("#tb").onclick = () => { stopAudio(); speak("No way! Good for you!", { who: "B" }); };
}

// ---------- 화면 전환 ----------
const ROUTES = {};
function fail(msg) { $("#view").innerHTML = `<div class="card"><p class="ko">${esc(msg)}</p></div>`; }
function route() {
  stopAudio(); RUN++;
  const parts = (location.hash.slice(1) || "home").split("/");
  const name = ROUTES[parts[0]] ? parts[0] : "home";
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.r === name));
  ROUTES[name]($("#view"), parts.slice(1));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);

async function boot() {
  if (!KEY) return fail("카톡 알림의 버튼으로 한 번 열어주세요. 처음 한 번 열면 이 기기에 접속 정보가 저장돼요.");
  try { await loadAll(); }
  catch (e) { return fail(`서버에 연결하지 못했어요. 네트워크를 확인하고 새로고침하세요. (${e.message})`); }
  route();
}
