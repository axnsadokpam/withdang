const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const LudoGame = require('./game/LudoGame');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const rooms = {};

app.use(express.static(path.join(__dirname, 'public')));

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}


function executeBotMove(roomCode, game, liveCurrent) {
  if (!rooms[roomCode] || game.status !== 'PLAYING') return;
  const valid = game.getValidMoves(liveCurrent.color, game.diceValue);
  if (!valid || valid.length === 0) {
    game.phase = 'ROLL';
    game.diceValue = null;
    game.passTurn();
    io.to(roomCode).emit('dice-rolled', {
      player: liveCurrent,
      gameState: game.getPublicState(),
      turnPassed: true,
      autoPass: true
    });
    setTimeout(() => handleBotTurn(roomCode), 400);
    return;
  }

  let bestTokenId = game.getSmartBotMove(liveCurrent.id);
  if (bestTokenId === null || !valid.includes(bestTokenId)) {
    bestTokenId = valid[0];
  }

  const moveRes = game.moveToken(liveCurrent.id, bestTokenId);
  if (!moveRes.success) {
    game.phase = 'ROLL';
    game.diceValue = null;
    game.passTurn();
    io.to(roomCode).emit('dice-rolled', {
      player: liveCurrent,
      gameState: game.getPublicState(),
      turnPassed: true
    });
    setTimeout(() => handleBotTurn(roomCode), 400);
    return;
  }

  io.to(roomCode).emit('token-moved', {
    player: liveCurrent,
    tokenId: moveRes.tokenId,
    prevStep: moveRes.prevStep,
    newStep: moveRes.newStep,
    roll: moveRes.roll,
    captureOccurred: moveRes.captureOccurred,
    capturedInfo: moveRes.capturedInfo,
    getsBonusTurn: moveRes.getsBonusTurn,
    gameOver: moveRes.gameOver,
    winner: moveRes.winner,
    gameState: game.getPublicState()
  });

  if (!moveRes.gameOver) {
    const hopSteps = Math.max(1, Math.abs(moveRes.newStep - moveRes.prevStep));
    const animDuration = (moveRes.prevStep === 0 ? 1 : hopSteps) * 140;
    const nextDelay = animDuration + 450;
    setTimeout(() => handleBotTurn(roomCode), nextDelay);
  }
}

function handleBotTurn(roomCode) {
  const game = rooms[roomCode];
  if (!game || game.status !== 'PLAYING') return;

  const current = game.getCurrentPlayer();
  if (!current || !current.isBot) return;

  setTimeout(() => {
    if (!rooms[roomCode]) return;
    const liveCurrent = game.getCurrentPlayer();
    if (!liveCurrent || !liveCurrent.isBot) return;

    // If bot already has a pending move
    if (game.phase === 'MOVE') {
      executeBotMove(roomCode, game, liveCurrent);
      return;
    }

    if (game.phase === 'ROLL') {
      const rollRes = game.rollDice(liveCurrent.id);
      if (!rollRes.success) {
        if (game.phase === 'MOVE') {
          executeBotMove(roomCode, game, liveCurrent);
        }
        return;
      }

      io.to(roomCode).emit('dice-rolled', {
        power: 1.0 + Math.random() * 0.35,
        player: liveCurrent,
        roll: rollRes.roll,
        validMoves: rollRes.validMoves || [],
        autoPass: rollRes.autoPass || false,
        turnPassed: rollRes.turnPassed || rollRes.autoPass || false,
        threeSixes: rollRes.threeSixes || false,
        gameState: game.getPublicState()
      });

      if (rollRes.turnPassed || rollRes.autoPass || rollRes.threeSixes) {
        setTimeout(() => handleBotTurn(roomCode), 700);
        return;
      }

      setTimeout(() => {
        executeBotMove(roomCode, game, liveCurrent);
      }, 750);
    }
  }, 240);
}

