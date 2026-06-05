const App = (() => {
    let currentConfig = null;
    
    function showStatus(message, type, targetId = 'notificationArea', timeout = null) {
        const container = document.getElementById(targetId);
        if (!container) return;
        
        const statusDiv = document.createElement('div');
        statusDiv.className = `${type}-message`;
        statusDiv.textContent = message;
        
        container.innerHTML = '';
        container.appendChild(statusDiv);
        
        if (timeout) {
            setTimeout(() => {
                if (container.firstChild === statusDiv) {
                    container.innerHTML = '';
                }
            }, timeout);
        }
    }
    
    function timeoutPromise(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ms)
            )
        ]);
    }
    
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
            
            return { success: true, message: "Уведомление отправлено в Telegram" };
        } catch (error) {
            console.error("Telegram error:", error);
            return { success: false, message: error.message };
        }
    }
    
    async function sendGoogleNotification(formId, entryId, message) {
        const apiUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
        
        const params = new URLSearchParams({
            [`entry.${entryId}`]: message,
            'fvv': '1',
            'pageHistory': '0',
            'submissionTimestamp': Date.now().toString()
        });
        
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });
            
            return { success: true, message: "Уведомление отправлено в Google Forms" };
        } catch (error) {
            console.error("Google Forms error:", error);
            return { success: false, message: error.message };
        }
    }
    
    async function sendNotificationWithFallback(config, message) {
        const telegramConfig = config.notifications?.telegram;
        const googleConfig = config.notifications?.google;
        
        if (telegramConfig && telegramConfig.botToken && telegramConfig.chatId) {
            try {
                const result = await timeoutPromise(
                    sendTelegramNotification(telegramConfig.botToken, telegramConfig.chatId, message),
                    3000
                );
                
                if (result.success) {
                    return result;
                }
                
                console.warn('Telegram failed, trying Google Forms:', result.message);
            } catch (error) {
                console.warn('Telegram timeout or error:', error.message);
            }
        }
        
        if (googleConfig && googleConfig.formId && googleConfig.entryId) {
            const result = await sendGoogleNotification(
                googleConfig.formId,
                googleConfig.entryId,
                message
            );
            
            if (result.success) {
                return result;
            }
        }
        
        return { success: false, message: 'Все каналы уведомлений недоступны' };
    }
    
    function renderButtons(config) {
        const buttonsGrid = document.getElementById("buttonsGrid");
        if (!buttonsGrid) return;
        
        buttonsGrid.innerHTML = "";
        
        if (!config.buttons || !Array.isArray(config.buttons) || config.buttons.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.style.cssText = 'color: var(--muted); text-align: center;';
            emptyMsg.textContent = 'Кнопки не найдены';
            buttonsGrid.appendChild(emptyMsg);
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
        const message = button.message || `Нажата кнопка: ${button.text}`;
        
        showStatus('Отправка...', 'info');
        
        const result = await sendNotificationWithFallback(config, message);
        
        if (result.success) {
            showStatus(result.message, 'success');
        } else {
            showStatus(`Ошибка: ${result.message}`, 'error');
        }
    }
    
    function showLoginError(message) {
        const errorDiv = document.getElementById("loginError");
        if (!errorDiv) return;
        
        errorDiv.textContent = message;
        errorDiv.style.display = "block";
        
        setTimeout(() => {
            errorDiv.style.display = "none";
        }, 3000);
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
            
            showStatus('Вход выполнен', 'success');
            
        } catch (error) {
            console.error("Login error:", error);
            showLoginError(error.message);
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
                    showLoginError("Введите pass-фразу");
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