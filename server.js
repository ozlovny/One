const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static('public'));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.json');
let db = { users: {}, caseHistory: [] };

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            db = JSON.parse(data);
            console.log('✅ База загружена:', Object.keys(db.users).length, 'пользователей');
        } else {
            saveDatabase();
            console.log('✅ Создана новая база');
        }
    } catch (err) {
        console.error('❌ Ошибка загрузки БД:', err);
        db = { users: {}, caseHistory: [] };
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        console.log('💾 База сохранена');
    } catch (err) {
        console.error('❌ Ошибка сохранения БД:', err);
    }
}

loadDatabase();

// Health check
app.get('/health', (req, res) => {
    console.log('📊 Health check');
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        users: Object.keys(db.users).length,
        cases: db.caseHistory.length
    });
});

// Profile
app.post('/api/profile', (req, res) => {
    console.log('📝 POST /api/profile:', req.body);
    const { telegram_id, first_name, last_name } = req.body;

    if (!telegram_id || !first_name) {
        return res.status(400).json({ error: 'Telegram ID и имя обязательны' });
    }

    try {
        const userId = String(telegram_id);
        
        if (db.users[userId]) {
            db.users[userId].last_active = new Date().toISOString();
            saveDatabase();
            console.log('✅ Пользователь найден:', userId);
            return res.json(db.users[userId]);
        } else {
            db.users[userId] = {
                telegram_id: telegram_id,
                first_name: first_name,
                last_name: last_name || '',
                balance: 0,
                cases_opened: 0,
                created_at: new Date().toISOString(),
                last_active: new Date().toISOString()
            };
            saveDatabase();
            console.log('✅ Новый пользователь создан:', userId);
            return res.status(201).json(db.users[userId]);
        }
    } catch (error) {
        console.error('❌ Ошибка в /api/profile:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Open case
app.post('/api/open-case', (req, res) => {
    console.log('🎁 POST /api/open-case:', req.body);
    const { telegram_id, case_id, price, reward } = req.body;

    if (!telegram_id || !case_id) {
        return res.status(400).json({ error: 'Telegram ID и case_id обязательны' });
    }

    try {
        const userId = String(telegram_id);
        
        if (!db.users[userId]) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверка баланса
        if (price > db.users[userId].balance) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Списываем стоимость и добавляем награду
        db.users[userId].balance = db.users[userId].balance - price + reward;
        db.users[userId].cases_opened = (db.users[userId].cases_opened || 0) + 1;
        db.users[userId].last_active = new Date().toISOString();
        
        // Добавляем в историю
        db.caseHistory.push({
            telegram_id: telegram_id,
            case_id: case_id,
            price: price,
            reward: reward,
            opened_at: new Date().toISOString()
        });
        
        saveDatabase();
        console.log('✅ Кейс открыт:', userId, case_id);
        
        return res.json(db.users[userId]);
    } catch (error) {
        console.error('❌ Ошибка в /api/open-case:', error);
        return res.status(500).json({ error: 'Ошибка открытия кейса' });
    }
});

// Stats
app.get('/api/stats/:telegram_id', (req, res) => {
    console.log('📊 GET /api/stats:', req.params.telegram_id);
    const { telegram_id } = req.params;
    const userId = String(telegram_id);

    try {
        if (!db.users[userId]) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const userCases = db.caseHistory.filter(c => String(c.telegram_id) === userId);
        const totalRewards = userCases.reduce((sum, c) => sum + c.reward, 0);
        const totalSpent = userCases.reduce((sum, c) => sum + c.price, 0);

        return res.json({
            ...db.users[userId],
            total_cases: userCases.length,
            total_rewards: totalRewards,
            total_spent: totalSpent
        });
    } catch (error) {
        console.error('❌ Ошибка в /api/stats:', error);
        return res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Сервер запущен на порту', PORT);
    console.log('📍 https://one-production-9063.up.railway.app');
    console.log('👥 Пользователей:', Object.keys(db.users).length);
});

// Shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n🛑 Завершение...');
    saveDatabase();
    console.log('✅ База сохранена');
    process.exit(0);
                            }
