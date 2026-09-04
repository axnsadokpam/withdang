
// =========================================================
// SESSION VALIDATION & SOCKET INITIALIZATION (MUST BE FIRST)
// =========================================================
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get("room");

if (roomParam) {
  // If user navigated directly to /game.html?room=CODE, redirect to lobby to pick name and join properly
  window.location.replace("/?room=" + encodeURIComponent(roomParam));
  throw new Error("Redirecting to lobby to join table properly");
}

let roomCode = sessionStorage.getItem("ludo_room_code") || localStorage.getItem("ludo_room_code");
let playerName = sessionStorage.getItem("ludo_player_name") || localStorage.getItem("ludo_player_name") || "Player";
let playerColor = sessionStorage.getItem("ludo_player_color") || localStorage.getItem("ludo_player_color") || "green";

if (roomCode === "null" || roomCode === "undefined" || (roomCode && roomCode.length !== 6)) {
  roomCode = null;
  sessionStorage.removeItem("ludo_room_code");
  localStorage.removeItem("ludo_room_code");
}

if (roomCode) {
  sessionStorage.setItem("ludo_room_code", roomCode);
}
sessionStorage.setItem("ludo_player_name", playerName);
sessionStorage.setItem("ludo_player_color", playerColor);

const socket = io();

// =========================================================
// MOBILE HAPTIC VIBRATION
// =========================================================
function triggerHaptic(type) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      if (type === 'turn') navigator.vibrate([35]);
      else if (type === 'six') navigator.vibrate([40, 60, 80]);
      else if (type === 'capture') navigator.vibrate([70, 40, 100]);
      else if (type === 'click') navigator.vibrate([15]);
    } catch (e) {}
  }
}

// =========================================================
// CLICK-TO-COPY ROOM CODE IN HEADER
function fallbackCopyBadge(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    if (roomBadgeEl) {
      const origHtml = roomBadgeEl.innerHTML;
      roomBadgeEl.innerHTML = '<span class="badge-label" style="display:inline !important;">✓</span> <strong class="badge-code" style="color:#10b981;">Copied!</strong>';
      addLogMessage("Invite link copied to clipboard!", "game");
      setTimeout(() => { roomBadgeEl.innerHTML = origHtml; }, 2200);
    }
  } catch (e) {
    prompt("Copy invite link:", text);
  }
  document.body.removeChild(ta);
}

const roomBadgeEl = document.querySelector(".room-badge");
if (roomBadgeEl) {
  roomBadgeEl.title = "Click to copy invite link";
  roomBadgeEl.addEventListener("click", () => {
    const inviteUrl = window.location.origin + "/?room=" + roomCode;
    triggerHaptic('click');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        const origHtml = roomBadgeEl.innerHTML;
        roomBadgeEl.innerHTML = '<span class="badge-label" style="display:inline !important;">✓</span> <strong class="badge-code" style="color:#10b981;">Copied!</strong>';
        addLogMessage("Invite link copied to clipboard!", "game");
        setTimeout(() => { roomBadgeEl.innerHTML = origHtml; }, 2200);
      }).catch(() => fallbackCopyBadge(inviteUrl));
    } else {
      fallbackCopyBadge(inviteUrl);
    }
  });
}

// =========================================================
// FLOATING LIVE REACTIONS CONTROLLER
// =========================================================
const reactionsBar = document.getElementById("reactions-bar");
const floatingStage = document.getElementById("floating-reactions-stage");

if (reactionsBar) {
  reactionsBar.querySelectorAll(".reaction-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const emoji = btn.dataset.emoji;
      triggerHaptic('click');
      socket.emit("send-reaction", { emoji });
    });
  });
}

socket.on("reaction-sent", (data) => {
  if (window.sounds) window.sounds.playReactionPop();
  spawnFloatingEmoji(data.emoji, data.color);
});

function spawnFloatingEmoji(emoji, color) {
  if (!floatingStage) return;
  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.textContent = emoji;

  // Random horizontal spawn position across center of board
  const minX = 25;
  const maxX = 75;
  const randomX = minX + Math.random() * (maxX - minX);
  el.style.left = randomX + "%";

  floatingStage.appendChild(el);
  setTimeout(() => { el.remove(); }, 2500);
}


// Universal Mobile Audio & Speech Unlock
document.addEventListener('pointerdown', function unlockAudioOnce() {
  if (window.sounds) window.sounds.init();
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.paused) {
    try { window.speechSynthesis.resume(); } catch (e) {}
  }
  document.removeEventListener('pointerdown', unlockAudioOnce);
}, { once: true });


