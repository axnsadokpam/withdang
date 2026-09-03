const BOARD_CONSTANTS = {
  MAIN_TRACK: [
    [6, 1],  [6, 2],  [6, 3],  [6, 4],  [6, 5],
    [5, 6],  [4, 6],  [3, 6],  [2, 6],  [1, 6],  [0, 6],
    [0, 7],
    [0, 8],  [1, 8],  [2, 8],  [3, 8],  [4, 8],  [5, 8],
    [6, 9],  [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8],  [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5],  [8, 4],  [8, 3],  [8, 2],  [8, 1],  [8, 0],
    [7, 0],
    [6, 0]
  ],
  START_OFFSETS: { green: 0, red: 13, blue: 26, yellow: 39 },
  HOME_COLUMNS: {
    green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
  },
  HOME_DESTINATIONS: {
    green: [7, 6],
    red: [6, 7],
    blue: [7, 8],
    yellow: [8, 7]
  },
  BASE_SLOTS: {
    green: [[2, 2], [2, 3], [3, 2], [3, 3]],
    red: [[2, 11], [2, 12], [3, 11], [3, 12]],
    blue: [[11, 11], [11, 12], [12, 11], [12, 12]],
    yellow: [[11, 2], [11, 3], [12, 2], [12, 3]]
  },
  SAFE_TRACK_INDICES: [0, 8, 13, 21, 26, 34, 39, 47],
  DIRECTION_ARROWS: {
    "6_0": "flowUp", "0_6": "flowRight", "0_7": "flowRight", "0_8": "flowDown",
    "6_14": "flowDown", "7_14": "flowDown", "8_14": "flowLeft",
    "14_8": "flowLeft", "14_7": "flowLeft", "14_6": "flowUp",
    "8_0": "flowUp", "7_0": "flowUp"
  }
};

const BOARD_SVGS = {
  star: '<svg class="board-star-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="16" cy="16" r="14" fill="#fef3c7" fill-opacity="0.35" stroke="#d97706" stroke-width="1.2" stroke-dasharray="2 2"/>' +
        '<path d="M16 4.5L19.5 12L27.5 13L21.5 18.5L23 26.5L16 22.5L9 26.5L10.5 18.5L4.5 13L12.5 12L16 4.5Z" fill="url(#starGold)" stroke="#b45309" stroke-width="0.8"/>' +
        '<defs><linearGradient id="starGold" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#fde047"/><stop offset="0.5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>' +
        '</svg>',

  startStar: '<svg class="start-star-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
             '<circle cx="16" cy="16" r="13" fill="rgba(0,0,0,0.25)" stroke="#ffffff" stroke-width="1.5"/>' +
             '<path d="M16 6L19 12.5L26 13.5L21 18.5L22.5 25.5L16 22L9.5 25.5L11 18.5L6 13.5L13 12.5L16 6Z" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>' +
             '</svg>',

  arrowRight: '<svg class="lane-arrow-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M8 5L15 12L8 19" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
              '</svg>',
  arrowDown: '<svg class="lane-arrow-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
             '<path d="M5 8L12 15L19 8" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
             '</svg>',
  arrowLeft: '<svg class="lane-arrow-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
             '<path d="M16 5L9 12L16 19" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
             '</svg>',
  arrowUp: '<svg class="lane-arrow-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
           '<path d="M5 16L12 9L19 16" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
           '</svg>',

  flowUp: '<svg class="flow-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M6 15l6-6 6 6"/></svg>',
  flowDown: '<svg class="flow-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  flowLeft: '<svg class="flow-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  flowRight: '<svg class="flow-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>'
};

class BoardRenderer {
  constructor(gridElement, onTokenClick) {
    this.grid = gridElement;
    this.onTokenClick = onTokenClick;
    this.tokenElements = {};
    this.cellElements = {};
    this.lastGameState = null;
    this.lastValidMoves = [];
    this.lastMyPlayerColor = null;
    this.previewStepCells = [];
    this.previewTargetCell = null;
    this.previewBadge = null;
    this.isAnimating = false;

    this.buildGrid();

    window.addEventListener("resize", () => {
      if (this.lastGameState && !this.isAnimating) {
        this.renderTokens(this.lastGameState, this.lastValidMoves, this.lastMyPlayerColor);
      }
    });
  }

