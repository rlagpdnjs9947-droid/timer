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
function playBeep(times = 1, freq = 880) {
  if (!soundToggle.checked) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  for (let i = 0; i < times; i++) {
    const t0 = audioCtx.currentTime + i * 0.35;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }
}

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
}

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
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