const headerRoomCode = document.getElementById("header-room-code");
const turnBanner = document.getElementById("turn-banner");
const turnPlayerName = document.getElementById("turn-player-name");
const turnPhaseBadge = document.getElementById("turn-phase-badge");
const dice3dContainer = document.getElementById("dice-3d-container");
const btnRollDice = document.getElementById("btn-roll-dice");

const btnAddBot = document.getElementById("btn-add-bot");
if (btnAddBot) {
  btnAddBot.addEventListener("click", () => {
    socket.emit("add-bot");
  });
}

const diceStatusTip = document.getElementById("dice-status-tip");
const gamePlayersList = document.getElementById("game-players-list");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const btnChatSend = document.getElementById("btn-chat-send");
const btnSoundToggle = document.getElementById("btn-sound-toggle");
const ludoGrid = document.getElementById("ludo-grid");
const winnerModal = document.getElementById("winner-modal");
const winnerTitle = document.getElementById("winner-title");
const winnerDesc = document.getElementById("winner-desc");

const rulesModal = document.getElementById("rules-modal");
const btnRulesTrigger = document.getElementById("btn-rules-trigger");
const btnCloseRules = document.getElementById("btn-close-rules");
const btnFullscreen = document.getElementById("btn-fullscreen");
const tabChatAll = document.getElementById("tab-chat-all");
const tabChatGame = document.getElementById("tab-chat-game");

const arenaStage = document.getElementById("arena-stage");
const hudRight = document.getElementById("hud-right");
const btnToggleChat = document.getElementById("btn-toggle-chat");
const btnCollapseChat = document.getElementById("btn-collapse-chat");
const chatUnreadDot = document.getElementById("chat-unread-dot");

let isChatOpen = window.innerWidth > 960;

if (headerRoomCode) headerRoomCode.textContent = roomCode;

const dice3d = new ThreeDiceController(dice3dContainer, btnRollDice);
if (window.innerWidth <= 960) { setChatVisible(false); }

let myPlayerColor = null;
let currentGameState = null;
let isRollInFlight = false;
let currentValidMoves = [];
let currentChatTab = "all";

const boardRenderer = new BoardRenderer(ludoGrid, (tokenId) => {
  handleTokenClick(tokenId);
});

if (btnSoundToggle) {
  btnSoundToggle.addEventListener("click", () => {
    const isMuted = window.sounds.toggleMute();
    btnSoundToggle.style.opacity = isMuted ? "0.4" : "1";
    btnSoundToggle.title = isMuted ? "Unmute Audio" : "Mute Audio";
  });
}

function showRulesModal() {
  if (rulesModal) rulesModal.style.display = "flex";
}
function hideRulesModal() {
  if (rulesModal) rulesModal.style.display = "none";
}

if (btnRulesTrigger) btnRulesTrigger.addEventListener("click", showRulesModal);
const btnMobileRules = document.getElementById("btn-mobile-rules");
if (btnMobileRules) btnMobileRules.addEventListener("click", showRulesModal);

if (btnCloseRules) btnCloseRules.addEventListener("click", hideRulesModal);
if (rulesModal) {
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) hideRulesModal();
  });
}

if (btnFullscreen) {
  btnFullscreen.addEventListener("click", () => {
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (!isFull) {
      const rfs = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen || document.documentElement.mozRequestFullScreen;
      if (rfs) {
        try { rfs.call(document.documentElement); } catch (e) {}
      }
    } else {
      const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (efs) {
        try { efs.call(document); } catch (e) {}
      }
    }
  });
}

function setChatVisible(visible) {
  isChatOpen = visible;
  if (visible) {
    arenaStage.classList.remove("chat-collapsed");
    hudRight.classList.remove("collapsed");
    btnToggleChat.classList.add("active");
    if (chatUnreadDot) chatUnreadDot.classList.remove("visible");
  } else {
    arenaStage.classList.add("chat-collapsed");
    hudRight.classList.add("collapsed");
    btnToggleChat.classList.remove("active");
  }
}

if (btnToggleChat) {
  btnToggleChat.addEventListener("click", () => {
    setChatVisible(!isChatOpen);
  });
}

if (btnCollapseChat) {
  btnCollapseChat.addEventListener("click", () => {
    setChatVisible(false);
  });
}

if (tabChatAll && tabChatGame) {
  tabChatAll.addEventListener("click", () => {
    currentChatTab = "all";
    tabChatAll.classList.add("active");
    tabChatGame.classList.remove("active");
    filterChatMessages();
  });
  tabChatGame.addEventListener("click", () => {
    currentChatTab = "game";
    tabChatGame.classList.add("active");
    tabChatAll.classList.remove("active");
    filterChatMessages();
  });
}

