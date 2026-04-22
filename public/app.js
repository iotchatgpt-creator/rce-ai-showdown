const socket = io();

const state = {
  playerId: null,
  roomCode: null,
  hostId: null,
  phase: 'landing',
  currentQuestion: null,
  selectedAnswer: null,
  timerInterval: null,
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
const roomCodeEl = document.getElementById('room-code');
const playersListEl = document.getElementById('players-list');
const startButton = document.getElementById('start-game');
const questionProgress = document.getElementById('question-progress');
const questionPrompt = document.getElementById('question-prompt');
const questionOptions = document.getElementById('question-options');
const timerEl = document.getElementById('timer');
const answerStatus = document.getElementById('answer-status');
const revealText = document.getElementById('reveal-text');
const revealExplanation = document.getElementById('reveal-explanation');
const leaderboardList = document.getElementById('leaderboard-list');
const championName = document.getElementById('champion-name');
const finalBoard = document.getElementById('final-board');

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
}

function setLandingError(message = '') {
  landingError.textContent = message;
}

function renderPlayers(players) {
  playersListEl.innerHTML = '';
  players.forEach((player) => {
    const li = document.createElement('li');
    li.textContent = `${player.name}${player.isHost ? ' (Host)' : ''}`;
    playersListEl.appendChild(li);
  });
}

function renderLeaderboard(targetElement, leaderboard) {
  targetElement.innerHTML = '';
  leaderboard.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `#${index + 1} ${item.name} — ${item.score} pts`;
    targetElement.appendChild(li);
  });
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

function renderQuestion(payload) {
  state.currentQuestion = payload;
  state.selectedAnswer = null;

  questionProgress.textContent = `Question ${payload.index} / ${payload.total}`;
  questionPrompt.textContent = payload.prompt;
  answerStatus.textContent = '';

  questionOptions.innerHTML = '';
  payload.options.forEach((optionText, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = optionText;
    btn.addEventListener('click', () => {
      if (state.selectedAnswer !== null) return;

      socket.emit(
        'submitAnswer',
        { roomCode: state.roomCode, answerIndex: idx },
        (response) => {
          if (!response.ok) {
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
    questionOptions.appendChild(btn);
  });

  showView('question');
  startQuestionTimer(payload.startedAt, payload.durationMs);
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
  roomCodeEl.textContent = payload.roomCode;

  renderPlayers(payload.players);

  const isHost = state.playerId === state.hostId;
  if (isHost && payload.phase === 'lobby') {
    startButton.classList.remove('hidden');
  } else {
    startButton.classList.add('hidden');
  }

  if (payload.phase === 'lobby') {
    showView('lobby');
  }
});

socket.on('questionStart', (payload) => {
  renderQuestion(payload);
});

socket.on('answerLocked', (payload) => {
  if (state.phase !== 'question') return;
  answerStatus.textContent = `Locked answers: ${payload.lockedCount}/${payload.totalPlayers}`;
});

socket.on('answerReveal', (payload) => {
  revealAnswer(payload);
});

socket.on('leaderboard', (payload) => {
  if (payload.final) {
    showView('final');
    championName.textContent = payload.champion
      ? `${payload.champion.name} with ${payload.champion.score} points!`
      : 'No champion this round.';
    renderLeaderboard(finalBoard, payload.leaderboard);
    return;
  }

  showView('leaderboard');
  renderLeaderboard(leaderboardList, payload.leaderboard);
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
    setLandingError('');
  });
});

startButton.addEventListener('click', () => {
  socket.emit('startGame', { roomCode: state.roomCode }, (response) => {
    if (!response.ok) {
      alert(response.error || 'Unable to start game');
    }
  });
});

showView('landing');
