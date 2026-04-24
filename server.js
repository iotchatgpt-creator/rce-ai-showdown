const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const QUESTION_TIME_MS = 20000;
const REVEAL_TIME_MS = 4000;
const LEADERBOARD_TIME_MS = 4000;
const QUESTIONS_PER_GAME = 20;
const RECONNECT_GRACE_MS = 300000; // 5 minutes
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'app-db.json');
const SCHEMA_FILE = path.join(DATA_DIR, 'db-schema.json');
const AVAILABLE_AVATARS = [
  'cat',
  'bear',
  'duck',
  'bunny',
  'fox',
  'frog',
  'cat-pearl',
  'cat-toffee',
  'bear-hazel',
  'bear-mocha',
  'duck-daisy',
  'duck-sunny',
  'bunny-rose',
  'bunny-lulu',
  'fox-ember',
  'fox-sienna',
  'frog-mint',
  'frog-olive',
  'cat-honey',
  'bear-coco',
];

const questionSeed = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8')
);
const dbSchema = JSON.parse(fs.readFileSync(SCHEMA_FILE, 'utf8'));

const rooms = new Map();
let dbState = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function defaultDbState() {
  return {
    meta: {
      schemaVersion: dbSchema.version,
      initializedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    },
    schema: dbSchema,
    masterData: {
      questions: questionSeed.map((question) => ({
        id: randomId('question'),
        ...question,
      })),
      avatars: AVAILABLE_AVATARS,
    },
    playerProfiles: [],
    activeRooms: [],
    completedGames: [],
  };
}

function ensureDbFile() {
  if (!fs.existsSync(DB_FILE)) {
    dbState = defaultDbState();
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2));
    return;
  }

  try {
    dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (error) {
    dbState = defaultDbState();
  }

  if (!dbState.meta || !dbState.schema || !dbState.masterData) {
    dbState = defaultDbState();
  }

  dbState.meta.schemaVersion = dbSchema.version;
  dbState.meta.lastUpdatedAt = new Date().toISOString();
  dbState.schema = dbSchema;
  dbState.masterData = dbState.masterData || {};
  dbState.masterData.questions = Array.isArray(dbState.masterData.questions)
    ? dbState.masterData.questions
    : questionSeed.map((question) => ({
      id: randomId('question'),
      ...question,
    }));
  dbState.masterData.avatars = AVAILABLE_AVATARS;
  dbState.playerProfiles = Array.isArray(dbState.playerProfiles) ? dbState.playerProfiles : [];
  dbState.activeRooms = Array.isArray(dbState.activeRooms) ? dbState.activeRooms : [];
  dbState.completedGames = Array.isArray(dbState.completedGames) ? dbState.completedGames : [];

  dbState.masterData.questions = dbState.masterData.questions.map((question) => normalizeQuestionInput(question));

  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2));
}

function saveDbState() {
  dbState.meta.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2));
}

function serializePlayer(player, room) {
  return {
    id: player.id,
    token: player.token,
    name: player.name,
    score: player.score,
    avatarId: player.avatarId || null,
    isHost: player.id === room.hostId,
    connected: !player.disconnectedAt,
    lastSeenAt: player.lastSeenAt || null,
  };
}

function serializePlayers(room) {
  return [...room.players.values()].map((player) => serializePlayer(player, room));
}

function getParticipantPlayers(room) {
  return [...room.players.values()].filter((player) => player.id !== room.hostId);
}

function persistRooms() {
  dbState.activeRooms = [...rooms.values()].map((room) => ({
    code: room.code,
    hostId: room.hostId,
    phase: room.phase === 'final' ? 'final' : 'lobby',
    questionIndex: room.phase === 'final' ? room.questionIndex : 0,
    players: serializePlayers(room),
    questions: room.questions,
    currentQuestionStartedAt: null,
    savedAt: new Date().toISOString(),
  }));

  saveDbState();
}

