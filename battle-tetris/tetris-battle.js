// Classic Tetris Battle Game: ARIA vs AI (Simultaneous Play)
class TetrisBattle {
    constructor() {
        this.boardWidth = 10;
        this.boardHeight = 20;
        this.cellSize = 28;
        this.gameOver = false;
        this.isPaused = false;
        
        // Game speed
        this.fallInterval = 1000; // milliseconds
        this.ariaFallTimer = 0;
        this.aiFallTimer = 0;
        this.lastTime = 0;
        
        // Movement settings (DAS - Delayed Auto Shift, ARR - Auto Repeat Rate)
        this.dasDelay = 133; // ms before auto-repeat starts
        this.arrSpeed = 0;   // ms between each movement (0 = instant)
        this.ariaKeyHeld = { left: false, right: false };
        this.ariaKeyTimer = { left: 0, right: 0 };
        this.ariaKeyLastMove = { left: 0, right: 0 };
        
        // Scores and stats
        this.ariaScore = 0;
        this.ariaLines = 0;
        this.aiScore = 0;
        this.aiLines = 0;
        this.level = 1;
        
        // Combo system
        this.ariaCombo = 0;
        this.aiCombo = 0;
        this.ariaLastClearTime = 0;
        this.aiLastClearTime = 0;
        this.comboTimeout = 3000; // 3 seconds to maintain combo
        
        // Initialize boards
        this.ariaBoard = this.createEmptyBoard();
        this.aiBoard = this.createEmptyBoard();
        
        // Current pieces
        this.ariaPiece = null;
        this.ariaPieceX = 0;
        this.ariaPieceY = 0;
        this.ariaPieceType = 0;
        this.aiPiece = null;
        this.aiPieceX = 0;
        this.aiPieceY = 0;
        this.aiPieceType = 0;
        
        // Hold pieces
        this.ariaHoldPiece = null;
        this.ariaCanHold = true;
        this.aiHoldPiece = null;
        this.aiCanHold = true;
        
        // Classic Tetris pieces with types
        this.pieceTypes = [
            { shape: [[1,1,1,1]], color: '#00f0f0', name: 'I' }, // Cyan
            { shape: [[1,1],[1,1]], color: '#f0f000', name: 'O' }, // Yellow
            { shape: [[0,1,0],[1,1,1]], color: '#a000f0', name: 'T' }, // Purple
            { shape: [[1,1,0],[0,1,1]], color: '#00f000', name: 'S' }, // Green
            { shape: [[0,1,1],[1,1,0]], color: '#f00000', name: 'Z' }, // Red
            { shape: [[1,0,0],[1,1,1]], color: '#0000f0', name: 'J' }, // Blue
            { shape: [[0,0,1],[1,1,1]], color: '#f0a000', name: 'L' }  // Orange
        ];
        
        this.ariaNextPiece = this.getRandomPieceType();
        this.aiNextPiece = this.getRandomPieceType();
        
        // AI decision making
        this.aiDecisionTimer = 0;
        this.aiTargetX = 0;
        this.aiTargetRotation = 0;
        this.aiCurrentRotation = 0;
        this.aiPlannedHold = false;
        
        this.setupBoards();
        this.setupControls();
        this.startGame();
        this.gameLoop();
    }
    
    createEmptyBoard() {
        return Array(this.boardHeight).fill(null).map(() => 
            Array(this.boardWidth).fill(0)
        );
    }
    
    getRandomPieceType() {
        return Math.floor(Math.random() * this.pieceTypes.length);
    }
    
    getPieceShape(type) {
        return this.pieceTypes[type].shape.map(row => [...row]);
    }
    
    getPieceColor(type) {
        return this.pieceTypes[type].color;
    }
    
    setupBoards() {
        const gameArea = document.getElementById('tetris-game-area');
        gameArea.innerHTML = '';
        
        // ARIA Board
        const ariaContainer = document.createElement('div');
        ariaContainer.className = 'tetris-board-container';
        ariaContainer.innerHTML = `
            <h3>ARIA</h3>
            <div style="display: flex; gap: 1rem; justify-content: center; align-items: flex-start;">
                <div>
                    <div style="margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">Hold:</div>
                    <div class="next-piece-preview" id="aria-hold"></div>
                    <div style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">Next:</div>
                    <div class="next-piece-preview" id="aria-next"></div>
                </div>
                <div class="tetris-board" id="aria-board"></div>
            </div>
            <div class="tetris-info" id="aria-info">Score: 0 | Lines: 0 | Level: 1</div>
            <div class="tetris-controls" id="aria-controls">
                <button id="aria-left">←</button>
                <button id="aria-right">→</button>
                <button id="aria-rotate">↻</button>
                <button id="aria-hold-btn">Hold</button>
                <button id="aria-soft-drop">↓</button>
                <button id="aria-hard-drop">⬇</button>
            </div>
        `;
        
        // AI Board
        const aiContainer = document.createElement('div');
        aiContainer.className = 'tetris-board-container';
        aiContainer.innerHTML = `
            <h3>AI Agent</h3>
            <div style="display: flex; gap: 1rem; justify-content: center; align-items: flex-start;">
                <div>
                    <div style="margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">Hold:</div>
                    <div class="next-piece-preview" id="ai-hold"></div>
                    <div style="margin-top: 1rem; margin-bottom: 0.5rem; font-size: 0.9rem; opacity: 0.8;">Next:</div>
                    <div class="next-piece-preview" id="ai-next"></div>
                </div>
                <div class="tetris-board" id="ai-board"></div>
            </div>
            <div class="tetris-info" id="ai-info">Score: 0 | Lines: 0 | Level: 1</div>
            <div class="tetris-controls">
                <span>AI Playing...</span>
            </div>
        `;
        
        gameArea.appendChild(ariaContainer);
        gameArea.appendChild(aiContainer);
        
        this.ariaBoardElement = document.getElementById('aria-board');
        this.aiBoardElement = document.getElementById('ai-board');
        this.ariaNextElement = document.getElementById('aria-next');
        this.aiNextElement = document.getElementById('ai-next');
        this.ariaHoldElement = document.getElementById('aria-hold');
        this.aiHoldElement = document.getElementById('ai-hold');
        this.ariaInfo = document.getElementById('aria-info');
        this.aiInfo = document.getElementById('ai-info');
        
        this.renderBoard('ARIA');
        this.renderBoard('AI');
        this.renderNextPiece('ARIA');
        this.renderNextPiece('AI');
        this.renderHoldPiece('ARIA');
        this.renderHoldPiece('AI');
    }
    
