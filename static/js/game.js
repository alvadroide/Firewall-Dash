document.addEventListener('DOMContentLoaded', () => {

    // --- Referencias a elementos del DOM ---
    const scoreDisplay = document.getElementById('score');
    const timerDisplay = document.getElementById('timer');
    const gridDisplay = document.getElementById('firewall-grid');
    const startGameButton = document.getElementById('start-game');
    const highscoreList = document.getElementById('highscore-list');
    const feedbackDisplay = document.getElementById('feedback');

    // --- Variables del estado del juego ---
    const GRID_SIZE = 16;
    let currentScore = 0;
    let timeLeft = 30;
    let gameTimer; // Para el reloj principal
    let targetTimer; // Para el tiempo de vida del objetivo
    let gameInProgress = false;
    let currentTargetPort = null; // El ID del puerto activo

    // --- Funciones de la API (Comunicación con Python) ---
    // (loadHighScores y submitHighScore son idénticas al juego Vigenere)
    // (Las incluiremos por completitud)
    async function loadHighScores() {
        try {
            const response = await fetch('/api/get_highscores');
            const scores = await response.json();
            highscoreList.innerHTML = '';
            if (scores.length === 0) {
                highscoreList.innerHTML = '<li>Aún no hay puntajes...</li>';
            } else {
                scores.forEach(score => {
                    const li = document.createElement('li');
                    li.textContent = `${score.player_name}: ${score.score} pts`;
                    highscoreList.appendChild(li);
                });
            }
        } catch (error) { console.error('Error al cargar puntajes:', error); }
    }

    async function submitHighScore(playerName, score) {
        try {
            await fetch('/api/submit_score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_name: playerName, score: score })
            });
            loadHighScores(); 
        } catch (error) { console.error('Error al guardar puntaje:', error); }
    }

    // --- Lógica del Juego (Game Loop) ---

    // 1. Inicia el juego
    function startGame() {
        currentScore = 0;
        timeLeft = 30;
        scoreDisplay.textContent = currentScore;
        timerDisplay.textContent = timeLeft;
        gameInProgress = true;
        
        startGameButton.style.display = 'none';
        feedbackDisplay.textContent = '';
        
        // Crear la cuadrícula de puertos
        createGrid();
        
        // Iniciar el temporizador principal
        gameTimer = setInterval(updateTimer, 1000);
        
        // Pedir el primer objetivo
        activateNewTarget();
        loadHighScores();
    }

    // 2. Crea la cuadrícula
    function createGrid() {
        gridDisplay.innerHTML = ''; // Limpiar cuadrícula
        for (let i = 0; i < GRID_SIZE; i++) {
            const port = document.createElement('div');
            port.classList.add('port');
            port.id = `port-${i}`;
            port.dataset.portId = i;
            
            // ¡Evento de clic!
            port.addEventListener('click', handlePortClick);
            
            gridDisplay.appendChild(port);
        }
    }

    // 3. Maneja el clic en un puerto
    async function handlePortClick(e) {
        if (!gameInProgress) return;

        const clickedPortId = parseInt(e.target.dataset.portId);
        
        // Desactivar el objetivo actual para que no se pueda hacer doble clic
        if (currentTargetPort !== null) {
            clearTimeout(targetTimer); // Detener el temporizador de "desaparición"
            document.getElementById(`port-${currentTargetPort}`).classList.remove('active');
        }

        // Enviar el clic al backend para validación
        try {
            const response = await fetch('/api/check_click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port_id: clickedPortId })
            });
            const data = await response.json();

            // Aplicar feedback visual
            const clickedPortElement = document.getElementById(`port-${clickedPortId}`);
            if (data.correct) {
                currentScore += data.score_bonus;
                clickedPortElement.classList.add('hit');
                // Pedir el siguiente objetivo INMEDIATAMENTE
                activateNewTarget();
            } else {
                currentScore += data.score_bonus; // Resta puntos
                clickedPortElement.classList.add('miss');
            }
            
            scoreDisplay.textContent = currentScore;
            
            // Quitar feedback visual después de un momento
            setTimeout(() => {
                clickedPortElement.classList.remove('hit', 'miss');
            }, 300);

        } catch (error) {
            console.error('Error al verificar clic:', error);
        }
    }

    // 4. Pide y activa un nuevo objetivo
    async function activateNewTarget() {
        if (!gameInProgress) return;
        
        try {
            const response = await fetch('/api/get_target');
            const data = await response.json();
            
            currentTargetPort = data.target_port;
            const targetElement = document.getElementById(`port-${currentTargetPort}`);
            targetElement.classList.add('active');
            
            // Establecer un tiempo límite para hacer clic en este objetivo
            // (Ej. 1.5 segundos). Si no, desaparece.
            targetTimer = setTimeout(() => {
                if (gameInProgress) {
                    targetElement.classList.remove('active');
                    // El jugador perdió la oportunidad, pedimos uno nuevo
                    activateNewTarget();
                }
            }, 1500); // 1.5 segundos para reaccionar

        } catch (error) {
            console.error('Error al pedir objetivo:', error);
        }
    }

    // 5. Reloj principal del juego
    function updateTimer() {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            endGame();
        }
    }

    // 6. Fin del juego
    function endGame() {
        clearInterval(gameTimer); // Detener reloj
        clearTimeout(targetTimer); // Detener temporizador del objetivo
        gameInProgress = false;
        
        feedbackDisplay.textContent = `¡Tiempo! Puntaje Final: ${currentScore}`;
        
        // Limpiar la cuadrícula
        if (currentTargetPort !== null) {
            document.getElementById(`port-${currentTargetPort}`).classList.remove('active');
        }
        
        startGameButton.style.display = 'block';
        startGameButton.textContent = 'Jugar de Nuevo';

        // Guardar puntaje
        if (currentScore > 0) {
            const playerName = prompt('¡Buen puntaje! Ingresa tu nombre (3-10 chars):', 'HACKER') || 'HACKER';
            submitHighScore(playerName.substring(0, 10), currentScore);
        }
    }

    // --- Asignación de Eventos ---
    startGameButton.addEventListener('click', startGame);
    loadHighScores(); // Cargar puntajes al inicio
});