const userId = localStorage.getItem("userId");
const username = localStorage.getItem("username");
const API = "https://to-do-app-sqvu.onrender.com";

if (!userId) window.location.href = "auth.html";

if (username) {
    document.getElementById("username").innerText = "👋 " + username;
}

// Apply saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
    document.body.classList.add("light");
    document.getElementById("themeBtn").textContent = "🌙 Dark";
}

let currentFilter = "all";
let currentSort = "none";

// ── Add Task ──
async function addTask() {
    const input = document.getElementById("taskInput");
    const priority = document.getElementById("priority").value;
    const dueDate = document.getElementById("dueDate").value;

    if (!input.value.trim()) {
        input.classList.add("shake");
        input.focus();
        setTimeout(() => input.classList.remove("shake"), 400);
        return;
    }

    try {
        await fetch(`${API}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: input.value.trim(), priority, dueDate, userId })
        });
        input.value = "";
        document.getElementById("dueDate").value = "";
        displayTasks();
    } catch (e) {
        alert("Could not add task. Please try again.");
    }
}

// ── Display Tasks ──
async function displayTasks() {
    document.getElementById("loader").style.display = "block";
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = "";

    const searchValue = document.getElementById("searchInput")?.value.toLowerCase() || "";

    let tasks;
    try {
        tasks = await getTasks();
    } catch (e) {
        document.getElementById("loader").style.display = "none";
        taskList.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><p>Could not load tasks. Check your connection.</p></div>`;
        return;
    }

    document.getElementById("loader").style.display = "none";

    // Sort
    if (currentSort === "date") {
        tasks.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    } else if (currentSort === "priority") {
        const order = { High: 1, Medium: 2, Low: 3 };
        tasks.sort((a, b) => order[a.priority] - order[b.priority]);
    }

    // Filter + search
    const filtered = tasks.filter(task => {
        if (!task.text.toLowerCase().includes(searchValue)) return false;
        if (currentFilter === "pending" && task.completed) return false;
        if (currentFilter === "completed" && !task.completed) return false;
        if (currentFilter === "high" && task.priority?.toLowerCase() !== "high") return false;
        return true;
    });

    if (filtered.length === 0) {
        taskList.innerHTML = `<div class="empty-state"><div class="emoji">✅</div><p>No tasks here. Add one above!</p></div>`;
        return;
    }

    const today = new Date().toISOString().split("T")[0];

    filtered.forEach(task => {
        const li = document.createElement("li");
        const priorityClass = task.priority?.toLowerCase() || "low";
        const isOverdue = task.dueDate && task.dueDate < today && !task.completed;

        li.classList.add(priorityClass);
        if (isOverdue) li.classList.add("overdue");

        const dateLabel = task.dueDate
            ? `<span class="task-date ${isOverdue ? 'overdue' : ''}">📅 ${isOverdue ? 'Overdue · ' : ''}${task.dueDate}</span>`
            : `<span class="task-date">No due date</span>`;

        li.innerHTML = `
            <input type="checkbox" onchange="toggleComplete(${task.id})" ${task.completed ? "checked" : ""}>
            <div class="task-body" ondblclick="startEdit(${task.id})">
                <div id="task-text-${task.id}">
                    <div class="task-name ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        ${dateLabel}
                        <span class="priority-badge ${priorityClass}">${task.priority}</span>
                    </div>
                </div>
            </div>
            <button class="btn-danger" onclick="deleteTask(${task.id})">Delete</button>
        `;
        taskList.appendChild(li);
    });
}

function escapeHtml(text) {
    return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Delete Task ──
async function deleteTask(id) {
    try {
        await fetch(`${API}/tasks/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });
        displayTasks();
    } catch (e) {
        alert("Could not delete task.");
    }
}

// ── Toggle Complete ──
async function toggleComplete(id) {
    try {
        const tasks = await getTasks();
        const task = tasks.find(t => t.id === id);
        await fetch(`${API}/tasks/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: task.text,
                completed: task.completed ? 0 : 1,
                priority: task.priority,
                dueDate: task.dueDate,
                userId
            })
        });
        displayTasks();
    } catch (e) {
        alert("Could not update task.");
    }
}

// ── Inline Edit ──
async function startEdit(id) {
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    const taskDiv = document.getElementById(`task-text-${id}`);
    taskDiv.innerHTML = `
        <div class="edit-row">
            <input type="text" id="edit-input-${id}" value="${escapeHtml(task.text)}"
                onkeydown="handleEditKey(event, ${id})" autofocus>
            <button class="btn-save" onclick="saveEdit(${id})">Save</button>
            <button class="btn-cancel" onclick="displayTasks()">Cancel</button>
        </div>
    `;
    document.getElementById(`edit-input-${id}`).focus();
}

function handleEditKey(event, id) {
    if (event.key === "Enter") saveEdit(id);
    else if (event.key === "Escape") displayTasks();
}

