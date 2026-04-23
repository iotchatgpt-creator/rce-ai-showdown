# RCE AI Sprint Showdown

RCE AI Sprint Showdown is a real-time multiplayer AI quiz game built with `Node.js`, `Express`, and `Socket.IO`.

Players join with a room code, pick a name, choose an avatar in the lobby, and play through timed AI-themed questions while scores update live.

## What The Game Does

- Creates a private room with a 6-character room code
- Lets players join from different browsers/devices
- Requires each player to pick a unique avatar before the host starts
- Runs 10 timed AI quiz questions per game
- Shows live question, reveal, leaderboard, and final winner screens
- Uses a cozy animated front-end with rotating seasonal background scenes

## How To Play

1. One person starts the app and clicks `Host Game`.
2. The host enters a name and creates a room.
3. Other players click `Join Game`, enter their name, and type the room code.
4. In the lobby, every player picks an avatar.
5. Each avatar can only be used by one person.
6. The host starts the game after everyone is ready.
7. Players answer each AI question before the timer runs out.
8. Correct answers earn points, and faster answers earn extra bonus points.
9. After 10 questions, the app shows the final champion screen.

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
- `package.json` - scripts and dependencies
- `Procfile` - optional process file for platform deploys

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
