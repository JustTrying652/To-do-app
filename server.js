const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors({
    origin: "https://peppy-crepe-5ac129.netlify.app"
}));
app.use(express.json());

// Database
const db = new sqlite3.Database("./tasks.db");

// Create table
db.run(`
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT,
    completed INTEGER,
    priority TEXT,
    dueDate TEXT,
    userId INTEGER
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)
`);

// GET all tasks
app.get("/tasks/:userId", (req, res) => {
    db.all("SELECT * FROM tasks WHERE userId=?", [req.params.userId], (err, rows) => {
        res.json(rows);
    });
});

// ADD task
app.post("/tasks", (req, res) => {
    const { text, priority, dueDate, userId } = req.body;

    console.log("Incoming task:", req.body);
    db.run(
        "INSERT INTO tasks (text, completed, priority, dueDate, userId) VALUES (?, ?, ?, ?, ?)",
        [text, 0, priority, dueDate, userId],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ id: this.lastID });
        }
    );
});

// UPDATE task
app.put("/tasks/:id", (req, res) => {
    const { text, completed, priority, dueDate, userId } = req.body;

    db.run(
        "UPDATE tasks SET text=?, completed=?, priority=?, dueDate=? WHERE id=? AND userId=?",
        [text, completed, priority, dueDate, req.params.id, userId],
        function (err) {
            if (err) return res.status(500).json({ error: "Database error" });
            if (this.changes === 0) return res.status(403).json({ error: "Not allowed" });
            res.sendStatus(200);
        }
    );
});

// DELETE task
app.delete("/tasks/:id", (req, res) => {
    const { userId } = req.body;

    db.run("DELETE FROM tasks WHERE id=? AND userId=?", [req.params.id, userId],
        function (err) {
            if (err) return res.status(500).json({ error: "Database error" });
            if (this.changes === 0) return res.status(403).json({ error: "Not allowed" });
            res.sendStatus(200);
        }
    );
});

app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashedPassword],
            function (err) {
                if (err) {
                    return res.status(400).json({ error: "User already exists" });
                }
                res.json({ message: "User created successfully" });
            }
        );
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username=?",
        [username],
        async (err, user) => {
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            let passwordValid = false;

            // Check if password is bcrypt hashed (hashes start with $2)
            if (user.password.startsWith("$2")) {
                passwordValid = await bcrypt.compare(password, user.password);
            } else {
                // Legacy plain text password — compare directly
                passwordValid = (password === user.password);

                // Auto-upgrade: re-hash and save for next time
                if (passwordValid) {
                    const newHash = await bcrypt.hash(password, 10);
                    db.run("UPDATE users SET password=? WHERE id=?", [newHash, user.id]);
                }
            }

            if (!passwordValid) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            res.json({ message: "Login successful", userId: user.id, username: user.username });
        }
    );
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});