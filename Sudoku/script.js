/*
 * Sudoku Puzzle App
 *
 * This script contains all the logic required to generate Sudoku puzzles of
 * varying difficulty, render the grid on the page, handle user input
 * (including pencil notes), provide hints, and highlight mistakes.
 *
 * Puzzles are generated using a simple backtracking algorithm to create a
 * fully solved board, then numbers are removed randomly to match the
 * selected difficulty. Each puzzle therefore has a unique solution. While
 * the removal strategy isn’t based on sophisticated human-solving logic,
 * the number of removed cells increases with difficulty.
 */

(() => {
  // Game state
  let board = [];            // current puzzle (0 represents empty)
  let solution = [];         // solved puzzle
  let fixedPositions = [];   // boolean map indicating given numbers
  let notes = [];            // notes[r][c] is a Set of candidate numbers
  let selectedCellEl = null; // currently selected DOM cell element

  // Toggles
  let notesMode = false;
  let autoCheckEnabled = false;
  let duplicatesHighlightEnabled = true;

  // Difficulty settings: how many numbers to remove from the solved grid
  const removalCounts = {
    easy: 35,
    medium: 45,
    hard: 55,
    expert: 60,
  };

  // Initialize once DOM is fully loaded
  document.addEventListener('DOMContentLoaded', () => {
    createNumberPad();
    attachControlEvents();
    startNewGame();
  });

  /* Generates a complete Sudoku board using a backtracking algorithm. A
   * recursive helper fills the grid row by row, column by column. At each
   * cell a randomised list of numbers 1–9 is tried; if a candidate
   * conforms to the Sudoku constraints (no duplicates in row, column or
   * subgrid) it is placed and the algorithm proceeds to the next cell.
   */
  function generateFullBoard() {
    const board = Array.from({ length: 9 }, () => new Array(9).fill(0));
    // Check whether placing `num` at (row, col) is valid
    const isSafe = (row, col, num) => {
      // Row check
      for (let c = 0; c < 9; c++) {
        if (board[row][c] === num) return false;
      }
      // Column check
      for (let r = 0; r < 9; r++) {
        if (board[r][col] === num) return false;
      }
      // 3×3 subgrid check
      const startRow = Math.floor(row / 3) * 3;
      const startCol = Math.floor(col / 3) * 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (board[startRow + r][startCol + c] === num) return false;
        }
      }
      return true;
    };
    // Shuffle an array in-place (Fisher–Yates algorithm)
    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    // Recursive fill
    const fillCell = (row, col) => {
      if (row === 9) return true; // all rows filled
      const nextRow = col === 8 ? row + 1 : row;
      const nextCol = col === 8 ? 0 : col + 1;
      const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const num of nums) {
        if (isSafe(row, col, num)) {
          board[row][col] = num;
          if (fillCell(nextRow, nextCol)) return true;
          board[row][col] = 0;
        }
      }
      return false;
    };
    fillCell(0, 0);
    return board;
  }

  /* Remove `count` numbers from the solved board at random. This function
   * modifies the board in place. Removing more numbers increases puzzle
   * difficulty by providing fewer clues. A simple loop ensures only
   * originally filled cells are cleared (no duplicates).
   */
  function removeNumbers(board, count) {
    let removed = 0;
    while (removed < count) {
      const r = Math.floor(Math.random() * 9);
      const c = Math.floor(Math.random() * 9);
      if (board[r][c] !== 0) {
        board[r][c] = 0;
        removed++;
      }
    }
  }

  /* Draws the Sudoku board inside the #sudoku-board container. Cells are
   * created dynamically for each row and column. Event listeners are
   * attached to handle selection and editing. Thick borders delineate
   * subgrids.
   */
  function drawBoard() {
    const container = document.getElementById('sudoku-board');
    container.innerHTML = '';
    selectedCellEl = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.classList.add('sudoku-cell');
        // Thick borders for subgrid separators
        if (r === 0) cell.classList.add('top-border-thick');
        if (c === 0) cell.classList.add('left-border-thick');
        if (r === 8) cell.classList.add('bottom-border-thick');
        if (c === 8) cell.classList.add('right-border-thick');
        if (r % 3 === 0) cell.classList.add('top-border-thick');
        if (c % 3 === 0) cell.classList.add('left-border-thick');
        // Attach data attributes
        cell.dataset.row = r;
        cell.dataset.col = c;
        updateCellContent(cell, r, c);
        cell.addEventListener('click', () => selectCell(cell));
        container.appendChild(cell);
      }
    }
  }

  /* Updates the visual content of a cell element based on the current
   * board value and its associated notes. If the cell is fixed (given),
   * a different style is applied.
   */
  function updateCellContent(cell, row, col) {
    cell.classList.remove('fixed', 'editable');
    cell.textContent = '';
    const existingNotes = cell.querySelector('.notes');
    if (existingNotes) cell.removeChild(existingNotes);
    const value = board[row][col];
    if (value !== 0) {
      cell.textContent = value;
      if (fixedPositions[row][col]) {
        cell.classList.add('fixed');
      } else {
        cell.classList.add('editable');
      }
    } else {
      const noteSet = notes[row][col];
      const notesContainer = document.createElement('div');
      notesContainer.classList.add('notes');
      for (let n = 1; n <= 9; n++) {
        const span = document.createElement('span');
        span.textContent = noteSet.has(n) ? n : '';
        notesContainer.appendChild(span);
      }
      cell.appendChild(notesContainer);
    }
  }

  /* Handles cell selection. The selected cell is highlighted and its
   * row, column and subgrid are lightly shaded. Selecting a fixed cell
   * still moves the highlight but does not allow editing.
   */
  function selectCell(cellEl) {
    deselectAllCells();
    selectedCellEl = cellEl;
    selectedCellEl.classList.add('selected');
    updateHighlights();
  }

  /* Removes highlight classes from all cells before applying new highlights. */
  function deselectAllCells() {
    const cells = document.querySelectorAll('.sudoku-cell');
    cells.forEach((cell) => {
      cell.classList.remove('selected','highlight-area','highlight-same');
    });
  }

  /* Updates row/column/subgrid shading and highlights numbers matching the
   * selected cell’s value. Also recalculates duplicate and error classes.
   */
  function updateHighlights() {
    updateConflicts();
    // Clear highlight classes
    const cells = document.querySelectorAll('.sudoku-cell');
    cells.forEach((cell) => {
      cell.classList.remove('highlight-area','highlight-same');
    });
    if (!selectedCellEl) return;
    const selectedRow = parseInt(selectedCellEl.dataset.row);
    const selectedCol = parseInt(selectedCellEl.dataset.col);
    const selectedVal = board[selectedRow][selectedCol];
    cells.forEach((cell) => {
      const r = parseInt(cell.dataset.row);
      const c = parseInt(cell.dataset.col);
      // Shade same row, column, or subgrid
      if (
        r === selectedRow ||
        c === selectedCol ||
        (Math.floor(r / 3) === Math.floor(selectedRow / 3) &&
         Math.floor(c / 3) === Math.floor(selectedCol / 3))
      ) {
        cell.classList.add('highlight-area');
      }
      // Highlight same numbers across the grid when enabled
      if (
        duplicatesHighlightEnabled &&
        selectedVal !== 0 &&
        board[r][c] === selectedVal
      ) {
        cell.classList.add('highlight-same');
      }
    });
  }

  /* Creates the number pad below the board. Buttons 1–9 call inputNumber,
   * and the Erase button clears the selected cell.
   */
  function createNumberPad() {
    const pad = document.getElementById('number-pad');
    pad.innerHTML = '';
    for (let n = 1; n <= 9; n++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-primary btn-sm';
      btn.textContent = n;
      btn.dataset.number = n;
      btn.addEventListener('click', () => inputNumber(n));
      pad.appendChild(btn);
    }
    const eraseBtn = document.createElement('button');
    eraseBtn.type = 'button';
    eraseBtn.className = 'btn btn-outline-danger btn-sm';
    eraseBtn.textContent = 'Erase';
    eraseBtn.addEventListener('click', () => eraseSelected());
    pad.appendChild(eraseBtn);
  }

  /* Attaches event listeners to the difficulty select and control buttons. */
  function attachControlEvents() {
    document.getElementById('difficulty').addEventListener('change', () => {
      startNewGame();
    });
    document.getElementById('newGameBtn').addEventListener('click', () => {
      startNewGame();
    });
    document.getElementById('hintBtn').addEventListener('click', giveHint);
    // Note toggle
    document.getElementById('noteToggleBtn').addEventListener('click', (e) => {
      notesMode = !notesMode;
      updateToggleButton(e.currentTarget, notesMode);
    });
    // Auto‑check toggle
    document.getElementById('autoCheckToggleBtn')
      .addEventListener('click', (e) => {
        autoCheckEnabled = !autoCheckEnabled;
        updateToggleButton(e.currentTarget, autoCheckEnabled);
        updateConflicts();
      });
    // Duplicates toggle
    document.getElementById('duplicateToggleBtn')
      .addEventListener('click', (e) => {
        duplicatesHighlightEnabled = !duplicatesHighlightEnabled;
        updateToggleButton(e.currentTarget, duplicatesHighlightEnabled);
        updateHighlights();
      });
    // Global keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
  }

  /* Updates the appearance of toggle buttons based on active state. */
  function updateToggleButton(button, active) {
    if (active) {
      button.classList.remove('btn-outline-secondary');
      button.classList.add('btn-secondary');
    } else {
      button.classList.remove('btn-secondary');
      button.classList.add('btn-outline-secondary');
    }
  }

  /* Starts a new puzzle using the selected difficulty. Clears previous
   * game state, generates a full solution, removes numbers according to
   * difficulty, and renders the fresh board.
   */
  function startNewGame() {
    const diff = document.getElementById('difficulty').value;
    notesMode = false;
    updateToggleButton(document.getElementById('noteToggleBtn'), notesMode);
    // Generate solved board
    board = generateFullBoard();
    solution = board.map((row) => row.slice());
    fixedPositions = Array.from({ length: 9 }, () => new Array(9).fill(false));
    notes = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );
    const removals = removalCounts[diff] ?? 45;
    removeNumbers(board, removals);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        fixedPositions[r][c] = board[r][c] !== 0;
      }
    }
    drawBoard();
    updateConflicts();
    updateStatus('');
  }

  /* Inputs a number into the selected cell. Behaviour depends on whether
   * note mode is active. In note mode the number toggles as a candidate; in
   * normal mode it sets the cell’s value. Duplicate and error highlights
   * are updated after each entry.
   */
  function inputNumber(num) {
    if (!selectedCellEl) return;
    const row = parseInt(selectedCellEl.dataset.row);
    const col = parseInt(selectedCellEl.dataset.col);
    if (fixedPositions[row][col]) return;
    if (notesMode) {
      const noteSet = notes[row][col];
      if (noteSet.has(num)) {
        noteSet.delete(num);
      } else {
        noteSet.add(num);
      }
      board[row][col] = 0;
      updateCellContent(selectedCellEl, row, col);
    } else {
      board[row][col] = num;
      notes[row][col].clear();
      updateCellContent(selectedCellEl, row, col);
    }
    updateConflicts();
    updateHighlights();
    if (isSolved()) {
      updateStatus('Congratulations! You solved the puzzle.');
    }
  }

  /* Clears the selected cell’s value and notes, if it is not a fixed clue. */
  function eraseSelected() {
    if (!selectedCellEl) return;
    const row = parseInt(selectedCellEl.dataset.row);
    const col = parseInt(selectedCellEl.dataset.col);
    if (fixedPositions[row][col]) return;
    board[row][col] = 0;
    notes[row][col].clear();
    updateCellContent(selectedCellEl, row, col);
    updateConflicts();
    updateHighlights();
    updateStatus('');
  }

  /* Provides a hint by filling one incorrect or empty cell with its
   * corresponding value from the solution. Hinted cells become fixed to
   * prevent further editing.
   */
  function giveHint() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!fixedPositions[r][c]) {
          const current = board[r][c];
          const correct = solution[r][c];
          if (current === 0 || current !== correct) {
            board[r][c] = correct;
            fixedPositions[r][c] = true;
            notes[r][c].clear();
            const cellEl = document.querySelector(
              `.sudoku-cell[data-row="${r}"][data-col="${c}"]`
            );
            updateCellContent(cellEl, r, c);
            updateConflicts();
            updateHighlights();
            selectCell(cellEl);
            if (isSolved()) {
              updateStatus('Puzzle solved using a hint!');
            }
            return;
          }
        }
      }
    }
    updateStatus('No available hints.');
  }

  /* Computes duplicate positions for current board. Returns a Set of
   * coordinates encoded as 'r-c' representing cells that conflict in rows,
   * columns or 3×3 subgrids.
   */
  function calculateDuplicatePositions() {
    const duplicates = new Set();
    // Row duplicates
    for (let r = 0; r < 9; r++) {
      const map = {};
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val === 0) continue;
        if (!map[val]) map[val] = [];
        map[val].push(c);
      }
      for (const val in map) {
        if (map[val].length > 1) {
          for (const c of map[val]) duplicates.add(`${r}-${c}`);
        }
      }
    }
    // Column duplicates
    for (let c = 0; c < 9; c++) {
      const map = {};
      for (let r = 0; r < 9; r++) {
        const val = board[r][c];
        if (val === 0) continue;
        if (!map[val]) map[val] = [];
        map[val].push(r);
      }
      for (const val in map) {
        if (map[val].length > 1) {
          for (const r of map[val]) duplicates.add(`${r}-${c}`);
        }
      }
    }
    // Subgrid duplicates
    for (let br = 0; br < 3; br++) {
      for (let bc = 0; bc < 3; bc++) {
        const map = {};
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const row = br * 3 + r;
            const col = bc * 3 + c;
            const val = board[row][col];
            if (val === 0) continue;
            if (!map[val]) map[val] = [];
            map[val].push([row, col]);
          }
        }
        for (const val in map) {
          if (map[val].length > 1) {
            for (const [row, col] of map[val]) {
              duplicates.add(`${row}-${col}`);
            }
          }
        }
      }
    }
    return duplicates;
  }

  /* Updates duplicate and error highlights across the entire grid. This
   * function clears any previous 'duplicate' and 'error' classes before
   * applying new ones. If auto‑check is enabled, wrong numbers are
   * marked.
   */
  function updateConflicts() {
    const cells = document.querySelectorAll('.sudoku-cell');
    cells.forEach((cell) => {
      cell.classList.remove('duplicate', 'error');
    });
    const dupes = calculateDuplicatePositions();
    dupes.forEach((key) => {
      const [rStr, cStr] = key.split('-');
      const r = parseInt(rStr);
      const c = parseInt(cStr);
      const cellEl = document.querySelector(
        `.sudoku-cell[data-row="${r}"][data-col="${c}"]`
      );
      if (cellEl) cellEl.classList.add('duplicate');
    });
    if (autoCheckEnabled) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (board[r][c] !== 0 && board[r][c] !== solution[r][c]) {
            const cellEl = document.querySelector(
              `.sudoku-cell[data-row="${r}"][data-col="${c}"]`
            );
            if (cellEl) cellEl.classList.add('error');
          }
        }
      }
    }
  }

  /* Determines whether the current board matches the solved grid (i.e.
   * puzzle is complete and correct).
   */
  function isSolved() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] === 0 || board[r][c] !== solution[r][c]) {
          return false;
        }
      }
    }
    return true;
  }

  /* Updates the status message displayed below the board. */
  function updateStatus(message) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
  }

  /* Handles keyboard navigation and input. Arrow keys move the selection,
   * numbers enter values, backspace/delete erases, and certain letters
   * trigger toggle functions.
   */
  function handleKeyDown(event) {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }
    if (!selectedCellEl) {
      const first = document.querySelector('.sudoku-cell');
      if (first) selectCell(first);
    }
    const key = event.key;
    if (key.startsWith('Arrow')) {
      event.preventDefault();
      switch (key) {
        case 'ArrowUp':
          moveSelection(-1, 0);
          break;
        case 'ArrowDown':
          moveSelection(1, 0);
          break;
        case 'ArrowLeft':
          moveSelection(0, -1);
          break;
        case 'ArrowRight':
          moveSelection(0, 1);
          break;
      }
      return;
    }
    if (/^[1-9]$/.test(key)) {
      inputNumber(parseInt(key));
      return;
    }
    if (key === 'Backspace' || key === 'Delete' || key === '0') {
      eraseSelected();
      return;
    }
    if (key.toLowerCase() === 'n') {
      notesMode = !notesMode;
      updateToggleButton(document.getElementById('noteToggleBtn'), notesMode);
      return;
    }
    if (key.toLowerCase() === 'h') {
      giveHint();
      return;
    }
    if (key.toLowerCase() === 'a') {
      autoCheckEnabled = !autoCheckEnabled;
      updateToggleButton(document.getElementById('autoCheckToggleBtn'), autoCheckEnabled);
      updateConflicts();
      return;
    }
    if (key.toLowerCase() === 'd') {
      duplicatesHighlightEnabled = !duplicatesHighlightEnabled;
      updateToggleButton(document.getElementById('duplicateToggleBtn'), duplicatesHighlightEnabled);
      updateHighlights();
      return;
    }
    if (key === 'Escape') {
      selectedCellEl = null;
      deselectAllCells();
      return;
    }
  }

  /* Moves the selection relative to the current selected cell by (dr, dc).
   * Wraps around at board boundaries.
   */
  function moveSelection(dr, dc) {
    if (!selectedCellEl) return;
    const row = parseInt(selectedCellEl.dataset.row);
    const col = parseInt(selectedCellEl.dataset.col);
    let newRow = row + dr;
    let newCol = col + dc;
    if (newRow < 0) newRow = 8;
    if (newRow > 8) newRow = 0;
    if (newCol < 0) newCol = 8;
    if (newCol > 8) newCol = 0;
    const nextCell = document.querySelector(
      `.sudoku-cell[data-row="${newRow}"][data-col="${newCol}"]`
    );
    if (nextCell) selectCell(nextCell);
  }
})();