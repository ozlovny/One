// server.js
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Инициализация базы данных
let db;
try {
    const dbPath = process.env.DATABASE_PATH || './database.db';
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    console.log('Подключено к SQLite базе данных');
    initDatabase();
} catch (err) {
    console.error('Ошибка подключения к БД:', err);
    process.exit(1);
}

// Создание таблиц
function initDatabase() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT,
                balance INTEGER DEFAULT 0,
                ads_watched INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Таблица users готова');

        db.exec(`
            CREATE TABLE IF NOT EXISTS ad_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                reward INTEGER DEFAULT 1,
                watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log('Таблица ad_history готова');
    } catch (err) {
        console.error('Ошибка создания таблиц:', err);
    }
}

// Health check для Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: Получить или создать профиль пользователя
app.post('/api/profile', (req, res) => {
    const { telegram_id, first_name, last_name } = req.body;

    if (!telegram_id || !first_name) {
        return res.status(400).json({ error: 'Telegram ID и имя обязательны' });
    }

    try {
        // Проверяем существование пользователя
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);

        if (user) {
            // Обновляем last_active
            db.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_id = ?').run(telegram_id);
            return res.json(user);
        } else {
            // Создаем нового пользователя
            const insert = db.prepare('INSERT INTO users (telegram_id, first_name, last_name) VALUES (?, ?, ?)');
            const result = insert.run(telegram_id, first_name, last_name || '');
            
            const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
            return res.status(201).json(newUser);
        }
    } catch (error) {
        console.error('Ошибка в /api/profile:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: Просмотр рекламы и начисление награды
app.post('/api/watch-ad', (req, res) => {
    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Telegram ID обязателен' });
    }

    try {
        // Получаем пользователя
        const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const reward = 1;

        // Начинаем транзакцию
        const transaction = db.transaction(() => {
            // Обновляем баланс и счетчик
            db.prepare(`
                UPDATE users 
                SET balance = balance + ?, 
                    ads_watched = ads_watched + 1,
                    last_active = CURRENT_TIMESTAMP 
                WHERE telegram_id = ?
            `).run(reward, telegram_id);

            // Записываем в историю
            db.prepare('INSERT INTO ad_history (user_id, reward) VALUES (?, ?)').run(user.id, reward);
        });

        transaction();

        // Получаем обновленные данные
        const updatedUser = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegram_id);
        return res.json(updatedUser);

    } catch (error) {
        console.error('Ошибка в /api/watch-ad:', error);
        return res.status(500).json({ error: 'Ошибка начисления награды' });
    }
});

// API: Получить статистику пользователя
app.get('/api/stats/:telegram_id', (req, res) => {
    const { telegram_id } = req.params;

    try {
        const stats = db.prepare(`
            SELECT 
                u.*,
                COUNT(ah.id) as total_ads,
                IFNULL(SUM(ah.reward), 0) as total_rewards
            FROM users u
            LEFT JOIN ad_history ah ON u.id = ah.user_id
            WHERE u.telegram_id = ?
            GROUP BY u.id
        `).get(telegram_id);

        if (!stats) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json(stats);
    } catch (error) {
        console.error('Ошибка в /api/stats:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: Получить историю просмотров рекламы
app.get('/api/ad-history/:telegram_id', (req, res) => {
    const { telegram_id } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const history = db.prepare(`
            SELECT ah.* 
            FROM ad_history ah
            JOIN users u ON ah.user_id = u.id
            WHERE u.telegram_id = ?
            ORDER BY ah.watched_at DESC
            LIMIT ?
        `).all(telegram_id, limit);

        return res.json(history);
    } catch (error) {
        console.error('Ошибка в /api/ad-history:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📱 URL: http://localhost:${PORT}`);
    console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
});

// Корректное закрытие при завершении
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n🛑 Получен сигнал завершения...');
    try {
        db.close();
        console.log('✅ База данных закрыта');
    } catch (err) {
        console.error('Ошибка закрытия БД:', err);
    }
    process.exit(0);
}
