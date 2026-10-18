
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
    const messages = $("chatMessages");
    const welcome = $("welcomeCard");
    const sendBtn = $("sendBtn");
    const form = $("chatForm");
    const modal = $("deleteModal");

    const STORAGE_KEY = "meowChats";
    const THEME_KEY = "meowTheme";

    let chats = loadChats();
    let currentId = null;
    let sending = false;
    let installPrompt = null;
    let chatToDelete = null;
    let deleteAll = false;
    let previousFocus = null;

    function loadChats() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY) || "[]"
            );
            return Array.isArray(saved) ? saved : [];
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
        } catch (error) {
            console.error("Could not save chat history:", error);
        }
    }

    function setTheme(theme) {
        const selected = theme === "light" ? "light" : "dark";

        document.documentElement.setAttribute(
            "data-theme",
            selected
        );

        localStorage.setItem(THEME_KEY, selected);

        const themeBtn = $("themeBtn");
        const themeSelect = $("themeSelect");

        if (themeBtn) {
            themeBtn.textContent =
                selected === "dark" ? "☀" : "☾";

            themeBtn.title =
                selected === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode";

            themeBtn.setAttribute(
                "aria-label",
                themeBtn.title
            );
        }

        if (themeSelect) {
            themeSelect.value = selected;
        }

        const meta = document.querySelector(
            'meta[name="theme-color"]'
        );

        if (meta) {
            meta.content =
                selected === "dark" ? "#111022" : "#f8f6ff";
        }
    }

    const savedTheme =
        localStorage.getItem(THEME_KEY) ||
        localStorage.getItem("noirTheme") ||
        "dark";

    setTheme(savedTheme);

    const themeBtn = $("themeBtn");
    const themeSelect = $("themeSelect");

    if (themeBtn) {
        themeBtn.onclick = () => {
            const current =
                document.documentElement.getAttribute("data-theme");

            const nextTheme =
                current === "dark" ? "light" : "dark";

            setTheme(nextTheme);

            console.log("Theme changed to:", nextTheme);
        };
    }

    if (themeSelect) {
        themeSelect.onchange = event => {
            setTheme(event.target.value);
        };
    }

    function closeSidebar() {
        $("sidebar").classList.remove("open");
        $("sidebarOverlay").classList.remove("show");
    }

    function showPage(name) {
        Object.entries(pages).forEach(([key, page]) => {
            page.classList.toggle(
                "active-page",
                key === name
            );
        });

        Object.entries(navButtons).forEach(([key, button]) => {
            button.classList.toggle(
                "active",
                key === name
            );
        });

        closeSidebar();

        if (name === "history") {
            renderHistory();
        }
    }

    $("menuBtn").addEventListener("click", () => {
        $("sidebar").classList.add("open");
        $("sidebarOverlay").classList.add("show");
    });

    $("sidebarOverlay").addEventListener(
        "click",
        closeSidebar
    );

    $("historyBtn").addEventListener("click", () => {
        showPage("history");
    });

    $("settingsBtn").addEventListener("click", () => {
        showPage("settings");
    });

    $("aboutBtn").addEventListener("click", () => {
        showPage("about");
    });

    function currentChat() {
        return chats.find(chat => chat.id === currentId);
    }

    function createChat() {
        const chat = {
            id: Date.now().toString() +
                Math.random().toString(36).slice(2),
            title: "New Conversation",
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

    function displayMessage(role, text) {
        const row = document.createElement("div");

        row.className = "message " + (
            role === "user" ? "user" : "model"
        );

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;

        row.appendChild(bubble);
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;

        return row;
    }

    function openChat(id) {
        if (sending) return;

        const chat = chats.find(item => item.id === id);
        if (!chat) return;

        currentId = chat.id;
        messages.innerHTML = "";

        welcome.style.display =
            chat.messages.length > 0 ? "none" : "flex";

        chat.messages.forEach(item => {
            displayMessage(item.role, item.text);
        });

        showPage("chat");
        messages.scrollTop = messages.scrollHeight;
        input.focus();
    }

    function renderHistory() {
        const list = $("historyList");
        list.innerHTML = "";

        const savedChats = chats.filter(chat =>
            Array.isArray(chat.messages) &&
            chat.messages.length > 0
        );

        if (!savedChats.length) {
            const empty = document.createElement("p");
            empty.textContent =
                "No conversations yet. Start chatting with Noir!";
            list.appendChild(empty);
            return;
        }

        savedChats.forEach(chat => {
            const row = document.createElement("div");
            row.className = "history-row";

            const openButton = document.createElement("button");
            openButton.type = "button";
            openButton.className = "history-item";

            const title = document.createElement("span");
            title.className = "history-title";
            title.textContent =
                "✦ " + (chat.title || "New Conversation");

            openButton.appendChild(title);

            openButton.addEventListener("click", () => {
                openChat(chat.id);
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "history-delete";
            deleteButton.textContent = "✕";
            deleteButton.title = "Delete conversation";

            deleteButton.setAttribute(
                "aria-label",
                "Delete " + (chat.title || "conversation")
            );

            deleteButton.addEventListener("click", () => {
                openDeleteModal(chat.id);
            });

            row.appendChild(openButton);
            row.appendChild(deleteButton);
            list.appendChild(row);
        });
    }

    function openDeleteModal(id = null, all = false) {
        if (sending || !modal) return;

        previousFocus = document.activeElement;

        if (all) {
            $("deleteModalTitle").textContent =
                "Clear all chat history?";

            $("deleteModalText").textContent =
                "Are you sure you want to delete all saved conversations?";

            $("confirmDeleteBtn").textContent = "Delete All";
        } else {
            const chat = chats.find(item => item.id === id);
            if (!chat) return;

            $("deleteModalTitle").textContent =
                "Delete conversation?";

            $("deleteModalText").textContent =
                `Are you sure you want to delete "${chat.title}"?`;

            $("confirmDeleteBtn").textContent = "Delete Chat";
        }

        deleteAll = all;
        chatToDelete = id;
        modal.hidden = false;

        $("cancelDeleteBtn").focus();
    }

    function closeDeleteModal() {
        if (!modal) return;

        modal.hidden = true;
        chatToDelete = null;
        deleteAll = false;

        if (previousFocus && previousFocus.isConnected) {
            previousFocus.focus();
        }

        previousFocus = null;
    }

    $("cancelDeleteBtn").addEventListener(
        "click",
        closeDeleteModal
    );

    $("confirmDeleteBtn").addEventListener("click", () => {
        if (sending) return;

        if (deleteAll) {
            chats = [];
            currentId = null;
            messages.innerHTML = "";
            welcome.style.display = "flex";
        } else if (chatToDelete !== null) {
            const id = chatToDelete;

            chats = chats.filter(chat => chat.id !== id);

            if (currentId === id) {
                currentId = null;
                messages.innerHTML = "";
                welcome.style.display = "flex";
            }
        } else {
            return;
        }

        saveChats();
        closeDeleteModal();
        renderHistory();
    });

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeDeleteModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (modal.hidden) return;

        if (event.key === "Escape") {
            event.preventDefault();
            closeDeleteModal();
            return;
        }

        if (event.key === "Tab") {
            const first = $("cancelDeleteBtn");
            const last = $("confirmDeleteBtn");

            if (event.shiftKey &&
                document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey &&
                       document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    $("clearHistoryBtn").addEventListener("click", () => {
        if (!chats.length) return;
        openDeleteModal(null, true);
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const prompt = input.value.trim();

        if (!prompt || sending) return;

        if (!navigator.onLine) {
            alert("You're offline. Reconnect to chat with Noir AI.");
            return;
        }

        let chat = currentChat();

        if (!chat) {
            chat = createChat();
        }

        const history = chat.messages.slice(-4);

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
            "Noir is thinking... ✦"
        );

        loading.classList.add("thinking-message");

        const started = performance.now();

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

            const elapsed =
                (performance.now() - started) / 1000;

            console.log(
                `Noir total response: ${elapsed.toFixed(2)} seconds`
            );

        } catch (error) {
            loading.remove();

            displayMessage(
                "model",
                "Sorry, I couldn't respond. " + error.message
            );

            console.error("Noir request failed:", error);

        } finally {
            sending = false;
            sendBtn.disabled = false;
            input.focus();
        }
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    document.querySelectorAll("[data-prompt]").forEach(button => {
        button.addEventListener("click", () => {
            input.value = button.dataset.prompt;
            showPage("chat");
            input.focus();
        });
    });

    function updateConnection() {
        const online = navigator.onLine;

        const status = $("connectionStatus");
        const dot = document.querySelector(".status-dot");

        if (status) {
            status.textContent =
                online ? "Online" : "Offline";
        }

        if (dot) {
            dot.style.background =
                online ? "#79dab0" : "#f085a8";
        }
    }

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    updateConnection();

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        installPrompt = event;

        if ($("installBtn")) {
            $("installBtn").hidden = false;
        }
    });

    if ($("installBtn")) {
        $("installBtn").addEventListener("click", async () => {
            if (!installPrompt) return;

            installPrompt.prompt();
            await installPrompt.userChoice;

            installPrompt = null;
            $("installBtn").hidden = true;
        });
    }

    window.addEventListener("appinstalled", () => {
        installPrompt = null;

        if ($("installBtn")) {
            $("installBtn").hidden = true;
        }
    });
});