  buildGrid() {
    this.grid.innerHTML = "";

    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        this.cellElements[r + "_" + c] = cell;

        const inGreenYard = r < 6 && c < 6;
        const inRedYard = r < 6 && c >= 9;
        const inYellowYard = r >= 9 && c < 6;
        const inBlueYard = r >= 9 && c >= 9;
        const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;

        if (inGreenYard || inRedYard || inYellowYard || inBlueYard || inCenter) {
          cell.classList.add("cell-hidden");
          this.grid.appendChild(cell);
          continue;
        }

        if (r === 6 && c === 1) { cell.classList.add("cell-start-green"); cell.innerHTML = BOARD_SVGS.startStar; }
        if (r === 1 && c === 8) { cell.classList.add("cell-start-red"); cell.innerHTML = BOARD_SVGS.startStar; }
        if (r === 8 && c === 13) { cell.classList.add("cell-start-blue"); cell.innerHTML = BOARD_SVGS.startStar; }
        if (r === 13 && c === 6) { cell.classList.add("cell-start-yellow"); cell.innerHTML = BOARD_SVGS.startStar; }

        if (r === 7 && c >= 1 && c <= 5) {
          cell.classList.add("cell-homecol-green");
          cell.innerHTML = BOARD_SVGS.arrowRight;
        }
        if (c === 7 && r >= 1 && r <= 5) {
          cell.classList.add("cell-homecol-red");
          cell.innerHTML = BOARD_SVGS.arrowDown;
        }
        if (r === 7 && c >= 9 && c <= 13) {
          cell.classList.add("cell-homecol-blue");
          cell.innerHTML = BOARD_SVGS.arrowLeft;
        }
        if (c === 7 && r >= 9 && r <= 13) {
          cell.classList.add("cell-homecol-yellow");
          cell.innerHTML = BOARD_SVGS.arrowUp;
        }

        BOARD_CONSTANTS.SAFE_TRACK_INDICES.forEach(trackIdx => {
          const [starR, starC] = BOARD_CONSTANTS.MAIN_TRACK[trackIdx];
          if (r === starR && c === starC && !cell.innerHTML) {
            cell.classList.add("safe-star");
            cell.innerHTML = BOARD_SVGS.star;
          }
        });

        const key = r + "_" + c;
        if (BOARD_CONSTANTS.DIRECTION_ARROWS[key] && !cell.innerHTML) {
          cell.innerHTML = '<span class="track-flow">' + BOARD_SVGS[BOARD_CONSTANTS.DIRECTION_ARROWS[key]] + '</span>';
        }

        this.grid.appendChild(cell);
      }
    }
  }

  getCoordinates(color, step, tokenIndex) {
    if (step === 0) {
      return BOARD_CONSTANTS.BASE_SLOTS[color][tokenIndex];
    }
    if (step >= 1 && step <= 51) {
      const trackIdx = (BOARD_CONSTANTS.START_OFFSETS[color] + (step - 1)) % 52;
      return BOARD_CONSTANTS.MAIN_TRACK[trackIdx];
    }
    if (step >= 52 && step <= 56) {
      return BOARD_CONSTANTS.HOME_COLUMNS[color][step - 52];
    }
    return BOARD_CONSTANTS.HOME_DESTINATIONS[color];
  }

  coordsToPercent(r, c) {
    const stepSize = 100 / 15;
    const top = (r + 0.5) * stepSize;
    const left = (c + 0.5) * stepSize;
    return { top, left };
  }

  // Calculate array of coordinates a token will traverse
  calculatePath(color, fromStep, roll, tokenIndex) {
    const pathCoords = [];
    if (fromStep === 0) {
      // Step out of base onto start tile
      pathCoords.push(this.getCoordinates(color, 1, tokenIndex));
      return pathCoords;
    }

    const targetStep = Math.min(fromStep + roll, 57);
    for (let s = fromStep + 1; s <= targetStep; s++) {
      pathCoords.push(this.getCoordinates(color, s, tokenIndex));
    }
    return pathCoords;
  }

  // Intelligent Path Preview
  previewPath(gameState, tokenId, roll, myPlayerColor) {
    this.clearPathPreview();
    if (!gameState || !roll || tokenId === undefined) return;

    const player = gameState.players.find(p => p.color === myPlayerColor);
    if (!player || !player.tokens[tokenId]) return;

    const token = player.tokens[tokenId];
    const pathCoords = this.calculatePath(myPlayerColor, token.step, roll, tokenId);
    if (!pathCoords.length) return;

    const destCoords = pathCoords[pathCoords.length - 1];
    const [destR, destC] = destCoords;

    // Highlight intermediate path steps
    for (let i = 0; i < pathCoords.length - 1; i++) {
      const [r, c] = pathCoords[i];
      const cell = this.cellElements[r + "_" + c];
      if (cell) {
        cell.classList.add("path-step");
        this.previewStepCells.push(cell);
      }
    }

    // Highlight destination tile
    const destCell = this.cellElements[destR + "_" + destC];
    if (destCell) {
      destCell.classList.add("path-target");
      this.previewTargetCell = destCell;

      // Determine tactical badge: Capture, Safe, Goal, or Move
      let badgeType = "badge-move";
      let badgeText = "🎯 MOVE";

      const isHomeGoal = (token.step + roll) >= 57;
      if (isHomeGoal) {
        badgeType = "badge-goal";
        badgeText = "🏁 GOAL";
      } else {
        // Check for opponent tokens on landing cell
        const isSafeTile = destCell.classList.contains("safe-star") || destCell.classList.contains("cell-start-" + myPlayerColor);
        let hasEnemy = false;

        gameState.players.forEach(p => {
          if (p.color !== myPlayerColor) {
            p.tokens.forEach(t => {
              if (t.step > 0 && t.step <= 51) {
                const [er, ec] = this.getCoordinates(p.color, t.step, 0);
                if (er === destR && ec === destC) {
                  hasEnemy = true;
                }
              }
            });
          }
        });

        if (hasEnemy && !isSafeTile) {
          badgeType = "badge-capture";
          badgeText = "⚔️ CAPTURE";
        } else if (isSafeTile) {
          badgeType = "badge-safe";
          badgeText = "🛡️ SAFE";
        }
      }

      const badge = document.createElement("div");
      badge.className = "tactical-badge " + badgeType;
      badge.textContent = badgeText;
      destCell.appendChild(badge);
      this.previewBadge = badge;

      // Clicking directly on destination tile also triggers move!
      destCell.onclick = (e) => {
        e.stopPropagation();
        if (this.onTokenClick) {
          this.onTokenClick(tokenId);
        }
      };
    }
  }

  clearPathPreview() {
    this.previewStepCells.forEach(cell => {
      cell.classList.remove("path-step");
    });
    this.previewStepCells = [];

    if (this.previewTargetCell) {
      this.previewTargetCell.classList.remove("path-target");
      this.previewTargetCell.onclick = null;
      this.previewTargetCell = null;
    }

    if (this.previewBadge) {
      this.previewBadge.remove();
      this.previewBadge = null;
    }
  }

  // Step-by-step hop animation
  animateHop(playerColor, tokenIdx, fromStep, toStep, onComplete) {
    const tokenKey = playerColor + "-" + tokenIdx;
    const tokenEl = this.tokenElements[tokenKey];
    if (!tokenEl) {
      if (onComplete) onComplete();
      return;
    }

    this.isAnimating = true;
    const pathCoords = [];

    if (fromStep === 0) {
      pathCoords.push(this.getCoordinates(playerColor, 1, tokenIdx));
    } else {
      for (let s = fromStep + 1; s <= toStep; s++) {
        pathCoords.push(this.getCoordinates(playerColor, s, tokenIdx));
      }
    }

    let currentHopIndex = 0;
    const totalHops = pathCoords.length;

    const executeHop = () => {
      if (currentHopIndex >= totalHops) {
        this.isAnimating = false;
        tokenEl.classList.remove("hopping");
        if (onComplete) onComplete();
        return;
      }

      const [r, c] = pathCoords[currentHopIndex];
      const percent = this.coordsToPercent(r, c);

      tokenEl.classList.remove("hopping");
      void tokenEl.offsetWidth; // Trigger reflow for CSS animation restart
      tokenEl.classList.add("hopping");

      tokenEl.style.top = percent.top + "%";
      tokenEl.style.left = percent.left + "%";

      if (window.sounds) {
        window.sounds.playHop(currentHopIndex);
      }

      currentHopIndex++;
      setTimeout(executeHop, 140);
    };

    executeHop();
  }

  renderTokens(gameState, validMoves, myPlayerColor) {
    if (!gameState) return;
    this.lastGameState = gameState;
    this.lastValidMoves = validMoves;
    this.lastMyPlayerColor = myPlayerColor;

    if (this.isAnimating) return;

    const isMyTurn = gameState.currentTurn === myPlayerColor;
    const isMovePhase = gameState.phase === "MOVE";

    const occupiedCells = {};

    // Collect tokens for all 4 colors so the board always displays all pieces
    const colorTokens = {};
    const COLORS = ['green', 'yellow', 'blue', 'red'];

    COLORS.forEach(color => {
      const p = (gameState.players || []).find(player => player.color === color);
      if (p && Array.isArray(p.tokens) && p.tokens.length) {
        colorTokens[color] = p.tokens;
      } else if (gameState.tokens && Array.isArray(gameState.tokens[color])) {
        colorTokens[color] = gameState.tokens[color];
      } else {
        colorTokens[color] = [
          { id: 0, step: 0 },
          { id: 1, step: 0 },
          { id: 2, step: 0 },
          { id: 3, step: 0 }
        ];
      }
    });

    // Build occupied cells map
    Object.keys(colorTokens).forEach(color => {
      colorTokens[color].forEach((token, idx) => {
        const [r, c] = this.getCoordinates(color, token.step, idx);
        const cellKey = r + "_" + c;
        if (!occupiedCells[cellKey]) occupiedCells[cellKey] = [];
        occupiedCells[cellKey].push({
          playerColor: color,
          tokenIndex: idx,
          tokenData: token
        });
      });
    });

    const activeTokenKeys = new Set();
    const gridRect = this.grid ? this.grid.getBoundingClientRect() : null;

    Object.keys(colorTokens).forEach(color => {
      colorTokens[color].forEach((token, idx) => {
        const tokenKey = color + "-" + idx;
        activeTokenKeys.add(tokenKey);

        let tokenEl = this.tokenElements[tokenKey];
        if (!tokenEl) {
          tokenEl = document.createElement("div");
          tokenEl.className = "token token-" + color;
          tokenEl.dataset.color = color;
          tokenEl.dataset.index = idx;
          tokenEl.innerHTML = '<div class="token-inner"><div class="token-core"></div><span class="token-num">' + (idx + 1) + '</span></div>';

          tokenEl.addEventListener("click", () => {
            if (this.onTokenClick) {
              this.onTokenClick(idx);
            }
          });

          // Intelligent hover projection
          tokenEl.addEventListener("mouseenter", () => {
            if (color === myPlayerColor && isMyTurn && isMovePhase && validMoves && validMoves.includes(idx)) {
              this.previewPath(gameState, idx, gameState.lastRoll, myPlayerColor);
            }
          });

          tokenEl.addEventListener("mouseleave", () => {
            this.clearPathPreview();
          });

          this.grid.appendChild(tokenEl);
          this.tokenElements[tokenKey] = tokenEl;
        }

        const [r, c] = this.getCoordinates(color, token.step, idx);
        const cellKey = r + "_" + c;
        const group = occupiedCells[cellKey] || [];
        const groupIndex = group.findIndex(g => g.playerColor === color && g.tokenIndex === idx);
        const groupTotal = group.length;

        let basePercent = null;

        // Sub-pixel perfect socket centering for base slots
        if (token.step === 0 && gridRect && gridRect.width > 0) {
          const slotEl = document.querySelector('[data-slot="' + color + '-' + idx + '"]');
          if (slotEl) {
            const slotRect = slotEl.getBoundingClientRect();
            basePercent = {
              left: ((slotRect.left + slotRect.width / 2 - gridRect.left) / gridRect.width) * 100,
              top: ((slotRect.top + slotRect.height / 2 - gridRect.top) / gridRect.height) * 100
            };
          }
        }

        if (!basePercent) {
          basePercent = this.coordsToPercent(r, c);
        }

        let offsetX = 0;
        let offsetY = 0;
        let scale = 1;

        if (token.step > 0 && groupTotal > 1) {
          scale = 0.74;
          const angle = (groupIndex / groupTotal) * 2 * Math.PI;
          const radiusPercent = 1.4;
          offsetX = Math.cos(angle) * radiusPercent;
          offsetY = Math.sin(angle) * radiusPercent;
        }

        tokenEl.style.top = (basePercent.top + offsetY) + "%";
        tokenEl.style.left = (basePercent.left + offsetX) + "%";
        tokenEl.style.transform = "translate(-50%, -50%) scale(" + scale + ")";

        const isMine = color === myPlayerColor;
        const canMove = isMine && isMyTurn && isMovePhase && validMoves && validMoves.includes(idx);

        if (canMove) {
          tokenEl.classList.add("can-move");
        } else {
          tokenEl.classList.remove("can-move");
        }
      });
    });

    Object.keys(this.tokenElements).forEach(key => {
      if (!activeTokenKeys.has(key)) {
        this.tokenElements[key].remove();
        delete this.tokenElements[key];
      }
    });
  }
}
