const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const QUESTION_TIME_MS = 15000;
const REVEAL_TIME_MS = 4000;
const LEADERBOARD_TIME_MS = 4000;
const QUESTIONS_PER_GAME = 10;

const questionBank = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8')
);

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

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
  return shuffle(questionBank).slice(0, QUESTIONS_PER_GAME);
}

function speedBonus(elapsedMs) {
  const seconds = elapsedMs / 1000;
  if (seconds <= 5) return 10;
  if (seconds <= 10) return 8;
  if (seconds <= 15) return 6;
  return 0;
}

function serializePlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.id === room.hostId,
  }));
}

function emitRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  io.to(roomCode).emit('roomState', {
    roomCode,
    phase: room.phase,
    hostId: room.hostId,
    players: serializePlayers(room),
    questionIndex: room.questionIndex,
    totalQuestions: room.questions.length,
  });
}

function emitLeaderboard(roomCode, final = false) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const leaderboard = serializePlayers(room).sort((a, b) => b.score - a.score);
  io.to(roomCode).emit('leaderboard', {
    leaderboard,
    final,
    champion: leaderboard[0] || null,
    title: final ? 'RCE AI Champion — Iteration 2.14' : null,
  });
}

function startQuestion(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  if (room.questionIndex >= room.questions.length) {
    room.phase = 'final';
    emitLeaderboard(roomCode, true);
    emitRoomState(roomCode);
    return;
  }

  room.phase = 'question';
  room.answers = new Map();
  room.currentQuestionStartedAt = Date.now();

  const current = room.questions[room.questionIndex];

  io.to(roomCode).emit('questionStart', {
    index: room.questionIndex + 1,
    total: room.questions.length,
    prompt: current.prompt,
    options: current.options,
    durationMs: QUESTION_TIME_MS,
    startedAt: room.currentQuestionStartedAt,
  });

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

  const answerSummary = [...room.players.values()].map((player) => {
    const a = room.answers.get(player.id);
    return {
      playerId: player.id,
      name: player.name,
      answered: Boolean(a),
      correct: a ? a.correct : false,
      earned: a ? a.earned : 0,
      score: player.score,
    };
  });

  io.to(roomCode).emit('answerReveal', {
    correctIndex: question.correctIndex,
    explanation: question.explanation || '',
    answerSummary,
  });

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

function removePlayerFromRoom(socketId, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players.delete(socketId);
  room.answers.delete(socketId);

  if (room.players.size === 0) {
    if (room.timer) clearTimeout(room.timer);
    rooms.delete(roomCode);
    return;
  }

  if (room.hostId === socketId) {
    room.hostId = room.players.keys().next().value;
  }

  emitRoomState(roomCode);
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }, callback = () => {}) => {
    const hostName = sanitizeName(name) || 'Host';
    const roomCode = getUniqueRoomCode();

    const room = {
      code: roomCode,
      hostId: socket.id,
      players: new Map(),
      phase: 'lobby',
      questions: [],
      questionIndex: 0,
      answers: new Map(),
      timer: null,
      currentQuestionStartedAt: null,
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: hostName,
      score: 0,
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;

    callback({ ok: true, roomCode, playerId: socket.id });
    emitRoomState(roomCode);
  });

  socket.on('joinRoom', ({ roomCode, name }, callback = () => {}) => {
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

    room.players.set(socket.id, {
      id: socket.id,
      name: playerName,
      score: 0,
    });

    socket.join(cleanCode);
    socket.data.roomCode = cleanCode;

    callback({ ok: true, roomCode: cleanCode, playerId: socket.id });
    emitRoomState(cleanCode);
  });

  socket.on('startGame', ({ roomCode }, callback = () => {}) => {
    const room = rooms.get(roomCode);
    if (!room) {
      callback({ ok: false, error: 'Room not found.' });
      return;
    }
    if (room.hostId !== socket.id) {
      callback({ ok: false, error: 'Only host can start.' });
      return;
    }
    if (room.players.size < 1) {
      callback({ ok: false, error: 'Need at least one player.' });
      return;
    }

    room.questions = pickQuestions();
    room.questionIndex = 0;
    room.players.forEach((player) => {
      player.score = 0;
    });

    callback({ ok: true });
    startQuestion(roomCode);
  });

  socket.on('submitAnswer', ({ roomCode, answerIndex }, callback = () => {}) => {
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'question') {
      callback({ ok: false, error: 'Question not active.' });
      return;
    }

    if (!room.players.has(socket.id)) {
      callback({ ok: false, error: 'Not in room.' });
      return;
    }

    if (room.answers.has(socket.id)) {
      callback({ ok: false, error: 'Answer already locked.' });
      return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - room.currentQuestionStartedAt);

    room.answers.set(socket.id, {
      answerIndex,
      elapsedMs,
      receivedAt: now,
    });

    callback({ ok: true });

    io.to(roomCode).emit('answerLocked', {
      playerId: socket.id,
      lockedCount: room.answers.size,
      totalPlayers: room.players.size,
    });
  });

  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (roomCode) {
      removePlayerFromRoom(socket.id, roomCode);
    }
  });
});

server.listen(PORT, () => {
  console.log(`RCE AI Sprint Showdown listening on ${PORT}`);
});
