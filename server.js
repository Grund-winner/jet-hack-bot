const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// CORS - allow all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { rounds: {}, roundOrder: [], players: {} };
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
}

function ensureDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Health check
app.get('/api/health', (req, res) => {
  const data = readData();
  res.json({ status: 'alive', totalRounds: data.roundOrder.length });
});

// POST /api/collect - Receive data from userscript
app.post('/api/collect', (req, res) => {
  try {
    const { type, data } = req.body;
    ensureDir();
    const store = readData();

    if (type === 'round_end') {
      const roundId = data.roundId || `round_${Date.now()}`;
      const blueCoef = data.crashBlue || 1;
      const orangeCoef = data.crashOrange || 1;
      const winner = blueCoef > orangeCoef ? 'blue' : blueCoef < orangeCoef ? 'orange' : 'tie';

      store.rounds[roundId] = {
        id: roundId,
        roundId,
        winningCar: data.winningCar || winner,
        crashBlue: blueCoef,
        crashOrange: orangeCoef,
        totalBets: data.totalBets || 0,
        totalPlayers: data.totalPlayers || 0,
        durationSeconds: data.duration || 0,
        phase: 'crashed',
        createdAt: store.rounds[roundId]?.createdAt || new Date().toISOString(),
        endedAt: new Date().toISOString()
      };
      if (!store.roundOrder.includes(roundId)) {
        store.roundOrder.push(roundId);
        if (store.roundOrder.length > 1000) {
          const removed = store.roundOrder.shift();
          delete store.rounds[removed];
        }
      }
    } else if (type === 'round_start') {
      const roundId = data.roundId || `round_${Date.now()}`;
      if (!store.rounds[roundId]) {
        store.rounds[roundId] = {
          id: roundId, roundId, winningCar: '', crashBlue: 1, crashOrange: 1,
          totalBets: 0, totalPlayers: 0, durationSeconds: 0, phase: 'betting',
          createdAt: new Date().toISOString(), endedAt: null
        };
        if (!store.roundOrder.includes(roundId)) store.roundOrder.push(roundId);
      }
    } else if (type === 'history') {
      if (Array.isArray(data.rounds)) {
        for (const r of data.rounds) {
          const rid = r.roundId || r.id;
          if (!rid) continue;
          const bc = r.coefficients?.[0] || r.crashBlue || 1;
          const oc = r.coefficients?.[1] || r.crashOrange || 1;
          const w = r.winningCar || (bc > oc ? 'blue' : bc < oc ? 'orange' : 'tie');
          if (!store.rounds[rid]) {
            store.rounds[rid] = {
              id: rid, roundId: rid, winningCar: w, crashBlue: bc, crashOrange: oc,
              totalBets: 0, totalPlayers: 0, durationSeconds: 0, phase: 'crashed',
              createdAt: new Date().toISOString(), endedAt: new Date().toISOString()
            };
            store.roundOrder.push(rid);
          }
        }
        if (store.roundOrder.length > 1000) {
          store.roundOrder = store.roundOrder.slice(-1000);
        }
      }
    } else if (type === 'ping') {
      writeData(store);
      return res.json({ pong: true, totalRounds: store.roundOrder.length });
    }

    writeData(store);
    res.json({ success: true, type, totalRounds: store.roundOrder.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collect - Check status
app.get('/api/collect', (req, res) => {
  const data = readData();
  res.json({ collecting: data.roundOrder.length > 0, totalRounds: data.roundOrder.length });
});

// GET /api/stats - Get all stats
app.get('/api/stats', (req, res) => {
  try {
    const data = readData();
    const allRounds = data.roundOrder.map(id => data.rounds[id]).filter(Boolean).reverse();
    const totalRounds = allRounds.length;
    const blueWins = allRounds.filter(r => r.winningCar === 'blue').length;
    const orangeWins = allRounds.filter(r => r.winningCar === 'orange').length;

    const avgBlue = totalRounds > 0 ? allRounds.reduce((s,r) => s + r.crashBlue, 0) / totalRounds : 0;
    const avgOrange = totalRounds > 0 ? allRounds.reduce((s,r) => s + r.crashOrange, 0) / totalRounds : 0;
    const maxBlue = totalRounds > 0 ? Math.max(...allRounds.map(r => r.crashBlue)) : 0;
    const maxOrange = totalRounds > 0 ? Math.max(...allRounds.map(r => r.crashOrange)) : 0;

    // Streaks
    let currentStreak = 0, streakCar = '', maxBlueStreak = 0, maxOrangeStreak = 0;
    let tempBlue = 0, tempOrange = 0;
    for (const r of allRounds) {
      if (r.winningCar === 'blue') { tempBlue++; tempOrange = 0; maxBlueStreak = Math.max(maxBlueStreak, tempBlue); }
      else if (r.winningCar === 'orange') { tempOrange++; tempBlue = 0; maxOrangeStreak = Math.max(maxOrangeStreak, tempOrange); }
    }
    for (let i = 0; i < allRounds.length; i++) {
      if (i === 0) { streakCar = allRounds[i].winningCar; currentStreak = 1; }
      else if (allRounds[i].winningCar === streakCar) currentStreak++;
      else break;
    }

    // Distribution
    const blueRanges = { under1_5:0, x1_5_to_2:0, x2_to_3:0, x3_to_5:0, x5_to_10:0, over10:0 };
    const orangeRanges = { under1_5:0, x1_5_to_2:0, x2_to_3:0, x3_to_5:0, x5_to_10:0, over10:0 };
    function getRange(v) { if(v<1.5) return 'under1_5'; if(v<2) return 'x1_5_to_2'; if(v<3) return 'x2_to_3'; if(v<5) return 'x3_to_5'; if(v<10) return 'x5_to_10'; return 'over10'; }
    for (const r of allRounds) { blueRanges[getRange(r.crashBlue)]++; orangeRanges[getRange(r.crashOrange)]++; }

    const topPlayers = Object.values(data.players || []).sort((a,b) => b.totalProfit - a.totalProfit).slice(0,20);

    res.json({
      totalRounds, blueWins, orangeWins,
      blueWinRate: totalRounds > 0 ? ((blueWins/totalRounds)*100).toFixed(1) : '0',
      orangeWinRate: totalRounds > 0 ? ((orangeWins/totalRounds)*100).toFixed(1) : '0',
      avgCrashBlue: avgBlue.toFixed(2), avgCrashOrange: avgOrange.toFixed(2),
      maxCrashBlue: maxBlue.toFixed(2), maxCrashOrange: maxOrange.toFixed(2),
      totalBetsRecorded: allRounds.reduce((s,r) => s + r.totalBets, 0),
      totalPlayers: Object.keys(data.players || {}).length,
      topPlayers, recentRounds: allRounds.slice(0,50),
      currentStreak, streakCar, maxBlueStreak, maxOrangeStreak,
      blueRanges, orangeRanges
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Speed & Cash Backend running on port ' + PORT));
