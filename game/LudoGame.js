const board = require('./Board');
const { COLORS } = require('./constants');

class LudoGame {
  constructor(roomCode, maxPlayers = 4, hostColor = 'green', gameMode = 'quick') {
    this.gameMode = ['quick', 'classic'].includes(gameMode) ? gameMode : 'quick';
    this.targetGoals = this.gameMode === 'quick' ? 2 : 4;
    this.history = [];
    this.hostColor = ['green', 'red', 'yellow', 'blue'].includes(hostColor) ? hostColor : 'green';
    
    // Calculate balanced color mapping
    if (maxPlayers === 2) {
      const opposites = { green: 'blue', blue: 'green', red: 'yellow', yellow: 'red' };
      this.colorSequence = [this.hostColor, opposites[this.hostColor]];
    } else {
      const clockOrder = ['green', 'red', 'blue', 'yellow'];
      const startIdx = clockOrder.indexOf(this.hostColor);
      this.colorSequence = [];
      for (let i = 0; i < maxPlayers; i++) {
        this.colorSequence.push(clockOrder[(startIdx + i) % 4]);
      }
    }
    this.roomCode = roomCode;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.status = 'WAITING';
    this.currentTurnIndex = 0;
    this.diceValue = null;
    this.phase = 'ROLL';
    this.consecutiveSixes = 0;
    this.winner = null;
    this.turnDeadline = Date.now() + 30000;
    this.matchStats = {
      green: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      yellow: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      blue: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      red: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 }
    };
    this.lastActivity = Date.now();

