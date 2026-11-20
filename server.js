require("dotenv").config();
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API = "https://api.heygen.com";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  name: "heygen.sid",
  secret: process.env.SESSION_SECRET || "local-development-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, "public")));

function requireKey(req, res, next) {
  if (!req.session.heygenKey) return res.status(401).json({ error: "Add your HeyGen API key in Settings first." });
  next();
}
async function heygen(req, endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      "x-api-key": req.session.heygenKey,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HeyGen returned ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}
function fail(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Unexpected server error" });
}

app.get("/api/session", (req, res) => {
  res.json({ connected: Boolean(req.session.heygenKey) });
});
app.post("/api/key", async (req, res) => {
  const key = String(req.body.apiKey || "").trim();
  if (!key || key.length < 12 || key.length > 500) return res.status(400).json({ error: "Please enter a valid-looking API key." });
  req.session.heygenKey = key;
  try {
    const result = await heygen(req, "/v3/models/audio/voices?type=public&limit=1");
    res.json({ ok: true, connected: true });
  } catch (error) {
    delete req.session.heygenKey;
    fail(res, error);
  }
});
app.delete("/api/key", (req, res) => {
  delete req.session.heygenKey;
  res.json({ ok: true });
});
app.get("/api/avatars", requireKey, async (req, res) => {
  try {
    const result = await heygen(req, "/v3/avatars?limit=50");
    res.json(result);
  } catch (e) { fail(res, e); }
});
app.get("/api/voices", requireKey, async (req, res) => {
  try {
    const type = req.query.type === "private" ? "private" : "public";
    const result = await heygen(req, `/v3/models/audio/voices?type=${type}&limit=100`);
    res.json(result);
  } catch (e) { fail(res, e); }
});
app.post("/api/videos", requireKey, async (req, res) => {
  try {
    const { avatarId, voiceId, script, title, aspectRatio, resolution, caption } = req.body;
    if (!avatarId || !script?.trim()) return res.status(400).json({ error: "Choose an avatar and enter a script." });
    if (script.length > 5000) return res.status(400).json({ error: "Script must be 5,000 characters or fewer." });
    const payload = {
      type: "avatar",
      avatar_id: avatarId,
      title: (title || "HeyGen Studio video").slice(0, 120),
      script: script.trim(),
      aspect_ratio: ["16:9","9:16","1:1","4:5","5:4","auto"].includes(aspectRatio) ? aspectRatio : "16:9",
      resolution: ["720p","1080p","4k"].includes(resolution) ? resolution : "720p",
      output_format: "mp4"
    };
    if (voiceId) payload.voice_id = voiceId;
    if (caption) payload.caption = { file_format: "srt", style: "default" };
    const result = await heygen(req, "/v3/videos", {
      method: "POST",
      headers: { "Idempotency-Key": require("crypto").randomUUID() },
      body: JSON.stringify(payload)
    });
    const data = result.data || result;
    const item = {
      video_id: data.video_id || data.id,
      title: payload.title,
      status: data.status || "waiting",
      created_at: Date.now()
    };
    req.session.history = [item, ...(req.session.history || [])].slice(0, 50);
    res.json(result);
  } catch (e) { fail(res, e); }
});
app.get("/api/videos/:id", requireKey, async (req, res) => {
  try {
    const id = encodeURIComponent(req.params.id);
    const result = await heygen(req, `/v3/videos/${id}`);
    const data = result.data || result;
    req.session.history = (req.session.history || []).map(v =>
      v.video_id === id ? { ...v, ...data } : v
    );
    res.json(result);
  } catch (e) { fail(res, e); }
});
app.get("/api/history", (req, res) => res.json({ data: req.session.history || [] }));
app.use((err, req, res, next) => fail(res, err));

app.listen(PORT, () => console.log(`HeyGen Studio running at http://localhost:${PORT}`));
