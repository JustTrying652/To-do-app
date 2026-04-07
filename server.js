const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const Groq = require("groq-sdk");

const app = express();
app.use(cors({
    origin: "https://peppy-crepe-5ac129.netlify.app"
}));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Create tables if they don't exist
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            priority TEXT,
            "dueDate" TEXT,
            "userId" INTEGER REFERENCES users(id)
        )
    `);
    console.log("Database ready");
}
initDB();

// GET all tasks for a user
app.get("/tasks/:userId", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM tasks WHERE "userId"=$1`,
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// ADD task
app.post("/tasks", async (req, res) => {
    const { text, priority, dueDate, userId } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO tasks (text, completed, priority, "dueDate", "userId") VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [text, 0, priority, dueDate, userId]
        );
        res.json({ id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// UPDATE task
app.put("/tasks/:id", async (req, res) => {
    const { text, completed, priority, dueDate, userId } = req.body;
    try {
        const result = await pool.query(
            `UPDATE tasks SET text=$1, completed=$2, priority=$3, "dueDate"=$4 WHERE id=$5 AND "userId"=$6`,
            [text, completed, priority, dueDate, req.params.id, userId]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Not allowed" });
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// DELETE task
app.delete("/tasks/:id", async (req, res) => {
    const { userId } = req.body;
    try {
        const result = await pool.query(
            `DELETE FROM tasks WHERE id=$1 AND "userId"=$2`,
            [req.params.id, userId]
        );
        if (result.rowCount === 0) return res.status(403).json({ error: "Not allowed" });
        res.sendStatus(200);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// SIGNUP
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2)",
            [username, hashedPassword]
        );
        res.json({ message: "User created successfully" });
    } catch (err) {
        if (err.code === "23505") {
            return res.status(400).json({ error: "User already exists" });
        }
        res.status(500).json({ error: "Server error" });
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username=$1",
            [username]
        );
        const user = result.rows[0];

        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        let passwordValid = false;

        if (user.password.startsWith("$2")) {
            passwordValid = await bcrypt.compare(password, user.password);
        } else {
            passwordValid = (password === user.password);
            if (passwordValid) {
                const newHash = await bcrypt.hash(password, 10);
                await pool.query("UPDATE users SET password=$1 WHERE id=$2", [newHash, user.id]);
            }
        }

        if (!passwordValid) return res.status(401).json({ error: "Invalid credentials" });

        res.json({ message: "Login successful", userId: user.id, username: user.username });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ── AI: Break task into subtasks ──
app.post("/ai/breakdown", async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task text required" });

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{
                role: "user",
                content: `Break this task into 3-5 clear, actionable subtasks. Return ONLY a JSON array of strings, no explanation, no markdown. Task: "${task}"`
            }],
            max_tokens: 300
        });

        const raw = completion.choices[0].message.content.trim();
        const subtasks = JSON.parse(raw);
        res.json({ subtasks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "AI request failed" });
    }
});

// ── AI: Suggest priority ──
app.post("/ai/priority", async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task text required" });

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{
                role: "user",
                content: `Based on this task, suggest a priority level. Return ONLY a JSON object like {"priority": "High", "reason": "short reason"}. Priority must be exactly one of: High, Medium, Low. Task: "${task}"`
            }],
            max_tokens: 100
        });

        const raw = completion.choices[0].message.content.trim();
        const result = JSON.parse(raw);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "AI request failed" });
    }
});

// ── AI: Daily summary ──
app.post("/ai/summary", async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || tasks.length === 0) return res.status(400).json({ error: "No tasks provided" });

    const taskList = tasks
        .filter(t => !t.completed)
        .map(t => `- ${t.text} (${t.priority} priority${t.dueDate ? ", due " + t.dueDate : ""})`)
        .join("\n");

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{
                role: "user",
                content: `You are a helpful productivity assistant. Given these pending tasks, write a short motivational daily plan in 3-4 sentences. Be encouraging and practical.\n\nTasks:\n${taskList}`
            }],
            max_tokens: 200
        });

        res.json({ summary: completion.choices[0].message.content.trim() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "AI request failed" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