function loadPersistedRooms() {
  dbState.activeRooms.forEach((savedRoom) => {
    const players = new Map();
    (savedRoom.players || []).forEach((player) => {
      players.set(player.id, {
        id: player.id,
        token: player.token,
        name: player.name,
        score: savedRoom.phase === 'final' ? player.score : 0,
        avatarId: player.avatarId || null,
        socketId: null,
        disconnectedAt: null,
        lastSeenAt: player.lastSeenAt || null,
        disconnectTimer: null,
      });
    });

    rooms.set(savedRoom.code, {
      code: savedRoom.code,
      hostId: savedRoom.hostId,
      players,
      phase: savedRoom.phase === 'final' ? 'final' : 'lobby',
      questions: Array.isArray(savedRoom.questions) && savedRoom.questions.length ? savedRoom.questions : pickQuestions(),
      questionIndex: savedRoom.phase === 'final' ? savedRoom.questionIndex || 0 : 0,
      answers: new Map(),
      timer: null,
      currentQuestionStartedAt: null,
      lastRevealPayload: null,
      lastLeaderboardPayload: null,
    });
  });
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function createRoomCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

function getUniqueRoomCode() {
  let code = createRoomCode();
  while (rooms.has(code)) {
    code = createRoomCode();
  }
  return code;
}

function sanitizeName(name) {
  return String(name || '').trim().slice(0, 24);
}

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function pickQuestions() {
  return shuffle(dbState.masterData.questions || questionSeed).slice(0, QUESTIONS_PER_GAME);
}

function validateQuestionInput(payload, partial = false) {
  const errors = [];
  const hasPrompt = Object.prototype.hasOwnProperty.call(payload, 'prompt');
  const hasOptions = Object.prototype.hasOwnProperty.call(payload, 'options');
  const hasCorrectIndex = Object.prototype.hasOwnProperty.call(payload, 'correctIndex');

  if (!partial || hasPrompt) {
    if (!String(payload.prompt || '').trim()) {
      errors.push('prompt is required');
    }
  }

  if (!partial || hasOptions) {
    if (!Array.isArray(payload.options) || payload.options.length !== 4) {
      errors.push('options must be an array of 4 strings');
    } else if (payload.options.some((option) => !String(option || '').trim())) {
      errors.push('each option must be a non-empty string');
    }
  }

  if (!partial || hasCorrectIndex) {
    if (!Number.isInteger(payload.correctIndex) || payload.correctIndex < 0 || payload.correctIndex > 3) {
      errors.push('correctIndex must be an integer from 0 to 3');
    }
  }

  return errors;
}

function normalizeQuestionInput(payload, existing = {}) {
  return {
    id: existing.id || payload.id || randomId('question'),
    prompt: Object.prototype.hasOwnProperty.call(payload, 'prompt')
      ? String(payload.prompt).trim()
      : existing.prompt,
    options: Object.prototype.hasOwnProperty.call(payload, 'options')
      ? payload.options.map((option) => String(option).trim())
      : existing.options,
    correctIndex: Object.prototype.hasOwnProperty.call(payload, 'correctIndex')
      ? payload.correctIndex
      : existing.correctIndex,
    explanation: Object.prototype.hasOwnProperty.call(payload, 'explanation')
      ? String(payload.explanation || '').trim()
      : existing.explanation || '',
    difficulty: Object.prototype.hasOwnProperty.call(payload, 'difficulty')
      ? String(payload.difficulty || '').trim()
      : existing.difficulty || '',
    tags: Object.prototype.hasOwnProperty.call(payload, 'tags')
      ? Array.isArray(payload.tags) ? payload.tags.map(t => String(t).trim()) : []
      : existing.tags || [],
  };
}

function speedBonus(elapsedMs) {
  const seconds = elapsedMs / 1000;
  if (seconds <= 5) return 10;
  if (seconds <= 10) return 8;
  if (seconds <= 15) return 6;
  return 0;
}

function syncPlayerProfile(player, roomCode, role) {
  const existing = dbState.playerProfiles.find((profile) => profile.token === player.token);
  const payload = {
    token: player.token,
    playerId: player.id,
    name: player.name,
    lastRoomCode: roomCode,
    role,
    avatarId: player.avatarId || null,
    lastSeenAt: new Date().toISOString(),
  };

  if (existing) {
    Object.assign(existing, payload);
  } else {
    dbState.playerProfiles.push(payload);
  }
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  persistRooms();

  io.to(roomCode).emit('roomState', {
    roomCode,
    phase: room.phase,
    hostId: room.hostId,
    players: serializePlayers(room),
    availableAvatars: AVAILABLE_AVATARS,
    questionQueue: room.questions,
    questionIndex: room.questionIndex,
    totalQuestions: room.questions.length || QUESTIONS_PER_GAME,
  });
}

function isAvatarTaken(room, avatarId, ignorePlayerId = null) {
  for (const player of room.players.values()) {
    if (player.id !== ignorePlayerId && player.avatarId === avatarId) {
      return true;
    }
  }
  return false;
}

function getLeaderboard(room) {
  return serializePlayers(room)
    .filter((player) => !player.isHost)
    .sort((a, b) => b.score - a.score);
}

function emitLeaderboard(roomCode, final = false) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const leaderboard = getLeaderboard(room);
  const payload = {
    leaderboard,
    final,
    champion: leaderboard[0] || null,
    title: final ? 'RCE AI Champion — Iteration 2.14' : null,
  };

  room.lastLeaderboardPayload = payload;
  io.to(roomCode).emit('leaderboard', payload);
}

