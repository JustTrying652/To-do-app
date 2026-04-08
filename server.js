const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const GroqSDK = require("groq-sdk");
const GroqClient = GroqSDK.default || GroqSDK;

const app = express();
app.use(cors({
    origin: "https://to-do-app-obkk.vercel.app"
}));
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Groq client
const groq = new GroqClient({ apiKey: process.env.GROQ_API_KEY });

// Verify Groq key on startup
if (!process.env.GROQ_API_KEY) {
    console.warn("⚠️  GROQ_API_KEY not set - AI features will not work");
} else {
    console.log("✅ GROQ_API_KEY loaded, length:", process.env.GROQ_API_KEY.length);
}

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

// [Keep all your existing CRUD routes unchanged - they're fine]
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

// SIGNUP & LOGIN routes [unchanged - they're fine]
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

// ── AI test endpoint ──
app.get("/ai/test", async (req, res) => {
    if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ error: "GROQ_API_KEY not set" });
    }
    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: "Reply with only the word: working" }],
            max_tokens: 10
        });
        res.json({ status: "ok", response: completion.choices[0].message.content.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message, type: err.constructor.name });
    }
});

// 🔥 FIXED: Robust JSON extraction function
function extractJSON(raw) {
    console.log("Raw AI response:", raw); // Debug log
    
    if (!raw) return null;
    
    // Clean up common markdown/code blocks
    let cleaned = raw
        .replace(/```(?:json)?\s*[\r\n]?/gi, "")
        .replace(/```\s*[\r\n]?$/gm, "")
        .replace(/^\s*[\r\n]/gm, "")
        .trim();

    // Try multiple JSON extraction strategies
    const strategies = [
        // Strategy 1: Find JSON object/array
        () => {
            const match = cleaned.match(/\{[^{}]*"priority"[^}]*\}/i) || 
                         cleaned.match(/\{[^{}]+\}/) ||
                         cleaned.match(/\$[^\$]+\$/);
            return match ? match[0] : null;
        },
        // Strategy 2: Extract from first { to last }
        () => {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            return start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : null;
        },
        // Strategy 3: Extract first array
        () => {
            const start = cleaned.indexOf('[');
            const end = cleaned.indexOf(']', start);
            return start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : null;
        }
    ];

    for (const strategy of strategies) {
        try {
            const jsonStr = strategy();
            if (jsonStr) {
                console.log("Extracted JSON:", jsonStr);
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            continue;
        }
    }

    console.error("Failed to extract JSON from:", cleaned);
    return null;
}

// 🔥 FIXED: Priority suggestion with fallback
app.post("/ai/priority", async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task text required" });

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192", // You can also try "mixtral-8x7b-32768" for better JSON
            messages: [
                {
                    role: "system",
                    content: `You are a productivity assistant. Respond with ONLY valid JSON, nothing else. No explanations, no markdown.

Example response:
{"priority":"High","reason":"Time-sensitive task"}

Priority must be exactly: "High", "Medium", or "Low".`
                },
                {
                    role: "user",
                    content: `Task: "${task}"`
                }
            ],
            max_tokens: 100,
            temperature: 0.1 // Lower temperature = more reliable JSON
        });

        const raw = completion.choices[0].message.content.trim();
        const result = extractJSON(raw);
        
        if (!result || !result.priority) {
            // Fallback: simple heuristic
            console.log("AI JSON failed, using fallback");
            const priority = task.toLowerCase().includes('urgent') || 
                           task.toLowerCase().includes('today') || 
                           task.toLowerCase().includes('deadline') ? 'High' :
                           task.length > 50 ? 'Medium' : 'Low';
            
            return res.json({ 
                priority, 
                reason: "AI temporarily unavailable - using smart fallback" 
            });
        }

        // Normalize priority
        const normalizedPriority = result.priority.charAt(0).toUpperCase() + 
                                  result.priority.slice(1).toLowerCase();
        
        res.json({ 
            priority: normalizedPriority, 
            reason: result.reason || "Priority assigned based on task analysis"
        });
    } catch (err) {
        console.error("Priority error:", err.message);
        // Fallback response
        res.json({ 
            priority: "Medium", 
            reason: "Service temporarily unavailable - default priority assigned" 
        });
    }
});

// 🔥 FIXED: Subtask breakdown with fallback
app.post("/ai/breakdown", async (req, res) => {
    const { task } = req.body;
    if (!task) return res.status(400).json({ error: "Task text required" });

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                {
                    role: "system",
                    content: `You are a productivity assistant. Respond with ONLY a JSON array of 3-5 strings. Nothing else.

Example: ["Step 1", "Step 2", "Step 3"]`
                },
                {
                    role: "user",
                    content: `Break this into 3-5 actionable subtasks: "${task}"`
                }
            ],
            max_tokens: 200,
            temperature: 0.2
        });

        const raw = completion.choices[0].message.content.trim();
        const subtasks = extractJSON(raw);
        
        if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
            // Fallback: simple breakdown
            console.log("AI subtasks failed, using fallback");
            const fallback = [
                `1. Plan: ${task}`,
                "2. Execute key actions",
                "3. Review and complete"
            ];
            return res.json({ subtasks: fallback });
        }

        res.json({ subtasks: subtasks.slice(0, 5) }); // Limit to 5 max
    } catch (err) {
        console.error("Breakdown error:", err.message);
        res.json({ 
            subtasks: [`1. ${task}`, "2. Follow up", "3. Review completion"] 
        });
    }
});

// 🔥 FIXED: Daily summary (this one was mostly working)
app.post("/ai/summary", async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || tasks.length === 0) {
        return res.json({ summary: "🎉 You have no pending tasks! Great work — enjoy your day." });
    }

    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) {
        return res.json({ summary: "🎉 You have no pending tasks! Great work — enjoy your day." });
    }

    const taskList = pending
        .map(t => `- ${t.text} (${t.priority || 'Medium'}${t.dueDate ? `, due ${t.dueDate}` : ""})`)
        .join("\n");

    try {
        const completion = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                {
                    role: "system",
                    content: "You are an encouraging productivity coach. Write concise, motivating daily plans in 3-4 sentences."
                },
                {
                    role: "user",
                    content: `Pending tasks:\n${taskList}\n\nWrite a motivating daily plan.`
                }
            ],
            max_tokens: 200,
            temperature: 0.7
        });

        res.json({ 
            summary: completion.choices[0].message.content.trim() || 
                    "Focus on your top priority tasks today. You've got this! 💪" 
        });
    } catch (err) {
        console.error("Summary error:", err.message);
        res.json({ 
            summary: `You have ${pending.length} pending tasks. Tackle the highest priority ones first! 💪` 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});