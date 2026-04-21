const STORAGE_KEY = 'gate-prep-tracker-v1';

const defaultData = {
  subjects: [],
  updates: [],
  tests: [],
  activity: []
};

const state = load();
let overallTrendChart;
let testTrendChart;

const nodes = {
  views: document.querySelectorAll('.view'),
  nav: document.querySelectorAll('.nav-item'),
  statCards: document.getElementById('stat-cards'),
  lectureProgress: document.getElementById('lecture-progress'),
  lectureProgressLabel: document.getElementById('lecture-progress-label'),
  pyqProgress: document.getElementById('pyq-progress'),
  pyqProgressLabel: document.getElementById('pyq-progress-label'),
  recentActivity: document.getElementById('recent-activity'),
  subjectList: document.getElementById('subject-list'),
  topicSearch: document.getElementById('topic-search'),
  dailySubject: document.getElementById('daily-subject'),
  dailyTopic: document.getElementById('daily-topic'),
  lectureLinks: document.getElementById('lecture-links')
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function addActivity(text) {
  state.activity.unshift({ text, date: new Date().toISOString() });
  state.activity = state.activity.slice(0, 100);
}

function completionBadge(percent) {
  if (percent >= 80) return '<span class="badge green">High</span>';
  if (percent >= 40) return '<span class="badge yellow">Medium</span>';
  return '<span class="badge red">Low</span>';
}

function getTotals() {
  let totalTopics = 0;
  let topicsCompleted = 0;
  let totalLectures = 0;
  let lecturesCompleted = 0;
  let totalPyqs = 0;
  let pyqsSolved = 0;

  state.subjects.forEach((subject) => {
    totalLectures += subject.totalLectures;
    lecturesCompleted += subject.lecturesCompleted;
    totalPyqs += subject.totalPyqs;
    pyqsSolved += subject.pyqsSolved;
    totalTopics += subject.topics.length;
    topicsCompleted += subject.topics.filter((t) => t.completed).length;
  });

  return { totalTopics, topicsCompleted, totalLectures, lecturesCompleted, totalPyqs, pyqsSolved };
}

function renderDashboard() {
  const t = getTotals();
  const lecturePct = t.totalLectures ? Math.round((t.lecturesCompleted / t.totalLectures) * 100) : 0;
  const pyqPct = t.totalPyqs ? Math.round((t.pyqsSolved / t.totalPyqs) * 100) : 0;

  nodes.statCards.innerHTML = [
    ['Total Topics', t.totalTopics],
    ['Topics Completed', t.topicsCompleted],
    ['Lectures', `${t.lecturesCompleted}/${t.totalLectures}`],
    ['PYQs Solved', t.pyqsSolved]
  ]
    .map(([label, value]) => `<article class="card"><div class="small">${label}</div><div class="stat-number">${value}</div></article>`)
    .join('');

  nodes.lectureProgress.style.width = `${lecturePct}%`;
  nodes.pyqProgress.style.width = `${pyqPct}%`;
  nodes.lectureProgressLabel.textContent = `${lecturePct}% complete`;
  nodes.pyqProgressLabel.textContent = `${pyqPct}% complete`;

  nodes.recentActivity.innerHTML = state.activity
    .slice(0, 5)
    .map((a) => `<li>${a.text} <span class="small">(${new Date(a.date).toLocaleDateString()})</span></li>`)
    .join('') || '<li>No activity yet. Start logging progress.</li>';

  renderOverallTrend();
}

function renderOverallTrend() {
  const byDate = {};
  state.updates.forEach((u) => {
    byDate[u.date] ??= { lectures: 0, pyqs: 0 };
    byDate[u.date].lectures += u.lecturesCompleted;
    byDate[u.date].pyqs += u.pyqsSolved;
  });
  const labels = Object.keys(byDate).sort();
  const lectureData = labels.map((d) => byDate[d].lectures);
  const pyqData = labels.map((d) => byDate[d].pyqs);

  const ctx = document.getElementById('overall-trend');
  overallTrendChart?.destroy();
  overallTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Lectures / day', data: lectureData, borderColor: '#4f46e5', tension: 0.3 },
        { label: 'PYQs / day', data: pyqData, borderColor: '#16a34a', tension: 0.3 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderSubjects() {
  const term = nodes.topicSearch.value.toLowerCase().trim();
  nodes.subjectList.innerHTML = state.subjects
    .filter((s) => {
      if (!term) return true;
      return s.name.toLowerCase().includes(term) || s.topics.some((t) => t.name.toLowerCase().includes(term));
    })
    .map((s) => {
      const pct = s.totalLectures ? Math.round((s.lecturesCompleted / s.totalLectures) * 100) : 0;
      const topicMarkup = s.topics
        .map(
          (t) => `<li>
            <strong>${t.name}</strong> ${t.completed ? '✅' : ''}
            <button data-action="toggle-topic" data-subject="${s.id}" data-topic="${t.id}">${t.completed ? 'Undo' : 'Mark complete'}</button>
            <div class="small">Lectures: ${t.lecturesCompleted}/${t.totalLectures} • PYQs: ${t.pyqsSolved}/${t.totalPyqs}</div>
          </li>`
        )
        .join('') || '<li class="small">No topics yet.</li>';

      return `<div class="subject-row">
        <div class="subject-head">
          <div>
            <strong>${s.name}</strong>
            <div class="small">Lectures ${s.lecturesCompleted}/${s.totalLectures} • PYQs ${s.pyqsSolved}/${s.totalPyqs}</div>
          </div>
          ${completionBadge(pct)}
        </div>
        <ul class="topic-list">${topicMarkup}</ul>
        <form class="inline-form" data-action="add-topic" data-subject="${s.id}">
          <input name="topicName" placeholder="Add topic in ${s.name}" required />
          <input type="number" name="topicLectures" placeholder="Total lectures" min="0" required />
          <input type="number" name="topicPyqs" placeholder="Total PYQs" min="0" required />
          <button type="submit">Add</button>
        </form>
      </div>`;
    })
    .join('');
}

function renderDailyOptions() {
  nodes.dailySubject.innerHTML = state.subjects
    .map((s) => `<option value="${s.id}">${s.name}</option>`)
    .join('') || '<option value="">Add a subject first</option>';
  renderTopicOptions();
}

function renderTopicOptions() {
  const subject = state.subjects.find((s) => s.id === nodes.dailySubject.value);
  nodes.dailyTopic.innerHTML = subject?.topics
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join('') || '<option value="">Add topic first</option>';
}

function renderLectureLinks() {
  const all = [];
  state.subjects.forEach((s) => {
    s.topics.forEach((t) => {
      (t.lectureLinks || []).forEach((link) => all.push({ subject: s.name, topic: t.name, ...link }));
    });
  });

  nodes.lectureLinks.innerHTML = all.length
    ? `<ul class="lecture-link-list">${all
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(
          (l) => `<li><a href="${l.url}" target="_blank" rel="noreferrer">${l.url}</a> <span class="small">(${l.subject} → ${l.topic}, ${l.date})</span></li>`
        )
        .join('')}</ul>`
    : '<p class="small">No lecture links added yet.</p>';
}

function renderTestTrend() {
  const sorted = [...state.tests].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map((t) => `${t.name} (${t.date})`);
  const pctData = sorted.map((t) => Math.round((t.score / t.total) * 100));

  const ctx = document.getElementById('test-trend');
  testTrendChart?.destroy();
  testTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Score %', data: pctData, borderColor: '#ef4444', tension: 0.25 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function refreshAll() {
  save();
  renderDashboard();
  renderSubjects();
  renderDailyOptions();
  renderLectureLinks();
  renderTestTrend();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    nodes.nav.forEach((n) => n.classList.remove('active'));
    btn.classList.add('active');
    nodes.views.forEach((v) => v.classList.add('hidden'));
    document.getElementById(`${btn.dataset.view}-view`).classList.remove('hidden');
  });
});

