const {
  MAIN_TRACK,
  START_OFFSETS,
  HOME_COLUMNS,
  HOME_DESTINATIONS,
  BASE_SLOTS,
  SAFE_TRACK_INDICES
} = require('./constants');

class Board {
  constructor() {
    this.totalTrackCells = 52;
    this.TOTAL_STEPS = 57;
  }

  getCoordinates(color, step, tokenIndex = 0) {
    if (step === 0) {
      return BASE_SLOTS[color][tokenIndex];
    }
    if (step >= 1 && step <= 51) {
      const idx = (START_OFFSETS[color] + (step - 1)) % 52;
      return MAIN_TRACK[idx];
    }
    if (step >= 52 && step <= 56) {
      return HOME_COLUMNS[color][step - 52];
    }
    if (step >= 57) {
      return HOME_DESTINATIONS[color];
    }
    return null;
  }

  isPositionSafe(color, step) {
    if (step === 0 || step >= 52) return true;
    const idx = (START_OFFSETS[color] + (step - 1)) % 52;
    return SAFE_TRACK_INDICES.includes(idx);
  }

  getCellKey(color, step, tokenIndex = 0) {
    if (step === 0) return 'yard_' + color + '_' + tokenIndex;
    if (step >= 1 && step <= 51) {
      const idx = (START_OFFSETS[color] + (step - 1)) % 52;
      return 'track_' + idx;
    }
    if (step >= 52 && step <= 56) {
      return 'homecol_' + color + '_' + (step - 52);
    }
    return 'home_' + color;
  }
}

module.exports = new Board();