function filterChatMessages() {
  const bubbles = chatMessages.querySelectorAll(".chat-bubble");
  bubbles.forEach((b) => {
    if (currentChatTab === "all") {
      b.style.display = "block";
    } else {
      b.style.display = b.dataset.msgType === "game" ? "block" : "none";
    }
  });
}


const cachedState = sessionStorage.getItem("ludo_game_state");
if (cachedState) {
  try {
    const parsedState = JSON.parse(cachedState);
    if (parsedState && parsedState.roomCode === roomCode) {
      updateGameView(parsedState);
    }
  } catch (e) {}
}

function joinOrCreateGame() {
  if (roomCode) {
    if (headerRoomCode) headerRoomCode.textContent = roomCode;
    socket.emit("join-room", {
      roomCode: roomCode,
      playerName: playerName,
      playerColor: playerColor || sessionStorage.getItem("ludo_player_color") || localStorage.getItem("ludo_player_color")
    });
  } else {
    // Auto-create match vs AI Bot so game starts immediately!
    addLogMessage("Setting up match vs AI Bot...", "game");
    socket.emit("create-room", {
      playerName: playerName,
      maxPlayers: 2,
      preferredColor: playerColor || "green",
      gameMode: "quick"
    });
  }
}

if (socket.connected) {
  joinOrCreateGame();
} else {
  socket.on("connect", () => {
    joinOrCreateGame();
  });
}


const btnVoiceToggle = document.getElementById("btn-voice-toggle");
const btnVoiceMute = document.getElementById("btn-voice-mute");
const voiceStatusDot = document.getElementById("voice-status-dot");

const voiceChat = new VoiceChatController(socket, {
  onStatusChange: ({ joined, muted }) => {
    if (joined) {
      if (btnVoiceToggle) {
        btnVoiceToggle.classList.add("active");
        btnVoiceToggle.title = "Leave Voice (V)";
      }
      if (btnVoiceMute) {
        btnVoiceMute.style.display = "flex";
        btnVoiceMute.title = muted ? "Unmute Mic (M)" : "Mute Mic (M)";
        btnVoiceMute.classList.toggle("muted", muted);
      }
      if (voiceStatusDot) {
        voiceStatusDot.className = "voice-dot " + (muted ? "muted" : "live");
      }
      addLogMessage("Connected to room voice channel", "game");
    } else {
      if (btnVoiceToggle) {
        btnVoiceToggle.classList.remove("active");
        btnVoiceToggle.title = "Join Voice Chat (V)";
      }
      if (btnVoiceMute) {
        btnVoiceMute.style.display = "none";
      }
      if (voiceStatusDot) {
        voiceStatusDot.className = "voice-dot";
      }
      addLogMessage("Left voice channel", "game");
    }
  },
  onSpeaking: (peerId, isSpeaking) => {
    updatePlayerSpeaking(peerId, isSpeaking);
  },
  onError: (msg) => {
    addLogMessage(msg, "game");
  }
});

function updatePlayerSpeaking(peerId, isSpeaking) {
  const slotItem = document.querySelector('[data-socket-id="' + peerId + '"]');
  if (slotItem) {
    slotItem.classList.toggle("speaking", isSpeaking);
  }
}

if (btnVoiceToggle) {
  btnVoiceToggle.addEventListener("click", () => {
    if (voiceChat.isJoined) {
      voiceChat.leaveVoice();
    } else {
      voiceChat.joinVoice();
    }
  });
}

if (btnVoiceMute) {
  btnVoiceMute.addEventListener("click", () => {
    voiceChat.toggleMute();
  });
}


// =========================================================
// PRESSURE & VELOCITY-SENSITIVE DICE CONTROLLER
// =========================================================
const diceChargeBar = document.getElementById("dice-charge-bar");
const diceChargeLabel = document.getElementById("dice-charge-label");
const CIRCLE_CIRCUMFERENCE = 339.29; // 2 * pi * 54

let chargeStartTime = null;
let chargeRafId = null;
let lastShakeTick = 0;

