const socket = io();

const state = {
  playerId: null,
  roomCode: null,
  hostId: null,
  phase: 'landing',
  currentQuestion: null,
  selectedAnswer: null,
  timerInterval: null,
  players: [],
  availableAvatars: [],
  questionQueue: [],
  lockedCount: 0,
  totalParticipants: 0,
};

const views = {
  landing: document.getElementById('view-landing'),
  lobby: document.getElementById('view-lobby'),
  question: document.getElementById('view-question'),
  reveal: document.getElementById('view-reveal'),
  leaderboard: document.getElementById('view-leaderboard'),
  final: document.getElementById('view-final'),
};

const landingError = document.getElementById('landing-error');
const hostForm = document.getElementById('host-form');
const joinForm = document.getElementById('join-form');
const lobbyNotice = document.getElementById('lobby-notice');
const roomCodeEl = document.getElementById('room-code');
const playersListEl = document.getElementById('players-list');
const startButton = document.getElementById('start-game');
const hostLobbyPanel = document.getElementById('host-lobby-panel');
const hostQuestionQueue = document.getElementById('host-question-queue');
const hostReadyStat = document.getElementById('host-ready-stat');
const hostPlayerStat = document.getElementById('host-player-stat');
const questionProgress = document.getElementById('question-progress');
const questionPrompt = document.getElementById('question-prompt');
const questionOptions = document.getElementById('question-options');
const questionSticker = document.getElementById('question-sticker');
const questionVibe = document.getElementById('question-vibe');
const timerEl = document.getElementById('timer');
const answerStatus = document.getElementById('answer-status');
const revealText = document.getElementById('reveal-text');
const revealExplanation = document.getElementById('reveal-explanation');
const revealRace = document.getElementById('reveal-race');
const hostLivePanel = document.getElementById('host-live-panel');
const hostLockedCount = document.getElementById('host-locked-count');
const hostLeaderName = document.getElementById('host-leader-name');
const hostNextQuestion = document.getElementById('host-next-question');
const hostLiveStandings = document.getElementById('host-live-standings');
const leaderboardList = document.getElementById('leaderboard-list');
const championName = document.getElementById('champion-name');
const finalBoard = document.getElementById('final-board');
const phasePill = document.getElementById('phase-pill');
const rolePill = document.getElementById('role-pill');
const playerCount = document.getElementById('player-count');
const heroRoomCode = document.getElementById('hero-room-code');
const avatarPicker = document.getElementById('avatar-picker');
const avatarStatus = document.getElementById('avatar-status');
const avatarReadyCount = document.getElementById('avatar-ready-count');
const meadowScene = document.getElementById('meadow-scene');
const sceneWeather = document.getElementById('scene-weather');
const scenePicnic = document.getElementById('scene-picnic');
const sceneFriends = document.getElementById('scene-friends');
const SESSION_KEY = 'rce-ai-showdown-session';

const optionBadges = ['🍃', '🐟', '⭐', '🎁'];
const avatarEmojiMap = {
  cat: '🐱',
  bear: '🐻',
  duck: '🐥',
  bunny: '🐰',
  fox: '🦊',
  frog: '🐸',
};
const questionFunMoments = [
  { sticker: '🤖', vibe: 'Warm up those AI brains.' },
  { sticker: '✨', vibe: 'This one is tiny, silly, and sneaky.' },
  { sticker: '🚀', vibe: 'Fast answers get the big zoomies.' },
  { sticker: '🧠', vibe: 'Team genius mode is officially on.' },
  { sticker: '🎉', vibe: 'A fun one is landing on the board.' },
  { sticker: '😆', vibe: 'No overthinking. Just vibes and guesses.' },
  { sticker: '🌮', vibe: 'Brain snack question incoming.' },
  { sticker: '🎯', vibe: 'Aim for the clean easy win.' },
  { sticker: '🛼', vibe: 'Someone is about to glide into first.' },
  { sticker: '🍿', vibe: 'This reveal might get dramatic.' },
];
const avatarCatalog = [
  { id: 'cat', type: 'cat', name: 'Miso', species: 'Cat', accent: 'peach' },
  { id: 'bear', type: 'bear', name: 'Maple', species: 'Bear', accent: 'honey' },
  { id: 'duck', type: 'duck', name: 'Puddles', species: 'Duck', accent: 'sky' },
  { id: 'bunny', type: 'bunny', name: 'Clover', species: 'Bunny', accent: 'mint' },
  { id: 'fox', type: 'fox', name: 'Rusty', species: 'Fox', accent: 'sunset' },
  { id: 'frog', type: 'frog', name: 'Sprig', species: 'Frog', accent: 'leaf' },
  { id: 'cat-pearl', type: 'cat', name: 'Pearl', species: 'Cat', accent: 'mint' },
  { id: 'cat-toffee', type: 'cat', name: 'Toffee', species: 'Cat', accent: 'honey' },
  { id: 'bear-hazel', type: 'bear', name: 'Hazel', species: 'Bear', accent: 'peach' },
  { id: 'bear-mocha', type: 'bear', name: 'Mocha', species: 'Bear', accent: 'sunset' },
  { id: 'duck-daisy', type: 'duck', name: 'Daisy', species: 'Duck', accent: 'mint' },
  { id: 'duck-sunny', type: 'duck', name: 'Sunny', species: 'Duck', accent: 'honey' },
  { id: 'bunny-rose', type: 'bunny', name: 'Rose', species: 'Bunny', accent: 'peach' },
  { id: 'bunny-lulu', type: 'bunny', name: 'Lulu', species: 'Bunny', accent: 'sky' },
  { id: 'fox-ember', type: 'fox', name: 'Ember', species: 'Fox', accent: 'honey' },
  { id: 'fox-sienna', type: 'fox', name: 'Sienna', species: 'Fox', accent: 'peach' },
  { id: 'frog-mint', type: 'frog', name: 'Minty', species: 'Frog', accent: 'mint' },
  { id: 'frog-olive', type: 'frog', name: 'Olive', species: 'Frog', accent: 'leaf' },
  { id: 'cat-honey', type: 'cat', name: 'Honey', species: 'Cat', accent: 'sunset' },
  { id: 'bear-coco', type: 'bear', name: 'Coco', species: 'Bear', accent: 'leaf' },
];
const seasonCatalog = ['spring', 'summer', 'autumn', 'winter'];

