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

window.onload = displayTasks;