function startDiceCharge() {
  if (winnerModal && winnerModal.style.display === "flex") return;
  if (!currentGameState || isRollInFlight) return;
  const isMyTurn = currentGameState.currentTurn === myPlayerColor;
  if (!isMyTurn || currentGameState.phase !== "ROLL") return;
  if (chargeStartTime) return; // already charging

  chargeStartTime = Date.now();
  dice3d.startCharging();
  if (diceChargeLabel) {
    diceChargeLabel.textContent = "CHARGING...";
    diceChargeLabel.classList.add("visible");
    diceChargeLabel.classList.remove("supercharged");
  }

  const loop = () => {
    if (!chargeStartTime) return;
    const elapsed = Date.now() - chargeStartTime;
    const ratio = Math.min(elapsed / 1100, 1.0);
    const offset = CIRCLE_CIRCUMFERENCE * (1 - ratio);

    if (diceChargeBar) {
      diceChargeBar.style.strokeDashoffset = offset;
    }
    dice3d.updateCharge(ratio);

    // Audio rattle ticks
    if (elapsed - lastShakeTick > Math.max(50, 140 - ratio * 90)) {
      lastShakeTick = elapsed;
      if (window.sounds) window.sounds.playDiceShake(ratio);
    }

    if (ratio >= 0.85 && diceChargeLabel) {
      diceChargeLabel.textContent = "⚡ POWER SLAM!";
      diceChargeLabel.classList.add("supercharged");
    } else if (ratio >= 0.35 && diceChargeLabel) {
      diceChargeLabel.textContent = "THROWING HARD";
    }

    chargeRafId = requestAnimationFrame(loop);
  };

  chargeRafId = requestAnimationFrame(loop);
}

function releaseDiceCharge() {
  if (!chargeStartTime) return;
  const elapsed = Date.now() - chargeStartTime;
  chargeStartTime = null;
  if (chargeRafId) {
    cancelAnimationFrame(chargeRafId);
    chargeRafId = null;
  }

  // Calculate power: 1.0 (tap) to 2.2 (full charge)
  const power = elapsed < 180 ? 1.0 : Math.min(1.0 + (elapsed / 1100) * 1.2, 2.2);

  // Reset UI gauge smoothly
  if (diceChargeBar) diceChargeBar.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE;
  if (diceChargeLabel) {
    diceChargeLabel.classList.remove("visible", "supercharged");
  }

  triggerRoll(power);
}

function triggerRoll(powerMultiplier = 1.0) {
  if (!currentGameState || isRollInFlight) return;
  const isMyTurn = currentGameState.currentTurn === myPlayerColor;
  if (!isMyTurn || currentGameState.phase !== "ROLL") return;

  isRollInFlight = true;
  btnRollDice.disabled = true;
  hideRollBadge();
  boardRenderer.clearPathPreview();
  socket.emit("roll-dice", { power: powerMultiplier });
}

// Spacebar Hold & Release Listeners
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat && document.activeElement.tagName !== "INPUT") {
    if (winnerModal && winnerModal.style.display === "flex") {
      e.preventDefault();
      socket.emit("request-rematch");
      return;
    }
    e.preventDefault();
    startDiceCharge();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space" && document.activeElement.tagName !== "INPUT") {
    if (winnerModal && winnerModal.style.display === "flex") return;
    e.preventDefault();
    releaseDiceCharge();
  }
});

// Pointer & Touch Listeners for Button & 3D Box
[btnRollDice, dice3dContainer].forEach(el => {
  if (!el) return;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startDiceCharge();
  });
  el.addEventListener("pointerup", (e) => {
    e.preventDefault();
    releaseDiceCharge();
  });
  el.addEventListener("pointerleave", () => {
    if (chargeStartTime) releaseDiceCharge();
  });
  el.addEventListener("pointercancel", () => {
    if (chargeStartTime) releaseDiceCharge();
  });
});


function handleTokenClick(tokenId) {
  if (!currentGameState) return;
  const isMyTurn = currentGameState.currentTurn === myPlayerColor;
  if (!isMyTurn || currentGameState.phase !== "MOVE") return;

  if (!currentValidMoves.includes(tokenId)) {
    addLogMessage("Pawn " + (tokenId + 1) + " cannot move with this roll", "game");
    return;
  }

  boardRenderer.clearPathPreview();
  hideRollBadge();
  currentValidMoves = [];
  updateTokenButtons([]);

  // Emit move to server. Server broadcasts 'token-moved', which executes animateTokenHopSequence!
  socket.emit("move-token", { tokenId });
}

// Wire hover and click events on HUD 1-4 buttons
for (let i = 0; i < 4; i++) {
  const btn = document.getElementById("token-btn-" + i);
  if (btn) {
    btn.addEventListener("click", () => {
      handleTokenClick(i);
    });

    btn.addEventListener("mouseenter", () => {
      if (currentGameState && currentValidMoves.includes(i)) {
        boardRenderer.previewPath(currentGameState, i, currentGameState.lastRoll || currentGameState.diceValue, myPlayerColor);
      }
    });

    btn.addEventListener("mouseleave", () => {
      boardRenderer.clearPathPreview();
    });
  }
}

