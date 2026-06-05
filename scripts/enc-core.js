// Ядро модуля enc - универсальные функции шифрования
const EncCore = (() => {
    const ITERATIONS = 300000;
    
    // Нормализация строки
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
    async function encrypt(payload, password, options = {}) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const key = await deriveKey(password, salt, 'encrypt');
        
        // Добавляем метаданные если нужно
        const dataToEncrypt = options.includeMeta ? {
            ...payload,
            _encrypted_at: Date.now(),
            _version: options.version || '1.0'
        } : payload;
        
        const encoded = new TextEncoder().encode(JSON.stringify(dataToEncrypt));
        
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encoded
        );
        
        const result = {
            v: 1,
            alg: 'AES-GCM',
            kdf: 'PBKDF2-SHA256',
            iterations: ITERATIONS,
            salt: bufferToBase64(salt),
            iv: bufferToBase64(iv),
            ciphertext: bufferToBase64(ciphertext)
        };
        
        // Добавляем схему если передана
        if (options.schema) {
            result.schema = options.schema;
        }
        
        return result;
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
        
        const result = JSON.parse(new TextDecoder().decode(decrypted));
        
        // Удаляем метаданные если они были добавлены
        if (result._encrypted_at) delete result._encrypted_at;
        if (result._version) delete result._version;
        
        return result;
    }
    
    // Генерация имени файла на основе passphrase
    async function generateFilename(passphrase) {
        const normalized = normalizeStr(passphrase);
        return await sha256(normalized);
    }
    
    // Валидация данных по схеме
    function validate(data, schema) {
        if (!schema || !schema.fields) {
            return { valid: true, errors: [] };
        }
        
        const errors = [];
        
        for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
            const value = data[fieldName];
            
            // Проверка обязательности
            if (fieldSchema.required && (value === undefined || value === null || value === '')) {
                errors.push(`Поле "${fieldName}" обязательно`);
                continue;
            }
            
            // Пропускаем дальнейшую валидацию если нет значения и поле не обязательное
            if (value === undefined || value === null) {
                continue;
            }
            
            // Валидация типа array
            if (fieldSchema.type === 'array') {
                if (!Array.isArray(value)) {
                    errors.push(`Поле "${fieldName}" должно быть массивом`);
                    continue;
                }
                
                if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
                    errors.push(`В поле "${fieldName}" минимум ${fieldSchema.minItems} элементов`);
                }
                
                if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
                    errors.push(`В поле "${fieldName}" максимум ${fieldSchema.maxItems} элементов`);
                }
                
                // Валидация элементов массива
                if (fieldSchema.itemSchema && value.length) {
                    value.forEach((item, idx) => {
                        for (const [subField, subSchema] of Object.entries(fieldSchema.itemSchema.fields)) {
                            const subValue = item[subField];
                            
                            if (subSchema.required && (subValue === undefined || subValue === null || subValue === '')) {
                                errors.push(`В элементе ${idx + 1} поля "${subField}" обязательно`);
                            }
                            
                            if (subSchema.type === 'string' && subValue) {
                                if (subSchema.minLength && subValue.length < subSchema.minLength) {
                                    errors.push(`В элементе ${idx + 1} поле "${subField}" минимум ${subSchema.minLength} символов`);
                                }
                                if (subSchema.maxLength && subValue.length > subSchema.maxLength) {
                                    errors.push(`В элементе ${idx + 1} поле "${subField}" максимум ${subSchema.maxLength} символов`);
                                }
                            }
                        }
                    });
                }
            }
            
            // Валидация типа string
            if (fieldSchema.type === 'string' && typeof value === 'string') {
                if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
                    errors.push(`Поле "${fieldName}" минимум ${fieldSchema.minLength} символов`);
                }
                if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
                    errors.push(`Поле "${fieldName}" максимум ${fieldSchema.maxLength} символов`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
    
    // Загрузка зашифрованного файла
    async function loadEncryptedFile(filename, passphrase) {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error(`Файл не найден: ${response.status}`);
        }
        
        const encryptedData = await response.json();
        const data = await decrypt(encryptedData, passphrase);
        
        // Возвращаем также схему если есть
        return {
            data: data,
            schema: encryptedData.schema || null
        };
    }
    
    // Публичное API
    return {
        encrypt,
        decrypt,
        generateFilename,
        validate,
        loadEncryptedFile,
        normalizeStr,
        sha256
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EncCore;
}