// Turn-Based Battle Game: ARIA vs AI
class TurnBasedBattle {
    constructor() {
        this.ariaHP = 100;
        this.ariaMaxHP = 100;
        this.aiHP = 100;
        this.aiMaxHP = 100;
        this.currentTurn = 'ARIA'; // 'ARIA' or 'AI'
        this.gameOver = false;
        this.battleLog = [];
        this.ariaDefending = false;
        this.aiDefending = false;
        this.ariaSkillCooldown = 0;
        this.aiSkillCooldown = 0;
        this.turnCount = 0;
        
        this.setupBattle();
    }
    
    setupBattle() {
        const gameArea = document.getElementById('battle-game-area');
        gameArea.innerHTML = `
            <div class="battle-arena">
                <div class="combatants">
                    <div class="combatant">
                        <div class="combatant-name">ARIA</div>
                        <div class="hp-bar-container">
                            <div class="hp-bar" id="aria-hp-bar" style="width: 100%">100/100</div>
                        </div>
                        <div class="hp-text" id="aria-hp-text">HP: 100/100</div>
                    </div>
                    
                    <div class="combatant">
                        <div class="combatant-name">AI Agent</div>
                        <div class="hp-bar-container">
                            <div class="hp-bar" id="ai-hp-bar" style="width: 100%">100/100</div>
                        </div>
                        <div class="hp-text" id="ai-hp-text">HP: 100/100</div>
                    </div>
                </div>
                
                <div class="battle-log" id="battle-log">
                    <div class="log-entry">Battle begins! ARIA vs AI Agent</div>
                </div>
                
                <div class="action-buttons" id="action-buttons">
                    <button class="action-btn attack" id="attack-btn">⚔️ Attack</button>
                    <button class="action-btn defend" id="defend-btn">🛡️ Defend</button>
                    <button class="action-btn skill" id="skill-btn">✨ Skill</button>
                    <button class="action-btn item" id="item-btn">💊 Item</button>
                </div>
                
                <div id="game-over-screen"></div>
            </div>
        `;
        
        this.setupEventListeners();
        this.updateUI();
    }
    
    setupEventListeners() {
        document.getElementById('attack-btn').addEventListener('click', () => this.playerAction('attack'));
        document.getElementById('defend-btn').addEventListener('click', () => this.playerAction('defend'));
        document.getElementById('skill-btn').addEventListener('click', () => this.playerAction('skill'));
        document.getElementById('item-btn').addEventListener('click', () => this.playerAction('item'));
    }
    
