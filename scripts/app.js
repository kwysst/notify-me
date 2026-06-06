// app.js - логика уведомлений
(function() {
    let encAuth = null;
    
    function showStatus(message, type) {
        const container = document.getElementById('encNotificationArea');
        if (!container) return;
        
        const div = document.createElement('div');
        div.className = `${type}-message`;
        div.textContent = message;
        container.innerHTML = '';
        container.appendChild(div);
        
        setTimeout(() => {
            if (container.firstChild === div) container.innerHTML = '';
        }, 3000);
    }
    
    function timeoutPromise(promise, ms) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
        ]);
    }
    
    async function sendTelegramNotification(botToken, chatId, message) {
        const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: "HTML"
                })
            });
            
            const data = await response.json();
            if (!response.ok || !data.ok) {
                throw new Error(data.description || "Ошибка отправки");
            }
            
            return { success: true, message: "Уведомление отправлено в Telegram" };
        } catch (error) {
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
            await fetch(apiUrl, {
                method: "POST",
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });
            return { success: true, message: "Уведомление отправлено в Google Forms" };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
    
    async function sendNotificationWithFallback(config, message) {
        const tg = config.notifications?.telegram;
        const gg = config.notifications?.google;
        
        if (tg?.botToken && tg?.chatId) {
            try {
                const result = await timeoutPromise(
                    sendTelegramNotification(tg.botToken, tg.chatId, message),
                    3000
                );
                if (result.success) return result;
            } catch(e) {
                console.warn('Telegram timeout:', e.message);
            }
        }
        
        if (gg?.formId && gg?.entryId) {
            return await sendGoogleNotification(gg.formId, gg.entryId, message);
        }
        
        return { success: false, message: 'Нет доступных каналов уведомлений' };
    }
    
    function renderButtons(config) {
        const container = document.getElementById('encContent');
        if (!container) return;
        
        container.innerHTML = `
            <div id="encButtonsGrid" class="buttons-grid"></div>
            <div id="encNotificationArea" class="notification-area"></div>
        `;
        
        const grid = document.getElementById('encButtonsGrid');
        
        config.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = 'action-btn';
            btn.textContent = button.text;
            btn.onclick = async () => {
                const message = button.message || `Нажата: ${button.text}`;
                showStatus('Отправка...', 'info');
                const result = await sendNotificationWithFallback(config, message);
                showStatus(result.message, result.success ? 'success' : 'error');
            };
            grid.appendChild(btn);
        });
    }
    
    // Инициализация
    encAuth = new EncAuth({
        containerId: 'encApp',
        dataPath: 'data/',
        title: 'Уведомления',
        onLogin: (config) => {
            renderButtons(config);
        },
        onLogout: () => {
            const container = document.getElementById('encContent');
            if (container) container.innerHTML = '';
            
            // Убираем pass из URL
            const url = new URL(window.location.href);
            url.searchParams.delete('pass');
            window.history.replaceState({}, '', url);
        }
    });
})();