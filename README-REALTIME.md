# 0.999 Realtime Voice setup (Vercel)

## Architecture
- Static child-facing UI is hosted by Vercel.
- `api/session.js` creates a short-lived OpenAI Realtime client secret.
- The permanent `OPENAI_API_KEY` exists only in Vercel server environment variables.
- Browser audio uses WebRTC; microphone audio is streamed to OpenAI and generated voice returns to the browser.
- This prototype does not upload or store raw recordings in GitHub.

## Deploy
1. Import `wealthyjin/0999-kids-academy` into Vercel.
2. Add Environment Variable `OPENAI_API_KEY` in Vercel Project Settings -> Environment Variables. Never add it to GitHub, HTML, JS, or chat.
3. Set `APP_ORIGIN` to the exact deployed origin, e.g. `https://your-project.vercel.app` (no trailing slash).
4. Redeploy after adding environment variables.
5. Open the Vercel HTTPS URL on current Chrome Android and allow microphone access.

## Voice
The frontend requests a short-lived client secret from `/api/session`, then establishes a WebRTC connection to `/v1/realtime/calls`. Server VAD is configured for hands-free turn-taking and interruption. The browser never receives the permanent API key.

## Important
- API usage is billable. Configure project budgets/usage limits and limit lesson duration.
- This is a first integration scaffold, not yet a completed device-tested child product.
- Do not collect children's names, addresses, school, photos, or raw voice recordings. Keep any future learning records private and parent-controlled.
- Add authentication/rate limiting before sharing publicly. An origin check alone is not authentication.
- Use a separate private database only if parent-approved progress storage is later required.
