// Main menu navigation
document.addEventListener('DOMContentLoaded', () => {
    const tetrisCard = document.getElementById('tetris-battle');
    const trainingCard = document.getElementById('tetris-training');
    const battleCard = document.getElementById('turn-based-battle');
    const tetrisGame = document.getElementById('tetris-game');
    const trainingGame = document.getElementById('tetris-training-game');
    const battleGame = document.getElementById('battle-game');
    const container = document.querySelector('.container');
    
    const backButtons = document.querySelectorAll('.back-btn');
    
    // Show Tetris Battle
    tetrisCard.addEventListener('click', () => {
        container.classList.add('hidden');
        tetrisGame.classList.remove('hidden');
        trainingGame.classList.add('hidden');
        if (window.initTetrisBattle) {
            window.initTetrisBattle();
        }
    });
    
    // Show Training Mode
    trainingCard.addEventListener('click', () => {
        container.classList.add('hidden');
        tetrisGame.classList.add('hidden');
        trainingGame.classList.remove('hidden');
        if (window.initTetrisTraining) {
            window.initTetrisTraining();
        }
    });
    
    // Show Turn-Based Battle
    battleCard.addEventListener('click', () => {
        container.classList.add('hidden');
        tetrisGame.classList.add('hidden');
        trainingGame.classList.add('hidden');
        battleGame.classList.remove('hidden');
        if (window.initTurnBasedBattle) {
            window.initTurnBasedBattle();
        }
    });
    
    // Back to menu
    backButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tetrisGame.classList.add('hidden');
            trainingGame.classList.add('hidden');
            battleGame.classList.add('hidden');
            container.classList.remove('hidden');
        });
    });
});