    setupControls() {
        document.getElementById('aria-left').addEventListener('click', () => this.movePiece('ARIA', -1, 0));
        document.getElementById('aria-right').addEventListener('click', () => this.movePiece('ARIA', 1, 0));
        document.getElementById('aria-rotate').addEventListener('click', () => this.rotatePiece('ARIA'));
        document.getElementById('aria-hold-btn').addEventListener('click', () => this.holdPiece('ARIA'));
        document.getElementById('aria-soft-drop').addEventListener('click', () => this.softDrop('ARIA'));
        document.getElementById('aria-hard-drop').addEventListener('click', () => this.hardDrop('ARIA'));
        
        // Keyboard controls with DAS/ARR
        document.addEventListener('keydown', (e) => {
            if (this.gameOver || this.isPaused) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    if (!this.ariaKeyHeld.left) {
                        this.movePiece('ARIA', -1, 0);
                        this.ariaKeyHeld.left = true;
                        this.ariaKeyTimer.left = 0;
                        this.ariaKeyLastMove.left = Date.now();
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (!this.ariaKeyHeld.right) {
                        this.movePiece('ARIA', 1, 0);
                        this.ariaKeyHeld.right = true;
                        this.ariaKeyTimer.right = 0;
                        this.ariaKeyLastMove.right = Date.now();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.rotatePiece('ARIA');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.softDrop('ARIA');
                    break;
                case ' ':
                    e.preventDefault();
                    this.hardDrop('ARIA');
                    break;
            }
            
            // Shift key for hold (check separately)
            if (e.shiftKey && !e.repeat) {
                e.preventDefault();
                this.holdPiece('ARIA');
            }
        });
        
        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    this.ariaKeyHeld.left = false;
                    this.ariaKeyTimer.left = 0;
                    break;
                case 'ArrowRight':
                    this.ariaKeyHeld.right = false;
                    this.ariaKeyTimer.right = 0;
                    break;
            }
        });
        
        this.setupSettings();
    }
    
    startGame() {
        this.spawnPiece('ARIA');
        this.spawnPiece('AI');
        this.updateInfo('ARIA');
        this.updateInfo('AI');
        this.renderBoard('ARIA');
        this.renderBoard('AI');
        this.renderNextPiece('ARIA');
        this.renderNextPiece('AI');
        this.renderHoldPiece('ARIA');
        this.renderHoldPiece('AI');
    }
    
    gameLoop() {
        if (this.gameOver || this.isPaused) {
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        const currentTime = Date.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Update fall timers
        this.ariaFallTimer += deltaTime;
        this.aiFallTimer += deltaTime;
        
        // Handle DAS/ARR for left/right movement
        this.handleMovementInput(deltaTime);
        
        // ARIA piece falling
        if (this.ariaFallTimer >= this.fallInterval) {
            this.ariaFallTimer = 0;
            if (!this.movePiece('ARIA', 0, 1)) {
                this.lockPiece('ARIA');
            }
        }
        
        // AI piece falling
        if (this.aiFallTimer >= this.fallInterval) {
            this.aiFallTimer = 0;
            if (!this.movePiece('AI', 0, 1)) {
                this.lockPiece('AI');
            }
        }
        
        // AI decision making
        this.aiThink();
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    handleMovementInput(deltaTime) {
        const currentTime = Date.now();
        
        // Handle left movement
        if (this.ariaKeyHeld.left) {
            this.ariaKeyTimer.left += deltaTime;
            
            if (this.ariaKeyTimer.left >= this.dasDelay) {
                const timeSinceLastMove = currentTime - this.ariaKeyLastMove.left;
                if (timeSinceLastMove >= this.arrSpeed) {
                    this.movePiece('ARIA', -1, 0);
                    this.ariaKeyLastMove.left = currentTime;
                }
            }
        }
        
        // Handle right movement
        if (this.ariaKeyHeld.right) {
            this.ariaKeyTimer.right += deltaTime;
            
            if (this.ariaKeyTimer.right >= this.dasDelay) {
                const timeSinceLastMove = currentTime - this.ariaKeyLastMove.right;
                if (timeSinceLastMove >= this.arrSpeed) {
                    this.movePiece('ARIA', 1, 0);
                    this.ariaKeyLastMove.right = currentTime;
                }
            }
        }
    }
    
    setupSettings() {
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            const settingsBtn = document.querySelector('.settings-btn');
            const settingsModal = document.getElementById('settings-modal');
            const closeSettings = document.getElementById('close-settings');
            const dasSlider = document.getElementById('das-delay');
            const arrSlider = document.getElementById('arr-speed');
            const dasValue = document.getElementById('das-value');
            const arrValue = document.getElementById('arr-value');
            const resetBtn = document.getElementById('reset-settings');
            
            if (!settingsModal || !settingsBtn) return; // Elements not ready yet
            
            // Load saved settings
            const savedDas = localStorage.getItem('tetris-das');
            const savedArr = localStorage.getItem('tetris-arr');
            if (savedDas && dasSlider && dasValue) {
                this.dasDelay = parseInt(savedDas);
                dasSlider.value = savedDas;
                dasValue.textContent = savedDas;
            }
            if (savedArr && arrSlider && arrValue) {
                this.arrSpeed = parseInt(savedArr);
                arrSlider.value = savedArr;
                arrValue.textContent = savedArr;
            }
            
            // Open settings
            settingsBtn.addEventListener('click', () => {
                settingsModal.classList.remove('hidden');
            });
            
            // Close settings
            if (closeSettings) {
                closeSettings.addEventListener('click', () => {
                    settingsModal.classList.add('hidden');
                });
            }
            
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });
            
            // Update DAS
            if (dasSlider && dasValue) {
                dasSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.dasDelay = value;
                    dasValue.textContent = value;
                    localStorage.setItem('tetris-das', value);
                });
            }
            
            // Update ARR
            if (arrSlider && arrValue) {
                arrSlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value);
                    this.arrSpeed = value;
                    arrValue.textContent = value;
                    localStorage.setItem('tetris-arr', value);
                });
            }
            
            // Reset to default
            if (resetBtn && dasSlider && arrSlider && dasValue && arrValue) {
                resetBtn.addEventListener('click', () => {
                    this.dasDelay = 133;
                    this.arrSpeed = 0;
                    dasSlider.value = 133;
                    arrSlider.value = 0;
                    dasValue.textContent = '133';
                    arrValue.textContent = '0';
                    localStorage.setItem('tetris-das', '133');
                    localStorage.setItem('tetris-arr', '0');
                });
            }
        }, 100);
    }
    
    spawnPiece(player) {
        const nextPieceType = player === 'ARIA' ? this.ariaNextPiece : this.aiNextPiece;
        const pieceShape = this.getPieceShape(nextPieceType);
        
        if (player === 'ARIA') {
            this.ariaPiece = pieceShape;
            this.ariaPieceType = nextPieceType;
            this.ariaPieceX = Math.floor((this.boardWidth - pieceShape[0].length) / 2);
            this.ariaPieceY = 0;
            this.ariaNextPiece = this.getRandomPieceType();
        } else {
            this.aiPiece = pieceShape;
            this.aiPieceType = nextPieceType;
            this.aiPieceX = Math.floor((this.boardWidth - pieceShape[0].length) / 2);
            this.aiPieceY = 0;
            this.aiNextPiece = this.getRandomPieceType();
        }
        
        // Check if game over
        if (!this.canPlacePiece(player, this.ariaPieceX, this.ariaPieceY)) {
            this.endGame(player === 'ARIA' ? 'AI' : 'ARIA');
        }
    }
    
    canPlacePiece(player, x, y, piece = null) {
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        const currentPiece = piece || (player === 'ARIA' ? this.ariaPiece : this.aiPiece);
        
        if (!currentPiece) return false;
        
        for (let py = 0; py < currentPiece.length; py++) {
            for (let px = 0; px < currentPiece[py].length; px++) {
                if (currentPiece[py][px]) {
                    const boardX = x + px;
                    const boardY = y + py;
                    
                    if (boardX < 0 || boardX >= this.boardWidth || 
                        boardY >= this.boardHeight ||
                        (boardY >= 0 && board[boardY][boardX])) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    movePiece(player, dx, dy) {
        if (this.gameOver) return false;
        
        const x = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const y = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        if (this.canPlacePiece(player, x + dx, y + dy)) {
            if (player === 'ARIA') {
                this.ariaPieceX += dx;
                this.ariaPieceY += dy;
            } else {
                this.aiPieceX += dx;
                this.aiPieceY += dy;
            }
            this.renderBoard(player);
            return true;
        }
        return false;
    }
    
    rotatePiece(player) {
        if (this.gameOver) return;
        
        const piece = player === 'ARIA' ? this.ariaPiece : this.aiPiece;
        const rotated = this.rotateMatrix(piece);
        const x = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const y = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        // Try rotation, with wall kicks
        if (this.canPlacePiece(player, x, y, rotated)) {
            if (player === 'ARIA') {
                this.ariaPiece = rotated;
            } else {
                this.aiPiece = rotated;
            }
            this.renderBoard(player);
        } else {
            // Try wall kick left
            if (this.canPlacePiece(player, x - 1, y, rotated)) {
                if (player === 'ARIA') {
                    this.ariaPiece = rotated;
                    this.ariaPieceX -= 1;
                } else {
                    this.aiPiece = rotated;
                    this.aiPieceX -= 1;
                }
                this.renderBoard(player);
            } else if (this.canPlacePiece(player, x + 1, y, rotated)) {
                // Try wall kick right
                if (player === 'ARIA') {
                    this.ariaPiece = rotated;
                    this.ariaPieceX += 1;
                } else {
                    this.aiPiece = rotated;
                    this.aiPieceX += 1;
                }
                this.renderBoard(player);
            }
        }
    }
    
    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
        
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                rotated[j][rows - 1 - i] = matrix[i][j];
            }
        }
        return rotated;
    }
    
    holdPiece(player) {
        if (this.gameOver) return;
        
        if (player === 'ARIA') {
            if (!this.ariaCanHold) return;
            this.ariaCanHold = false;
            
            if (this.ariaHoldPiece === null) {
                // First hold - store current piece and get next
                this.ariaHoldPiece = this.ariaPieceType;
                this.spawnPiece('ARIA');
            } else {
                // Swap current with held piece
                const temp = this.ariaHoldPiece;
                this.ariaHoldPiece = this.ariaPieceType;
                this.ariaPieceType = temp;
                this.ariaPiece = this.getPieceShape(temp);
                this.ariaPieceX = Math.floor((this.boardWidth - this.ariaPiece[0].length) / 2);
                this.ariaPieceY = 0;
            }
            this.renderHoldPiece('ARIA');
            this.renderBoard('ARIA');
            this.renderNextPiece('ARIA');
        } else {
            if (!this.aiCanHold) return;
            this.aiCanHold = false;
            
            if (this.aiHoldPiece === null) {
                this.aiHoldPiece = this.aiPieceType;
                this.spawnPiece('AI');
            } else {
                const temp = this.aiHoldPiece;
                this.aiHoldPiece = this.aiPieceType;
                this.aiPieceType = temp;
                this.aiPiece = this.getPieceShape(temp);
                this.aiPieceX = Math.floor((this.boardWidth - this.aiPiece[0].length) / 2);
                this.aiPieceY = 0;
            }
            this.renderHoldPiece('AI');
            this.renderBoard('AI');
            this.renderNextPiece('AI');
            this.aiCurrentRotation = 0;
        }
    }
    
    softDrop(player) {
        this.movePiece(player, 0, 1);
    }
    
    hardDrop(player) {
        let x = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        let y = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        while (this.canPlacePiece(player, x, y + 1)) {
            y++;
        }
        
        if (player === 'ARIA') {
            this.ariaPieceY = y;
        } else {
            this.aiPieceY = y;
        }
        
        this.renderBoard(player);
        this.lockPiece(player);
    }
    
    lockPiece(player) {
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        const piece = player === 'ARIA' ? this.ariaPiece : this.aiPiece;
        const pieceType = player === 'ARIA' ? this.ariaPieceType : this.aiPieceType;
        const x = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const y = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        // Place piece on board with color
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const boardY = y + py;
                    if (boardY >= 0) {
                        board[boardY][x + px] = pieceType + 1; // Store piece type (1-7)
                    }
                }
            }
        }
        
        // Detect T-spin before clearing lines
        const isTSpin = this.detectTSpin(player, x, y);
        
        // Clear lines
        const linesCleared = this.clearLines(player);
        
        // Update combo system
        const currentTime = Date.now();
        let combo = player === 'ARIA' ? this.ariaCombo : this.aiCombo;
        let lastClearTime = player === 'ARIA' ? this.ariaLastClearTime : this.aiLastClearTime;
        
        // Initialize lastClearTime if it's 0 (first clear)
        if (lastClearTime === 0) {
            lastClearTime = currentTime;
        }
        
        if (linesCleared > 0) {
            // Check if combo should continue
            if (currentTime - lastClearTime < this.comboTimeout) {
                combo++;
            } else {
                combo = 1; // Reset combo if too much time passed
            }
            
            if (player === 'ARIA') {
                this.ariaCombo = combo;
                this.ariaLastClearTime = currentTime;
            } else {
                this.aiCombo = combo;
                this.aiLastClearTime = currentTime;
            }
        } else {
            // No lines cleared, reset combo after timeout
            if (currentTime - lastClearTime >= this.comboTimeout) {
                if (player === 'ARIA') {
                    this.ariaCombo = 0;
                } else {
                    this.aiCombo = 0;
                }
            }
        }
        
        // Update score and lines with T-spin and combo bonuses
        if (linesCleared > 0) {
            let basePoints = [0, 100, 300, 500, 800][linesCleared] || 800;
            let attackName = '';
            
            // T-spin bonuses (classic Tetris Battle values)
            if (isTSpin) {
                if (linesCleared === 1) {
                    basePoints = 800;
                    attackName = 'T-SPIN SINGLE';
                } else if (linesCleared === 2) {
                    basePoints = 1200;
                    attackName = 'T-SPIN DOUBLE';
                } else if (linesCleared === 3) {
                    basePoints = 1600;
                    attackName = 'T-SPIN TRIPLE';
                }
            } else {
                // Regular line clear names
                if (linesCleared === 1) attackName = 'SINGLE';
                else if (linesCleared === 2) attackName = 'DOUBLE';
                else if (linesCleared === 3) attackName = 'TRIPLE';
                else if (linesCleared === 4) attackName = 'TETRIS';
            }
            
            // Combo multiplier (like old Tetris Battle)
            const comboMultiplier = Math.min(combo || 1, 10); // Cap at 10x, default to 1 if undefined
            const finalPoints = Math.floor(basePoints * (1 + (comboMultiplier - 1) * 0.5));
            
            // Show attack message (with error handling)
            try {
                this.showAttackMessage(player, attackName, combo || 1);
            } catch (e) {
                console.error('Error showing attack message:', e);
            }
            
            if (player === 'ARIA') {
                this.ariaScore += finalPoints;
                this.ariaLines += linesCleared;
            } else {
                this.aiScore += finalPoints;
                this.aiLines += linesCleared;
            }
            this.updateInfo(player);
            
            // Level up every 10 lines
            const totalLines = player === 'ARIA' ? this.ariaLines : this.aiLines;
            const newLevel = Math.floor(totalLines / 10) + 1;
            if (newLevel > this.level) {
                this.level = newLevel;
                this.fallInterval = Math.max(100, 1000 - (this.level - 1) * 50);
            }
        }
        
        // Send garbage if lines cleared (with combo bonus)
        if (linesCleared > 0) {
            try {
                let garbageLines = linesCleared;
                if (isTSpin) garbageLines += 1; // T-spin sends extra garbage
                const currentCombo = player === 'ARIA' ? this.ariaCombo : this.aiCombo;
                if (currentCombo > 1) {
                    garbageLines += Math.floor(currentCombo / 2); // Combo bonus garbage
                }
                // Cap garbage to prevent overflow
                garbageLines = Math.min(garbageLines, 20); // Max 20 lines at once
                this.sendGarbage(player === 'ARIA' ? 'AI' : 'ARIA', garbageLines);
            } catch (e) {
                console.error('Error sending garbage:', e);
            }
        }
        
        // Reset hold ability
        if (player === 'ARIA') {
            this.ariaCanHold = true;
        } else {
            this.aiCanHold = true;
        }
        
        // Spawn new piece
        this.spawnPiece(player);
        this.renderBoard(player);
        this.renderNextPiece(player);
        
        // Reset AI rotation tracking
        if (player === 'AI') {
            this.aiCurrentRotation = 0;
        }
    }
    
    clearLines(player) {
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        let linesCleared = 0;
        
        for (let y = this.boardHeight - 1; y >= 0; y--) {
            if (board[y].every(cell => cell !== 0)) {
                board.splice(y, 1);
                board.unshift(Array(this.boardWidth).fill(0));
                linesCleared++;
                y++; // Check same line again
            }
        }
        
        return linesCleared;
    }
    
    sendGarbage(target, lines) {
        if (!lines || lines <= 0) return; // Safety check
        
        const board = target === 'ARIA' ? this.ariaBoard : this.aiBoard;
        if (!board) return; // Safety check
        
        const garbageLines = Math.min(Math.max(1, Math.floor(lines)), 20); // Clamp between 1 and 20
        
        // Remove lines from top
        for (let i = 0; i < garbageLines && board.length > 0; i++) {
            board.shift();
        }
        
        // Add garbage lines at bottom (gray blocks)
        for (let i = 0; i < garbageLines; i++) {
            const garbageLine = Array(this.boardWidth).fill(8); // 8 = garbage color
            const hole = Math.floor(Math.random() * this.boardWidth);
            garbageLine[hole] = 0; // One hole per line
            board.push(garbageLine);
        }
        
        // Render the board after garbage is added
        this.renderBoard(target);
    }
    
    // Advanced AI: Evaluate board states and find best moves
    aiThink() {
        if (this.gameOver || !this.aiPiece) return;
        
        this.aiDecisionTimer += 16; // ~60fps
        
        // Make AI decisions less frequently
        if (this.aiDecisionTimer < 100) return;
        this.aiDecisionTimer = 0;
        
        // Plan the best move
        const bestMove = this.findBestMove('AI');
        
        if (!bestMove) {
            // Fallback: just try to move down or drop
            if (this.canPlacePiece('AI', this.aiPieceX, this.aiPieceY + 1)) {
                // Piece can still fall, let it fall naturally
                return;
            } else {
                // Can't move down, lock it
                this.lockPiece('AI');
            }
            return;
        }
        
        // Execute planned move
        if (bestMove.hold) {
            this.holdPiece('AI');
            this.aiCurrentRotation = 0;
            return;
        }
        
        // Rotate to target rotation
        if (bestMove.rotation !== this.aiCurrentRotation) {
            const rotationsNeeded = (bestMove.rotation - this.aiCurrentRotation + 4) % 4;
            if (rotationsNeeded > 0 && rotationsNeeded < 4) {
                this.rotatePiece('AI');
                this.aiCurrentRotation = (this.aiCurrentRotation + 1) % 4;
                return;
            }
        }
        
        // Move to target X position
        const currentX = this.aiPieceX;
        const targetX = Math.max(0, Math.min(this.boardWidth - 1, bestMove.x)); // Clamp to valid range
        if (currentX < targetX) {
            this.movePiece('AI', 1, 0);
        } else if (currentX > targetX) {
            this.movePiece('AI', -1, 0);
        } else if (currentX === targetX && bestMove.drop) {
            // In position, drop it
            this.hardDrop('AI');
            this.aiCurrentRotation = 0;
        }
    }
    
    findBestMove(player) {
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        const currentPiece = player === 'ARIA' ? this.ariaPiece : this.aiPiece;
        const currentPieceType = player === 'ARIA' ? this.ariaPieceType : this.aiPieceType;
        const nextPieceType = player === 'ARIA' ? this.ariaNextPiece : this.aiNextPiece;
        const holdPieceType = player === 'ARIA' ? this.ariaHoldPiece : this.aiHoldPiece;
        const canHold = player === 'ARIA' ? this.ariaCanHold : this.aiCanHold;
        
        if (!currentPiece) return null;
        
        let bestScore = -Infinity;
        let bestMove = null;
        
        // Consider current piece
        try {
            const currentScore = this.evaluatePiecePlacement(board, currentPiece, currentPieceType);
            if (currentScore && currentScore.score > bestScore) {
                bestScore = currentScore.score;
                bestMove = {
                    x: currentScore.x,
                    rotation: currentScore.rotation,
                    drop: true,
                    hold: false
                };
            }
        } catch (e) {
            console.error('Error evaluating current piece:', e);
        }
        
        // Consider next piece
        if (canHold) {
            try {
                const nextPiece = this.getPieceShape(nextPieceType);
                const nextScore = this.evaluatePiecePlacement(board, nextPiece, nextPieceType);
                if (nextScore && nextScore.score > bestScore) {
                    bestScore = nextScore.score;
                    bestMove = {
                        x: nextScore.x,
                        rotation: nextScore.rotation,
                        drop: false,
                        hold: true // Hold current, use next
                    };
                }
            } catch (e) {
                console.error('Error evaluating next piece:', e);
            }
        }
        
        // Consider held piece if available
        if (holdPieceType !== null && canHold) {
            try {
                const heldPiece = this.getPieceShape(holdPieceType);
                const heldScore = this.evaluatePiecePlacement(board, heldPiece, holdPieceType);
                if (heldScore && heldScore.score > bestScore) {
                    bestScore = heldScore.score;
                    bestMove = {
                        x: heldScore.x,
                        rotation: heldScore.rotation,
                        drop: false,
                        hold: true // Swap to use held piece
                    };
                }
            } catch (e) {
                console.error('Error evaluating held piece:', e);
            }
        }
        
        return bestMove;
    }
    
    evaluatePiecePlacement(board, piece, pieceType) {
        let bestScore = -Infinity;
        let bestX = 0;
        let bestRotation = 0;
        
        // Try all rotations (0-3)
        for (let rotation = 0; rotation < 4; rotation++) {
            let testPiece = piece;
            for (let r = 0; r < rotation; r++) {
                testPiece = this.rotateMatrix(testPiece);
            }
            
            // Try all X positions
            for (let x = -2; x < this.boardWidth + 2; x++) {
                // Find drop position
                let y = 0;
                while (this.canPlacePieceOnBoard(board, testPiece, x, y + 1)) {
                    y++;
                }
                
                // Check if this is a valid placement
                if (!this.canPlacePieceOnBoard(board, testPiece, x, y)) {
                    continue; // Can't place here
                }
                
                // Make sure at least part of the piece is on the board
                let hasValidCell = false;
                for (let py = 0; py < testPiece.length; py++) {
                    for (let px = 0; px < testPiece[py].length; px++) {
                        if (testPiece[py][px]) {
                            const boardX = x + px;
                            const boardY = y + py;
                            if (boardX >= 0 && boardX < this.boardWidth && 
                                boardY >= 0 && boardY < this.boardHeight) {
                                hasValidCell = true;
                                break;
                            }
                        }
                    }
                    if (hasValidCell) break;
                }
                
                if (!hasValidCell) continue;
                
                // Simulate placement
                const simulatedBoard = board.map(row => [...row]);
                for (let py = 0; py < testPiece.length; py++) {
                    for (let px = 0; px < testPiece[py].length; px++) {
                        if (testPiece[py][px]) {
                            const boardY = y + py;
                            const boardX = x + px;
                            if (boardY >= 0 && boardY < this.boardHeight && 
                                boardX >= 0 && boardX < this.boardWidth) {
                                simulatedBoard[boardY][boardX] = pieceType + 1;
                            }
                        }
                    }
                }
                
                // Evaluate this placement
                const score = this.evaluateBoard(simulatedBoard);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestX = x;
                    bestRotation = rotation;
                }
            }
        }
        
        // If no valid placement found, return a default safe placement
        if (bestScore === -Infinity) {
            return { score: -1000, x: Math.floor(this.boardWidth / 2), rotation: 0 };
        }
        
        return { score: bestScore, x: bestX, rotation: bestRotation };
    }
    
    canPlacePieceOnBoard(board, piece, x, y) {
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const boardX = x + px;
                    const boardY = y + py;
                    
                    if (boardX < 0 || boardX >= this.boardWidth || 
                        boardY >= this.boardHeight ||
                        (boardY >= 0 && board[boardY][boardX] !== 0)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    evaluateBoard(board) {
        let score = 0;
        let linesCleared = 0;
        let holes = 0;
        let height = 0;
        let bumpiness = 0;
        const columnHeights = [];
        
        // Calculate column heights and find holes
        for (let x = 0; x < this.boardWidth; x++) {
            let colHeight = 0;
            let foundBlock = false;
            for (let y = 0; y < this.boardHeight; y++) {
                if (board[y][x] !== 0) {
                    if (!foundBlock) {
                        colHeight = this.boardHeight - y;
                        foundBlock = true;
                    }
                } else if (foundBlock) {
                    holes++; // Hole found below blocks
                }
            }
            columnHeights.push(colHeight);
            height = Math.max(height, colHeight);
        }
        
        // Calculate bumpiness (height differences)
        for (let x = 0; x < this.boardWidth - 1; x++) {
            bumpiness += Math.abs(columnHeights[x] - columnHeights[x + 1]);
        }
        
        // Check for lines to clear
        for (let y = 0; y < this.boardHeight; y++) {
            if (board[y].every(cell => cell !== 0)) {
                linesCleared++;
            }
        }
        
        // Scoring: maximize lines cleared, minimize height, holes, and bumpiness
        score = linesCleared * 1000; // Big bonus for clearing lines
        score -= height * 10; // Penalize height
        score -= holes * 50; // Heavy penalty for holes
        score -= bumpiness * 5; // Penalize bumpiness
        
        // Bonus for keeping board low
        if (height < 10) score += 100;
        if (height < 5) score += 200;
        
        return score;
    }
    
    renderHoldPiece(player) {
        const holdElement = player === 'ARIA' ? this.ariaHoldElement : this.aiHoldElement;
        const holdType = player === 'ARIA' ? this.ariaHoldPiece : this.aiHoldPiece;
        
        holdElement.innerHTML = '';
        
        if (holdType === null) {
            holdElement.style.display = 'flex';
            holdElement.style.alignItems = 'center';
            holdElement.style.justifyContent = 'center';
            holdElement.style.minHeight = '80px';
            holdElement.innerHTML = '<span style="opacity: 0.5; font-size: 0.8rem;">Empty</span>';
            return;
        }
        
        holdElement.style.display = 'grid';
        const holdShape = this.getPieceShape(holdType);
        const color = this.getPieceColor(holdType);
        
        holdElement.style.gridTemplateColumns = `repeat(${holdShape[0].length}, 20px)`;
        
        for (let y = 0; y < holdShape.length; y++) {
            for (let x = 0; x < holdShape[y].length; x++) {
                const cell = document.createElement('div');
                cell.className = 'tetris-cell';
                if (holdShape[y][x]) {
                    cell.style.background = color;
                    cell.style.border = `2px solid ${this.darkenColor(color)}`;
                    cell.style.opacity = '0.7';
                }
                holdElement.appendChild(cell);
            }
        }
    }
    
    detectTSpin(player, x, y) {
        // T-spin detection: T-piece rotated into a tight space with 3 corners filled
        const pieceType = player === 'ARIA' ? this.ariaPieceType : this.aiPieceType;
        if (pieceType !== 2) return false; // T-piece is type 2 (index 2 in pieceTypes)
        
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        const pieceX = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const pieceY = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        // T-piece center is at pieceX + 1, pieceY + 1 (for 3x3 shape)
        // Check the 4 corners around the T-piece center
        const centerX = pieceX + 1;
        const centerY = pieceY + 1;
        
        const corners = [
            { x: centerX - 1, y: centerY - 1 }, // Top-left
            { x: centerX + 1, y: centerY - 1 }, // Top-right
            { x: centerX - 1, y: centerY + 1 }, // Bottom-left
            { x: centerX + 1, y: centerY + 1 }  // Bottom-right
        ];
        
        let filledCorners = 0;
        for (const corner of corners) {
            if (corner.x < 0 || corner.x >= this.boardWidth || 
                corner.y < 0 || corner.y >= this.boardHeight) {
                filledCorners++; // Out of bounds counts as filled
            } else if (board[corner.y][corner.x] !== 0) {
                filledCorners++;
            }
        }
        
        // T-spin requires at least 3 corners filled
        return filledCorners >= 3;
    }
    
    showAttackMessage(player, attackName, combo) {
        try {
            const boardElement = player === 'ARIA' 
                ? document.getElementById('aria-board')
                : document.getElementById('ai-board');
            
            if (!boardElement) return;
            
            const boardContainer = boardElement.parentElement;
            if (!boardContainer) return;
            
            // Remove existing message
            const existingMsg = boardContainer.querySelector('.attack-message');
            if (existingMsg) {
                try {
                    existingMsg.remove();
                } catch (e) {
                    // Ignore if already removed
                }
            }
            
            // Create message
            const message = document.createElement('div');
            message.className = 'attack-message';
            message.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 1.5rem;
                font-weight: bold;
                color: #fff;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                z-index: 1000;
                pointer-events: none;
                animation: fadeOut 2s ease-out forwards;
                white-space: pre-line;
                text-align: center;
            `;
            
            let text = attackName || 'LINE CLEAR';
            const comboValue = combo || 1;
            if (comboValue > 1) {
                text += `\n${comboValue}x COMBO!`;
            }
            message.textContent = text;
            
            boardContainer.style.position = 'relative';
            boardContainer.appendChild(message);
            
            // Remove after animation
            setTimeout(() => {
                try {
                    if (message && message.parentElement) {
                        message.remove();
                    }
                } catch (e) {
                    // Ignore cleanup errors
                }
            }, 2000);
        } catch (e) {
            console.error('Error in showAttackMessage:', e);
            // Don't crash the game if message display fails
        }
    }
    
    updateInfo(player) {
        const infoElement = player === 'ARIA' ? this.ariaInfo : this.aiInfo;
        const score = player === 'ARIA' ? this.ariaScore : this.aiScore;
        const lines = player === 'ARIA' ? this.ariaLines : this.aiLines;
        const combo = player === 'ARIA' ? this.ariaCombo : this.aiCombo;
        const comboText = combo > 0 ? ` | Combo: ${combo}x` : '';
        infoElement.textContent = `Score: ${score} | Lines: ${lines} | Level: ${this.level}${comboText}`;
    }
    
    renderNextPiece(player) {
        const nextElement = player === 'ARIA' ? this.ariaNextElement : this.aiNextElement;
        const nextType = player === 'ARIA' ? this.ariaNextPiece : this.aiNextPiece;
        const nextShape = this.getPieceShape(nextType);
        const color = this.getPieceColor(nextType);
        
        nextElement.innerHTML = '';
        nextElement.style.gridTemplateColumns = `repeat(${nextShape[0].length}, 20px)`;
        
        for (let y = 0; y < nextShape.length; y++) {
            for (let x = 0; x < nextShape[y].length; x++) {
                const cell = document.createElement('div');
                cell.className = 'tetris-cell';
                if (nextShape[y][x]) {
                    cell.style.background = color;
                    cell.style.border = `2px solid ${this.darkenColor(color)}`;
                }
                nextElement.appendChild(cell);
            }
        }
    }
    
    darkenColor(color) {
        // Simple color darkening for borders
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 30);
        const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 30);
        const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 30);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    getGhostPiecePosition(player) {
        const piece = player === 'ARIA' ? this.ariaPiece : this.aiPiece;
        const pieceX = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const pieceY = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        
        if (!piece) return { x: pieceX, y: pieceY };
        
        // Find where the piece will land
        let ghostY = pieceY;
        while (this.canPlacePiece(player, pieceX, ghostY + 1)) {
            ghostY++;
        }
        
        return { x: pieceX, y: ghostY };
    }
    
    renderBoard(player) {
        const board = player === 'ARIA' ? this.ariaBoard : this.aiBoard;
        const boardElement = player === 'ARIA' ? this.ariaBoardElement : this.aiBoardElement;
        const piece = player === 'ARIA' ? this.ariaPiece : this.aiPiece;
        const pieceType = player === 'ARIA' ? this.ariaPieceType : this.aiPieceType;
        const pieceX = player === 'ARIA' ? this.ariaPieceX : this.aiPieceX;
        const pieceY = player === 'ARIA' ? this.ariaPieceY : this.aiPieceY;
        const pieceColor = this.getPieceColor(pieceType);
        
        // Get ghost piece position
        const ghostPos = this.getGhostPiecePosition(player);
        const ghostX = ghostPos.x;
        const ghostY = ghostPos.y;
        
        boardElement.style.gridTemplateColumns = `repeat(${this.boardWidth}, ${this.cellSize}px)`;
        boardElement.innerHTML = '';
        
        // Render board
        for (let y = 0; y < this.boardHeight; y++) {
            for (let x = 0; x < this.boardWidth; x++) {
                const cell = document.createElement('div');
                cell.className = 'tetris-cell';
                
                // Render locked pieces with colors
                if (board[y][x] > 0 && board[y][x] <= 7) {
                    const color = this.getPieceColor(board[y][x] - 1);
                    cell.style.background = color;
                    cell.style.border = `2px solid ${this.darkenColor(color)}`;
                    cell.style.boxShadow = 'inset 0 0 5px rgba(0,0,0,0.3)';
                } else if (board[y][x] === 8) {
                    // Garbage blocks (gray)
                    cell.style.background = '#666';
                    cell.style.border = '2px solid #444';
                }
                
                // Render ghost piece (only if different from current piece position)
                if (piece && ghostY !== pieceY && 
                    y >= ghostY && y < ghostY + piece.length &&
                    x >= ghostX && x < ghostX + piece[0].length) {
                    const py = y - ghostY;
                    const px = x - ghostX;
                    if (py >= 0 && py < piece.length && px >= 0 && px < piece[py].length && piece[py][px]) {
                        // Ghost piece styling - semi-transparent outline
                        cell.style.border = `2px dashed ${pieceColor}`;
                        cell.style.opacity = '0.3';
                        cell.style.boxShadow = 'none';
                    }
                }
                
                // Render current piece (on top of ghost)
                if (piece && y >= pieceY && y < pieceY + piece.length &&
                    x >= pieceX && x < pieceX + piece[0].length) {
                    const py = y - pieceY;
                    const px = x - pieceX;
                    if (py >= 0 && py < piece.length && px >= 0 && px < piece[py].length && piece[py][px]) {
                        cell.style.background = pieceColor;
                        cell.style.border = `2px solid ${this.darkenColor(pieceColor)}`;
                        cell.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
                        cell.style.opacity = '1';
                    }
                }
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    endGame(winner) {
        this.gameOver = true;
        const gameArea = document.getElementById('tetris-game-area');
        gameArea.innerHTML = `
            <div class="victory-screen" style="width: 100%;">
                <h2>${winner} Wins!</h2>
                <p style="font-size: 1.5rem; margin: 1rem 0;">Game Over</p>
                <p style="font-size: 1.2rem; margin: 0.5rem 0;">ARIA: ${this.ariaScore} | AI: ${this.aiScore}</p>
                <button class="retry-btn" onclick="location.reload()">Play Again</button>
            </div>
        `;
    }
}

// Initialize game
window.initTetrisBattle = function() {
    window.tetrisBattle = new TetrisBattle();
};