    this.tokens = {
      green: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      yellow: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      blue: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      red: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }]
    };

    // Dynamic Drama & Pity Engine tracking
    this.turnsWithoutSix = { green: 0, yellow: 0, blue: 0, red: 0 };
    this.revengeBuffs = { green: false, yellow: false, blue: false, red: false };
  }

  addPlayer(socketId, name) {
    if (this.players.length >= this.maxPlayers) {
      return { success: false, message: 'Room is full' };
    }
    if (this.status !== 'WAITING') {
      return { success: false, message: 'Game already in progress' };
    }

    const color = this.colorSequence[this.players.length];

    const player = {
      id: socketId,
      name: name || ('Player ' + (this.players.length + 1)),
      color,
      isHost: this.players.length === 0,
      connected: true
    };

    this.players.push(player);

    if (this.players.length === this.maxPlayers) {
      this.players.forEach(p => { p.tokens = this.tokens[p.color]; });
    this.status = 'PLAYING';
      this.currentTurnIndex = 0;
      this.phase = 'ROLL';
    }

    return { success: true, player };
  }

  removePlayer(socketId) {
    const player = this.players.find(p => p.id === socketId);
    if (player) {
      player.connected = false;
      if (this.status === 'WAITING') {
        this.players = this.players.filter(p => p.id !== socketId);
      }
    }
    return player;
  }

  reconnectPlayer(socketId, playerName) {
    const player = this.players.find(p => p.name === playerName);
    if (player) {
      player.id = socketId;
      player.connected = true;
      player.isAway = false;
      return player;
    }
    return null;
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  calculateDynamicRoll(color) {
    const weights = [1, 1, 1, 1, 1, 1]; // Indices 0-5 corresponding to rolls 1-6

    // 1. PITY TIMER FOR YARDS: Ramp 6 probability if player is trapped in Yard
    const myTokens = this.tokens[color] || [];
    const hasTokensInYard = myTokens.some(t => t.step === 0);
    const turnsStuck = this.turnsWithoutSix[color] || 0;

    if (hasTokensInYard) {
      if (turnsStuck >= 5) {
        weights[5] += 4.5; // ~48% chance of rolling 6
        weights[4] += 1.5; // Also slight boost for 5
      } else if (turnsStuck >= 3) {
        weights[5] += 2.5; // ~32% chance of rolling 6
        weights[4] += 0.8;
      } else if (turnsStuck >= 2) {
        weights[5] += 1.0;
      }
    }

    // 2. STRIKE ZONE DRAMA (Clash Catalyst):
    // Add extra probability weight to the exact roll that knocks out an opponent pawn
    for (const t of myTokens) {
      if (t.step >= 1 && t.step <= 50) {
        for (let r = 1; r <= 6; r++) {
          const targetStep = t.step + r;
          if (targetStep <= 51 && !board.isPositionSafe(color, targetStep)) {
            const landingKey = board.getCellKey(color, targetStep);
            for (const opp of this.players) {
              if (opp.color === color) continue;
              for (const oppToken of (this.tokens[opp.color] || [])) {
                if (oppToken.step >= 1 && oppToken.step <= 51) {
                  if (board.getCellKey(opp.color, oppToken.step) === landingKey) {
                    weights[r - 1] += 2.2; // Strike zone fate weight!
                  }
                }
              }
            }
          }
        }
      }
    }

    // 3. UNDERDOG MOMENTUM (Rubber-Banding):
    const allPawnHomeCounts = Object.values(this.matchStats).map(s => s.pawnsHome || 0);
    const maxGoals = Math.max(0, ...allPawnHomeCounts);
    const myGoals = (this.matchStats[color] && this.matchStats[color].pawnsHome) || 0;
    if (maxGoals > myGoals) {
      weights[3] += 0.5; // 4
      weights[4] += 0.8; // 5
      weights[5] += 0.9; // 6
    }

    // Sample from weighted distribution
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < 6; i++) {
      if (rand < weights[i]) {
        return i + 1;
      }
      rand -= weights[i];
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  rollDice(socketId) {
    const current = this.getCurrentPlayer();
    if (!current || current.id !== socketId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.phase !== 'ROLL' || this.status !== 'PLAYING') {
      return { success: false, message: 'Cannot roll right now' };
    }

    const roll = this.calculateDynamicRoll(current.color);
    this.diceValue = roll;
    this.lastActivity = Date.now();
    this.history.push({
      time: Date.now(),
      type: 'ROLL',
      player: current.name,
      color: current.color,
      roll: roll
    });
    if (this.matchStats[current.color]) {
      this.matchStats[current.color].rolls++;
      if (roll === 6) this.matchStats[current.color].sixes++;
    }
    this.turnDeadline = Date.now() + 30000;

    // Update pity tracker
    if (roll === 6) {
      this.turnsWithoutSix[current.color] = 0;
    } else {
      this.turnsWithoutSix[current.color] = (this.turnsWithoutSix[current.color] || 0) + 1;
    }

    this.consecutiveSixes = roll === 6 ? this.consecutiveSixes + 1 : 0;

    if (this.consecutiveSixes === 3) {
      this.consecutiveSixes = 0;
      this.phase = 'ROLL';
      this.diceValue = null;
      this.passTurn();
      return {
        success: true,
        roll,
        threeSixes: true,
        turnPassed: true,
        validMoves: [],
        message: 'Three consecutive 6s! Turn forfeited.'
      };
    }

    const validMoves = this.getValidMoves(current.color, roll);

    if (validMoves.length === 0) {
      this.phase = 'ROLL';
      const prevRoll = this.diceValue;
      this.diceValue = null;
      this.passTurn();
      return {
        success: true,
        roll: prevRoll,
        validMoves: [],
        autoPass: true,
        turnPassed: true,
        message: 'No moves possible with ' + prevRoll
      };
    }

    this.phase = 'MOVE';
    return {
      success: true,
      roll,
      validMoves,
      hasRevenge: !!this.revengeBuffs[current.color],
      message: current.name + ' rolled a ' + roll
    };
  }


  isPathBlocked(playerColor, fromStep, toStep) {
    if (toStep <= fromStep) return false;

    // Check intermediate steps: jumping OVER an opponent wall is blocked!
    for (let s = fromStep + 1; s < toStep; s++) {
      if (s >= 1 && s <= 51) {
        const cellKey = board.getCellKey(playerColor, s);
        for (const opp of this.players) {
          if (opp.color === playerColor) continue;
          const oppTokensOnCell = (this.tokens[opp.color] || []).filter(t => 
            t.step >= 1 && t.step <= 51 && board.getCellKey(opp.color, t.step) === cellKey
          );

          if (oppTokensOnCell.length >= 2) {
            return true; // Blocked: cannot leap over an opponent wall!
          }
        }
      }
    }

    // Landing directly ON toStep:
    // Wall Smashing rule: rolling the exact count allows smashing into the wall!
    return false;
  }

  getValidMoves(color, roll) {
    const tokens = this.tokens[color];
    const valid = [];
    const hasRevenge = !!this.revengeBuffs[color];

    for (const token of tokens) {
      if (token.step === 0) {
        // Roll of 6 breaks out, or 5 if holding the Revenge Buff!
        if (roll === 6 || (hasRevenge && roll === 5)) {
          if (!this.isPathBlocked(color, 0, 1)) {
            valid.push(token.id);
          }
        }
      } else if (token.step + roll <= 57) {
        if (!this.isPathBlocked(color, token.step, token.step + roll)) {
          valid.push(token.id);
        }
      }
    }

    return valid;
  }

  moveToken(socketId, tokenId) {
    const current = this.getCurrentPlayer();
    if (!current || current.id !== socketId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.phase !== 'MOVE' || this.status !== 'PLAYING') {
      return { success: false, message: 'Cannot move right now' };
    }

    const validMoves = this.getValidMoves(current.color, this.diceValue);
    if (!validMoves.includes(tokenId)) {
      return { success: false, message: 'Invalid move for this token' };
    }

    const token = this.tokens[current.color].find(t => t.id === tokenId);
    const prevStep = token.step;

    // If escaping base with revenge buff, consume it
    if (prevStep === 0 && this.revengeBuffs[current.color]) {
      this.revengeBuffs[current.color] = false;
    }

    let captureOccurred = false;
    let capturedInfo = null;

    token.step = token.step === 0 ? 1 : token.step + this.diceValue;
    if (token.step === 57 && this.matchStats[current.color]) {
      this.matchStats[current.color].pawnsHome++;
    }
    this.turnDeadline = Date.now() + 30000;

    if (token.step >= 1 && token.step <= 51) {
      if (!board.isPositionSafe(current.color, token.step)) {
        const landingKey = board.getCellKey(current.color, token.step);

        for (const p of this.players) {
          if (p.color === current.color) continue;
          for (const opp of this.tokens[p.color]) {
            if (opp.step >= 1 && opp.step <= 51) {
              if (board.getCellKey(p.color, opp.step) === landingKey) {
                opp.step = 0;
                captureOccurred = true;
                // Award the victim a Revenge Buff for fast breakout on their turn!
                this.revengeBuffs[p.color] = true;

                if (this.matchStats[current.color]) {
                  this.matchStats[current.color].captures++;
                }
                capturedInfo = {
                  player: p.name,
                  color: p.color,
                  tokenId: opp.id
                };
                break;
              }
            }
          }
          if (captureOccurred) break;
        }
      }
    }

    const isSafeSpot = board.isPositionSafe(current.color, token.step);
    const isHomeGoal = token.step === 57;

    const homeCount = this.tokens[current.color].filter(t => t.step === 57).length;
    const won = homeCount >= this.targetGoals;
    if (won) {
      this.status = 'FINISHED';
      this.phase = 'GAME_OVER';
      this.winner = current;
      return {
        success: true,
        tokenId,
        prevStep,
        newStep: token.step,
        captureOccurred,
        capturedInfo,
        isSafeSpot,
        isHomeGoal,
        gameOver: true,
        winner: current
      };
    }

    const bonus = this.diceValue === 6 || captureOccurred || token.step === 57;
    const rolled = this.diceValue;
    this.phase = 'ROLL';
    this.diceValue = null;

    if (!bonus) {
      this.passTurn();
    }

    return {
      success: true,
      tokenId,
      prevStep,
      newStep: token.step,
      roll: rolled,
      captureOccurred,
      capturedInfo,
      isSafeSpot,
      isHomeGoal,
      getsBonusTurn: bonus,
      nextPlayer: this.getCurrentPlayer()
    };
  }

  passTurn() {
    this.consecutiveSixes = 0;
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    this.turnDeadline = Date.now() + 30000;
  }


  addBot() {
    if (this.players.length >= this.maxPlayers) return null;
    const color = this.colorSequence[this.players.length];
    const botId = 'bot_' + Math.random().toString(36).substring(2, 8);
    const botName = 'Bot ' + color.charAt(0).toUpperCase() + color.slice(1);
    const bot = {
      id: botId,
      name: botName,
      color,
      isHost: false,
      isBot: true,
      connected: true
    };
    this.players.push(bot);
    if (this.players.length === this.maxPlayers) {
      this.players.forEach(p => { p.tokens = this.tokens[p.color]; });
      this.status = 'PLAYING';
      this.currentTurnIndex = 0;
      this.phase = 'ROLL';
    }
    return bot;
  }

  getSmartBotMove(botId) {
    const player = this.players.find(p => p.id === botId);
    if (!player) return null;
    const valid = this.getValidMoves(player.color, this.diceValue);
    if (!valid || !valid.length) return null;

    const myTokens = this.tokens[player.color];

    // Priority 1: Capture an opponent pawn
    for (const tokenId of valid) {
      const t = myTokens[tokenId];
      const targetStep = t.step === 0 ? 1 : t.step + this.diceValue;
      if (targetStep <= 51 && !board.isPositionSafe(player.color, targetStep)) {
        const landingKey = board.getCellKey(player.color, targetStep);
        for (const opp of this.players) {
          if (opp.id !== botId) {
            for (const oppToken of this.tokens[opp.color]) {
              if (oppToken.step >= 1 && oppToken.step <= 51) {
                if (board.getCellKey(opp.color, oppToken.step) === landingKey) {
                  return tokenId;
                }
              }
            }
          }
        }
      }
    }

    // Priority 2: Move into Home Victory (step 57)
    for (const tokenId of valid) {
      const t = myTokens[tokenId];
      if (t.step + this.diceValue === 57) return tokenId;
    }

    // Priority 3: Move out of base onto track
    for (const tokenId of valid) {
      const t = myTokens[tokenId];
      if (t.step === 0) return tokenId;
    }

    // Priority 4: Move to a safe square
    for (const tokenId of valid) {
      const t = myTokens[tokenId];
      const targetStep = t.step + this.diceValue;
      if (targetStep <= 51 && board.isPositionSafe(player.color, targetStep)) {
        return tokenId;
      }
    }

    // Default: Advance pawn furthest along
    let best = valid[0];
    let maxStep = myTokens[best].step;
    for (const id of valid) {
      if (myTokens[id].step > maxStep) {
        maxStep = myTokens[id].step;
        best = id;
      }
    }
    return best;
  }


  resetForRematch() {
    this.tokens = {
      green: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      yellow: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      blue: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }],
      red: [{ id: 0, step: 0 }, { id: 1, step: 0 }, { id: 2, step: 0 }, { id: 3, step: 0 }]
    };
    this.players.forEach(p => { p.tokens = this.tokens[p.color]; });
    this.status = 'PLAYING';
    this.currentTurnIndex = 0;
    this.phase = 'ROLL';
    this.consecutiveSixes = 0;
    this.diceValue = null;
    this.winner = null;
    this.turnDeadline = Date.now() + 30000;
    this.turnsWithoutSix = { green: 0, yellow: 0, blue: 0, red: 0 };
    this.revengeBuffs = { green: false, yellow: false, blue: false, red: false };
    this.matchStats = {
      green: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      yellow: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      blue: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
      red: { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 }
    };
  }

  getPublicState() {
    return {
      roomCode: this.roomCode,
      maxPlayers: this.maxPlayers,
      gameMode: this.gameMode,
      targetGoals: this.targetGoals,
      status: this.status,
      players: this.players.map(p => ({
        ...p,
        stats: this.matchStats[p.color] || { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 },
        hasRevenge: !!this.revengeBuffs[p.color],
        tokens: this.tokens[p.color] || [
          { id: 0, step: 0 },
          { id: 1, step: 0 },
          { id: 2, step: 0 },
          { id: 3, step: 0 }
        ]
      })),
      currentTurn: this.getCurrentPlayer() ? this.getCurrentPlayer().color : null,
      currentTurnPlayer: this.getCurrentPlayer(),
      diceValue: this.diceValue,
      lastRoll: this.diceValue,
      validMoves: (this.phase === 'MOVE' && this.diceValue && this.getCurrentPlayer()) ? this.getValidMoves(this.getCurrentPlayer().color, this.diceValue) : [],
      phase: this.phase,
      tokens: this.tokens,
      winner: this.winner,
      turnDeadline: this.turnDeadline,
      matchStats: this.matchStats,
      revengeBuffs: this.revengeBuffs
    };
  }
}

module.exports = LudoGame;