async function saveEdit(id) {
    const input = document.getElementById(`edit-input-${id}`);
    const updatedText = input.value.trim();
    if (!updatedText) return;

    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    try {
        await fetch(`${API}/tasks/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: updatedText,
                completed: task.completed,
                priority: task.priority,
                dueDate: task.dueDate,
                userId
            })
        });
        displayTasks();
    } catch (e) {
        alert("Could not save changes.");
    }
}

// ── Filter & Sort ──
function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    displayTasks();
}

function setSort(sortType, btn) {
    if (currentSort === sortType) {
        currentSort = "none";
        btn.classList.remove("active");
    } else {
        currentSort = sortType;
        document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }
    displayTasks();
}

// ── Theme ──
function toggleDarkMode() {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");
    document.getElementById("themeBtn").textContent = isLight ? "🌙 Dark" : "☀️ Light";
}

// ── Logout ──
function logout() {
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    window.location.href = "auth.html";
}

// ── Get Tasks ──
async function getTasks() {
    const res = await fetch(`${API}/tasks/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch tasks");
    return await res.json();
}

// ── AI Panel helpers ──
function showAiPanel(title, html) {
    const panel = document.getElementById("ai-panel");
    panel.style.display = "block";
    panel.innerHTML = `
        <div class="ai-title">${title}</div>
        <div class="ai-content">${html}</div>
        <button class="ai-close" onclick="document.getElementById('ai-panel').style.display='none'">✕ Close</button>
    `;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setAiBtnsLoading(loading) {
    document.querySelectorAll(".btn-ai").forEach(b => b.disabled = loading);
}

// ── AI: Extract due date from natural language ──
async function aiExtractDate() {
    const input = document.getElementById("taskInput");
    const text = input.value.trim();

    if (!text) {
        input.classList.add("shake");
        input.focus();
        setTimeout(() => input.classList.remove("shake"), 400);
        return;
    }

    setAiBtnsLoading(true);
    showAiPanel("📅 Detecting due date...", "<em>Analysing your task...</em>");

    try {
        const res = await fetch(`${API}/ai/duedate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task: text })
        });
        const data = await res.json();

        if (data.found && data.date) {
            // Auto-set the date picker
            document.getElementById("dueDate").value = data.date;
            showAiPanel("📅 Due date detected", `
                Found <strong>${data.label}</strong> in your task — due date set to <strong>${data.date}</strong>.
                <br><span style="font-size:0.78rem; color:var(--text3); margin-top:6px; display:block;">Date picker has been updated automatically.</span>
            `);
        } else {
            showAiPanel("📅 No date found", `
                No due date was detected in your task text.<br>
                <span style="color:var(--text2); font-size:0.82rem;">Try adding phrases like "by Friday", "tomorrow", "next week", or "in 3 days".</span>
            `);
        }
    } catch (e) {
        showAiPanel("📅 Due date detection", "Could not analyse task. Please try again.");
    }
    setAiBtnsLoading(false);
}

// ── AI: Suggest Priority ──
async function aiSuggestPriority() {
    const text = document.getElementById("taskInput").value.trim();
    if (!text) {
        document.getElementById("taskInput").classList.add("shake");
        setTimeout(() => document.getElementById("taskInput").classList.remove("shake"), 400);
        return;
    }

    setAiBtnsLoading(true);
    showAiPanel("✨ Analysing priority...", "<em>Thinking...</em>");

    try {
        const res = await fetch(`${API}/ai/priority`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task: text })
        });
        const data = await res.json();

        // Auto-set the dropdown
        document.getElementById("priority").value = data.priority;

        showAiPanel("✨ Priority suggestion", `
            <strong>${data.priority} Priority</strong> recommended<br>
            <span style="color:var(--text2); font-size:0.82rem;">${data.reason}</span>
            <br><span style="font-size:0.78rem; color:var(--text3); margin-top:6px; display:block;">Priority dropdown has been updated automatically.</span>
        `);
    } catch (e) {
        showAiPanel("✨ Priority suggestion", "Could not get suggestion. Please try again.");
    }
    setAiBtnsLoading(false);
}

// ── AI: Break into Subtasks ──
async function aiBreakdown() {
    const text = document.getElementById("taskInput").value.trim();
    if (!text) {
        document.getElementById("taskInput").classList.add("shake");
        setTimeout(() => document.getElementById("taskInput").classList.remove("shake"), 400);
        return;
    }

    setAiBtnsLoading(true);
    showAiPanel("🔀 Breaking down task...", "<em>Thinking...</em>");

    try {
        const res = await fetch(`${API}/ai/breakdown`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task: text })
        });
        const data = await res.json();

        const priority = document.getElementById("priority").value;
        const dueDate = document.getElementById("dueDate").value;

        const subtaskHtml = data.subtasks.map(s => `
            <div class="ai-subtask">
                <span>${escapeHtml(s)}</span>
                <button class="btn-add-subtask" onclick="addSubtask('${escapeHtml(s)}', '${priority}', '${dueDate}', this)">+ Add</button>
            </div>
        `).join("");

        showAiPanel("🔀 Suggested subtasks", subtaskHtml);
    } catch (e) {
        showAiPanel("🔀 Subtask breakdown", "Could not break down task. Please try again.");
    }
    setAiBtnsLoading(false);
}

async function addSubtask(text, priority, dueDate, btn) {
    btn.disabled = true;
    btn.textContent = "✓ Added";
    try {
        await fetch(`${API}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, priority, dueDate, userId })
        });
        displayTasks();
    } catch (e) {
        btn.disabled = false;
        btn.textContent = "+ Add";
    }
}

// ── AI: Daily Summary ──
async function aiDailySummary() {
    setAiBtnsLoading(true);
    showAiPanel("📋 Generating your daily plan...", "<em>Thinking...</em>");

    try {
        const tasks = await getTasks();
        if (tasks.filter(t => !t.completed).length === 0) {
            showAiPanel("📋 Daily summary", "🎉 You have no pending tasks! Enjoy your day.");
            setAiBtnsLoading(false);
            return;
        }

        const res = await fetch(`${API}/ai/summary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tasks })
        });
        const data = await res.json();
        showAiPanel("📋 Your daily plan", data.summary);
    } catch (e) {
        showAiPanel("📋 Daily summary", "Could not generate summary. Please try again.");
    }
    setAiBtnsLoading(false);
}

window.onload = displayTasks;