document.getElementById('subject-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const subject = {
    id: uid(),
    name: String(f.get('name')).trim(),
    totalLectures: Number(f.get('totalLectures')),
    lecturesCompleted: 0,
    totalPyqs: Number(f.get('totalPyqs')),
    pyqsSolved: 0,
    topics: []
  };
  state.subjects.push(subject);
  addActivity(`Added subject ${subject.name}`);
  e.target.reset();
  refreshAll();
});

nodes.subjectList.addEventListener('submit', (e) => {
  if (e.target.dataset.action !== 'add-topic') return;
  e.preventDefault();
  const subjectId = e.target.dataset.subject;
  const subject = state.subjects.find((s) => s.id === subjectId);
  const f = new FormData(e.target);
  const topic = {
    id: uid(),
    name: String(f.get('topicName')).trim(),
    totalLectures: Number(f.get('topicLectures')),
    lecturesCompleted: 0,
    totalPyqs: Number(f.get('topicPyqs')),
    pyqsSolved: 0,
    completed: false,
    lectureLinks: []
  };
  subject.topics.push(topic);
  addActivity(`Added topic ${topic.name} in ${subject.name}`);
  e.target.reset();
  refreshAll();
});

nodes.subjectList.addEventListener('click', (e) => {
  if (e.target.dataset.action !== 'toggle-topic') return;
  const { subject: subjectId, topic: topicId } = e.target.dataset;
  const topic = state.subjects.find((s) => s.id === subjectId)?.topics.find((t) => t.id === topicId);
  topic.completed = !topic.completed;
  addActivity(`${topic.completed ? 'Completed' : 'Reopened'} topic ${topic.name}`);
  refreshAll();
});