io.on('connection', (socket) => {
  socket.on('create-room', ({ playerName, maxPlayers, preferredColor, gameMode }) => {
    const code = generateRoomCode();
    const capacity = parseInt(maxPlayers, 10) || 4;
    const game = new LudoGame(code, capacity, preferredColor, gameMode);

    const res = game.addPlayer(socket.id, playerName);
    rooms[code] = game;
    socket.join(code);
    socket.roomCode = code;
    socket.playerName = res.player.name;

    socket.emit('room-created', {
      roomCode: code,
      player: res.player,
      gameState: game.getPublicState()
    });
  });

  socket.on('join-room', ({ roomCode, playerName, playerColor }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const game = rooms[code];

    if (!game) {
      return socket.emit('error-msg', { message: 'Room not found. Check code or create a table.' });
    }

    // Try finding existing player by color, then by matching name
    let existing = null;
    if (playerColor) {
      existing = game.players.find(p => p.color === playerColor);
    }
    if (!existing && playerName) {
      const cleanName = playerName.trim().toLowerCase();
      if (game.status === 'WAITING') {
        // In WAITING, only match if the player is disconnected or already this socket
        existing = game.players.find(p => p.id === socket.id || (!p.connected && p.name.toLowerCase() === cleanName));
      } else {
        existing = game.players.find(p => p.name.toLowerCase() === cleanName);
      }
    }
    if (!existing && game.status === 'PLAYING') {
      // Reconnect to a disconnected/away seat if available
      existing = game.players.find(p => (!p.connected || p.isAway) && !p.isBot);
    }

    if (existing) {
      game.reconnectPlayer(socket.id, existing.name);
      existing.isAway = false;
      existing.connected = true;
      socket.join(code);
      socket.roomCode = code;
      socket.playerName = existing.name;

      const pubState = game.getPublicState();
      socket.emit('room-joined', {
        roomCode: code,
        player: existing,
        gameState: pubState
      });
      socket.emit('game-updated', {
        gameState: pubState,
        player: existing
      });
      socket.to(code).emit('game-updated', {
        gameState: pubState,
        message: existing.name + ' reconnected'
      });
      return;
    }

    // If game is already running and no existing seat matched, reject
    if (game.status !== 'WAITING') {
      return socket.emit('error-msg', { message: 'Game already in progress.' });
    }

    // Disambiguate duplicate names in WAITING lobby
    let chosenName = (playerName || '').trim() || ('Player ' + (game.players.length + 1));
    if (game.players.some(p => p.name.toLowerCase() === chosenName.toLowerCase())) {
      let counter = 2;
      while (game.players.some(p => p.name.toLowerCase() === (chosenName + ' ' + counter).toLowerCase())) {
        counter++;
      }
      chosenName = chosenName + ' ' + counter;
    }

    const res = game.addPlayer(socket.id, chosenName);
    if (!res.success) {
      return socket.emit('error-msg', { message: res.message });
    }

    socket.join(code);
    socket.roomCode = code;
    socket.playerName = res.player.name;

    const pubState = game.getPublicState();
    socket.emit('room-joined', {
      roomCode: code,
      player: res.player,
      gameState: pubState
    });

    io.to(code).emit('player-joined', {
      player: res.player,
      gameState: pubState
    });

    if (game.status === 'PLAYING') {
      io.to(code).emit('game-started', {
        gameState: pubState
      });
    }
  });

  socket.on('add-bot', () => {
    const game = rooms[socket.roomCode];
    if (!game) return;
    // Fill remaining seats with bots so game can launch immediately
    while (game.players.length < game.maxPlayers) {
      const bot = game.addBot();
      if (!bot) break;
      io.to(socket.roomCode).emit('player-joined', {
        player: bot,
        gameState: game.getPublicState()
      });
    }
    if (game.status === 'PLAYING') {
      io.to(socket.roomCode).emit('game-started', {
        gameState: game.getPublicState()
      });
      handleBotTurn(socket.roomCode);
    }
  });

    socket.on('roll-dice', (payload = {}) => {
    const power = (payload && payload.power) ? payload.power : 1.0;
    const game = rooms[socket.roomCode];
    if (!game) return;

    const rollingPlayer = game.getCurrentPlayer();
    const res = game.rollDice(socket.id);
    if (!res.success) {
      return socket.emit('action-error', { message: res.message });
    }

    io.to(socket.roomCode).emit('dice-rolled', {
      player: rollingPlayer,
      roll: res.roll,
      validMoves: res.validMoves || [],
      autoPass: res.autoPass || false,
      turnPassed: res.turnPassed || res.autoPass || false,
      threeSixes: res.threeSixes || false,
      gameState: game.getPublicState(),
      message: res.message
    });

    // If turn passed (no valid moves), trigger bot if next player is bot
    if (res.autoPass || res.threeSixes || res.turnPassed) {
      setTimeout(() => handleBotTurn(socket.roomCode), 500);
    }
  });

    socket.on('move-token', ({ tokenId }) => {
    const game = rooms[socket.roomCode];
    if (!game) return;

    const movingPlayer = game.players.find(p => p.id === socket.id);
    const res = game.moveToken(socket.id, tokenId);
    if (!res.success) {
      return socket.emit('action-error', { message: res.message });
    }

    io.to(socket.roomCode).emit('token-moved', {
      player: movingPlayer,
      tokenId: res.tokenId,
      prevStep: res.prevStep,
      newStep: res.newStep,
      roll: res.roll,
      captureOccurred: res.captureOccurred,
      capturedInfo: res.capturedInfo,
      getsBonusTurn: res.getsBonusTurn,
      gameOver: res.gameOver,
      winner: res.winner,
      gameState: game.getPublicState()
    });

    // If next player is bot and no bonus turn awarded, trigger bot turn
    if (!res.gameOver && !res.getsBonusTurn) {
      setTimeout(() => handleBotTurn(socket.roomCode), 600);
    }
  });

  
  socket.on('request-rematch', () => {
    const game = rooms[socket.roomCode];
    if (!game) return;
    game.resetForRematch();
    io.to(socket.roomCode).emit('game-rematch-started', {
      gameState: game.getPublicState()
    });
    handleBotTurn(socket.roomCode);
  });

  
  socket.on('send-reaction', ({ emoji }) => {
    const code = socket.roomCode;
    if (!code) return;
    const game = rooms[code];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(code).emit('reaction-sent', {
      sender: player.name,
      color: player.color,
      emoji: (emoji || '❤️').slice(0, 4)
    });
  });

  socket.on('send-chat', ({ message }) => {
    const game = rooms[socket.roomCode];
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    io.to(socket.roomCode).emit('chat-message', {
      sender: player.name,
      color: player.color,
      text: (message || '').substring(0, 100),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('voice-join', () => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('voice-peer-joined', { peerId: socket.id, playerName: socket.playerName });
  });

  socket.on('voice-signal', ({ to, data }) => {
    io.to(to).emit('voice-signal', {
      from: socket.id,
      data
    });
  });

  socket.on('voice-leave', () => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('voice-peer-left', { peerId: socket.id });
  });

  socket.on('voice-speaking', ({ isSpeaking }) => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('voice-peer-speaking', {
      peerId: socket.id,
      isSpeaking
    });
  });

  
  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code) return;
    socket.to(code).emit('voice-peer-left', { peerId: socket.id });

    const game = rooms[code];
    if (!game) return;

    // In WAITING lobby: remove player and clean up room if empty
    if (game.status === 'WAITING') {
      const removed = game.removePlayer(socket.id);
      if (removed) {
        if (game.players.length === 0) {
          delete rooms[code];
        } else {
          io.to(code).emit('player-left', {
            playerName: removed.name,
            gameState: game.getPublicState()
          });
          io.to(code).emit('game-updated', {
            gameState: game.getPublicState(),
            message: removed.name + ' left the table'
          });
        }
      }
      return;
    }

    // In PLAYING game: mark as away/disconnected
    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      player.isAway = true;
      player.connected = false;
      io.to(code).emit('player-status-changed', {
        player: player,
        status: 'away',
        gameState: game.getPublicState()
      });

      // If it's this player's turn, auto-play only if they remain disconnected after 4s
      if (game.status === 'PLAYING') {
        const current = game.getCurrentPlayer();
        if (current && current.id === socket.id) {
          setTimeout(() => {
            if (!rooms[code]) return;
            const liveCurrent = game.getCurrentPlayer();
            // Verify player hasn't reconnected with a new socket ID
            if (liveCurrent && liveCurrent.id === socket.id && (liveCurrent.isAway || !liveCurrent.connected)) {
              const rollRes = game.rollDice(socket.id);
              if (rollRes.success) {
                io.to(code).emit('dice-rolled', {
                  player: liveCurrent,
                  roll: rollRes.roll,
                  validMoves: rollRes.validMoves,
                  turnPassed: rollRes.turnPassed,
                  autoPassed: true,
                  gameState: game.getPublicState()
                });

                if (!rollRes.turnPassed && rollRes.validMoves && rollRes.validMoves.length > 0) {
                  setTimeout(() => {
                    const moveRes = game.moveToken(socket.id, rollRes.validMoves[0]);
                    if (moveRes.success) {
                      io.to(code).emit('token-moved', {
                        player: liveCurrent,
                        tokenId: moveRes.tokenId,
                        prevStep: moveRes.prevStep,
                        newStep: moveRes.newStep,
                        roll: moveRes.roll,
                        captureOccurred: moveRes.captureOccurred,
                        capturedInfo: moveRes.capturedInfo,
                        getsBonusTurn: moveRes.getsBonusTurn,
                        gameOver: moveRes.gameOver,
                        winner: moveRes.winner,
                        gameState: game.getPublicState()
                      });
                      handleBotTurn(code);
                    }
                  }, 800);
                } else {
                  handleBotTurn(code);
                }
              }
            }
          }, 4000);
        }
      }
    }

    // Auto cleanup abandoned rooms if all human players are disconnected for 10 minutes
    const hasActiveHumans = game.players.some(p => p.connected && !p.isBot);
    if (!hasActiveHumans) {
      setTimeout(() => {
        if (rooms[code] && !rooms[code].players.some(p => p.connected && !p.isBot)) {
          delete rooms[code];
        }
      }, 10 * 60 * 1000);
    }
  });
});

