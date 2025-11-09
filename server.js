// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Путь к файлу базы данных
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.json');

// Инициализация базы данных
let db = { users: {}, adHistory: [] };

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            db = JSON.parse(data);
            console.log('✅ База данных загружена');
        } else {
            saveDatabase();
            console.log('✅ Создана новая база данных');
        }
    } catch (err) {
        console.error('❌ Ошибка загрузки БД:', err);
        db = { users: {}, adHistory: [] };
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('❌ Ошибка сохранения БД:', err);
    }
}

// Загружаем БД при старте
loadDatabase();

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        users: Object.keys(db.users).length,
        ads: db.adHistory.length
    });
});

// API: Получить или создать профиль
app.post('/api/profile', (req, res) => {
    const { telegram_id, first_name, last_name } = req.body;

    if (!telegram_id || !first_name) {
        return res.status(400).json({ error: 'Telegram ID и имя обязательны' });
    }

    try {
        const userId = String(telegram_id);
        
        if (db.users[userId]) {
            // Обновляем last_active
            db.users[userId].last_active = new Date().toISOString();
            saveDatabase();
            return res.json(db.users[userId]);
        } else {
            // Создаём нового пользователя
            db.users[userId] = {
                telegram_id: telegram_id,
                first_name: first_name,
                last_name: last_name || '',
                balance: 0,
                ads_watched: 0,
                created_at: new Date().toISOString(),
                last_active: new Date().toISOString()
            };
            saveDatabase();
            return res.status(201).json(db.users[userId]);
        }
    } catch (error) {
        console.error('❌ Ошибка в /api/profile:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: Просмотр рекламы
app.post('/api/watch-ad', (req, res) => {
    const { telegram_id } = req.body;

    if (!telegram_id) {
        return res.status(400).json({ error: 'Telegram ID обязателен' });
    }

    try {
        const userId = String(telegram_id);
        
        if (!db.users[userId]) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const reward = 1;
        
        // Обновляем баланс
        db.users[userId].balance += reward;
        db.users[userId].ads_watched += 1;
        db.users[userId].last_active = new Date().toISOString();
        
        // Добавляем в историю
        db.adHistory.push({
            telegram_id: telegram_id,
            reward: reward,
            watched_at: new Date().toISOString()
        });
        
        saveDatabase();
        
        return res.json(db.users[userId]);
    } catch (error) {
        console.error('❌ Ошибка в /api/watch-ad:', error);
        return res.status(500).json({ error: 'Ошибка начисления награды' });
    }
});

// API: Статистика пользователя
app.get('/api/stats/:telegram_id', (req, res) => {
    const { telegram_id } = req.params;
    const userId = String(telegram_id);

    try {
        if (!db.users[userId]) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const userAds = db.adHistory.filter(ad => String(ad.telegram_id) === userId);
        const totalRewards = userAds.reduce((sum, ad) => sum + ad.reward, 0);

        return res.json({
            ...db.users[userId],
            total_ads: userAds.length,
            total_rewards: totalRewards
        });
    } catch (error) {
        console.error('❌ Ошибка в /api/stats:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API: История просмотров
app.get('/api/ad-history/:telegram_id', (req, res) => {
    const { telegram_id } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const userId = String(telegram_id);

    try {
        const history = db.adHistory
            .filter(ad => String(ad.telegram_id) === userId)
            .slice(-limit)
            .reverse();

        return res.json(history);
    } catch (error) {
        console.error('❌ Ошибка в /api/ad-history:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Сервер запущен на порту', PORT);
    console.log('📱 URL: http://localhost:' + PORT);
    console.log('👥 Пользователей:', Object.keys(db.users).length);
});

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n🛑 Завершение работы...');
    saveDatabase();
    console.log('✅ База данных сохранена');
    process.exit(0);
    }
