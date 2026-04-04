const API = "https://to-do-app-sqvu.onrender.com";

function getFields() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    return { username, password };
}

function showError(message) {
    let err = document.getElementById("auth-error");
    if (!err) {
        err = document.createElement("div");
        err.id = "auth-error";
        err.style.cssText = "color:#f0506e; font-size:0.82rem; margin-top:10px; text-align:center;";
        document.querySelector(".auth-btns").after(err);
    }
    err.textContent = message;
}

function clearError() {
    const err = document.getElementById("auth-error");
    if (err) err.textContent = "";
}

// LOGIN
async function login() {
    clearError();
    const { username, password } = getFields();

    if (!username || !password) {
        showError("Please enter both username and password.");
        return;
    }

    try {
        const res = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("username", data.username);
            window.location.href = "index.html";
        } else {
            showError(data.error || "Login failed. Please try again.");
        }
    } catch (e) {
        showError("Could not connect. Please check your connection.");
    }
}

// SIGNUP — creates account then immediately logs in and redirects
async function signup() {
    clearError();
    const { username, password } = getFields();

    if (!username || !password) {
        showError("Please enter both username and password.");
        return;
    }

    if (password.length < 4) {
        showError("Password must be at least 4 characters.");
        return;
    }

    try {
        // Step 1: Create account
        const signupRes = await fetch(`${API}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const signupData = await signupRes.json();

        if (!signupRes.ok) {
            showError(signupData.error || "Signup failed. Please try again.");
            return;
        }

        // Step 2: Auto-login immediately
        const loginRes = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const loginData = await loginRes.json();

        if (loginRes.ok) {
            localStorage.setItem("userId", loginData.userId);
            localStorage.setItem("username", loginData.username);
            window.location.href = "index.html";
        } else {
            showError("Account created! Please sign in.");
        }
    } catch (e) {
        showError("Could not connect. Please check your connection.");
    }
}
