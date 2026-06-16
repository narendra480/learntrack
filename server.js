// ═══════════════════════════════════════════════════════════════════════════════
//  LearnTrack Backend  –  server.js
//  Stack: Node.js + Express + PostgreSQL (pg) + node-cron + nodemailer
//  Run:   node server.js
// ═══════════════════════════════════════════════════════════════════════════════

const express    = require("express");
const cors       = require("cors");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const cron       = require("node-cron");
const nodemailer = require("nodemailer");
const { Pool }   = require("pg");
require("dotenv").config();

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "learntrack_super_secret_2024";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("dist"));

// ─── POSTGRESQL CONNECTION ──────────────────────────────────────────────────────
// Set these in your .env file:
//   DB_HOST=localhost   DB_PORT=5432   DB_NAME=learntrack
//   DB_USER=postgres    DB_PASSWORD=yourpassword
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
pool.connect((err) => {
  if (err) console.error("❌ DB connection failed:", err);
  else     console.log("✅ Connected to PostgreSQL");
});

const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        google_id TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        name TEXT,
        profession TEXT,
        bio TEXT,
        email TEXT,
        interested_courses TEXT,
        completed_courses TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reset_codes (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not-started',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, name)
      );

      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        date DATE,
        topic TEXT,
        status TEXT NOT NULL DEFAULT 'not-started',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Database tables are ready");
  } catch (err) {
    console.error("❌ Failed to initialize database schema:", err);
  }
};

initDb();

// ─── EMAIL TRANSPORTER ─────────────────────────────────────────────────────────
// Uses Gmail by default. Set in .env:
//   EMAIL_USER=you@gmail.com   EMAIL_PASS=your_app_password
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,   // Gmail App Password (not normal password)
  },
});

// ─── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ─── ROUTES: AUTH ───────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields required" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hash]
    );
    const user  = result.rows[0];
    await pool.query(
      "INSERT INTO profiles (user_id, name, email) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
      [user.id, username, email]
    );
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    console.log("✅ Registered user:", username);
    res.json({ user, token });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Username already exists" });
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user   = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    console.log("✅ Login:", username);
    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ROUTES: FORGOT PASSWORD ───────────────────────────────────────────────────
const crypto = require("crypto");

// POST /api/auth/forgot-password
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    // Always respond OK so we don't reveal if email exists
    if (result.rows.length === 0) return res.json({ ok: true });

    const user = result.rows[0];
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      `INSERT INTO reset_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET code=$2, expires_at=$3`,
      [user.id, code, expires]
    );

    await transporter.sendMail({
      from: `"LearnTrack 📚" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your LearnTrack Password Reset Code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f0f7ff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#2563eb,#60a5fa);padding:28px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">📚 LearnTrack</h1>
          </div>
          <div style="padding:28px">
            <h2 style="color:#1e3a5f;margin:0 0 12px">Password Reset Code</h2>
            <p style="color:#64748b;margin:0 0 24px">Use this code to reset your password. It expires in 15 minutes.</p>
            <div style="background:#fff;border:2px solid #c8dff7;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
              <span style="font-size:36px;font-weight:800;letter-spacing:0.3em;color:#2563eb">${code}</span>
            </div>
            <p style="color:#94a3b8;font-size:12px">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    });

    console.log(`📧 Reset code sent to ${email}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/forgot-username
app.post("/api/auth/forgot-username", async (req, res) => {
  const { email } = req.body || {};
  try {
    const result = await pool.query("SELECT username FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.json({ ok: true });

    const { username } = result.rows[0];
    await transporter.sendMail({
      from: `"LearnTrack 📚" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your LearnTrack Username",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#f0f7ff;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#2563eb,#60a5fa);padding:28px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">📚 LearnTrack</h1>
          </div>
          <div style="padding:28px;color:#1e3a5f">
            <h2 style="margin:0 0 12px;font-size:18px">Username recovery</h2>
            <p style="margin:0 0 16px;color:#64748b">We received a request to help you recover your LearnTrack username.</p>
            <div style="background:#fff;border:2px solid #c8dff7;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px">
              <span style="font-size:24px;font-weight:800;color:#2563eb">${username}</span>
            </div>
            <p style="margin:0;color:#94a3b8;font-size:12px">If you didn't request this, please ignore this message.</p>
          </div>
        </div>
      `,
    });

    console.log(`📧 Username hint sent to ${email}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/verify-reset-code
app.post("/api/auth/verify-reset-code", async (req, res) => {
  const { email, code } = req.body || {};
  try {
    const result = await pool.query(
      `SELECT rc.* FROM reset_codes rc
       JOIN users u ON u.id = rc.user_id
       WHERE u.email = $1 AND rc.code = $2 AND rc.expires_at > NOW()`,
      [email, code]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ message: "Invalid or expired code" });

    // Generate a short-lived reset token
    const resetToken = jwt.sign({ userId: result.rows[0].user_id, purpose: "reset" }, JWT_SECRET, { expiresIn: "10m" });
    res.json({ resetToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  try {
    const decoded = jwt.verify(resetToken, JWT_SECRET);
    if (decoded.purpose !== "reset")
      return res.status(400).json({ message: "Invalid reset token" });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, decoded.userId]);
    await pool.query("DELETE FROM reset_codes WHERE user_id=$1", [decoded.userId]);
    console.log(`✅ Password reset for user id: ${decoded.userId}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Reset token expired or invalid" });
  }
});

// ─── ROUTES: GOOGLE OAUTH ───────────────────────────────────────────────────────
const passport      = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

app.use(passport.initialize());

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${process.env.APP_URL?.replace("3000","4000") || "http://localhost:4000"}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email    = profile.emails[0].value;
    const name     = profile.displayName;
    const googleId = profile.id;

    // Check if user exists by google_id or email
    let result = await pool.query("SELECT * FROM users WHERE google_id=$1 OR email=$2", [googleId, email]);

    if (result.rows.length > 0) {
      // Existing user — update google_id if missing
      const user = result.rows[0];
      if (!user.google_id) {
        await pool.query("UPDATE users SET google_id=$1 WHERE id=$2", [googleId, user.id]);
      }
      return done(null, user);
    }

    // New user — create account
    const username = email.split("@")[0].replace(/[^a-z0-9_]/gi, "_");
    const newUser  = await pool.query(
      "INSERT INTO users (username, email, google_id, password_hash) VALUES ($1,$2,$3,$4) RETURNING *",
      [username, email, googleId, ""]
    );

    // Auto-create profile with their Google name
    await pool.query(
      "INSERT INTO profiles (user_id, name, email) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [newUser.rows[0].id, name, email]
    );

    done(null, newUser.rows[0]);
  } catch (err) {
    done(err, null);
  }
}));