function formatPhaseLabel(phase) {
  const labels = {
    landing: 'Landing',
    lobby: 'Lobby',
    question: 'Question Live',
    reveal: 'Answer Reveal',
    leaderboard: 'Leaderboard',
    final: 'Final Podium',
  };

  return labels[phase] || 'Live';
}

function saveSession(details) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(details));
  } catch (error) {
    // Ignore storage failures.
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    // Ignore storage failures.
  }
}

function isHostView() {
  return Boolean(state.playerId) && state.playerId === state.hostId;
}

function getParticipantPlayers() {
  return state.players.filter((player) => !player.isHost);
}

function updateChrome() {
  const role = isHostView() ? 'Host' : 'Player';
  phasePill.textContent = formatPhaseLabel(state.phase);
  rolePill.textContent = role;
  heroRoomCode.textContent = state.roomCode || '------';
}

function getPlayerAvatarId(playerId = state.playerId) {
  const player = state.players.find((item) => item.id === playerId);
  return player ? player.avatarId || null : null;
}

function getAvatarEmoji(avatarId) {
  const avatar = avatarCatalog.find((item) => item.id === avatarId);
  return avatarEmojiMap[avatar ? avatar.type : 'cat'] || '✨';
}

function getAvatarSvg(avatarId) {
  const art = {
    cat: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <path d="M30 36 44 16l12 20" fill="#f8c9a9" stroke="#7d675f" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M90 36 76 16 64 36" fill="#f8c9a9" stroke="#7d675f" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="60" cy="62" r="38" fill="#f8c9a9" stroke="#7d675f" stroke-width="4"/>
        <ellipse cx="60" cy="72" rx="21" ry="16" fill="#fff8ef"/>
        <circle cx="46" cy="58" r="4.8" fill="#33443d"/>
        <circle cx="74" cy="58" r="4.8" fill="#33443d"/>
        <path d="M57 68h6" stroke="#b66f54" stroke-width="4" stroke-linecap="round"/>
        <path d="M52 75c4 4 12 4 16 0" stroke="#b66f54" stroke-width="4" stroke-linecap="round" fill="none"/>
        <path d="M31 63h-16M31 72H14M89 63h16M89 72h17" stroke="#a86f4f" stroke-width="4" stroke-linecap="round"/>
        <path d="M54 31h12" stroke="#c78c61" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `,
    bear: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <circle cx="36" cy="34" r="14" fill="#9d6a42" stroke="#6b4a34" stroke-width="4"/>
        <circle cx="84" cy="34" r="14" fill="#9d6a42" stroke="#6b4a34" stroke-width="4"/>
        <circle cx="60" cy="62" r="38" fill="#9d6a42" stroke="#6b4a34" stroke-width="4"/>
        <circle cx="60" cy="71" r="18" fill="#efd2ae"/>
        <circle cx="46" cy="58" r="5" fill="#2f241d"/>
        <circle cx="74" cy="58" r="5" fill="#2f241d"/>
        <ellipse cx="60" cy="68" rx="6" ry="5" fill="#7a4d38"/>
        <path d="M53 78c4 3 10 3 14 0" stroke="#7a4d38" stroke-width="4" stroke-linecap="round" fill="none"/>
      </svg>
    `,
    duck: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <circle cx="60" cy="58" r="38" fill="#ffe36d" stroke="#b5942f" stroke-width="4"/>
        <circle cx="46" cy="55" r="5" fill="#38463f"/>
        <circle cx="74" cy="55" r="5" fill="#38463f"/>
        <path d="M60 22l7-12 7 12" fill="#ffd24a" stroke="#b5942f" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M43 70c6-3 28-3 34 0v7c-9 5-25 5-34 0z" fill="#ef9b35" stroke="#bb6f18" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="37" cy="67" r="4" fill="#ffd6c3" opacity="0.6"/>
        <circle cx="83" cy="67" r="4" fill="#ffd6c3" opacity="0.6"/>
      </svg>
    `,
    bunny: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <rect x="34" y="5" width="16" height="36" rx="10" fill="#ffe3ef" stroke="#8f7c82" stroke-width="3.5"/>
        <rect x="70" y="5" width="16" height="36" rx="10" fill="#ffe3ef" stroke="#8f7c82" stroke-width="3.5"/>
        <circle cx="60" cy="62" r="38" fill="#fff4f8" stroke="#8f7c82" stroke-width="4"/>
        <ellipse cx="60" cy="72" rx="20" ry="16" fill="#ffffff"/>
        <circle cx="46" cy="58" r="4.7" fill="#3a403e"/>
        <circle cx="74" cy="58" r="4.7" fill="#3a403e"/>
        <ellipse cx="60" cy="67" rx="5.8" ry="4.8" fill="#b47b69"/>
        <path d="M53 77c4-2 10-2 14 0" stroke="#d95c79" stroke-width="4" stroke-linecap="round" fill="none"/>
        <circle cx="40" cy="69" r="4" fill="#f3bfd0"/>
        <circle cx="80" cy="69" r="4" fill="#f3bfd0"/>
      </svg>
    `,
    fox: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <path d="M35 28 50 10l8 18" fill="#f2a14f" stroke="#7a5a43" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M85 28 70 10l-8 18" fill="#f2a14f" stroke="#7a5a43" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="60" cy="62" r="38" fill="#f2a14f" stroke="#7a5a43" stroke-width="4"/>
        <path d="M42 72c6-14 30-14 36 0-8 10-28 10-36 0z" fill="#fff2df"/>
        <circle cx="46" cy="58" r="4.8" fill="#2f352f"/>
        <circle cx="74" cy="58" r="4.8" fill="#2f352f"/>
        <path d="M56 68h8" stroke="#8f573e" stroke-width="4" stroke-linecap="round"/>
        <path d="M52 76c4 4 12 4 16 0" stroke="#8f573e" stroke-width="4" stroke-linecap="round" fill="none"/>
      </svg>
    `,
    frog: `
      <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
        <circle cx="44" cy="32" r="13" fill="#95d574" stroke="#5f7a4d" stroke-width="4"/>
        <circle cx="76" cy="32" r="13" fill="#95d574" stroke="#5f7a4d" stroke-width="4"/>
        <circle cx="60" cy="64" r="37" fill="#95d574" stroke="#5f7a4d" stroke-width="4"/>
        <circle cx="44" cy="32" r="4.5" fill="#5e4332"/>
        <circle cx="76" cy="32" r="4.5" fill="#5e4332"/>
        <circle cx="53" cy="67" r="2.5" fill="#5e4332"/>
        <circle cx="67" cy="67" r="2.5" fill="#5e4332"/>
        <path d="M42 79c10 7 26 7 36 0" stroke="#5e4332" stroke-width="4" stroke-linecap="round" fill="none"/>
      </svg>
    `,
  };

  return art[avatarId] || '';
}

function getAvatarExtras(avatarId, variant = 'default') {
  if (variant === 'scene') return '';

  const extras = {
    cat: `
      <span class="avatar-extra cat-tail" aria-hidden="true"></span>
    `,
    bear: `
      <span class="avatar-extra bear-paw paw-left" aria-hidden="true"></span>
      <span class="avatar-extra bear-paw paw-right" aria-hidden="true"></span>
    `,
    duck: `
      <span class="avatar-extra duck-feet" aria-hidden="true">
        <span class="duck-foot foot-left"></span>
        <span class="duck-foot foot-right"></span>
      </span>
    `,
    bunny: `
      <span class="avatar-extra bunny-alert" aria-hidden="true">!</span>
    `,
    fox: `
      <span class="avatar-extra fox-tail" aria-hidden="true"></span>
    `,
    frog: `
      <span class="avatar-extra frog-feet" aria-hidden="true">
        <span class="frog-foot foot-left"></span>
        <span class="frog-foot foot-right"></span>
      </span>
    `,
  };

  return extras[avatarId] || '';
}

function createAvatarMarkup(avatarId, mood = 'idle', variant = 'default') {
  const avatar = avatarCatalog.find((item) => item.id === avatarId);
  if (!avatar) return '';

  return `
    <span class="avatar-art avatar-${avatar.type} ${avatar.accent} ${mood} ${variant === 'scene' ? 'scene-avatar' : ''}">
      ${getAvatarSvg(avatar.type)}
      ${getAvatarExtras(avatar.type, variant)}
    </span>
  `;
}

function setSeasonTheme(season) {
  document.body.classList.remove(
    'season-spring',
    'season-summer',
    'season-autumn',
    'season-winter'
  );
  document.body.classList.add(`season-${season}`);
  if (meadowScene) {
    meadowScene.setAttribute('data-season', season);
  }
  if (scenePicnic) {
    scenePicnic.className = `scene-picnic scene-${season}`;
  }
}

function getSeasonWeatherMarkup(season) {
  const makeItems = (baseClass, count) =>
    Array.from({ length: count }, (_, index) => `<span class="${baseClass} ${baseClass}-${index + 1}"></span>`).join('');

  const weather = {
    spring: `${makeItems('petal', 8)}${makeItems('butterfly', 3)}`,
    summer: `${makeItems('sunbeam', 4)}${makeItems('firefly', 4)}`,
    autumn: `${makeItems('leaf-drift', 8)}${makeItems('acorn-drop', 4)}`,
    winter: `${makeItems('snowflake', 10)}${makeItems('frost-twinkle', 4)}`,
  };

  return weather[season] || '';
}

function getSeasonSceneMarkup(season) {
  const villagers = {
    spring: `
      <div class="scene-villager spring-miso">${createAvatarMarkup('cat', 'idle', 'scene')}</div>
      <div class="scene-villager spring-maple">${createAvatarMarkup('bear', 'idle', 'scene')}</div>
      <div class="scene-villager spring-puddles">${createAvatarMarkup('duck', 'happy', 'scene')}</div>
      <div class="scene-villager spring-clover">${createAvatarMarkup('bunny', 'happy', 'scene')}</div>
      <div class="scene-villager spring-rusty">${createAvatarMarkup('fox', 'idle', 'scene')}</div>
      <div class="scene-villager spring-sprig">${createAvatarMarkup('frog', 'happy', 'scene')}</div>
      <div class="season-props spring-props">
        <span class="flower-clump flower-a"></span>
        <span class="flower-clump flower-b"></span>
        <span class="flower-clump flower-c"></span>
        <span class="tea-set tea-left"></span>
        <span class="tea-set tea-right"></span>
      </div>
    `,
    summer: `
      <div class="scene-villager summer-miso">${createAvatarMarkup('cat', 'happy', 'scene')}</div>
      <div class="scene-villager summer-maple">${createAvatarMarkup('bear', 'happy', 'scene')}</div>
      <div class="scene-villager summer-puddles">${createAvatarMarkup('duck', 'happy', 'scene')}</div>
      <div class="scene-villager summer-clover">${createAvatarMarkup('bunny', 'idle', 'scene')}</div>
      <div class="scene-villager summer-rusty">${createAvatarMarkup('fox', 'happy', 'scene')}</div>
      <div class="scene-villager summer-sprig">${createAvatarMarkup('frog', 'idle', 'scene')}</div>
      <div class="season-props summer-props">
        <span class="sunhat"></span>
        <span class="lemonade-pitcher"></span>
        <span class="drink-cup cup-a"></span>
        <span class="drink-cup cup-b"></span>
        <span class="watermelon-slice melon-a"></span>
        <span class="watermelon-slice melon-b"></span>
        <span class="beach-ball"></span>
      </div>
    `,
    autumn: `
      <div class="scene-villager autumn-miso">${createAvatarMarkup('cat', 'idle', 'scene')}</div>
      <div class="scene-villager autumn-maple">${createAvatarMarkup('bear', 'happy', 'scene')}</div>
      <div class="scene-villager autumn-puddles">${createAvatarMarkup('duck', 'idle', 'scene')}</div>
      <div class="scene-villager autumn-clover">${createAvatarMarkup('bunny', 'happy', 'scene')}</div>
      <div class="scene-villager autumn-rusty">${createAvatarMarkup('fox', 'happy', 'scene')}</div>
      <div class="scene-villager autumn-sprig">${createAvatarMarkup('frog', 'idle', 'scene')}</div>
      <div class="season-props autumn-props">
        <span class="leaf-pile"></span>
        <span class="pumpkin pumpkin-a"></span>
        <span class="pumpkin pumpkin-b"></span>
        <span class="cider-mug mug-a"></span>
        <span class="cider-mug mug-b"></span>
      </div>
    `,
    winter: `
      <div class="scene-villager winter-miso">${createAvatarMarkup('cat', 'idle', 'scene')}</div>
      <div class="scene-villager winter-maple">${createAvatarMarkup('bear', 'happy', 'scene')}</div>
      <div class="scene-villager winter-puddles">${createAvatarMarkup('duck', 'idle', 'scene')}</div>
      <div class="scene-villager winter-clover">${createAvatarMarkup('bunny', 'happy', 'scene')}</div>
      <div class="scene-villager winter-rusty">${createAvatarMarkup('fox', 'idle', 'scene')}</div>
      <div class="scene-villager winter-sprig">${createAvatarMarkup('frog', 'happy', 'scene')}</div>
      <div class="season-props winter-props">
        <span class="snowman"></span>
        <span class="snow-drift drift-a"></span>
        <span class="snow-drift drift-b"></span>
        <span class="cocoa-mug cocoa-a"></span>
        <span class="cocoa-mug cocoa-b"></span>
        <span class="knit-scarf"></span>
      </div>
    `,
  };

  return villagers[season] || '';
}

function renderDecor() {
  const season = seasonCatalog[Math.floor(Math.random() * seasonCatalog.length)];
  setSeasonTheme(season);
  if (sceneWeather) sceneWeather.innerHTML = getSeasonWeatherMarkup(season);
  if (sceneFriends) sceneFriends.innerHTML = getSeasonSceneMarkup(season);
}

function showView(viewName) {
  Object.values(views).forEach((v) => {
    v.classList.add('hidden');
    v.classList.remove('active');
  });

  const selected = views[viewName];
  if (selected) {
    selected.classList.remove('hidden');
    selected.classList.add('active');
  }

  state.phase = viewName;
  updateChrome();
}

function setLandingError(message = '') {
  landingError.textContent = message;
}

function renderPlayers(players) {
  state.players = players;
  const participants = getParticipantPlayers();
  const readyPlayers = participants.filter((player) => player.avatarId).length;
  playerCount.textContent = String(participants.length);
  avatarReadyCount.textContent = `${readyPlayers} ready`;
  if (hostReadyStat) hostReadyStat.textContent = `${readyPlayers} ready`;
  if (hostPlayerStat) hostPlayerStat.textContent = `${participants.length} players`;
  playersListEl.innerHTML = '';
  participants.forEach((player) => {
    const li = document.createElement('li');
    li.className = 'player-card';
    const avatarId = player.avatarId || avatarCatalog[0].id;
    const mood = player.avatarId ? 'happy' : 'idle';
    const pickedAvatar = avatarCatalog.find((item) => item.id === player.avatarId);
    li.innerHTML = `
      <div class="player-avatar-wrap">
        ${createAvatarMarkup(avatarId, mood)}
      </div>
      <div class="player-meta">
        <strong>${player.name}${player.isHost ? ' (Host)' : ''}</strong>
        <span>${player.avatarId && pickedAvatar ? `${pickedAvatar.name} the ${pickedAvatar.species}` : 'Picking avatar...'}</span>
      </div>
    `;
    playersListEl.appendChild(li);
  });

  renderAvatarPicker();
  renderHostLobbyPanel();
  renderHostLiveStats();
}

function renderLeaderboard(targetElement, leaderboard) {
  targetElement.innerHTML = '';
  leaderboard.forEach((item, index) => {
    const li = document.createElement('li');
    const avatarId = item.avatarId || avatarCatalog[index % avatarCatalog.length].id;
    li.innerHTML = `
      <div class="leaderboard-entry">
        ${createAvatarMarkup(avatarId, 'happy')}
        <span>${item.name}</span>
      </div>
      <strong>${item.score} pts</strong>
    `;
    targetElement.appendChild(li);
  });
}

function renderRevealRace(answerSummary = []) {
  if (!revealRace) return;

  const ranked = [...answerSummary].sort((a, b) => b.score - a.score);
  const topScore = ranked.length ? Math.max(...ranked.map((item) => item.score), 1) : 1;

  revealRace.innerHTML = '';

  ranked.forEach((item, index) => {
    const player = state.players.find((entry) => entry.id === item.playerId);
    const playerAvatarId = player ? player.avatarId : null;
    const progress = topScore > 0 ? Math.max(6, Math.round((item.score / topScore) * 100)) : 6;
    const lane = document.createElement('div');
    lane.className = 'race-lane';
    lane.innerHTML = `
      <div class="race-player-meta">
        <span class="race-emoji">${getAvatarEmoji(playerAvatarId)}</span>
        <div>
          <strong>${item.name}</strong>
          <span>${item.correct ? `+${item.earned} points` : item.answered ? 'Oops, no points' : 'No answer this time'}</span>
        </div>
      </div>
      <div class="race-track">
        <span class="race-start">Start</span>
        <div class="race-line">
          <span class="race-runner" style="left: calc(${progress}% - 20px)">${getAvatarEmoji(playerAvatarId)}</span>
        </div>
        <span class="race-finish">${index === 0 ? 'Leading' : `${item.score} pts`}</span>
      </div>
    `;
    revealRace.appendChild(lane);
  });
}

function renderHostLobbyPanel() {
  if (!hostLobbyPanel || !hostQuestionQueue) return;

  const show = isHostView() && state.phase === 'lobby';
  hostLobbyPanel.classList.toggle('hidden', !show);
  if (!show) return;

  hostQuestionQueue.innerHTML = '';

  state.questionQueue.forEach((question, index) => {
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.innerHTML = `
      <div class="queue-meta">
        <span class="queue-index">#${index + 1}</span>
        <strong>${question.prompt}</strong>
      </div>
      <div class="queue-actions">
        <button class="queue-btn" data-action="up" ${index === 0 ? 'disabled' : ''}>Up</button>
        <button class="queue-btn" data-action="top" ${index === 0 ? 'disabled' : ''}>Top</button>
      </div>
    `;

    card.querySelectorAll('.queue-btn').forEach((button) => {
      button.addEventListener('click', () => {
        socket.emit(
          'prioritizeQuestion',
          {
            roomCode: state.roomCode,
            questionId: question.id,
            action: button.getAttribute('data-action'),
          },
          (response) => {
            if (!response.ok) {
              avatarStatus.textContent = response.error || 'Could not reorder questions.';
            }
          }
        );
      });
    });

    hostQuestionQueue.appendChild(card);
  });
}

function renderHostLiveStats() {
  if (!hostLivePanel || !hostLiveStandings) return;

  const show = isHostView() && ['question', 'reveal', 'leaderboard'].includes(state.phase);
  hostLivePanel.classList.toggle('hidden', !show);
  if (!show) return;

  const leaderboard = getParticipantPlayers().slice().sort((a, b) => b.score - a.score);
  if (hostLockedCount) hostLockedCount.textContent = `${state.lockedCount} / ${state.totalParticipants}`;
  if (hostLeaderName) {
    hostLeaderName.textContent = leaderboard.length
      ? `${leaderboard[0].name} (${leaderboard[0].score} pts)`
      : 'Waiting...';
  }
  if (hostNextQuestion) {
    const nextPrompt = state.questionQueue[state.currentQuestion ? state.currentQuestion.index : 0];
    hostNextQuestion.textContent = nextPrompt ? nextPrompt.prompt : 'Queue complete';
  }

  hostLiveStandings.innerHTML = '';
  leaderboard.slice(0, 5).forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'host-standing-row';
    row.innerHTML = `
      <span class="host-standing-rank">${index + 1}</span>
      <span class="host-standing-name">${player.name}</span>
      <strong>${player.score} pts</strong>
    `;
    hostLiveStandings.appendChild(row);
  });
}

function renderAvatarPicker() {
  if (!avatarPicker) return;

  if (isHostView()) {
    avatarPicker.innerHTML = '<div class="host-avatar-note">Host mode is live. Players pick avatars. You run the room.</div>';
    avatarStatus.textContent = 'Host mode active';
    return;
  }

  const takenByAvatar = new Map(
    getParticipantPlayers().filter((player) => player.avatarId).map((player) => [player.avatarId, player.id])
  );
  const myAvatarId = getPlayerAvatarId();

  avatarPicker.innerHTML = '';

  avatarCatalog.forEach((avatar) => {
    const ownerId = takenByAvatar.get(avatar.id);
    const isMine = ownerId === state.playerId;
    const isTaken = Boolean(ownerId) && !isMine;
    const button = document.createElement('button');
    button.className = `avatar-option ${avatar.species} ${avatar.accent}`;
    if (isMine) button.classList.add('selected');
    if (isTaken) button.classList.add('taken');
    button.disabled = isTaken || state.phase !== 'lobby';
    button.innerHTML = `
      ${createAvatarMarkup(avatar.id, isMine ? 'happy' : 'idle')}
      <span class="avatar-name">${avatar.name}</span>
      <span class="avatar-label">${avatar.species}</span>
      <span class="avatar-helper">${isTaken ? 'Taken' : isMine ? 'Yours' : 'Pick me'}</span>
    `;
    button.addEventListener('click', () => {
      socket.emit('chooseAvatar', { roomCode: state.roomCode, avatarId: avatar.id }, (response) => {
        if (!response.ok) {
          answerStatus.textContent = '';
          avatarStatus.textContent = response.error || 'Could not pick avatar.';
          return;
        }
        avatarStatus.textContent = `${avatar.name} picked`;
      });
    });
    avatarPicker.appendChild(button);
  });

  if (myAvatarId) {
    const currentAvatar = avatarCatalog.find((avatar) => avatar.id === myAvatarId);
    avatarStatus.textContent = currentAvatar ? `${currentAvatar.name} picked` : 'Avatar picked';
  } else {
    avatarStatus.textContent = 'Nothing picked yet';
  }
}

function startQuestionTimer(startedAt, durationMs) {
  clearInterval(state.timerInterval);

  const tick = () => {
    const elapsed = Date.now() - startedAt;
    const remainMs = Math.max(0, durationMs - elapsed);
    timerEl.textContent = String(Math.ceil(remainMs / 1000));
  };

  tick();
  state.timerInterval = setInterval(tick, 200);
}

function clearQuestionTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
}

function lockOptionButtons() {
  [...questionOptions.querySelectorAll('.option')].forEach((btn) => {
    btn.disabled = true;
    btn.classList.add('locked');
  });
}

function markSelectedOption(button) {
  [...questionOptions.querySelectorAll('.option')].forEach((btn) => {
    btn.classList.remove('selected');
  });
  button.classList.add('selected');
}

function renderQuestion(payload) {
  state.currentQuestion = payload;
  state.selectedAnswer = null;
  state.lockedCount = 0;
  state.totalParticipants = payload.totalParticipants || state.totalParticipants;
  const funMoment = questionFunMoments[(payload.index - 1) % questionFunMoments.length];

  questionProgress.textContent = `Question ${payload.index} / ${payload.total}`;
  questionPrompt.textContent = payload.prompt;
  answerStatus.textContent = '';
  if (questionSticker) questionSticker.textContent = funMoment.sticker;
  if (questionVibe) questionVibe.textContent = funMoment.vibe;

  questionOptions.innerHTML = '';
  payload.options.forEach((optionText, idx) => {
    const btn = document.createElement('button');
    btn.className = `option option-${idx % optionBadges.length}`;
    btn.innerHTML = `<span class="option-badge">${optionBadges[idx % optionBadges.length]}</span><span>${optionText}</span>`;
    if (!isHostView()) {
      btn.addEventListener('click', () => {
        if (state.selectedAnswer !== null) return;
        markSelectedOption(btn);
        answerStatus.textContent = 'Locking answer...';

        socket.emit(
          'submitAnswer',
          { roomCode: state.roomCode, answerIndex: idx },
          (response) => {
            if (!response.ok) {
              btn.classList.remove('selected');
              answerStatus.textContent = response.error || 'Unable to submit answer.';
              return;
            }
            state.selectedAnswer = idx;
            lockOptionButtons();
            btn.classList.add('correct');
            answerStatus.textContent = 'Answer locked!';
          }
        );
      });
    } else {
      btn.disabled = true;
      btn.classList.add('host-readonly');
    }
    questionOptions.appendChild(btn);
  });

  showView('question');
  startQuestionTimer(payload.startedAt, payload.durationMs);
  answerStatus.textContent = isHostView()
    ? 'Host mode: watch the room, track who is answering, and prep the next question.'
    : '';
  renderHostLiveStats();
}

function revealAnswer(payload) {
  showView('reveal');
  clearQuestionTimer();

  const selectedOption = state.selectedAnswer;
  const selectedText =
    selectedOption === null
      ? 'No answer submitted this round.'
      : `You picked option ${selectedOption + 1}.`;

  revealText.textContent = `${selectedText} Correct answer: option ${payload.correctIndex + 1}.`;
  revealExplanation.textContent = payload.explanation || '';
  renderRevealRace(payload.answerSummary || []);
  renderHostLiveStats();

  if (state.currentQuestion) {
    [...questionOptions.querySelectorAll('.option')].forEach((btn, idx) => {
      btn.classList.remove('correct');
      btn.classList.remove('wrong');
      if (idx === payload.correctIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedOption) {
        btn.classList.add('wrong');
      }
    });
  }
}

socket.on('roomState', (payload) => {
  state.hostId = payload.hostId;
  state.phase = payload.phase;
  state.roomCode = payload.roomCode;
  state.availableAvatars = payload.availableAvatars || [];
  state.questionQueue = payload.questionQueue || [];
  roomCodeEl.textContent = payload.roomCode;
  heroRoomCode.textContent = payload.roomCode;

  renderPlayers(payload.players);

  const isHost = state.playerId === state.hostId;
  const participantPlayers = payload.players.filter((player) => !player.isHost);
  const allReady = participantPlayers.length > 0 && participantPlayers.every((player) => player.avatarId);
  if (isHost && payload.phase === 'lobby') {
    startButton.classList.remove('hidden');
    startButton.disabled = !allReady;
  } else {
    startButton.classList.add('hidden');
  }

  if (payload.phase === 'lobby') {
    if (lobbyNotice) {
      lobbyNotice.textContent = isHost
        ? 'You are hosting. Watch readiness, reorder the question queue, and launch when everyone is set.'
        : 'Pick an avatar before the host starts. One avatar per player.';
    }
    showView('lobby');
  }
});

socket.on('questionStart', (payload) => {
  renderQuestion(payload);
});

socket.on('answerLocked', (payload) => {
  if (state.phase !== 'question') return;
  state.lockedCount = payload.lockedCount;
  state.totalParticipants = payload.totalPlayers;
  answerStatus.textContent = isHostView()
    ? `Live status: ${payload.lockedCount}/${payload.totalPlayers} players have answered.`
    : `Locked answers: ${payload.lockedCount}/${payload.totalPlayers}`;
  renderHostLiveStats();
});

socket.on('answerReveal', (payload) => {
  revealAnswer(payload);
});

socket.on('leaderboard', (payload) => {
  if (payload.final) {
    state.phase = 'final';
    showView('final');
    championName.textContent = payload.champion
      ? `${payload.champion.name} with ${payload.champion.score} points!`
      : 'No champion this round.';
    renderLeaderboard(finalBoard, payload.leaderboard);
    return;
  }

  showView('leaderboard');
  renderLeaderboard(leaderboardList, payload.leaderboard);
  renderHostLiveStats();
});

document.getElementById('show-host').addEventListener('click', () => {
  setLandingError('');
  hostForm.classList.remove('hidden');
  joinForm.classList.add('hidden');
});

document.getElementById('show-join').addEventListener('click', () => {
  setLandingError('');
  joinForm.classList.remove('hidden');
  hostForm.classList.add('hidden');
});

document.getElementById('create-room').addEventListener('click', () => {
  const name = document.getElementById('host-name').value;
  socket.emit('createRoom', { name }, (response) => {
    if (!response.ok) {
      setLandingError(response.error || 'Failed to create room.');
      return;
    }

    state.playerId = response.playerId;
    state.roomCode = response.roomCode;
    saveSession({
      roomCode: response.roomCode,
      playerId: response.playerId,
      playerToken: response.playerToken,
      playerName: response.playerName || name,
    });
    setLandingError('');
  });
});

document.getElementById('join-room').addEventListener('click', () => {
  const name = document.getElementById('join-name').value;
  const roomCode = document.getElementById('join-room-code').value;

  socket.emit('joinRoom', { name, roomCode }, (response) => {
    if (!response.ok) {
      setLandingError(response.error || 'Failed to join room.');
      return;
    }

    state.playerId = response.playerId;
    state.roomCode = response.roomCode;
    saveSession({
      roomCode: response.roomCode,
      playerId: response.playerId,
      playerToken: response.playerToken,
      playerName: response.playerName || name,
    });
    setLandingError('');
  });
});

startButton.addEventListener('click', () => {
  socket.emit('startGame', { roomCode: state.roomCode }, (response) => {
    if (!response.ok) {
      avatarStatus.textContent = response.error || 'Unable to start game.';
    }
  });
});

showView('landing');
updateChrome();
renderDecor();

const savedSession = loadSession();
if (savedSession && savedSession.roomCode && savedSession.playerToken) {
  socket.emit(
    'resumeSession',
    {
      roomCode: savedSession.roomCode,
      playerToken: savedSession.playerToken,
    },
    (response) => {
      if (!response.ok) {
        clearSession();
        return;
      }

      state.playerId = response.playerId;
      state.roomCode = response.roomCode;
      saveSession({
        roomCode: response.roomCode,
        playerId: response.playerId,
        playerToken: response.playerToken,
        playerName: response.playerName || savedSession.playerName,
      });
    }
  );
}

// Prevent accidental refresh: show confirmation dialog
window.addEventListener('beforeunload', function (e) {
  // Modern browsers ignore custom messages, but returning a string triggers the dialog
  e.preventDefault();
  e.returnValue = '';
  return '';
});

// Optional: Listen for refresh and show a custom popup (in-app)
let refreshPending = false;
window.addEventListener('keydown', function (e) {
  // Detect F5 or Ctrl+R/Command+R
  if ((e.key === 'F5') || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    if (!refreshPending) {
      refreshPending = true;
      if (confirm('Do you want to restart the game?')) {
        window.removeEventListener('beforeunload', () => {}); // Remove handler to allow refresh
        location.reload();
      } else {
        refreshPending = false;
      }
    }
  }
});
