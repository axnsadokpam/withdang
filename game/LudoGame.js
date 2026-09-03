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
      return player;
    }
    return null;
  }

  getCurrentPlayer() {
    return this.players[this.currentTurnIndex];
  }

  rollDice(socketId) {
    const current = this.getCurrentPlayer();
    if (!current || current.id !== socketId) {
      return { success: false, message: 'Not your turn' };
    }
    if (this.phase !== 'ROLL' || this.status !== 'PLAYING') {
      return { success: false, message: 'Cannot roll right now' };
    }

    const roll = Math.floor(Math.random() * 6) + 1;
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
      message: current.name + ' rolled a ' + roll
    };
  }


  isPathBlocked(playerColor, fromStep, toStep) {
    if (toStep <= fromStep) return false;

    // Check intermediate and destination steps on the main track (1 to 51)
    for (let s = fromStep + 1; s <= toStep; s++) {
      if (s >= 1 && s <= 51) {
        const cellKey = board.getCellKey(playerColor, s);

        // Check if any opponent has 2 or more pawns on this cell
        for (const opp of this.players) {
          if (opp.color === playerColor) continue;
          const oppTokensOnCell = (this.tokens[opp.color] || []).filter(t => 
            t.step >= 1 && t.step <= 51 && board.getCellKey(opp.color, t.step) === cellKey
          );

          if (oppTokensOnCell.length >= 2) {
            return true; // Blocked by opponent defensive wall!
          }
        }
      }
    }
    return false;
  }

  getValidMoves(color, roll) {
    const tokens = this.tokens[color];
    const valid = [];

    for (const token of tokens) {
      if (token.step === 0) {
        if (roll === 6) {
          // Check if starting tile is blocked by opponent wall
          if (!this.isPathBlocked(color, 0, 1)) {
            valid.push(token.id);
          }
        }
      } else if (token.step + roll <= 57) {
        // Check if path is blocked by an opponent wall
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
        gameOver: true,
        winner: current
      };
    }

    const bonus = this.diceValue === 6 || captureOccurred;
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
    this.status = 'PLAYING';
    this.phase = 'ROLL';
    this.consecutiveSixes = 0;
    this.diceValue = null;
    this.winner = null;
    this.turnDeadline = Date.now() + 30000;
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
      phase: this.phase,
      tokens: this.tokens,
      winner: this.winner,
      turnDeadline: this.turnDeadline,
      matchStats: this.matchStats
    };
  }
}

module.exports = LudoGame;