// GET /api/auth/google  — start OAuth flow
app.get("/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

// GET /api/auth/google/callback  — Google redirects here
app.get("/api/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.APP_URL || "http://localhost:3000"}?error=google_failed` }),
  (req, res) => {
    const token = jwt.sign({ id: req.user.id, username: req.user.username }, JWT_SECRET, { expiresIn: "30d" });
    const user  = { id: req.user.id, username: req.user.username, email: req.user.email };
    // Redirect back to frontend with token in URL
    const frontendUrl = process.env.APP_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// ─── ROUTES: PROFILE ────────────────────────────────────────────────────────────

// GET /api/profile
app.get("/api/profile", auth, async (req, res) => {
  const result = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [req.user.id]);
  res.json(result.rows[0] || null);
});

// PUT /api/profile
app.put("/api/profile", auth, async (req, res) => {
  const { name, profession, bio, email, interestedCourses, completedCourses } = req.body || {};
  await pool.query(`
    INSERT INTO profiles (user_id, name, profession, bio, email, interested_courses, completed_courses)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (user_id) DO UPDATE
    SET name=$2, profession=$3, bio=$4, email=$5,
        interested_courses=$6, completed_courses=$7, updated_at=NOW()
  `, [req.user.id, name, profession, bio, email, interestedCourses, completedCourses]);
  res.json({ ok: true });
});

// ─── ROUTES: COURSES ────────────────────────────────────────────────────────────

// GET /api/courses
app.get("/api/courses", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM courses WHERE user_id = $1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json(result.rows);
});

// POST /api/courses/find-or-create
app.post("/api/courses/find-or-create", auth, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "Course name is required" });
  const existing = await pool.query(
    "SELECT * FROM courses WHERE user_id=$1 AND LOWER(name)=LOWER($2)",
    [req.user.id, name]
  );
  if (existing.rows.length > 0) return res.json(existing.rows[0]);
  const result = await pool.query(
    "INSERT INTO courses (user_id, name, status) VALUES ($1,$2,'in-progress') RETURNING *",
    [req.user.id, name]
  );
  res.json(result.rows[0]);
});