function sendCurrentStateToSocket(socket, room) {
  socket.emit('roomState', {
    roomCode: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: serializePlayers(room),
    availableAvatars: AVAILABLE_AVATARS,
    questionQueue: room.questions,
    questionIndex: room.questionIndex,
    totalQuestions: room.questions.length || QUESTIONS_PER_GAME,
  });

  if (room.phase === 'question' && room.questions[room.questionIndex]) {
    const current = room.questions[room.questionIndex];
    socket.emit('questionStart', {
      index: room.questionIndex + 1,
      total: room.questions.length,
      prompt: current.prompt,
      options: current.options,
      durationMs: QUESTION_TIME_MS,
      startedAt: room.currentQuestionStartedAt,
      totalParticipants: getParticipantPlayers(room).length,
    });
  }

  if (room.phase === 'reveal' && room.lastRevealPayload) {
    socket.emit('answerReveal', room.lastRevealPayload);
  }

  if ((room.phase === 'leaderboard' || room.phase === 'final') && room.lastLeaderboardPayload) {
    socket.emit('leaderboard', room.lastLeaderboardPayload);
  }
}

function schedulePlayerRemoval(playerId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.get(playerId);
  if (!player) return;

  player.disconnectedAt = Date.now();
  player.lastSeenAt = new Date().toISOString();

  if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
  player.disconnectTimer = setTimeout(() => {
    removePlayerFromRoom(playerId, roomCode);
  }, RECONNECT_GRACE_MS);

  syncPlayerProfile(player, roomCode, room.hostId === player.id ? 'host' : 'participant');
  emitRoomState(roomCode);
}

function removePlayerFromRoom(playerId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const player = room.players.get(playerId);
  if (player && player.disconnectTimer) clearTimeout(player.disconnectTimer);

  room.players.delete(playerId);
  room.answers.delete(playerId);

  if (room.players.size === 0) {
    if (room.timer) clearTimeout(room.timer);
    rooms.delete(roomCode);
    persistRooms();
    return;
  }

  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value;
  }

  emitRoomState(roomCode);
}

function createPlayer(name) {
  return {
    id: randomId('player'),
    token: randomId('token'),
    name,
    score: 0,
    avatarId: null,
    socketId: null,
    disconnectedAt: null,
    lastSeenAt: new Date().toISOString(),
    disconnectTimer: null,
  };
}

function attachSocketToPlayer(socket, room, player) {
  player.socketId = socket.id;
  player.disconnectedAt = null;
  player.lastSeenAt = new Date().toISOString();
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }

  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerId = player.id;
  socket.data.playerToken = player.token;
}

function findPlayerByToken(room, playerToken) {
  for (const player of room.players.values()) {
    if (player.token === playerToken) return player;
  }
  return null;
}

function archiveCompletedGame(room) {
  dbState.completedGames.push({
    roomCode: room.code,
    finishedAt: new Date().toISOString(),
    champion: getLeaderboard(room)[0] || null,
    leaderboard: getLeaderboard(room),
    totalQuestions: room.questions.length,
  });

  if (dbState.completedGames.length > 50) {
    dbState.completedGames = dbState.completedGames.slice(-50);
  }
}

function startQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.questionIndex >= room.questions.length) {
    room.phase = 'final';
    emitLeaderboard(roomCode, true);
    archiveCompletedGame(room);
    emitRoomState(roomCode);
    return;
  }

  room.phase = 'question';
  room.answers = new Map();
  room.currentQuestionStartedAt = Date.now();
  room.lastRevealPayload = null;

  const current = room.questions[room.questionIndex];
  const payload = {
    index: room.questionIndex + 1,
    total: room.questions.length,
    prompt: current.prompt,
    options: current.options,
    durationMs: QUESTION_TIME_MS,
    startedAt: room.currentQuestionStartedAt,
    totalParticipants: getParticipantPlayers(room).length,
  };

  io.to(roomCode).emit('questionStart', payload);
  emitRoomState(roomCode);

  room.timer = setTimeout(() => endQuestion(roomCode), QUESTION_TIME_MS);
}

function endQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'question') return;

  clearTimeout(room.timer);
  room.timer = null;

  const question = room.questions[room.questionIndex];
  room.phase = 'reveal';

  for (const player of room.players.values()) {
    const answer = room.answers.get(player.id);
    if (!answer) continue;

    if (answer.answerIndex === question.correctIndex) {
      const earned = 10 + speedBonus(answer.elapsedMs);
      player.score += earned;
      answer.earned = earned;
      answer.correct = true;
    } else {
      answer.earned = 0;
      answer.correct = false;
    }
  }

  const answerSummary = getParticipantPlayers(room).map((player) => {
    const answer = room.answers.get(player.id);
    return {
      playerId: player.id,
      name: player.name,
      answered: Boolean(answer),
      correct: answer ? answer.correct : false,
      earned: answer ? answer.earned : 0,
      score: player.score,
    };
  });

  const payload = {
    correctIndex: question.correctIndex,
    explanation: question.explanation || '',
    answerSummary,
  };

  room.lastRevealPayload = payload;
  io.to(roomCode).emit('answerReveal', payload);
  emitRoomState(roomCode);

  setTimeout(() => {
    room.phase = 'leaderboard';
    emitLeaderboard(roomCode, false);
    emitRoomState(roomCode);

    setTimeout(() => {
      room.questionIndex += 1;
      startQuestion(roomCode);
    }, LEADERBOARD_TIME_MS);
  }, REVEAL_TIME_MS);
}

app.get('/api/questions', (_req, res) => {
  res.json({
    items: dbState.masterData.questions,
    total: dbState.masterData.questions.length,
  });
});

app.get('/api/questions/:id', (req, res) => {
  const question = dbState.masterData.questions.find((item) => item.id === req.params.id);
  if (!question) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }

  res.json(question);
});

app.post('/api/questions', (req, res) => {
  const payloads = Array.isArray(req.body) ? req.body : [req.body || {}];
  const addedQuestions = [];

  for (const payload of payloads) {
    const errors = validateQuestionInput(payload);
    if (errors.length) {
      res.status(400).json({ error: 'Invalid question payload.', details: errors, payload });
      return;
    }
    const question = normalizeQuestionInput(payload);
    dbState.masterData.questions.push(question);
    addedQuestions.push(question);
  }

  saveDbState();
  res.status(201).json(Array.isArray(req.body) ? addedQuestions : addedQuestions[0]);
});

app.put('/api/questions/:id', (req, res) => {
  const index = dbState.masterData.questions.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }

  const errors = validateQuestionInput(req.body || {});
  if (errors.length) {
    res.status(400).json({ error: 'Invalid question payload.', details: errors });
    return;
  }

  const updated = normalizeQuestionInput(req.body || {}, dbState.masterData.questions[index]);
  dbState.masterData.questions[index] = updated;
  saveDbState();

  res.json(updated);
});

app.patch('/api/questions/:id', (req, res) => {
  const index = dbState.masterData.questions.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }

  const errors = validateQuestionInput(req.body || {}, true);
  if (errors.length) {
    res.status(400).json({ error: 'Invalid question payload.', details: errors });
    return;
  }

  const updated = normalizeQuestionInput(req.body || {}, dbState.masterData.questions[index]);
  dbState.masterData.questions[index] = updated;
  saveDbState();

  res.json(updated);
});

