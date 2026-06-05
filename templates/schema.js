// Схема для валидации данных
const ENC_SCHEMA = {
    type: "encrypted_data",
    version: "1.0",
    fields: {
        buttons: {
            type: "array",
            required: true,
            minItems: 1,
            maxItems: 20,
            itemSchema: {
                type: "object",
                fields: {
                    text: {
                        type: "string",
                        required: true,
                        minLength: 1,
                        maxLength: 50,
                        label: "Текст кнопки",
                        placeholder: "Например: Помощь"
                    },
                    message: {
                        type: "string",
                        required: true,
                        minLength: 1,
                        maxLength: 500,
                        label: "Текст уведомления",
                        placeholder: "Что отправить в Telegram"
                    }
                }
            }
        }
    }
};

// Шаблон для генератора
const ENC_TEMPLATE = {
    notifications: {
        telegram: {
            botToken: "123:AAA",
            chatId: "987654321"
        }
    },
    buttons: [
        { text: "Кнопка 1", message: "Месседж 1" }
    ]
};

// Placeholder для текстового поля
const ENC_PLACEHOLDER = JSON.stringify(ENC_TEMPLATE, null, 4);

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENC_SCHEMA, ENC_TEMPLATE, ENC_PLACEHOLDER };
}