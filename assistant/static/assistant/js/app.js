
document.addEventListener("DOMContentLoaded", () => {

    const $ = id => document.getElementById(id);

    const pages = {
        chat: $("chatPage"),
        history: $("historyPage"),
        settings: $("settingsPage"),
        about: $("aboutPage")
    };

    const navButtons = {
        chat: $("newChatBtn"),
        history: $("historyBtn"),
        settings: $("settingsBtn"),
        about: $("aboutBtn")
    };

    const input = $("messageInput");
    const messages = $("messages");
    const welcome = $("welcome");
    const sendBtn = $("sendBtn");

    const STORAGE_KEY = "meowChats";
    const THEME_KEY = "meowTheme";

    let chats = loadChats();
    let currentId = null;
    let sending = false;

    // ==========================
    // THEME
    // ==========================

    function setTheme(theme) {
        const selected = theme === "light" ? "light" : "dark";

        document.documentElement.dataset.theme = selected;

        localStorage.setItem(THEME_KEY, selected);

        $("themeSelect").value = selected;

        $("themeBtn").textContent =
            selected === "dark" ? "☀" : "☾";

        document.querySelector(
            'meta[name="theme-color"]'
        ).content = selected === "dark"
            ? "#141122" : "#f8f5ff";
    }

    setTheme(localStorage.getItem(THEME_KEY) || "dark");

    $("themeBtn").addEventListener("click", () => {
        const current = document.documentElement.dataset.theme;

        setTheme(current === "dark" ? "light" : "dark");
    });

    $("themeSelect").addEventListener("change", event => {
        setTheme(event.target.value);
    });

    // ==========================
    // NAVIGATION
    // ==========================

    function showPage(name) {
        Object.keys(pages).forEach(key => {
            pages[key].classList.toggle(
                "active",
                key === name
            );
        });

        Object.keys(navButtons).forEach(key => {
            navButtons[key].classList.toggle(
                "active",
                key === name
            );
        });

        $("sidebar").classList.remove("open");
        $("overlay").classList.remove("show");

        if (name === "history") {
            renderHistory();
        }
    }

    $("menuBtn").addEventListener("click", () => {
        $("sidebar").classList.add("open");
        $("overlay").classList.add("show");
    });

    $("overlay").addEventListener("click", () => {
        $("sidebar").classList.remove("open");
        $("overlay").classList.remove("show");
    });

    $("historyBtn").addEventListener("click", () => {
        showPage("history");
    });

    $("settingsBtn").addEventListener("click", () => {
        showPage("settings");
    });

    $("aboutBtn").addEventListener("click", () => {
        showPage("about");
    });

    // ==========================
    // CHAT STORAGE
    // ==========================

    function loadChats() {
        try {
            const stored = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );

            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    }

    function saveChats() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(chats)
            );
        } catch {
            console.warn("Chat history could not be saved.");
        }
    }

    function currentChat() {
        return chats.find(chat => chat.id === currentId);
    }

    function createChat() {
        const chat = {
            id: Date.now().toString() +
                Math.random().toString(36).slice(2),
            title: "New Chat",
            messages: []
        };

        chats.unshift(chat);
        currentId = chat.id;
        saveChats();

        return chat;
    }

    function newChat() {
        if (sending) return;

        currentId = null;
        messages.innerHTML = "";
        welcome.style.display = "flex";
        input.value = "";

        showPage("chat");
        input.focus();
    }

    $("newChatBtn").addEventListener("click", newChat);

    // ==========================
    // MESSAGE RENDERING
    // ==========================

    function displayMessage(role, text) {
        const row = document.createElement("div");
        row.className = `message ${role}`;

        const bubble = document.createElement("div");
        bubble.className = "bubble";

        // Safe: don't interpret AI output as HTML.
        bubble.textContent = text;

        row.appendChild(bubble);
        messages.appendChild(row);

        messages.scrollTop = messages.scrollHeight;

        return row;
    }

    function renderChat(chat) {
        messages.innerHTML = "";

        welcome.style.display =
            chat.messages.length ? "none" : "flex";

        chat.messages.forEach(item => {
            displayMessage(item.role, item.text);
        });
    }

    function renderHistory() {
        const list = $("historyList");
        list.innerHTML = "";

        const saved = chats.filter(
            chat => chat.messages.length
        );

        if (!saved.length) {
            const empty = document.createElement("p");
            empty.textContent = "No conversations yet.";
            list.appendChild(empty);
            return;
        }

        saved.forEach(chat => {
            const button = document.createElement("button");
            button.className = "history-item";
            button.textContent = "✦ " + chat.title;

            button.addEventListener("click", () => {
                if (sending) return;

                currentId = chat.id;
                renderChat(chat);
                showPage("chat");
            });

            list.appendChild(button);
        });
    }

    $("clearHistoryBtn").addEventListener("click", () => {
        if (sending) return;

        if (confirm("Delete all saved conversations?")) {
            chats = [];
            currentId = null;
            saveChats();
            newChat();
        }
    });

    // ==========================
    // CHAT REQUEST
    // ==========================

    $("chatForm").addEventListener("submit", async event => {
        event.preventDefault();

        const prompt = input.value.trim();

        if (!prompt || sending) return;

        if (!navigator.onLine) {
            alert("You're offline. Reconnect to chat with Meow AI.");
            return;
        }

        let chat = currentChat();

        if (!chat) chat = createChat();

        const history = chat.messages.slice(-10);

        chat.messages.push({
            role: "user",
            text: prompt
        });

        if (chat.messages.length === 1) {
            chat.title = prompt.slice(0, 45);
        }

        saveChats();

        welcome.style.display = "none";
        displayMessage("user", prompt);

        input.value = "";
        sending = true;
        sendBtn.disabled = true;

        const loading = displayMessage(
            "model",
            "Meow is thinking... ✦"
        );

        try {
            const response = await fetch("/api/chat/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": document.querySelector(
                        "[name=csrfmiddlewaretoken]"
                    ).value
                },
                body: JSON.stringify({
                    message: prompt,
                    history: history
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Unable to generate response."
                );
            }

            loading.remove();

            displayMessage("model", data.reply);

            chat.messages.push({
                role: "model",
                text: data.reply
            });

            saveChats();

        } catch (error) {
            loading.remove();

            displayMessage(
                "model",
                "Sorry, I couldn't respond. " + error.message
            );

        } finally {
            sending = false;
            sendBtn.disabled = false;
            input.focus();
        }
    });

    // Press Enter to send, Shift+Enter for newline.
    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            $("chatForm").requestSubmit();
        }
    });

    // Suggested prompts.
    document.querySelectorAll("[data-prompt]").forEach(
        button => {
            button.addEventListener("click", () => {
                input.value = button.dataset.prompt;
                showPage("chat");
                input.focus();
            });
        }
    );

    // ==========================
    // CONNECTION STATUS
    // ==========================

    function updateConnection() {
        const online = navigator.onLine;

        $("connectionText").textContent =
            online ? "Online" : "Offline";

        $("statusDot").style.background =
            online ? "#7be0b3" : "#f085a8";
    }

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    updateConnection();

    // ==========================
    // PWA INSTALL BUTTON
    // ==========================

    let installPrompt = null;

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();

        installPrompt = event;
        $("installBtn").hidden = false;
    });

    $("installBtn").addEventListener("click", async () => {
        if (!installPrompt) return;

        installPrompt.prompt();
        await installPrompt.userChoice;

        installPrompt = null;
        $("installBtn").hidden = true;
    });

    window.addEventListener("appinstalled", () => {
        installPrompt = null;
        $("installBtn").hidden = true;
    });
});
