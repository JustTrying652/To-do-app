const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(cors());
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
    const { text, completed, priority, dueDate } = req.body;

    db.run(
        "UPDATE tasks SET text=?, completed=?, priority=?, dueDate=? WHERE id=?",
        [text, completed, priority, dueDate, req.params.id],
        () => {
            res.sendStatus(200);
        }
    );
});

// DELETE task
app.delete("/tasks/:id", (req, res) => {
    db.run("DELETE FROM tasks WHERE id=?", [req.params.id], () => {
        res.sendStatus(200);
    });
});

app.post("/signup", (req, res) => {
    const { username, password } = req.body;

    db.run(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, password],
        function (err) {
            if (err) {
                return res.status(400).json({ error: "User already exists" });
            }
            res.json({ message: "User created successfully" });
        }
    );
});

app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username=? AND password=?",
        [username, password],
        (err, user) => {
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }

            res.json({ message: "Login successful", userId: user.id });
        }
    );
});

// Start server
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});