window.addEventListener("keydown", (e) => {
  if (document.activeElement === chatInput) return;

    if (e.key === "Escape") {
    hideRulesModal();
    return;
  }

  if (winnerModal && winnerModal.style.display === "flex" && (e.key === "Enter" || e.code === "Space")) {
    e.preventDefault();
    socket.emit("request-rematch");
    return;
  }

  // Spacebar handled exclusively by analog charge controller

  if (e.key === "v" || e.key === "V") {
    if (voiceChat.isJoined) voiceChat.leaveVoice();
    else voiceChat.joinVoice();
    return;
  }

  if (e.key === "m" || e.key === "M") {
    if (voiceChat.isJoined) voiceChat.toggleMute();
    return;
  }

  if (["1", "2", "3", "4"].includes(e.key)) {
    const tokenId = parseInt(e.key) - 1;
    handleTokenClick(tokenId);
  }
});

function sendChat() {
  const text = (chatInput.value || "").trim();
  if (text) {
    socket.emit("send-chat", { message: text });
    chatInput.value = "";
  }
}

btnChatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

socket.on("player-joined", (data) => {
  updateGameView(data.gameState);
  addLogMessage(data.player.name + " joined the arena", "game");
});


socket.on("room-created", (data) => {
  roomCode = data.roomCode;
  myPlayerColor = data.player.color;
  sessionStorage.setItem("ludo_room_code", data.roomCode);
  sessionStorage.setItem("ludo_player_name", data.player.name);
  sessionStorage.setItem("ludo_player_color", data.player.color);
  localStorage.setItem("ludo_room_code", data.roomCode);
  localStorage.setItem("ludo_player_name", data.player.name);
  localStorage.setItem("ludo_player_color", data.player.color);
  if (headerRoomCode) headerRoomCode.textContent = data.roomCode;
  updateGameView(data.gameState);
  
  // Fill with bot immediately so game launches!
  if (data.gameState.status === "WAITING") {
    socket.emit("add-bot");
  }
});

socket.on("game-started", (data) => {
  updateGameView(data.gameState);
  addLogMessage("Match started! Roll dice to begin.", "game");
});

socket.on("error-msg", (data) => {
  console.warn("Server notice:", data.message);
  if (data.message && (data.message.includes("not found") || data.message.includes("expired") || data.message.includes("Room not found"))) {
    sessionStorage.removeItem("ludo_room_code");
    localStorage.removeItem("ludo_room_code");
    roomCode = null;
    addLogMessage("Table expired. Auto-starting match vs AI Bot...", "game");
    socket.emit("create-room", {
      playerName: playerName,
      maxPlayers: 2,
      preferredColor: playerColor || "green",
      gameMode: "quick"
    });
  } else {
    addLogMessage(data.message, "game");
  }
});

socket.on("room-joined", (data) => {
  if (data.player) {
    myPlayerColor = data.player.color;
    sessionStorage.setItem("ludo_player_color", data.player.color);
    localStorage.setItem("ludo_player_color", data.player.color);
    sessionStorage.setItem("ludo_player_name", data.player.name);
    localStorage.setItem("ludo_player_name", data.player.name);
  }
  updateGameView(data.gameState);
});

socket.on("game-updated", (data) => {
  if (data.player) {
    myPlayerColor = data.player.color;
    sessionStorage.setItem("ludo_player_color", data.player.color);
    localStorage.setItem("ludo_player_color", data.player.color);
    sessionStorage.setItem("ludo_player_name", data.player.name);
    localStorage.setItem("ludo_player_name", data.player.name);
  }
  updateGameView(data.gameState);
  if (data.message) addLogMessage(data.message, "game");
});