server.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});

// Periodic Turn Timeout Auto-Play (30s clock)
setInterval(() => {
  const now = Date.now();
  Object.keys(rooms).forEach(roomCode => {
    const game = rooms[roomCode];
    if (!game || game.status !== 'PLAYING' || !game.turnDeadline) return;

    if (now > game.turnDeadline) {
      const current = game.getCurrentPlayer();
      if (!current) return;

      if (game.phase === 'ROLL') {
        const rollRes = game.rollDice(current.id);
        if (!rollRes.success) return;

        io.to(roomCode).emit('dice-rolled', {
          player: current,
          roll: rollRes.roll,
          validMoves: rollRes.validMoves,
          turnPassed: rollRes.turnPassed,
          consecutiveSixes: rollRes.consecutiveSixes,
          autoPassed: true,
          gameState: game.getPublicState()
        });

        if (!rollRes.turnPassed && rollRes.validMoves && rollRes.validMoves.length > 0) {
          // Auto move first valid piece after 1 second
          setTimeout(() => {
            if (!rooms[roomCode]) return;
            const moveRes = game.moveToken(current.id, rollRes.validMoves[0]);
            if (!moveRes.success) return;

            io.to(roomCode).emit('token-moved', {
              player: current,
              tokenId: moveRes.tokenId,
              prevStep: moveRes.prevStep,
              newStep: moveRes.newStep,
              roll: moveRes.roll,
              captureOccurred: moveRes.captureOccurred,
              capturedInfo: moveRes.capturedInfo,
              getsBonusTurn: moveRes.getsBonusTurn,
              gameOver: moveRes.gameOver,
              winner: moveRes.winner,
              gameState: game.getPublicState()
            });

            const hopSteps = Math.max(1, Math.abs(moveRes.newStep - moveRes.prevStep));
            const animDuration = (moveRes.prevStep === 0 ? 1 : hopSteps) * 140;
            setTimeout(() => handleBotTurn(roomCode), animDuration + 450);
          }, 1000);
        } else {
          setTimeout(() => handleBotTurn(roomCode), 700);
        }
      } else if (game.phase === 'MOVE') {
        const valid = game.getValidMoves(current.color, game.diceValue);
        if (valid && valid.length > 0) {
          const moveRes = game.moveToken(current.id, valid[0]);
          if (!moveRes.success) return;

          io.to(roomCode).emit('token-moved', {
            player: current,
            tokenId: moveRes.tokenId,
            prevStep: moveRes.prevStep,
            newStep: moveRes.newStep,
            roll: moveRes.roll,
            captureOccurred: moveRes.captureOccurred,
            capturedInfo: moveRes.capturedInfo,
            getsBonusTurn: moveRes.getsBonusTurn,
            gameOver: moveRes.gameOver,
            winner: moveRes.winner,
            gameState: game.getPublicState()
          });

          const hopSteps = Math.max(1, Math.abs(moveRes.newStep - moveRes.prevStep));
          const animDuration = (moveRes.prevStep === 0 ? 1 : hopSteps) * 140;
          setTimeout(() => handleBotTurn(roomCode), animDuration + 450);
        }
      }
    }
  });
}, 2000);
