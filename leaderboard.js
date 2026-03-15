// ============================================================
// LEADERBOARD.JS — Local leaderboard (localStorage)
// ============================================================
// Future: swap saveScore / getScores to call a backend API

const MAX_ENTRIES = 10;

function getScores() {
  const raw = localStorage.getItem('acab_leaderboard');
  return raw ? JSON.parse(raw) : [];
}

function saveScore(name, score, level, tokens) {
  const scores = getScores();
  scores.push({
    name:   name.trim() || 'Anonymous',
    score,
    level,
    tokens,
    date: new Date().toLocaleDateString(),
  });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(MAX_ENTRIES); // keep top 10
  localStorage.setItem('acab_leaderboard', JSON.stringify(scores));
}

function renderLeaderboard() {
  const scores = getScores();
  const list = document.getElementById('leaderboard-list');

  if (!scores.length) {
    list.innerHTML = '<p class="empty-msg">No scores yet. Go play!</p>';
    return;
  }

  list.innerHTML = scores.map((s, i) => `
    <div class="lb-row ${i === 0 ? 'lb-gold' : i === 1 ? 'lb-silver' : i === 2 ? 'lb-bronze' : ''}">
      <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
      <span class="lb-name">${s.name}</span>
      <span class="lb-score">⭐ ${s.score}</span>
      <span class="lb-level">LVL ${s.level}</span>
      <span class="lb-tokens">😊 ${s.tokens}</span>
      <span class="lb-date">${s.date}</span>
    </div>
  `).join('');
}
