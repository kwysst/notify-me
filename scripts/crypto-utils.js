// Криптографический модуль
const CryptoUtils = (() => {
    const ITERATIONS = 300000;
    
    // Нормализация строки (убираем пробелы, приводим к нижнему регистру)
    function normalizeStr(str) {
        return str
            .trim()
            .toLowerCase()
            .normalize('NFKC')
            .replace(/\s+/g, '');
    }
    
    // SHA-256 хэш
    async function sha256(text) {
        const data = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    // Buffer to Base64
    function bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
    
    // Base64 to Buffer
    function base64ToBuffer(base64) {
        const binary = atob(base64);
        return Uint8Array.from(binary, c => c.charCodeAt(0));
    }
    
    // Получение ключа через PBKDF2
    async function deriveKey(password, salt, operation) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(normalizeStr(password)),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            [operation]
        );
    }
    
    // Шифрование данных
    async function encrypt(payload, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const key = await deriveKey(password, salt, 'encrypt');
        
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encoded
        );
        
        return {
            v: 1,
            alg: 'AES-GCM',
            kdf: 'PBKDF2-SHA256',
            iterations: ITERATIONS,
            salt: bufferToBase64(salt),
            iv: bufferToBase64(iv),
            ciphertext: bufferToBase64(ciphertext)
        };
    }
    
    // Расшифровка данных
    async function decrypt(encryptedData, password) {
        const salt = base64ToBuffer(encryptedData.salt);
        const iv = base64ToBuffer(encryptedData.iv);
        const ciphertext = base64ToBuffer(encryptedData.ciphertext);
        
        const key = await deriveKey(password, salt, 'decrypt');
        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            ciphertext
        );
        
        return JSON.parse(new TextDecoder().decode(decrypted));
    }
    
    // Генерация имени файла на основе pass-фразы
    async function generateFilename(passphrase) {
        const normalized = normalizeStr(passphrase);
        return await sha256(normalized);
    }
    
    // Публичное API
    return {
        encrypt,
        decrypt,
        generateFilename,
        normalizeStr,
        sha256
    };
})();

// Экспортируем для использования в других скриптах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
}