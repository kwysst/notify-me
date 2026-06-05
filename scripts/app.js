const App = (() => {
    let currentConfig = null;
    
    async function sendTelegramNotification(botToken, chatId, message) {
        const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        const payload = {
            chat_id: chatId,
            text: message,
            parse_mode: "HTML"
        };
        
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.ok) {
                throw new Error(data.description || "Ошибка отправки");
            }
            
            return { success: true, message: "Уведомление отправлено" };
        } catch (error) {
            console.error("Telegram error:", error);
            return { success: false, message: error.message };
        }
    }
    
    function renderButtons(config) {
        const buttonsGrid = document.getElementById("buttonsGrid");
        if (!buttonsGrid) return;
        
        buttonsGrid.innerHTML = "";
        
        if (!config.buttons || !Array.isArray(config.buttons) || config.buttons.length === 0) {
            buttonsGrid.innerHTML = "<p style='color: var(--muted); text-align: center;'>Кнопки не найдены</p>";
            return;
        }
        
        config.buttons.forEach((button) => {
            const btn = document.createElement("button");
            btn.className = "action-btn";
            btn.textContent = button.text;
            btn.addEventListener("click", async () => {
                await handleButtonClick(button, config);
            });
            buttonsGrid.appendChild(btn);
        });
    }
    
    async function handleButtonClick(button, config) {
        const notificationArea = document.getElementById("notificationArea");
        const message = button.message || `Нажата кнопка: ${button.text}`;
        
        if (!notificationArea) return;
        
        notificationArea.innerHTML = '<div class="notification-info">Отправка...</div>';
        
        if (config.notifications && config.notifications.telegram) {
            const tg = config.notifications.telegram;
            if (tg.botToken && tg.chatId) {
                const result = await sendTelegramNotification(tg.botToken, tg.chatId, message);
                if (result.success) {
                    notificationArea.innerHTML = `<div class="notification-success">${result.message}</div>`;
                } else {
                    notificationArea.innerHTML = `<div class="notification-error">Ошибка: ${result.message}</div>`;
                }
            } else {
                notificationArea.innerHTML = '<div class="notification-error">Telegram не настроен</div>';
            }
        } else {
            notificationArea.innerHTML = '<div class="notification-error">Telegram не настроен</div>';
        }
        
        setTimeout(() => {
            if (notificationArea.children.length > 0) {
                setTimeout(() => {
                    if (notificationArea.firstChild?.classList?.contains('notification-success') ||
                        notificationArea.firstChild?.classList?.contains('notification-error')) {
                        notificationArea.innerHTML = "";
                    }
                }, 3000);
            }
        }, 5000);
    }
    
    async function login(passphrase) {
        try {
            let config = await AuthModule.loadConfigFromCache(passphrase);
            
            if (!config) {
                config = await AuthModule.loadConfig(passphrase);
                await AuthModule.saveConfigToCache(passphrase, config);
            }
            
            currentConfig = config;
            
            document.getElementById("loginSection").style.display = "none";
            document.getElementById("appSection").style.display = "block";
            
            renderButtons(config);
            
            const notificationArea = document.getElementById("notificationArea");
            if (notificationArea) {
                notificationArea.innerHTML = '<div class="notification-success">Вход выполнен</div>';
                setTimeout(() => {
                    if (notificationArea.firstChild) {
                        notificationArea.innerHTML = "";
                    }
                }, 2000);
            }
            
        } catch (error) {
            console.error("Login error:", error);
            const errorDiv = document.getElementById("loginError");
            if (errorDiv) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = "block";
                
                setTimeout(() => {
                    errorDiv.style.display = "none";
                }, 3000);
            }
            throw error;
        }
    }
    
    function logout() {
        currentConfig = null;
        document.getElementById("loginSection").style.display = "block";
        document.getElementById("appSection").style.display = "none";
        
        const passphraseInput = document.getElementById("passphrase");
        if (passphraseInput) passphraseInput.value = "";
        
        const errorDiv = document.getElementById("loginError");
        if (errorDiv) errorDiv.style.display = "none";
        
        const buttonsGrid = document.getElementById("buttonsGrid");
        if (buttonsGrid) buttonsGrid.innerHTML = "";
        
        const notificationArea = document.getElementById("notificationArea");
        if (notificationArea) notificationArea.innerHTML = "";
    }
    
    function init() {
        const loginForm = document.getElementById("loginForm");
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const passphrase = document.getElementById("passphrase").value;
                if (passphrase) {
                    const btn = loginForm.querySelector('button[type="submit"]');
                    const originalText = btn.textContent;
                    btn.textContent = 'Вход...';
                    btn.disabled = true;
                    
                    await login(passphrase);
                    
                    btn.textContent = originalText;
                    btn.disabled = false;
                } else {
                    const errorDiv = document.getElementById("loginError");
                    if (errorDiv) {
                        errorDiv.textContent = "Введите pass-фразу";
                        errorDiv.style.display = "block";
                        setTimeout(() => {
                            errorDiv.style.display = "none";
                        }, 2000);
                    }
                }
            });
        }
        
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", logout);
        }
        
        const passphraseInput = document.getElementById("passphrase");
        if (passphraseInput) {
            passphraseInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                }
            });
        }
    }
    
    return {
        init,
        login,
        logout
    };
})();

if (document.getElementById('loginSection')) {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
}