socket.on("dice-rolled", (data) => {
  isRollInFlight = false;
  dice3d.roll(data.roll, data.power || 1.0, () => {
    currentGameState = data.gameState;
    currentValidMoves = data.validMoves || [];

    showRollBadge(data.roll);
    const pName = data.player ? data.player.name : (data.gameState && data.gameState.currentTurnPlayer ? data.gameState.currentTurnPlayer.name : "Player");
    if (data.roll === 6) triggerHaptic("six");
    if (window.announcer) {
      window.announcer.announceRoll(data.roll, pName, data.roll === 6);
    }

    updateGameView(data.gameState, currentValidMoves);

        // SMART AUTO-MOVE FOR FORCED / IDENTICAL CHOICES
    if (data.gameState.currentTurn === myPlayerColor && data.gameState.phase === "MOVE") {
      const myPlayer = (data.gameState.players || []).find(p => p.color === myPlayerColor);
      const myTokens = (myPlayer && myPlayer.tokens) ? myPlayer.tokens : ((data.gameState.tokens && data.gameState.tokens[myPlayerColor]) ? data.gameState.tokens[myPlayerColor] : []);
      const allInBase = myTokens.length > 0 && myTokens.every(t => t.step === 0);

      // Rule 1: If all 4 pawns are in the yard and rolled a 6 -> automatically exit Token 1!
      if (allInBase && data.roll === 6 && currentValidMoves.length > 0) {
        boardRenderer.previewPath(data.gameState, 0, data.roll, myPlayerColor);
        setTimeout(() => {
          if (currentGameState && currentGameState.phase === "MOVE" && currentGameState.currentTurn === myPlayerColor) {
            handleTokenClick(0);
          }
        }, 360);
      }
      // Rule 2: If exactly 1 valid move exists -> auto-move that single pawn!
      else if (currentValidMoves.length === 1) {
        boardRenderer.previewPath(data.gameState, currentValidMoves[0], data.roll, myPlayerColor);
        setTimeout(() => {
          if (currentGameState && currentGameState.phase === "MOVE" && currentGameState.currentTurn === myPlayerColor) {
            handleTokenClick(currentValidMoves[0]);
          }
        }, 360);
      }
    }

    if (data.threeSixes) {
      addLogMessage("Three consecutive sixes. Turn passed.", "game");
    } else if (data.autoPass) {
      addLogMessage("No valid moves with a " + data.roll + ". Turn passed.", "game");
    } else if (data.message) {
      addLogMessage(data.message, "game");
    }
  });
});

socket.on("token-moved", (data) => {
  currentGameState = data.gameState;
  currentValidMoves = [];
  boardRenderer.clearPathPreview();

  // Execute step-by-step parabolic arc hop!
  boardRenderer.animateTokenHopSequence(data.player.color, data.tokenId, data.prevStep, data.newStep, () => {
    if (data.captureOccurred && data.capturedInfo) {
      triggerHaptic("capture");
      const coords = boardRenderer.getCoordinates(data.player.color, data.newStep, data.tokenId);
      boardRenderer.triggerCaptureShockwave(coords[0], coords[1]);
      if (window.sounds) window.sounds.playCapture();
      if (window.announcer) window.announcer.announceCapture(data.player.name, data.capturedInfo.player);
      addLogMessage("Captured " + data.capturedInfo.player + "'s pawn!", "game");
    }

    if (data.getsBonusTurn && !data.gameOver) {
      addLogMessage("Bonus roll awarded.", "game");
    }

    if (data.gameOver && data.winner) {
      if (window.sounds) window.sounds.playWin();
      if (window.announcer) window.announcer.announceWin(data.winner ? data.winner.name : "Winner");
      winnerTitle.textContent = data.winner.name + " wins!";
      const isQuick = data.gameState && data.gameState.gameMode === "quick";
      winnerDesc.textContent = isQuick ? "First to 2 goals reached! Table champion!" : "All four pawns brought home safely!";
      winnerModal.style.display = "flex";
      if (boardRenderer && boardRenderer.triggerVictoryConfetti) {
        boardRenderer.triggerVictoryConfetti();
      }
    }

    updateGameView(data.gameState, []);
  });
});

socket.on("chat-message", (data) => {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.dataset.msgType = "chat";
  bubble.innerHTML = '<span style="font-weight:700; color:var(--ludo-' + data.color + ');">' + data.sender + ':</span> ' + escapeHTML(data.text) + ' <span style="font-size:10px; opacity:0.6; float:right;">' + data.time + '</span>';
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  filterChatMessages();

  if (!isChatOpen && chatUnreadDot) {
    chatUnreadDot.classList.add("visible");
  }
});

socket.on("player-disconnected", (data) => {
  addLogMessage(data.playerName + " disconnected", "game");
  updateGameView(data.gameState);
});

socket.on("action-error", (data) => {
  isRollInFlight = false;
  addLogMessage(data.message, "game");
  if (currentGameState && currentGameState.currentTurn === myPlayerColor && currentGameState.phase === "ROLL") {
    btnRollDice.disabled = false;
  }
});

function updateTokenButtons(validMoves) {
  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById("token-btn-" + i);
    if (!btn) continue;
    if (validMoves && validMoves.includes(i)) {
      btn.classList.add("available");
      btn.title = "Press " + (i + 1) + " or click to move pawn " + (i + 1);
    } else {
      btn.classList.remove("available");
      btn.title = "Pawn " + (i + 1) + " cannot move";
    }
  }
}