app.delete('/api/questions', (req, res) => {
  const count = dbState.masterData.questions.length;
  dbState.masterData.questions = [];
  saveDbState();
  res.json({ ok: true, deletedCount: count });
});

app.delete('/api/questions/:id', (req, res) => {
  const index = dbState.masterData.questions.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }

  const [deleted] = dbState.masterData.questions.splice(index, 1);
  saveDbState();

  res.json({ ok: true, deleted });
});

ensureDbFile();
loadPersistedRooms();

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }, callback = () => { }) => {
    const hostName = sanitizeName(name) || 'Host';
    const roomCode = getUniqueRoomCode();
    const host = createPlayer(hostName);

    const room = {
      code: roomCode,
      hostId: host.id,
      players: new Map(),
      phase: 'lobby',
      questions: pickQuestions(),
      questionIndex: 0,
      answers: new Map(),
      timer: null,
      currentQuestionStartedAt: null,
      lastRevealPayload: null,
      lastLeaderboardPayload: null,
    };

    room.players.set(host.id, host);
    rooms.set(roomCode, room);
    attachSocketToPlayer(socket, room, host);
    syncPlayerProfile(host, roomCode, 'host');

    callback({ ok: true, roomCode, playerId: host.id, playerToken: host.token, playerName: host.name });
    emitRoomState(roomCode);
  });

  socket.on('joinRoom', ({ roomCode, name, playerToken }, callback = () => { }) => {
    const cleanCode = String(roomCode || '').trim().toUpperCase();
    const playerName = sanitizeName(name);
    const room = rooms.get(cleanCode);

    if (!room) {
      callback({ ok: false, error: 'Room not found.' });
      return;
    }
    if (!playerName) {
      callback({ ok: false, error: 'Please enter a valid name.' });
      return;
    }
    if (room.phase !== 'lobby') {
      callback({ ok: false, error: 'Game already started.' });
      return;
    }

    if (playerToken) {
      const existingPlayer = findPlayerByToken(room, playerToken);
      if (existingPlayer) {
        existingPlayer.name = playerName;
        attachSocketToPlayer(socket, room, existingPlayer);
        syncPlayerProfile(existingPlayer, cleanCode, room.hostId === existingPlayer.id ? 'host' : 'participant');
        callback({
          ok: true,
          roomCode: cleanCode,
          playerId: existingPlayer.id,
          playerToken: existingPlayer.token,
          playerName: existingPlayer.name,
        });
        sendCurrentStateToSocket(socket, room);
        emitRoomState(cleanCode);
        return;
      }
    }

    if (getParticipantPlayers(room).length >= AVAILABLE_AVATARS.length) {
      callback({ ok: false, error: 'Room is full.' });
      return;
    }

    const player = createPlayer(playerName);
    room.players.set(player.id, player);
    attachSocketToPlayer(socket, room, player);
    syncPlayerProfile(player, cleanCode, 'participant');

    callback({ ok: true, roomCode: cleanCode, playerId: player.id, playerToken: player.token, playerName: player.name });
    emitRoomState(cleanCode);
  });

  socket.on('resumeSession', ({ roomCode, playerToken }, callback = () => { }) => {
    const cleanCode = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!room || !playerToken) {
      callback({ ok: false, error: 'Session not found.' });
      return;
    }

    const player = findPlayerByToken(room, playerToken);
    if (!player) {
      callback({ ok: false, error: 'Session expired.' });
      return;
    }

    attachSocketToPlayer(socket, room, player);
    syncPlayerProfile(player, cleanCode, room.hostId === player.id ? 'host' : 'participant');

    callback({
      ok: true,
      roomCode: cleanCode,
      playerId: player.id,
      playerToken: player.token,
      playerName: player.name,
      phase: room.phase,
    });

    sendCurrentStateToSocket(socket, room);
    emitRoomState(cleanCode);
  });

  socket.on('startGame', ({ roomCode }, callback = () => { }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      callback({ ok: false, error: 'Room not found.' });
      return;
    }
    if (room.hostId !== socket.data.playerId) {
      callback({ ok: false, error: 'Only host can start.' });
      return;
    }
    const participants = getParticipantPlayers(room);
    if (participants.length < 1) {
      callback({ ok: false, error: 'Need at least one player.' });
      return;
    }
    if (participants.some((player) => !player.avatarId)) {
      callback({ ok: false, error: 'Everyone needs to pick an avatar first.' });
      return;
    }

    if (!Array.isArray(room.questions) || !room.questions.length) {
      room.questions = pickQuestions();
    }
    room.questionIndex = 0;
    room.lastRevealPayload = null;
    room.lastLeaderboardPayload = null;
    room.players.forEach((player) => {
      player.score = 0;
    });

    callback({ ok: true });
    startQuestion(roomCode);
  });

  socket.on('chooseAvatar', ({ roomCode, avatarId }, callback = () => { }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      callback({ ok: false, error: 'Room not found.' });
      return;
    }
    if (room.phase !== 'lobby') {
      callback({ ok: false, error: 'Avatar selection is closed.' });
      return;
    }
    if (!room.players.has(socket.data.playerId)) {
      callback({ ok: false, error: 'Not in room.' });
      return;
    }
    if (room.hostId === socket.data.playerId) {
      callback({ ok: false, error: 'Host does not pick an avatar.' });
      return;
    }
    if (!AVAILABLE_AVATARS.includes(avatarId)) {
      callback({ ok: false, error: 'Unknown avatar.' });
      return;
    }
    if (isAvatarTaken(room, avatarId, socket.data.playerId)) {
      callback({ ok: false, error: 'That avatar is already taken.' });
      return;
    }

    const player = room.players.get(socket.data.playerId);
    player.avatarId = avatarId;
    syncPlayerProfile(player, roomCode, room.hostId === player.id ? 'host' : 'participant');
    callback({ ok: true, avatarId });
    emitRoomState(roomCode);
  });

  socket.on('submitAnswer', ({ roomCode, answerIndex }, callback = () => { }) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'question') {
      callback({ ok: false, error: 'Question not active.' });
      return;
    }

    if (!room.players.has(socket.data.playerId)) {
      callback({ ok: false, error: 'Not in room.' });
      return;
    }
    if (room.hostId === socket.data.playerId) {
      callback({ ok: false, error: 'Host is watching only.' });
      return;
    }

    if (room.answers.has(socket.data.playerId)) {
      callback({ ok: false, error: 'Answer already locked.' });
      return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - room.currentQuestionStartedAt);

    room.answers.set(socket.data.playerId, {
      answerIndex,
      elapsedMs,
      receivedAt: now,
    });

    callback({ ok: true });

    io.to(roomCode).emit('answerLocked', {
      playerId: socket.data.playerId,
      lockedCount: room.answers.size,
      totalPlayers: getParticipantPlayers(room).length,
    });

    if (room.answers.size >= getParticipantPlayers(room).length) {
      endQuestion(roomCode);
    }
  });

  socket.on('prioritizeQuestion', ({ roomCode, questionId, action }, callback = () => { }) => {
    const room = rooms.get(roomCode);
    if (!room) {
      callback({ ok: false, error: 'Room not found.' });
      return;
    }
    if (room.hostId !== socket.data.playerId) {
      callback({ ok: false, error: 'Only host can reorder questions.' });
      return;
    }
    if (room.phase !== 'lobby') {
      callback({ ok: false, error: 'Question order is locked once the game starts.' });
      return;
    }

    const currentIndex = room.questions.findIndex((question) => question.id === questionId);
    if (currentIndex === -1) {
      callback({ ok: false, error: 'Question not found in queue.' });
      return;
    }

    const [question] = room.questions.splice(currentIndex, 1);
    const targetIndex = action === 'top' ? 0 : Math.max(0, currentIndex - 1);
    room.questions.splice(targetIndex, 0, question);

    callback({ ok: true, questionQueue: room.questions });
    emitRoomState(roomCode);
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (roomCode && playerId) {
      schedulePlayerRemoval(playerId, roomCode);
    }
  });
});

server.listen(PORT, () => {
  console.log(`RCE AI Sprint Showdown listening on ${PORT}`);
});
