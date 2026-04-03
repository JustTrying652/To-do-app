// LOGIN
async function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch("https://to-do-app-sqvu.onrender.com/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("username", data.username);
        window.location.href = "index.html";
    } else {
        alert(data.error);
    }
}

// SIGNUP
async function signup() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const res = await fetch("https://to-do-app-sqvu.onrender.com/signup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (res.ok) {
        alert("Signup successful! Now login.");
    } else {
        alert(data.error);
    }
}