# RCE AI Sprint Showdown

A Kahoot-style multiplayer quiz web app built with **Node.js**, **Express**, and **Socket.IO**.

## Features

- Host and participants with no login
- Room code based join flow
- Real-time lobby, question, reveal, and leaderboard updates
- 10 random questions per game from a 120+ question bank
- 15-second timed rounds
- Score system with speed bonuses:
  - Correct answer = 10 points
  - 0–5 sec = +10
  - 5–10 sec = +8
  - 10–15 sec = +6
  - Incorrect = 0
- Final champion screen:
  - **RCE AI Champion — Iteration 2.14**
- Mobile-friendly responsive UI

## Project Structure

- `server.js`
- `package.json`
- `Procfile`
- `public/`
- `data/questions.json`
- `README.md`

## Run Locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## Deployment (Heroku)

This app uses `process.env.PORT` and includes a `Procfile`, so it is ready for Heroku-style deployment.
