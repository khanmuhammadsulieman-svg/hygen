# HeyGen AI Video Studio

A dark, responsive HeyGen workspace built with HTML, CSS, vanilla JavaScript, Node.js and Express.

## Features

- Server-side HeyGen API key handling (session memory; never browser localStorage)
- HeyGen v3 avatar and public voice loading
- Avatar video generation from a script
- Aspect ratio and resolution selection
- Optional subtitle file generation
- Render status polling and video preview
- Session-scoped generation history
- Responsive dark dashboard

## Requirements

- Node.js 20+
- A HeyGen API key with the required API permissions and available API credits

## Run locally

1. Extract this project.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env`.
5. Set a long random `SESSION_SECRET` in `.env`.
6. Start the app:

   ```bash
   npm start
   ```

7. Open http://localhost:3000 and connect your HeyGen API key in Settings.

## Security notes

- The API key is stored only in the server-side Express session memory and is cleared when the session expires or you disconnect. It is not written to `.env`, a database, localStorage, or frontend JavaScript.
- Express's default MemoryStore is suitable only for local single-user development. For a deployed multi-user production service, replace it with a persistent, production-grade session store and add user authentication, HTTPS, rate limiting, CSRF protection, and appropriate access controls.
- Set `NODE_ENV=production` only behind HTTPS, because the session cookie is marked secure in production.
- Never publish your `.env` file or commit API keys.
- API usage can consume HeyGen credits.

## API routes used

- `GET /v3/avatars`
- `GET /v3/models/audio/voices?type=public`
- `POST /v3/videos`
- `GET /v3/videos/{video_id}`

The app uses HeyGen's current v3 endpoints. Check the official docs for account-specific permissions and supported avatar/voice combinations:
https://developers.heygen.com/

## Important limitations

This is a working starter application, not a hosted service. Video history is kept in the active browser session and is not a permanent cross-device library. The app does not claim to provide a real-time render percentage; it polls HeyGen for the actual status.
