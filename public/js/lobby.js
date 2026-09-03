
// COLLAPSIBLE OPTIONS ACCORDION
const btnToggleOptions = document.getElementById("btn-toggle-options");
const collapsibleGroup = document.querySelector(".collapsible-group");
const optionsSummaryChip = document.getElementById("options-summary-chip");

function updateOptionsSummary() {
  if (!optionsSummaryChip) return;
  const modeLabel = selectedGameMode === "quick" ? "Quick" : "Classic";
  const colorCap = selectedHostColor.charAt(0).toUpperCase() + selectedHostColor.slice(1);
  optionsSummaryChip.innerHTML = modeLabel + " &bull; " + colorCap;
}

if (btnToggleOptions && collapsibleGroup) {
  btnToggleOptions.addEventListener("click", () => {
    const isOpen = collapsibleGroup.classList.toggle("open");
    btnToggleOptions.setAttribute("aria-expanded", isOpen);
  });
}


let selectedGameMode = "quick";
const modeButtons = document.querySelectorAll(".mode-btn");

modeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    modeButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedGameMode = btn.dataset.mode || "quick";
    updateOptionsSummary();
  });
});


let selectedHostColor = "green";
const colorChips = document.querySelectorAll(".color-chip");

colorChips.forEach(chip => {
  chip.addEventListener("click", () => {
    colorChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    selectedHostColor = chip.dataset.color || "green";
    updateOptionsSummary();
  });
});

const socket = io();

let selectedPlayerCount = 2;
let currentRoomCode = null;

const joinCard = document.getElementById("join-card");
const waitingCard = document.getElementById("waiting-card");

const hostNameInput = document.getElementById("host-name");
const joinNameInput = document.getElementById("join-name");
const roomCodeInput = document.getElementById("room-code-input");
const joinPillar = document.getElementById("join-pillar");

const btnCreateRoom = document.getElementById("btn-create-room");
const btnJoinRoom = document.getElementById("btn-join-room");
const countButtons = document.querySelectorAll(".count-btn");

const lobbyRoomCode = document.getElementById("lobby-room-code");
const btnCopyCode = document.getElementById("btn-copy-code");
const playerSlots = document.getElementById("player-slots");
const playerCountLabel = document.getElementById("player-count-label");
const errorMsg = document.getElementById("error-msg");
const btnStartBots = document.getElementById("btn-start-bots");

// Retrieve saved alias if exists
const savedName = localStorage.getItem("ludo_player_name");
if (savedName) {
  if (hostNameInput) hostNameInput.value = savedName;
  if (joinNameInput) joinNameInput.value = savedName;
}

// Check URL params for invite link (?room=CODE)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get("room");
if (roomParam) {
  const code = roomParam.trim().toUpperCase();
  roomCodeInput.value = code;
  if (joinPillar) {
    joinPillar.classList.add("highlighted");
  }
  // Focus the join name input immediately for the invited player
  setTimeout(() => {
    if (joinNameInput) joinNameInput.focus();
  }, 200);
}

// Capacity buttons
countButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    countButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPlayerCount = parseInt(btn.dataset.count);
  });
});

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
  setTimeout(() => { errorMsg.style.display = "none"; }, 4000);
}

// HOST: Create Room
btnCreateRoom.addEventListener("click", () => {
  const name = (hostNameInput.value || "").trim() || "Player";
  localStorage.setItem("ludo_player_name", name);
  socket.emit("create-room", { playerName: name, maxPlayers: selectedPlayerCount, preferredColor: selectedHostColor, gameMode: selectedGameMode });
});

// GUEST: Join Room (With their dedicated name input!)
btnJoinRoom.addEventListener("click", () => {
  const name = (joinNameInput.value || "").trim() || "Guest";
  const code = (roomCodeInput.value || "").trim().toUpperCase();
  if (!code || code.length !== 6) {
    showError("Please enter a valid 6-character room code");
    return;
  }
  localStorage.setItem("ludo_player_name", name);
  socket.emit("join-room", { roomCode: code, playerName: name });
});

// Copy Invite Link or Code
btnCopyCode.addEventListener("click", () => {
  const inviteUrl = window.location.origin + "/?room=" + currentRoomCode;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    btnCopyCode.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Link Copied!';
    setTimeout(() => {
      btnCopyCode.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Link';
    }, 2000);
  }).catch(() => {
    navigator.clipboard.writeText(currentRoomCode);
    btnCopyCode.textContent = "Code Copied!";
    setTimeout(() => { btnCopyCode.textContent = "Copy Code"; }, 2000);
  });
});

if (btnStartBots) {
  btnStartBots.addEventListener("click", () => {
    socket.emit("add-bot");
  });
}

// Socket event bindings
socket.on("room-created", (data) => {
  currentRoomCode = data.roomCode;
  sessionStorage.setItem("ludo_room_code", data.roomCode);
  sessionStorage.setItem("ludo_player_name", data.player.name);
  sessionStorage.setItem("ludo_player_color", data.player.color);
  showLobby(data.gameState);
});

socket.on("player-joined", (data) => {
  currentRoomCode = data.gameState.roomCode;
  sessionStorage.setItem("ludo_room_code", data.gameState.roomCode);
  showLobby(data.gameState);
});

socket.on("game-updated", (data) => { showLobby(data.gameState); });

socket.on("game-started", (data) => {
  sessionStorage.setItem("ludo_game_state", JSON.stringify(data.gameState));
  window.location.href = "/game.html";
});

socket.on("error-msg", (data) => { showError(data.message); });

function showLobby(gameState) {
  joinCard.style.display = "none";
  waitingCard.style.display = "block";
  lobbyRoomCode.textContent = gameState.roomCode;
  playerCountLabel.textContent = gameState.players.length + "/" + gameState.maxPlayers;
  playerSlots.innerHTML = "";
  
  gameState.players.forEach(p => {
    const item = document.createElement("div");
    item.className = "player-slot-item";
    item.innerHTML = '<div class="player-color-dot color-' + p.color + '"></div>' +
      '<div class="player-slot-name">' + p.name + '</div>' +
      '<div class="player-slot-tag" style="text-transform: capitalize;">' + p.color + (p.isHost ? ' &bull; Host' : '') + '</div>';
    playerSlots.appendChild(item);
  });

  if (gameState.status === "PLAYING") {
    setTimeout(() => { window.location.href = "/game.html"; }, 1000);
  }
}

// Auto format room code and enter key shortcuts
if (roomCodeInput) {
  roomCodeInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  });
  roomCodeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnJoinRoom.click();
  });
}

if (hostNameInput) {
  hostNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnCreateRoom.click();
  });
}

if (joinNameInput) {
  joinNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (roomCodeInput && roomCodeInput.value.trim().length === 6) {
        btnJoinRoom.click();
      } else if (roomCodeInput) {
        roomCodeInput.focus();
      }
    }
  });
}