// DELETE /api/courses/:id
app.delete("/api/courses/:id", auth, async (req, res) => {
  const courseId = req.params.id;
  try {
    const result = await pool.query(
      "DELETE FROM courses WHERE id=$1 AND user_id=$2 RETURNING id",
      [courseId, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Course not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── ROUTES: ENTRIES ────────────────────────────────────────────────────────────

// GET /api/courses/:id/entries
app.get("/api/courses/:id/entries", auth, async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM entries WHERE course_id=$1 ORDER BY date ASC, created_at ASC",
    [req.params.id]
  );
  res.json(result.rows);
});

// POST /api/courses/:id/entries
app.post("/api/courses/:id/entries", auth, async (req, res) => {
  const { date, topic, status, notes } = req.body || {};
  const result = await pool.query(
    "INSERT INTO entries (course_id, date, topic, status, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [req.params.id, date, topic, status || "not-started", notes]
  );
  res.json(result.rows[0]);
});

// PATCH /api/entries/:id
app.patch("/api/entries/:id", auth, async (req, res) => {
  const { status } = req.body || {};
  await pool.query("UPDATE entries SET status=$1 WHERE id=$2", [status, req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/entries/:id
app.delete("/api/entries/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM entries WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

// ─── ROUTES: EMAIL ──────────────────────────────────────────────────────────────

const sendReminder = async (to, name, appUrl = "http://localhost:3000") => {
  const mailOptions = {
    from: `"LearnTrack 📚" <${process.env.EMAIL_USER}>`,
    to,
    subject: "📚 Daily Learning Reminder – LearnTrack",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d1117;color:#e6edf3;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#1a2744,#0d1117);padding:32px 28px;border-bottom:1px solid #30363d">
          <h1 style="font-size:24px;margin:0;color:#58a6ff">📚 LearnTrack</h1>
          <p style="margin:8px 0 0;color:#8b949e;font-size:14px">Daily Learning Reminder</p>
        </div>
        <div style="padding:28px">
          <h2 style="font-size:18px;margin:0 0 12px">Hey ${name || "there"}! 👋</h2>
          <p style="color:#8b949e;line-height:1.6;margin:0 0 20px">
            Just a quick reminder to update your learning progress for today. 
            Consistency is the key to mastery — even 30 minutes counts!
          </p>
          <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;padding:16px;margin-bottom:24px">
            <p style="margin:0;font-size:13px;color:#8b949e;font-style:italic">
              ✅ If you've already completed today's task, please ignore this reminder.
            </p>
          </div>
          <a href="${appUrl}" style="display:inline-block;background:#58a6ff;color:#0d1117;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px">
            Update Today's Progress →
          </a>
          <p style="margin-top:24px;font-size:12px;color:#8b949e">
            You're receiving this because you signed up for LearnTrack. 
            Reminders are sent daily at 10 AM, 3 PM & 9 PM IST.
          </p>
        </div>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};

// POST /api/email/test
app.post("/api/email/test", auth, async (req, res) => {
  try {
    const profileResult = await pool.query("SELECT * FROM profiles WHERE user_id=$1", [req.user.id]);
    const profile = profileResult.rows[0];
    const email   = profile?.email;
    if (!email) return res.status(400).json({ message: "No email in profile. Please add one first." });
    await sendReminder(email, profile.name);
    res.json({ ok: true, message: `Test email sent to ${email}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── CRON JOBS: EMAIL REMINDERS ─────────────────────────────────────────────────
// Times are in IST (UTC+5:30).  node-cron uses server local time.
// If your server is UTC, adjust: 10:00 IST = 04:30 UTC, 15:00 IST = 09:30 UTC, 21:00 IST = 15:30 UTC

const sendBulkReminders = async (label) => {
  console.log(`📧 Sending ${label} reminders…`);
  try {
    const result = await pool.query(`
      SELECT p.email, p.name FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.email IS NOT NULL AND p.email != ''
    `);
    for (const { email, name } of result.rows) {
      try {
        await sendReminder(email, name);
        console.log(`  ✅ Sent to ${email}`);
      } catch (err) {
        console.error(`  ❌ Failed for ${email}:`, err.message);
      }
    }
    console.log(`📧 ${label} done. Sent to ${result.rows.length} users.`);
  } catch (err) {
    console.error("❌ Bulk reminder error:", err.message);
  }
};

// 10:00 AM IST daily
cron.schedule("0 10 * * *", () => sendBulkReminders("Morning (10 AM)"), { timezone: "Asia/Kolkata" });

// 3:00 PM IST daily
cron.schedule("0 15 * * *", () => sendBulkReminders("Afternoon (3 PM)"), { timezone: "Asia/Kolkata" });

// 9:00 PM IST daily
cron.schedule("0 21 * * *", () => sendBulkReminders("Evening (9 PM)"),   { timezone: "Asia/Kolkata" });

console.log("⏰ Email reminders scheduled: 10AM, 3PM, 9PM IST");
// Serve React frontend
const path = require("path");
app.get("/api/test", (req,res)=>{
    res.json({
        status:"API working"
    });
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ─── START ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 LearnTrack API running on port ${PORT}`);
});
