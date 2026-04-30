const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));

const GAME_BASE = 'https://crash-gateway-grm-cr.gamedev-tech.cc';

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Auth-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ==================== DATA STORAGE ====================

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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

function getRange(v) {
  if (v < 1.5) return 'under1_5';
  if (v < 2) return 'x1_5_to_2';
  if (v < 3) return 'x2_to_3';
  if (v < 5) return 'x3_to_5';
  if (v < 10) return 'x5_to_10';
  return 'over10';
}

function recordRound(store, roundData) {
  const { roundId, winningCar, crashBlue, crashOrange, totalBets, totalPlayers, durationSeconds, phase } = roundData;
  if (!roundId) return;
  
  store.rounds[roundId] = {
    id: roundId, roundId, winningCar: winningCar || 'blue',
    crashBlue: crashBlue || 1, crashOrange: crashOrange || 1,
    totalBets: totalBets || 0, totalPlayers: totalPlayers || 0,
    durationSeconds: durationSeconds || 0, phase: phase || 'crashed',
    createdAt: store.rounds[roundId]?.createdAt || new Date().toISOString(),
    endedAt: new Date().toISOString()
  };
  
  if (!store.roundOrder.includes(roundId)) {
    store.roundOrder.push(roundId);
    if (store.roundOrder.length > 2000) {
      const removed = store.roundOrder.shift();
      delete store.rounds[removed];
    }
  }
}

// ==================== API: GAME PROXY ====================

app.post('/api/proxy', async (req, res) => {
  try {
    const { action, authToken, sessionId, customerId } = req.body;
    
    if (action === 'authenticate') {
      if (!authToken) return res.status(400).json({ error: 'Token requis' });
      
      const r = await fetch(`${GAME_BASE}/user/auth`, {
        method: 'POST',
        headers: { 'Auth-Token': authToken, 'Content-Type': 'application/json' },
      });
      const text = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: `Auth echouee: ${r.status}`, details: text });
      
      const data = JSON.parse(text);
      const sid = data.sessionId || data.session_id || '';
      const cid = data.customerId || data.customer_id || '';
      if (!sid || !cid) return res.status(500).json({ error: 'Reponse auth invalide', raw: data });
      
      return res.json({ sessionId: sid, customerId: cid });
    }
    
    if (action === 'state') {
      if (!sessionId || !customerId) return res.status(400).json({ error: 'Credentials requises' });
      
      const r = await fetch(`${GAME_BASE}/state`, {
        headers: { 'Session-Id': sessionId, 'Customer-Id': customerId },
      });
      if (r.status === 401 || r.status === 403) return res.status(401).json({ error: 'Token expire', expired: true });
      if (!r.ok) return res.status(r.status).json({ error: `Erreur API: ${r.status}` });
      
      const data = await r.json();
      return res.json({ ...data, connected: true });
    }
    
    if (action === 'history') {
      if (!sessionId || !customerId) return res.status(400).json({ error: 'Credentials requises' });
      
      const limit = req.body.limit || 50;
      const r = await fetch(`${GAME_BASE}/history/last?limit=${limit}`, {
        headers: { 'Session-Id': sessionId, 'Customer-Id': customerId },
      });
      if (r.status === 401 || r.status === 403) return res.status(401).json({ error: 'Token expire', expired: true });
      if (!r.ok) return res.status(r.status).json({ error: `Erreur API: ${r.status}` });
      
      const data = await r.json();
      const rounds = data.history || data.rounds || (Array.isArray(data) ? data : []);
      
      // Store rounds
      ensureDir();
      const store = readData();
      for (const rd of rounds) {
        try {
          const cf = rd.coefficients || rd.cars || [];
          const crashBlue = (cf[0] && (cf[0].value || cf[0].coefficient || cf[0])) || 1;
          const crashOrange = (cf[1] && (cf[1].value || cf[1].coefficient || cf[1])) || 1;
          const winIdx = rd.winner ?? rd.winningCar;
          const winningCar = winIdx === 0 || winIdx === 'blue' ? 'blue' : 'orange';
          
          recordRound(store, {
            roundId: rd.id || rd.roundId || `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            winningCar,
            crashBlue: typeof crashBlue === 'number' ? crashBlue : parseFloat(crashBlue) || 1,
            crashOrange: typeof crashOrange === 'number' ? crashOrange : parseFloat(crashOrange) || 1,
            totalBets: rd.betCount || rd.totalBets || 0,
            totalPlayers: rd.playersCount || rd.totalPlayers || 0,
            durationSeconds: rd.duration || 0,
            phase: rd.phase || rd.state || 'crashed',
          });
        } catch (e) { /* skip */ }
      }
      writeData(store);
      
      return res.json({ rounds, connected: true });
    }
    
    res.status(400).json({ error: 'Action inconnue' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== API: COLLECT (legacy userscript) ====================

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

      recordRound(store, {
        roundId,
        winningCar: data.winningCar || winner,
        crashBlue: blueCoef,
        crashOrange: orangeCoef,
        totalBets: data.totalBets || 0,
        totalPlayers: data.totalPlayers || 0,
        durationSeconds: data.duration || 0,
        phase: 'crashed',
      });
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
        if (store.roundOrder.length > 2000) store.roundOrder = store.roundOrder.slice(-2000);
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

app.get('/api/collect', (req, res) => {
  const data = readData();
  res.json({ collecting: data.roundOrder.length > 0, totalRounds: data.roundOrder.length });
});

// ==================== API: STATS ====================

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

    const blueRanges = { under1_5:0, x1_5_to_2:0, x2_to_3:0, x3_to_5:0, x5_to_10:0, over10:0 };
    const orangeRanges = { under1_5:0, x1_5_to_2:0, x2_to_3:0, x3_to_5:0, x5_to_10:0, over10:0 };
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

// Health
app.get('/api/health', (req, res) => {
  const data = readData();
  res.json({ status: 'alive', totalRounds: data.roundOrder.length, version: '3.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Speed & Cash Monitor v3.0 running on port ${PORT}`));
