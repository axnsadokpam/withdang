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


function handleBotTurn(roomCode) {
  const game = rooms[roomCode];
  if (!game || game.status !== 'PLAYING') return;

  const current = game.getCurrentPlayer();
  if (!current || !current.isBot) return;

  setTimeout(() => {
    if (!rooms[roomCode]) return;
    const liveCurrent = game.getCurrentPlayer();
    if (!liveCurrent || !liveCurrent.isBot) return;

    const rollRes = game.rollDice(liveCurrent.id);
    if (!rollRes.success) return;

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
      setTimeout(() => handleBotTurn(roomCode), 400);
      return;
    }

    setTimeout(() => {
      if (!rooms[roomCode]) return;
      const bestTokenId = game.getSmartBotMove(liveCurrent.id);
      if (bestTokenId === null) return;

      const moveRes = game.moveToken(liveCurrent.id, bestTokenId);
      if (!moveRes.success) return;

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
        setTimeout(() => handleBotTurn(roomCode), 400);
      }
    }, 240);
  }, 220);
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

  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const game = rooms[code];

    if (!game) {
      return socket.emit('error-msg', { message: 'Room not found.' });
    }

    const existing = game.players.find(p => p.name.toLowerCase() === (playerName || '').toLowerCase());
    if (existing) {
      game.reconnectPlayer(socket.id, existing.name);
      socket.join(code);
      socket.roomCode = code;
      socket.playerName = existing.name;

      io.to(code).emit('game-updated', {
        gameState: game.getPublicState(),
        message: existing.name + ' reconnected'
      });
      return;
    }

    const res = game.addPlayer(socket.id, playerName);
    if (!res.success) {
      return socket.emit('error-msg', { message: res.message });
    }

    socket.join(code);
    socket.roomCode = code;
    socket.playerName = res.player.name;

    io.to(code).emit('player-joined', {
      player: res.player,
      gameState: game.getPublicState()
    });

    if (game.status === 'PLAYING') {
      io.to(code).emit('game-started', {
        gameState: game.getPublicState()
      });
    }
  });


  socket.on('add-bot', () => {
    const game = rooms[socket.roomCode];
    if (!game) return;
    const bot = game.addBot();
    if (bot) {
      io.to(socket.roomCode).emit('player-joined', {
        player: bot,
        gameState: game.getPublicState()
      });
      if (game.status === 'PLAYING') {
        io.to(socket.roomCode).emit('game-started', {
          gameState: game.getPublicState()
        });
        handleBotTurn(socket.roomCode);
      }
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
    if (!socket.roomCode) return;
    const game = rooms[socket.roomCode];
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (player) {
      player.isAway = true;
      io.to(socket.roomCode).emit('player-status-changed', {
        player: player,
        status: 'away',
        gameState: game.getPublicState()
      });

      // If it's this player's turn, auto-play for them smoothly after 3s
      if (game.status === 'PLAYING') {
        const current = game.getCurrentPlayer();
        if (current && current.id === socket.id) {
          setTimeout(() => {
            if (!rooms[socket.roomCode]) return;
            const liveCurrent = game.getCurrentPlayer();
            if (liveCurrent && liveCurrent.id === socket.id) {
              // Trigger auto-pilot roll
              const rollRes = game.rollDice(socket.id);
              if (rollRes.success) {
                io.to(socket.roomCode).emit('dice-rolled', {
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
                      io.to(socket.roomCode).emit('token-moved', {
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
                      handleBotTurn(socket.roomCode);
                    }
                  }, 800);
                } else {
                  handleBotTurn(socket.roomCode);
                }
              }
            }
          }, 2500);
        }
      }
    }
  });

  // old disconnect
  socket.on('_unused_disconnect', () => {
    const code = socket.roomCode;
    if (code) {
      socket.to(code).emit('voice-peer-left', { peerId: socket.id });
    }
    const game = rooms[code];
    if (!game) return;

    const player = game.removePlayer(socket.id);
    if (player) {
      io.to(code).emit('player-disconnected', {
        playerName: player.name,
        gameState: game.getPublicState()
      });
    }

    const active = game.players.some(p => p.connected);
    if (!active) {
      setTimeout(() => {
        if (rooms[code] && !rooms[code].players.some(p => p.connected)) {
          delete rooms[code];
        }
      }, 15 * 60 * 1000);
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

            handleBotTurn(roomCode);
          }, 1000);
        } else {
          handleBotTurn(roomCode);
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

          handleBotTurn(roomCode);
        }
      }
    }
  });
}, 2000);