    addLog(message, type = 'neutral') {
        const log = document.getElementById('battle-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
        this.battleLog.push(message);
    }
    
    playerAction(action) {
        if (this.currentTurn !== 'ARIA' || this.gameOver) return;
        
        this.executeAction('ARIA', action);
        
        if (!this.gameOver) {
            // AI turn
            setTimeout(() => {
                this.currentTurn = 'AI';
                this.aiAction();
            }, 1000);
        }
    }
    
    executeAction(actor, action) {
        if (action === 'attack') {
            this.attack(actor);
        } else if (action === 'defend') {
            this.defend(actor);
        } else if (action === 'skill') {
            this.useSkill(actor);
        } else if (action === 'item') {
            this.useItem(actor);
        }
        
        this.updateUI();
        this.checkGameOver();
    }
    
    attack(actor) {
        const defender = actor === 'ARIA' ? 'AI' : 'ARIA';
        const baseDamage = 15 + Math.floor(Math.random() * 10);
        const isDefending = defender === 'ARIA' ? this.ariaDefending : this.aiDefending;
        const damage = Math.floor(baseDamage * (isDefending ? 0.5 : 1));
        
        if (actor === 'ARIA') {
            this.aiHP = Math.max(0, this.aiHP - damage);
            this.addLog(`ARIA attacks AI Agent for ${damage} damage!`, 'player');
        } else {
            this.ariaHP = Math.max(0, this.ariaHP - damage);
            this.addLog(`AI Agent attacks ARIA for ${damage} damage!`, 'enemy');
        }
        
        if (isDefending) {
            this.addLog(`${defender} defended and took reduced damage!`, defender === 'ARIA' ? 'player' : 'enemy');
        }
        
        // Reset defending state
        if (defender === 'ARIA') {
            this.ariaDefending = false;
        } else {
            this.aiDefending = false;
        }
    }
    
    defend(actor) {
        if (actor === 'ARIA') {
            this.ariaDefending = true;
            this.addLog('ARIA takes a defensive stance!', 'player');
        } else {
            this.aiDefending = true;
            this.addLog('AI Agent takes a defensive stance!', 'enemy');
        }
    }
    
    useSkill(actor) {
        const cooldown = actor === 'ARIA' ? this.ariaSkillCooldown : this.aiSkillCooldown;
        
        if (cooldown > 0) {
            this.addLog(`${actor}'s skill is on cooldown for ${cooldown} turns!`, actor === 'ARIA' ? 'player' : 'enemy');
            return;
        }
        
        const defender = actor === 'ARIA' ? 'AI' : 'ARIA';
        const baseDamage = 25 + Math.floor(Math.random() * 15);
        const isDefending = defender === 'ARIA' ? this.ariaDefending : this.aiDefending;
        const damage = Math.floor(baseDamage * (isDefending ? 0.5 : 1));
        
        if (actor === 'ARIA') {
            this.aiHP = Math.max(0, this.aiHP - damage);
            this.ariaSkillCooldown = 3;
            this.addLog(`ARIA uses powerful skill on AI Agent for ${damage} damage!`, 'player');
        } else {
            this.ariaHP = Math.max(0, this.ariaHP - damage);
            this.aiSkillCooldown = 3;
            this.addLog(`AI Agent uses powerful skill on ARIA for ${damage} damage!`, 'enemy');
        }
        
        if (isDefending) {
            this.addLog(`${defender} defended and took reduced damage!`, defender === 'ARIA' ? 'player' : 'enemy');
        }
        
        // Reset defending state
        if (defender === 'ARIA') {
            this.ariaDefending = false;
        } else {
            this.aiDefending = false;
        }
    }
    
    useItem(actor) {
        const healAmount = 20 + Math.floor(Math.random() * 10);
        
        if (actor === 'ARIA') {
            this.ariaHP = Math.min(this.ariaMaxHP, this.ariaHP + healAmount);
            this.addLog(`ARIA uses a healing item and recovers ${healAmount} HP!`, 'player');
        } else {
            this.aiHP = Math.min(this.aiMaxHP, this.aiHP + healAmount);
            this.addLog(`AI Agent uses a healing item and recovers ${healAmount} HP!`, 'enemy');
        }
    }
    
    aiAction() {
        if (this.gameOver || this.currentTurn !== 'AI') return;
        
        // Simple AI decision making
        const actions = ['attack', 'defend', 'skill', 'item'];
        let chosenAction;
        
        // AI logic
        if (this.aiHP < 30 && Math.random() < 0.6) {
            chosenAction = 'item'; // Heal when low
        } else if (this.ariaHP < 30 && this.aiSkillCooldown === 0) {
            chosenAction = 'skill'; // Finish with skill
        } else if (this.aiHP < 50 && Math.random() < 0.4) {
            chosenAction = 'defend'; // Defend when low
        } else if (this.aiSkillCooldown === 0 && Math.random() < 0.3) {
            chosenAction = 'skill'; // Use skill sometimes
        } else {
            chosenAction = 'attack'; // Default to attack
        }
        
        this.executeAction('AI', chosenAction);
        
        // Update cooldowns
        if (this.ariaSkillCooldown > 0) this.ariaSkillCooldown--;
        if (this.aiSkillCooldown > 0) this.aiSkillCooldown--;
        
        // Switch back to player turn
        if (!this.gameOver) {
            setTimeout(() => {
                this.currentTurn = 'ARIA';
                this.updateUI();
            }, 1000);
        }
    }
    
    updateUI() {
        // Update HP bars
        const ariaHPPercent = (this.ariaHP / this.ariaMaxHP) * 100;
        const aiHPPercent = (this.aiHP / this.aiMaxHP) * 100;
        
        const ariaHPBar = document.getElementById('aria-hp-bar');
        const aiHPBar = document.getElementById('ai-hp-bar');
        
        ariaHPBar.style.width = `${ariaHPPercent}%`;
        ariaHPBar.textContent = `${this.ariaHP}/${this.ariaMaxHP}`;
        ariaHPBar.className = `hp-bar ${ariaHPPercent < 30 ? 'low' : ''}`;
        
        aiHPBar.style.width = `${aiHPPercent}%`;
        aiHPBar.textContent = `${this.aiHP}/${this.aiMaxHP}`;
        aiHPBar.className = `hp-bar ${aiHPPercent < 30 ? 'low' : ''}`;
        
        // Update HP text
        document.getElementById('aria-hp-text').textContent = `HP: ${this.ariaHP}/${this.ariaMaxHP}`;
        document.getElementById('ai-hp-text').textContent = `HP: ${this.aiHP}/${this.aiMaxHP}`;
        
        // Update action buttons
        const buttons = document.querySelectorAll('.action-btn');
        buttons.forEach(btn => {
            btn.disabled = this.currentTurn !== 'ARIA' || this.gameOver;
        });
        
        // Update skill button
        const skillBtn = document.getElementById('skill-btn');
        if (this.ariaSkillCooldown > 0) {
            skillBtn.textContent = `✨ Skill (${this.ariaSkillCooldown})`;
            skillBtn.disabled = true;
        } else {
            skillBtn.textContent = '✨ Skill';
            skillBtn.disabled = this.currentTurn !== 'ARIA' || this.gameOver;
        }
        
        // Update turn indicator
        if (!this.gameOver) {
            const log = document.getElementById('battle-log');
            const lastEntry = log.lastElementChild;
            if (!lastEntry || !lastEntry.textContent.includes('Turn:')) {
                const turnEntry = document.createElement('div');
                turnEntry.className = 'log-entry';
                turnEntry.textContent = `--- ${this.currentTurn}'s Turn ---`;
                log.appendChild(turnEntry);
            }
        }
    }
    
    checkGameOver() {
        if (this.ariaHP <= 0) {
            this.endGame('AI');
        } else if (this.aiHP <= 0) {
            this.endGame('ARIA');
        }
    }
    
    endGame(winner) {
        this.gameOver = true;
        const gameOverScreen = document.getElementById('game-over-screen');
        
        if (winner === 'ARIA') {
            gameOverScreen.innerHTML = `
                <div class="victory-screen">
                    <h2>🎉 Victory!</h2>
                    <p style="font-size: 1.5rem; margin: 1rem 0;">ARIA has defeated the AI Agent!</p>
                    <p style="font-size: 1.2rem; margin: 0.5rem 0;">XP Reward: +100</p>
                    <button class="retry-btn" onclick="location.reload()">Play Again</button>
                </div>
            `;
        } else {
            gameOverScreen.innerHTML = `
                <div class="defeat-screen">
                    <h2>💀 Defeat</h2>
                    <p style="font-size: 1.5rem; margin: 1rem 0;">AI Agent has defeated ARIA!</p>
                    <button class="retry-btn" onclick="location.reload()">Retry</button>
                </div>
            `;
        }
        
        // Disable all buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.disabled = true;
        });
    }
}

// Initialize game
window.initTurnBasedBattle = function() {
    window.turnBasedBattle = new TurnBasedBattle();
};

