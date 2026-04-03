
const userId = localStorage.getItem("userId");
const username = localStorage.getItem("username");
if (username) {
    document.getElementById("username").innerText = "Welcome, " + username;
}
if (!userId) {
    window.location.href = "auth.html";
}
let currentFilter = "all";
let currentSort = "none";
async function addTask() {
    const input = document.getElementById("taskInput");
    const priorityElement = document.getElementById("priority");
    const dueDateElement = document.getElementById("dueDate");

    const task = {
        text: input.value,
        priority: priorityElement.value,
        dueDate: dueDateElement.value
    };

    if (!task.text) return;
    const userId = localStorage.getItem("userId");
    await fetch("https://to-do-app-sqvu.onrender.com/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: task.text,
            priority: task.priority,
            dueDate: task.dueDate,
            userId: userId
        })
    });

    // Clear inputs
    input.value = "";
    dueDateElement.value = "";

    // Refresh list
    displayTasks();
}
function saveTask(task) {
    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    tasks.push(task);
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

async function displayTasks() {
    document.getElementById("loader").style.display = "block";
    const taskList = document.getElementById("taskList");
    taskList.innerHTML = "";

    const searchValue = document.getElementById("searchInput")?.value.toLowerCase() || "";

    let tasks = await getTasks();
    document.getElementById("loader").style.display = "none";
    if (currentSort === "date") {
    tasks.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
}

if (currentSort === "priority") {
    const priorityOrder = { High: 1, Medium: 2, Low: 3 };

    tasks.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}
    tasks.forEach((task, index) => {

        // 🔍 SEARCH FILTER
        if (!task.text.toLowerCase().includes(searchValue)) return;

        // 🎯 EXISTING FILTERS
        if (currentFilter === "pending" && task.completed) return;
        if (currentFilter === "completed" && !task.completed) return;
        if (currentFilter === "high" && (!task.priority || task.priority.toLowerCase() !== "high")) return;

        const li = document.createElement("li");

        const priorityClass = task.priority ? task.priority.toLowerCase() : "low";
        li.classList.add(priorityClass);
        const today = new Date().toISOString().split("T")[0];

if (task.dueDate && task.dueDate < today && !task.completed) {
    li.style.border = "2px solid red";
}
       li.innerHTML = `
    <input type="checkbox" onchange="toggleComplete(${task.id})" ${task.completed ? "checked" : ""}>

    <div style="flex:1, display: flex; flex-direction: column;" ondblclick="startEdit(${task.id})">
    <div id="task-text-${task.id}">
        <span class="${task.completed ? 'completed' : ''}">
            ${task.text} (${task.priority})
        </span>
    </div>

    <small>📅 Due: ${task.dueDate || "No date"}</small>
</div>

    <button onclick="deleteTask(${task.id})">X</button>
`;

        taskList.appendChild(li);
    });
}

async function deleteTask(id) {
    await fetch(`https://to-do-app-sqvu.onrender.com/tasks/${id}`, {
        method: "DELETE"
    });

    displayTasks();
}
async function toggleComplete(id) {
    let tasks = await getTasks();
    const task = tasks.find(t => t.id === id);

    await fetch(`https://to-do-app-sqvu.onrender.com/tasks/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: task.text,
            completed: task.completed ? 0 : 1,
            priority: task.priority,
            dueDate: task.dueDate
        })
    });

    displayTasks();
}
function setFilter(filter) {
    currentFilter = filter;
    displayTasks();
}

function toggleDarkMode() {
    document.body.classList.toggle("dark");

    // Save preference
    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }
}
function logout() {
    localStorage.removeItem("userId");
    window.location.href = "auth.html";
}
async function startEdit(id) {
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);

    const taskDiv = document.getElementById(`task-text-${id}`);

    taskDiv.innerHTML = `
        <input 
            type="text" 
            id="edit-input-${id}" 
            value="${task.text}"
            onkeydown="handleEditKey(event, ${id})"
            autofocus
        >
        <button onclick="saveEdit(${id})">Save</button>
        <button onclick="cancelEdit()">Cancel</button>
    `;
}
function handleEditKey(event, id) {
    if (event.key === "Enter") {
        saveEdit(id);
    } else if (event.key === "Escape") {
        cancelEdit();
    }
}
function cancelEdit() {
    displayTasks();
}
async function saveEdit(id) {
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);

    const input = document.getElementById(`edit-input-${id}`);
    const updatedText = input.value.trim();

    if (!updatedText) return;

      await fetch(`https://to-do-app-sqvu.onrender.com/tasks/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: updatedText,
            completed: task.completed,
            priority: task.priority,
            dueDate: task.dueDate
        })
    });

    displayTasks();
}

async function getTasks() {
    const userId = localStorage.getItem("userId");
    const res = await fetch(`https://to-do-app-sqvu.onrender.com/tasks/${userId}`);
    return await res.json();
}

function setSort(sortType) {
    currentSort = sortType;
    displayTasks();
}
window.onload = function () {
    displayTasks();

    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
        document.body.classList.add("dark");
    }
};