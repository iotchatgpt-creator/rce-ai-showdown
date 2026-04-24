# RCE AI Sprint Showdown

RCE AI Sprint Showdown is a real-time multiplayer AI quiz game built with `Node.js`, `Express`, and `Socket.IO`.

Players join with a room code, pick a name, choose an avatar in the lobby, and play through timed AI-themed questions while scores update live.

## What The Game Does

- Creates a private room with a 6-character room code
- Lets players join from different browsers/devices
- Requires each player to pick a unique avatar before the host starts
- Runs up to 20 timed AI quiz questions per game
- Shows live question, reveal, leaderboard, and final winner screens
- Uses a cozy animated front-end with rotating seasonal background scenes
- Uses a local embedded JSON data store for room/player persistence and auto-seeded master data

## How To Play

1. One person starts the app and clicks `Host Game`.
2. The host enters a name and creates a room.
3. Other players click `Join Game`, enter their name, and type the room code.
4. In the lobby, every player picks an avatar.
5. Each avatar can only be used by one person.
6. The host starts the game after everyone is ready.
7. Players answer each AI question before the timer runs out.
8. Correct answers earn points, and faster answers earn extra bonus points.
9. After up to 20 questions, the app shows the final champion screen.

## Scoring

- Correct answer: `10` points
- Answered in `0-5` seconds: `+10` bonus
- Answered in `5-10` seconds: `+8` bonus
- Answered in `10-15` seconds: `+6` bonus
- Wrong answer or no answer: `0`

## Tech Stack

- `Node.js`
- `Express`
- `Socket.IO`
- Plain `HTML`, `CSS`, and `JavaScript`

## Project Structure

- `server.js` - game server and real-time room logic
- `public/` - front-end UI
- `data/questions.json` - AI quiz question bank
- `data/db-schema.json` - logical schema for the embedded local data store
- `data/app-db.json` - auto-created local data file on first run
- `package.json` - scripts and dependencies
- `Procfile` - optional process file for platform deploys

## Local Data Store

The app now auto-creates a local embedded JSON data store on startup.

You do not need to install Postgres, MySQL, or SQLite for local use.

On first run, the server creates:

- `data/app-db.json`

It also auto-seeds master data from:

- `data/questions.json`
- the built-in avatar list in `server.js`

## Schema

The logical schema is defined in:

- `data/db-schema.json`

Current tables:

### `master_questions`

- Purpose: stores the question pool used by the game
- Primary key: `id`
- Columns:
  - `id`
  - `prompt`
  - `options`
  - `correctIndex`
  - `explanation`

### `player_profiles`

- Purpose: stores saved host/participant identity records for reconnect and refresh recovery
- Primary key: `token`
- Columns:
  - `token`
  - `playerId`
  - `name`
  - `lastRoomCode`
  - `role`
  - `avatarId`
  - `lastSeenAt`

### `active_rooms`

- Purpose: stores lobby/game room state so rooms are not only kept in memory
- Primary key: `code`
- Columns:
  - `code`
  - `hostId`
  - `phase`
  - `questionIndex`
  - `players`
  - `questions`
  - `savedAt`

### `completed_games`

- Purpose: stores recent finished game history
- Primary key: `finishedAt`
- Columns:
  - `roomCode`
  - `finishedAt`
  - `champion`
  - `leaderboard`
  - `totalQuestions`

## Install And Run Locally

### Requirements

- `Node.js 18+`
- `npm`

### Setup

```bash
npm install
```

### Start The App

```bash
npm start
```

By default the app runs on:

```text
http://localhost:3000
```

If port `3000` is already being used, start it on another port:

```bash
PORT=3011 npm start
```

Then open:

```text
http://localhost:3011
```

## Deploy

This app is a server app, so it should be deployed to a platform that supports `Node.js` servers.

`GitHub Pages` will not work for the live game because the app needs `Express` and `Socket.IO`.

### Option 1: Google Cloud Run

This is a good option if you want to deploy from source.

1. Install the Google Cloud CLI.
2. Log in:

```bash
gcloud auth login
```

3. Set your project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

4. Deploy from the project folder:

```bash
gcloud run deploy rce-ai-sprint-showdown --source . --region us-central1 --allow-unauthenticated
```

Cloud Run will build and deploy the app, and the service URL it returns is your live game link.

### Option 2: Render

1. Push this repo to GitHub.
2. Create a new `Web Service` on Render.
3. Connect the GitHub repository.
4. Use these settings:

- Build command: `npm install`
- Start command: `npm start`

Render will provide a public URL after deploy.

### Option 3: Railway

1. Push this repo to GitHub.
2. Create a new Railway project.
3. Link the repository.
4. Railway should detect the Node app automatically.
5. Set the start command to:

```bash
npm start
```

## REST API

The server exposes a JSON CRUD API for managing the question pool. All API endpoints use the `/api/questions` base route.

### 1. List All Questions
**GET** `/api/questions`
Returns a list of all available questions along with the total count.

**Response payload:**
```json
{
  "items": [
    {
      "id": "question_a1b2c3",
      "prompt": "What does AI stand for?",
      "options": ["Automated Internet", "Artificial Intelligence", "Applied Interface", "Analog Instruction"],
      "correctIndex": 1,
      "explanation": "AI stands for Artificial Intelligence."
    }
  ],
  "total": 1
}
```

### 2. Get Single Question
**GET** `/api/questions/:id`
Fetch a specific question by its ID.

**Example Request:**
```bash
curl http://localhost:3000/api/questions/question_a1b2c3
```

### 3. Create a Question
**POST** `/api/questions`
Add a new question to the database.

**Required Payload:**
- `prompt` (string)
- `options` (array of exactly 4 strings)
- `correctIndex` (integer 0-3)
- `explanation` (string, optional)

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/questions \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Which emoji best matches a chatbot?",
    "options": ["🧠", "💬", "🌮", "🪴"],
    "correctIndex": 1,
    "explanation": "A chatbot is mainly about conversation."
  }'
```

### 4. Replace a Question
**PUT** `/api/questions/:id`
Completely replaces an existing question. The payload must include all required fields just like the POST request.

**Example Request:**
```bash
curl -X PUT http://localhost:3000/api/questions/question_a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What does AI stand for (Updated)?",
    "options": ["Automated Internet", "Artificial Intelligence", "Applied Interface", "Analog Instruction"],
    "correctIndex": 1,
    "explanation": "AI stands for Artificial Intelligence."
  }'
```

### 5. Update Part of a Question
**PATCH** `/api/questions/:id`
Partially update an existing question. You only need to send the fields you want to change.

**Example Request:**
```bash
curl -X PATCH http://localhost:3000/api/questions/question_a1b2c3 \
  -H "Content-Type: application/json" \
  -d '{
    "correctIndex": 2,
    "explanation": "Updated explanation here."
  }'
```

### 6. Delete a Question
**DELETE** `/api/questions/:id`
Removes a question from the database.

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/questions/question_a1b2c3
```

### 7. Delete All Questions
**DELETE** `/api/questions`
Removes all questions from the database.

**Example Request:**
```bash
curl -X DELETE http://localhost:3000/api/questions
```


## Push To GitHub

If you want to publish the code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Notes

- The server uses `process.env.PORT || 3000`, which makes it deploy-friendly.
- Avatars are locked per player in the lobby.
- Questions are loaded from `data/questions.json`.
- Refreshing the app shows a random seasonal background scene.
- The app auto-creates its local data file and schema-backed structure at startup.
- Browser refresh recovery works by saving a local player session token and restoring it on reconnect.