function updateGameView(gameState, validMoves) {
  if (!validMoves) validMoves = currentValidMoves;
  currentGameState = gameState;

  const me = gameState.players.find(p => p.id === socket.id || (myPlayerColor && p.color === myPlayerColor) || p.name === playerName);
  if (me) {
    myPlayerColor = me.color;
    sessionStorage.setItem("ludo_player_color", me.color);
    localStorage.setItem("ludo_player_color", me.color);
  }

  const isMyTurn = gameState.currentTurn === myPlayerColor;
  const currentTurnPlayer = gameState.players.find(p => p.color === gameState.currentTurn);
  const currentTurnName = currentTurnPlayer ? currentTurnPlayer.name : "Waiting";

  turnBanner.className = "turn-status banner-" + gameState.currentTurn;
  const turnEyebrow = turnBanner.querySelector(".turn-eyebrow");
  if (turnEyebrow) {
    turnEyebrow.textContent = isMyTurn ? "YOUR TURN" : "CURRENT TURN";
  }
  turnPlayerName.textContent = isMyTurn ? (myPlayerColor.toUpperCase()) : (currentTurnName);
  if (turnPhaseBadge) turnPhaseBadge.textContent = gameState.phase;

  if (isMyTurn && gameState.phase === "ROLL") {
    triggerHaptic("turn");
    btnRollDice.disabled = false;
    diceStatusTip.innerHTML = "Roll dice (<kbd style=\"background:#1e293b; border:1px solid #334155; padding:2px 6px; border-radius:4px; color:#fff;\">Space</kbd>)";
    diceStatusTip.style.color = "#34d399";
    updateTokenButtons([]);
    boardRenderer.clearPathPreview();
  } else if (isMyTurn && gameState.phase === "MOVE") {
    btnRollDice.disabled = true;
    diceStatusTip.innerHTML = "Choose pawn (<kbd style=\"background:#1e293b; border:1px solid #334155; padding:2px 6px; border-radius:4px; color:#fff;\">1 - 4</kbd>)";
    diceStatusTip.style.color = "#facc15";
    updateTokenButtons(validMoves);

    // Auto-preview path if exactly 1 move is possible
    if (validMoves && validMoves.length === 1) {
      boardRenderer.previewPath(gameState, validMoves[0], gameState.lastRoll || gameState.diceValue, myPlayerColor);
    }
  } else {
    btnRollDice.disabled = true;
    diceStatusTip.textContent = "Waiting for " + currentTurnName + "...";
    diceStatusTip.style.color = "#64748b";
    updateTokenButtons([]);
    boardRenderer.clearPathPreview();
  }

  gamePlayersList.innerHTML = "";
  gameState.players.forEach(p => {
    const item = document.createElement("div");
        item.className = "player-slot-item";
    item.dataset.socketId = p.id;
    if (p.color === gameState.currentTurn) {
      item.style.borderColor = "var(--ludo-" + p.color + ")";
      item.style.background = "rgba(255,255,255,0.06)";
      item.style.boxShadow = "0 0 10px rgba(255,255,255,0.08)";
    }
    item.innerHTML = 
      '<div class="player-color-dot color-' + p.color + '"></div>' +
      '<div class="player-slot-name">' + escapeHTML(p.name) + (p.id === socket.id ? " (You)" : "") + '</div>' +
      '<div class="voice-wave"><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span><span class="voice-wave-bar"></span></div>' +
      '<div class="player-slot-tag">' + (p.connected ? "Active" : "Away") + '</div>';
    gamePlayersList.appendChild(item);
  });

  
  if (btnAddBot) {
    const isHost = me && me.isHost;
    if (gameState.status === "WAITING" && isHost && gameState.players.length < gameState.maxPlayers) {
      btnAddBot.style.display = "flex";
    } else {
      btnAddBot.style.display = "none";
    }
  }

  
  if (gameState.status === "FINISHED" && gameState.winner) {
    const tbody = document.getElementById("winner-stats-tbody");
    if (tbody && gameState.players) {
      tbody.innerHTML = "";
      gameState.players.forEach(p => {
        const stats = p.stats || { rolls: 0, sixes: 0, captures: 0, pawnsHome: 0 };
        const row = document.createElement("tr");
        row.innerHTML = 
          '<td style="text-align: left;"><span class="player-color-dot color-' + p.color + '" style="display:inline-block; vertical-align:middle; width:8px; height:8px; margin-right:6px;"></span>' + escapeHTML(p.name) + '</td>' +
          '<td>' + stats.rolls + '</td>' +
          '<td style="color:#facc15;">' + stats.sixes + '</td>' +
          '<td style="color:#ef4444;">' + stats.captures + '</td>' +
          '<td style="color:#10b981;">' + stats.pawnsHome + '/' + (gameState.targetGoals || 4) + '</td>';
        tbody.appendChild(row);
      });
    }
    boardRenderer.triggerVictoryConfetti();
  }

  boardRenderer.renderTokens(gameState, validMoves, myPlayerColor);
}