nodes.topicSearch.addEventListener('input', renderSubjects);
nodes.dailySubject.addEventListener('change', renderTopicOptions);

document.getElementById('daily-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const subject = state.subjects.find((s) => s.id === f.get('subjectId'));
  const topic = subject?.topics.find((t) => t.id === f.get('topicId'));
  if (!subject || !topic) return;

  const lectures = Number(f.get('lecturesCompleted'));
  const pyqs = Number(f.get('pyqsSolved'));
  const studyHours = Number(f.get('studyHours')) || 0;
  const lectureLink = String(f.get('lectureLink')).trim();
  const date = new Date().toISOString().slice(0, 10);

  topic.lecturesCompleted = Math.min(topic.totalLectures, topic.lecturesCompleted + lectures);
  topic.pyqsSolved = Math.min(topic.totalPyqs, topic.pyqsSolved + pyqs);
  if (topic.lecturesCompleted >= topic.totalLectures && topic.pyqsSolved >= topic.totalPyqs) topic.completed = true;

  subject.lecturesCompleted = Math.min(subject.totalLectures, subject.lecturesCompleted + lectures);
  subject.pyqsSolved = Math.min(subject.totalPyqs, subject.pyqsSolved + pyqs);

  if (lectureLink) {
    topic.lectureLinks.push({ url: lectureLink, date });
  }

  state.updates.push({
    id: uid(),
    subjectId: subject.id,
    topicId: topic.id,
    lecturesCompleted: lectures,
    pyqsSolved: pyqs,
    studyHours,
    lectureLink,
    date
  });

  addActivity(`Daily update: ${subject.name}/${topic.name} (+${lectures} lectures, +${pyqs} PYQs)`);
  e.target.reset();
  refreshAll();
});

document.getElementById('test-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const test = {
    id: uid(),
    name: String(f.get('name')).trim(),
    score: Number(f.get('score')),
    total: Number(f.get('total')),
    date: String(f.get('date'))
  };
  state.tests.push(test);
  addActivity(`Added mock test ${test.name} (${test.score}/${test.total})`);
  e.target.reset();
  refreshAll();
});

refreshAll();
