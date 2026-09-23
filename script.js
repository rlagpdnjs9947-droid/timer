const SUBJECTS = [
  { id: "korean", name: "국어", minutes: 80, warnMinutes: 10 },
  { id: "math", name: "수학", minutes: 100, warnMinutes: 10 },
  { id: "english", name: "영어", minutes: 70, warnMinutes: 10 },
  { id: "bio1", name: "생명과학Ⅰ", minutes: 30, warnMinutes: 5 },
  { id: "earth1", name: "지구과학Ⅰ", minutes: 30, warnMinutes: 5 },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 118;

const subjectListEl = document.getElementById("subjectList");
const currentSubjectEl = document.getElementById("currentSubject");
const currentMetaEl = document.getElementById("currentMeta");
const timeDisplayEl = document.getElementById("timeDisplay");
const ringFgEl = document.getElementById("ringFg");
const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const soundToggle = document.getElementById("soundToggle");
const autoNextToggle = document.getElementById("autoNextToggle");
const legVillainToggle = document.getElementById("legVillainToggle");
const paperVillainToggle = document.getElementById("paperVillainToggle");
const bannerEl = document.getElementById("banner");

ringFgEl.style.strokeDasharray = String(RING_CIRCUMFERENCE);

let activeSubject = null;
let remainingSeconds = 0;
let totalSeconds = 0;
let endTimestamp = null;
let intervalId = null;
let warnedForThisRun = false;
let finishedForThisRun = false;
let doneSubjectIds = new Set();

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBeep(times = 1, freq = 880) {
  if (!soundToggle.checked) return;
  const ctx = getAudioCtx();
  for (let i = 0; i < times; i++) {
    const t0 = ctx.currentTime + i * 0.35;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }
}

// ---- 수능빌런 소리 (실전 연습용 배경 소음) ----

let noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (!noiseBuffer) {
    const length = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// 다리떨기 빌런: 책상을 규칙적으로 두드리는 듯한 저음 진동을 연속으로 재생
function playLegTapBurst() {
  const ctx = getAudioCtx();
  const tapCount = 5 + Math.floor(Math.random() * 6);
  let t = ctx.currentTime + 0.02;
  for (let i = 0; i < tapCount; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = randomBetween(85, 130);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
    t += randomBetween(0.14, 0.2);
  }
}

// 종이넘기기 빌런: 필터링된 노이즈로 사각거리는 종이 소리를 재현
function playPaperRustleBurst() {
  const ctx = getAudioCtx();
  const rustleCount = 1 + Math.floor(Math.random() * 2);
  let t = ctx.currentTime + 0.02;
  for (let i = 0; i < rustleCount; i++) {
    const duration = randomBetween(0.25, 0.5);
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const offset = Math.random() * (noiseBuffer.duration - duration - 0.1);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = randomBetween(2500, 5000);
    bandpass.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(bandpass).connect(gain).connect(ctx.destination);
    source.start(t, offset, duration);
    t += duration + randomBetween(0.05, 0.15);
  }
}

let legVillainTimeoutId = null;
let paperVillainTimeoutId = null;

function scheduleLegVillain() {
  playLegTapBurst();
  legVillainTimeoutId = setTimeout(scheduleLegVillain, randomBetween(5000, 14000));
}

function schedulePaperVillain() {
  playPaperRustleBurst();
  paperVillainTimeoutId = setTimeout(schedulePaperVillain, randomBetween(7000, 18000));
}

function stopLegVillain() {
  clearTimeout(legVillainTimeoutId);
  legVillainTimeoutId = null;
}

function stopPaperVillain() {
  clearTimeout(paperVillainTimeoutId);
  paperVillainTimeoutId = null;
}

function syncVillainSounds() {
  const running = intervalId !== null;

  if (running && legVillainToggle.checked) {
    if (!legVillainTimeoutId) scheduleLegVillain();
  } else {
    stopLegVillain();
  }

  if (running && paperVillainToggle.checked) {
    if (!paperVillainTimeoutId) schedulePaperVillain();
  } else {
    stopPaperVillain();
  }
}

legVillainToggle.addEventListener("change", syncVillainSounds);
paperVillainToggle.addEventListener("change", syncVillainSounds);

function formatTime(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function renderSubjectList() {
  subjectListEl.innerHTML = "";
  SUBJECTS.forEach((subject) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card";
    card.dataset.id = subject.id;
    if (activeSubject && activeSubject.id === subject.id) card.classList.add("active");
    if (doneSubjectIds.has(subject.id)) card.classList.add("done");

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = subject.name;

    const duration = document.createElement("span");
    duration.className = "duration";
    duration.textContent = `${subject.minutes}분 · 종료 ${subject.warnMinutes}분 전 알림`;

    card.appendChild(name);
    card.appendChild(duration);
    card.addEventListener("click", () => selectSubject(subject.id));
    subjectListEl.appendChild(card);
  });
}

function selectSubject(id) {
  stopInterval();
  const subject = SUBJECTS.find((s) => s.id === id);
  if (!subject) return;
  activeSubject = subject;
  totalSeconds = subject.minutes * 60;
  remainingSeconds = totalSeconds;
  warnedForThisRun = false;
  finishedForThisRun = false;

  currentSubjectEl.textContent = subject.name;
  currentMetaEl.textContent = `${subject.minutes}분 시험 · 종료 ${subject.warnMinutes}분 전 알림`;

  updateDisplay();
  renderSubjectList();

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = false;
  startBtn.textContent = "시작";
}

function updateDisplay() {
  timeDisplayEl.textContent = formatTime(remainingSeconds);
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  ringFgEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));

  ringFgEl.classList.remove("warn", "danger");
  if (activeSubject) {
    if (remainingSeconds <= 60) {
      ringFgEl.classList.add("danger");
    } else if (remainingSeconds <= activeSubject.warnMinutes * 60) {
      ringFgEl.classList.add("warn");
    }
  }
}