function addLogMessage(msg, type) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.dataset.msgType = type || "chat";
  bubble.style.background = "rgba(255,255,255,0.03)";
  bubble.style.color = "#94a3b8";
  bubble.textContent = msg;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  filterChatMessages();

  if (!isChatOpen && chatUnreadDot && type !== "game") {
    chatUnreadDot.classList.add("visible");
  }
}

function escapeHTML(str) {
  return (str || "").replace(/[&<>'"]/g, 
    tag => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[tag] || tag)
  );
}

// TURN COUNTDOWN TIMER LOGIC
const timerText = document.getElementById("timer-text");
const timerProgress = document.getElementById("timer-progress");
const timerBadge = document.getElementById("turn-timer-badge");

let timerInterval = null;
let lastTickSecond = -1;

function updateTurnTimer(deadline) {
  if (!deadline || !currentGameState || currentGameState.status !== 'PLAYING') {
    if (timerText) timerText.textContent = "30";
    if (timerProgress) timerProgress.setAttribute("stroke-dasharray", "100, 100");
    if (timerBadge) timerBadge.classList.remove("urgent");
    return;
  }

  const remainingMs = Math.max(0, deadline - Date.now());
  const seconds = Math.ceil(remainingMs / 1000);

  if (timerText) timerText.textContent = seconds;

  const percent = (seconds / 30) * 100;
  if (timerProgress) {
    timerProgress.setAttribute("stroke-dasharray", percent + ", 100");
  }

  if (seconds <= 7) {
    if (timerBadge) timerBadge.classList.add("urgent");
    if (seconds !== lastTickSecond && window.sounds) {
      lastTickSecond = seconds;
      window.sounds.playTimerTick();
    }
  } else {
    if (timerBadge) timerBadge.classList.remove("urgent");
  }
}

if (!timerInterval) {
  timerInterval = setInterval(() => {
    if (currentGameState && currentGameState.turnDeadline) {
      updateTurnTimer(currentGameState.turnDeadline);
    }
  }, 250);
}

// REMATCH & EXIT BUTTONS
const btnRematch = document.getElementById("btn-rematch");
const btnExitLobby = document.getElementById("btn-exit-lobby");

if (btnRematch) {
  btnRematch.addEventListener("click", () => {
    socket.emit("request-rematch");
  });
}

if (btnExitLobby) {
  btnExitLobby.addEventListener("click", () => {
    sessionStorage.removeItem("ludo_room_code");
    sessionStorage.removeItem("ludo_game_state");
    localStorage.removeItem("ludo_room_code");
    localStorage.removeItem("ludo_game_state");
    window.location.href = "/";
  });
}

socket.on("game-rematch-started", (data) => {
  winnerModal.style.display = "none";
  winnerModal.classList.remove("active");
  currentGameState = data.gameState;
  currentValidMoves = [];
  if (boardRenderer && boardRenderer.clearConfetti) boardRenderer.clearConfetti();
  if (window.sounds) window.sounds.playRematch();
  hideRollBadge();
  if (window.announcer) window.announcer.speak("Rematch ready! Roll to start!");
  updateGameView(data.gameState);
  addLogMessage("Rematch commenced! Tokens reset to staging base.", "game");
});


// ANNOUNCER (SPOKEN DICE VOICE) & VISUAL ROLL BADGE
const btnAnnouncerToggle = document.getElementById("btn-announcer-toggle");
const diceRollBadge = document.getElementById("dice-roll-badge");
const diceRollNum = document.getElementById("dice-roll-num");

function updateAnnouncerButtonState(enabled) {
  if (!btnAnnouncerToggle) return;
  btnAnnouncerToggle.classList.toggle("active", enabled);
  btnAnnouncerToggle.style.opacity = enabled ? "1" : "0.45";
  btnAnnouncerToggle.title = enabled 
    ? "Spoken Dice Voice: ON (Click to Mute)" 
    : "Spoken Dice Voice: OFF (Click to Enable)";
}

if (btnAnnouncerToggle && window.announcer) {
  updateAnnouncerButtonState(window.announcer.enabled);
  btnAnnouncerToggle.addEventListener("click", () => {
    const isNowEnabled = window.announcer.toggle();
    updateAnnouncerButtonState(isNowEnabled);
    addLogMessage("Spoken Dice Voice: " + (isNowEnabled ? "Enabled" : "Muted"), "game");
  });
}

function showRollBadge(roll) {
  if (diceRollNum) diceRollNum.textContent = roll;
  if (diceRollBadge) {
    diceRollBadge.classList.remove("visible");
    void diceRollBadge.offsetWidth;
    diceRollBadge.classList.add("visible");
  }
}

function hideRollBadge() {
  if (diceRollBadge) diceRollBadge.classList.remove("visible");
}
