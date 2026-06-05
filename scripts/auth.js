// Модуль аутентификации и работы с конфигом
const AuthModule = (() => {
    async function loadConfig(passphrase) {
        try {
            const filename = await EncCore.generateFilename(passphrase);
            const fileUrl = `data/${filename}.enc`;
            
            console.log(`Loading config from: ${fileUrl}`);
            
            const response = await fetch(fileUrl);
            if (!response.ok) {
                throw new Error('Файл конфигурации не найден. Проверьте pass-фразу.');
            }
            
            const encryptedData = await response.json();
            const config = await EncCore.decrypt(encryptedData, passphrase);
            
            // Валидация структуры
            if (!config.buttons || !Array.isArray(config.buttons)) {
                throw new Error('Неверная структура конфигурационного файла');
            }
            
            if (config.buttons.length === 0) {
                throw new Error('Конфигурация не содержит кнопок');
            }
            
            return config;
        } catch (error) {
            console.error('Auth error:', error);
            throw new Error(`Ошибка: ${error.message}`);
        }
    }
    
    async function saveConfigToCache(passphrase, config) {
        try {
            const hash = await EncCore.sha256(passphrase);
            const cacheKey = `config_${hash}`;
            sessionStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                config: config
            }));
            return true;
        } catch (e) {
            console.warn('Cannot save to sessionStorage:', e);
            return false;
        }
    }
    
    async function loadConfigFromCache(passphrase) {
        try {
            const hash = await EncCore.sha256(passphrase);
            const cacheKey = `config_${hash}`;
            const cached = sessionStorage.getItem(cacheKey);
            
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < 3600000) {
                    return data.config;
                }
            }
        } catch (e) {
            console.warn('Cannot load from cache:', e);
        }
        return null;
    }
    
    function clearCache() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('config_')) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    return {
        loadConfig,
        saveConfigToCache,
        loadConfigFromCache,
        clearCache
    };
})();