function showBanner(message, danger = false) {
  bannerEl.textContent = message;
  bannerEl.classList.toggle("danger", danger);
  bannerEl.classList.add("show");
  clearTimeout(showBanner._t);
  showBanner._t = setTimeout(() => {
    bannerEl.classList.remove("show");
  }, 4000);
}

function tick() {
  const now = Date.now();
  remainingSeconds = Math.max(0, Math.round((endTimestamp - now) / 1000));
  updateDisplay();

  if (
    !warnedForThisRun &&
    activeSubject &&
    remainingSeconds <= activeSubject.warnMinutes * 60 &&
    remainingSeconds > 0
  ) {
    warnedForThisRun = true;
    showBanner(`${activeSubject.name}: 종료 ${activeSubject.warnMinutes}분 전입니다`);
    playBeep(2, 880);
  }

  if (!finishedForThisRun && remainingSeconds <= 0) {
    finishedForThisRun = true;
    stopInterval();
    doneSubjectIds.add(activeSubject.id);
    showBanner(`${activeSubject.name} 시험 종료`, true);
    playBeep(3, 660);
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    startBtn.textContent = "시작";
    renderSubjectList();

    if (autoNextToggle.checked) {
      const idx = SUBJECTS.findIndex((s) => s.id === activeSubject.id);
      const next = SUBJECTS[idx + 1];
      if (next) {
        setTimeout(() => selectSubject(next.id), 1500);
      }
    }
  }
}

function startInterval() {
  endTimestamp = Date.now() + remainingSeconds * 1000;
  intervalId = setInterval(tick, 250);
  syncVillainSounds();
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  syncVillainSounds();
}

startBtn.addEventListener("click", () => {
  if (!activeSubject || remainingSeconds <= 0) return;
  startInterval();
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  startBtn.textContent = "시작";
});

pauseBtn.addEventListener("click", () => {
  stopInterval();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  startBtn.textContent = "계속";
});

resetBtn.addEventListener("click", () => {
  if (!activeSubject) return;
  stopInterval();
  remainingSeconds = totalSeconds;
  warnedForThisRun = false;
  finishedForThisRun = false;
  doneSubjectIds.delete(activeSubject.id);
  updateDisplay();
  renderSubjectList();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  startBtn.textContent = "시작";
});

renderSubjectList();
