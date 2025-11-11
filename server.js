const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type']}));
app.use(express.json());
app.use(express.static('public'));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.json');
let db = { users: {}, sessions: {}, inventory: {} };

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            console.log('✅ База загружена');
        } else {
            saveDB();
        }
    } catch (err) {
        console.error('❌ Ошибка загрузки БД:', err);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('❌ Ошибка сохранения БД:', err);
    }
}

loadDB();

// Призы для Free кейса (25 призов)
const FREE_PRIZES = [
    {id: 1, name: 'Plush Pepe', image: 'https://img.icons8.com/fluency/96/frog.png', chance: 2},
    {id: 2, name: 'Rare Doge', image: 'https://img.icons8.com/fluency/96/doge.png', chance: 3},
    {id: 3, name: 'Crypto Cat', image: 'https://img.icons8.com/fluency/96/cat.png', chance: 4},
    {id: 4, name: 'Moon Rocket', image: 'https://img.icons8.com/fluency/96/rocket.png', chance: 4},
    {id: 5, name: 'Diamond Hand', image: 'https://img.icons8.com/fluency/96/diamond.png', chance: 4},
    {id: 6, name: 'Gold Coin', image: 'https://img.icons8.com/fluency/96/coin.png', chance: 5},
    {id: 7, name: 'Lucky Clover', image: 'https://img.icons8.com/fluency/96/four-leaf-clover.png', chance: 5},
    {id: 8, name: 'Magic Wand', image: 'https://img.icons8.com/fluency/96/magic-wand.png', chance: 5},
    {id: 9, name: 'Crown', image: 'https://img.icons8.com/fluency/96/crown.png', chance: 5},
    {id: 10, name: 'Fire', image: 'https://img.icons8.com/fluency/96/fire.png', chance: 5},
    {id: 11, name: 'Lightning', image: 'https://img.icons8.com/fluency/96/lightning-bolt.png', chance: 5},
    {id: 12, name: 'Trophy', image: 'https://img.icons8.com/fluency/96/trophy.png', chance: 5},
    {id: 13, name: 'Gift Box', image: 'https://img.icons8.com/fluency/96/gift.png', chance: 5},
    {id: 14, name: 'Party Popper', image: 'https://img.icons8.com/fluency/96/party-popper.png', chance: 5},
    {id: 15, name: 'Gem Stone', image: 'https://img.icons8.com/fluency/96/gemstone.png', chance: 5},
    {id: 16, name: 'Star Badge', image: 'https://img.icons8.com/fluency/96/star-badge.png', chance: 4},
    {id: 17, name: 'Medal', image: 'https://img.icons8.com/fluency/96/medal.png', chance: 4},
    {id: 18, name: 'Alien', image: 'https://img.icons8.com/fluency/96/alien.png', chance: 4},
    {id: 19, name: 'Robot', image: 'https://img.icons8.com/fluency/96/robot.png', chance: 3},
    {id: 20, name: 'Unicorn', image: 'https://img.icons8.com/fluency/96/unicorn.png', chance: 3},
    {id: 21, name: 'Dragon', image: 'https://img.icons8.com/fluency/96/dragon.png', chance: 3},
    {id: 22, name: 'Phoenix', image: 'https://img.icons8.com/fluency/96/phoenix.png', chance: 2},
    {id: 23, name: 'Wizard Hat', image: 'https://img.icons8.com/fluency/96/wizard.png', chance: 2},
    {id: 24, name: 'Legendary Sword', image: 'https://img.icons8.com/fluency/96/sword.png', chance: 1},
    {id: 25, name: 'Jackpot!', image: 'https://github.com/ozlovny/One/blob/main/ezgif-4f1cfc543d4b511c.webp', chance: 24}
];

// Кейсы
const CASES = [
    {
        id: 'free',
        name: 'Free Box',
        image: 'https://img.icons8.com/fluency/96/gift-box.png',
        price: 0,
        is_free: true,
        prizes: FREE_PRIZES
    },
    {
        id: 'basic',
        name: 'Basic Case',
        image: 'https://img.icons8.com/fluency/96/box.png',
        price: 50,
        is_free: false,
        prizes: FREE_PRIZES
    },
    {
        id: 'premium',
        name: 'Premium Case',
        image: 'https://img.icons8.com/fluency/96/treasure-chest.png',
        price: 150,
        is_free: false,
        prizes: FREE_PRIZES
    },
    {
        id: 'legendary',
        name: 'Legendary Case',
        image: 'https://img.icons8.com/fluency/96/crown.png',
        price: 300,
        is_free: false,
        prizes: FREE_PRIZES
    }
];

function getRandomPrize(prizes) {
    const totalChance = prizes.reduce((sum, p) => sum + p.chance, 0);
    let random = Math.random() * totalChance;
    
    for (let prize of prizes) {
        if (random < prize.chance) {
            return prize;
        }
        random -= prize.chance;
    }
    return prizes[prizes.length - 1];
}

function generateRoulette(winningPrize, allPrizes) {
    const items = [];
    const winningIndex = 25; // Позиция победы (середина из 51)
    
    // Генерируем 51 элемент
    for (let i = 0; i < 51; i++) {
        if (i === winningIndex) {
            items.push(winningPrize);
        } else {
            const randomPrize = allPrizes[Math.floor(Math.random() * allPrizes.length)];
            items.push(randomPrize);
        }
    }
    
    return { items, winning_index: winningIndex };
}

// Инициализация пользователя
app.post('/api/init', (req, res) => {
    const { telegram_id, first_name, last_name } = req.body;
    const userId = String(telegram_id);
    
    if (!db.users[userId]) {
        db.users[userId] = {
            telegram_id,
            first_name,
            last_name: last_name || '',
            balance: 0,
            cases_opened: 0,
            created_at: new Date().toISOString()
        };
        db.inventory[userId] = [];
        saveDB();
    }
    
    res.json(db.users[userId]);
});

// Получить список кейсов
app.get('/api/cases', (req, res) => {
    res.json(CASES.map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        price: c.price,
        is_free: c.is_free
    })));
});

// Подготовка к открытию (генерация рулетки)
app.post('/api/prepare-opening', (req, res) => {
    const { telegram_id, case_id } = req.body;
    const userId = String(telegram_id);
    
    if (!db.users[userId]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    const caseData = CASES.find(c => c.id === case_id);
    if (!caseData) {
        return res.status(404).json({ error: 'Кейс не найден' });
    }
    
    // Проверка баланса
    if (caseData.price > db.users[userId].balance) {
        return res.status(400).json({ error: 'Недостаточно средств' });
    }
    
    // Генерируем выигрышный приз
    const winningPrize = getRandomPrize(caseData.prizes);
    
    // Генерируем рулетку
    const roulette = generateRoulette(winningPrize, caseData.prizes);
    
    // Создаём сессию
    const sessionId = crypto.randomBytes(16).toString('hex');
    db.sessions[sessionId] = {
        user_id: userId,
        case_id: case_id,
        winning_prize: winningPrize,
        winning_index: roulette.winning_index,
        created_at: Date.now()
    };
    
    // Очищаем старые сессии (старше 10 минут)
    const now = Date.now();
    Object.keys(db.sessions).forEach(sid => {
        if (now - db.sessions[sid].created_at > 10 * 60 * 1000) {
            delete db.sessions[sid];
        }
    });
    
    saveDB();
    
    res.json({
        session_id: sessionId,
        items: roulette.items,
        winning_index: roulette.winning_index
    });
});

// Открытие кейса
app.post('/api/open-case', (req, res) => {
    const { telegram_id, case_id, session_id } = req.body;
    const userId = String(telegram_id);
    
    if (!db.users[userId]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (!db.sessions[session_id]) {
        return res.status(400).json({ error: 'Неверная сессия' });
    }
    
    const session = db.sessions[session_id];
    if (session.user_id !== userId || session.case_id !== case_id) {
        return res.status(400).json({ error: 'Неверная сессия' });
    }
    
    const caseData = CASES.find(c => c.id === case_id);
    if (!caseData) {
        return res.status(404).json({ error: 'Кейс не найден' });
    }
    
    // Проверка баланса
    if (caseData.price > db.users[userId].balance) {
        return res.status(400).json({ error: 'Недостаточно средств' });
    }
    
    // Списываем деньги
    db.users[userId].balance -= caseData.price;
    db.users[userId].cases_opened = (db.users[userId].cases_opened || 0) + 1;
    
    // Добавляем приз в инвентарь
    db.inventory[userId].push({
        ...session.winning_prize,
        obtained_at: new Date().toISOString()
    });
    
    // Удаляем сессию
    delete db.sessions[session_id];
    
    saveDB();
    
    res.json({
        prize: session.winning_prize,
        winning_index: session.winning_index,
        user: db.users[userId]
    });
});

// Профиль
app.get('/api/profile/:telegram_id', (req, res) => {
    const userId = String(req.params.telegram_id);
    
    if (!db.users[userId]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
        ...db.users[userId],
        inventory: db.inventory[userId] || []
    });
});

// Добавить баланс (для тестов)
app.post('/api/add-balance', (req, res) => {
    const { telegram_id, amount } = req.body;
    const userId = String(telegram_id);
    
    if (!db.users[userId]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    db.users[userId].balance += amount;
    saveDB();
    
    res.json(db.users[userId]);
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        users: Object.keys(db.users).length,
        sessions: Object.keys(db.sessions).length
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 Сервер запущен на', PORT);
});

process.on('SIGINT', () => {
    saveDB();
    process.exit(0);
});
