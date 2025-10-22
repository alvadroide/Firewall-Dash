import random
from flask import Flask, render_template, jsonify, request, session
from flask_sqlalchemy import SQLAlchemy

# --- Configuración Inicial ---
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# La 'session' necesita una clave secreta para funcionar
app.config['SECRET_KEY'] = 'mi_clave_secreta_del_firewall_123'
db = SQLAlchemy(app)

GRID_SIZE = 16 # Usaremos una cuadrícula de 4x4

# --- Modelo de la Base de Datos (BBDD) ---
class HighScore(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_name = db.Column(db.String(50), nullable=False)
    score = db.Column(db.Integer, nullable=False) # El puntaje será "puertos hackeados"

# --- Rutas de la API del Juego (Endpoints) ---

@app.route('/')
def index():
    """ Sirve la página principal del juego (index.html) """
    return render_template('index.html')

@app.route('/api/get_target', methods=['GET'])
def get_target():
    """
    Endpoint para que el frontend pida un nuevo objetivo (puerto).
    Devolvemos un ID de puerto aleatorio.
    """
    # Elige un puerto aleatorio (de 0 a 15)
    target_port = random.randint(0, GRID_SIZE - 1)
    
    # Guardamos el objetivo en la sesión del servidor
    # Esto es crucial para la seguridad
    session['current_target'] = target_port
    
    return jsonify({
        "target_port": target_port
    })

@app.route('/api/check_click', methods=['POST'])
def check_click():
    """
    Endpoint que recibe el clic del jugador y lo valida.
    """
    data = request.json
    clicked_port_id = data.get('port_id')
    
    # Verificamos si hay un objetivo activo en la sesión
    if 'current_target' not in session:
        # El jugador hizo clic sin un objetivo (o demasiado tarde)
        return jsonify({"correct": False, "score": 0})

    # Obtenemos el objetivo y lo eliminamos de la sesión (para que no se use 2 veces)
    correct_target = session.pop('current_target')
    
    if clicked_port_id == correct_target:
        # ¡Clic correcto!
        return jsonify({"correct": True, "score_bonus": 100})
    else:
        # ¡Clic incorrecto!
        return jsonify({"correct": False, "score_bonus": -50}) # Penalización

# --- Rutas de Puntajes (¡Idénticas al juego anterior!) ---

@app.route('/api/get_highscores', methods=['GET'])
def get_highscores():
    """ Obtiene los 10 puntajes más altos de la BBDD """
    scores = HighScore.query.order_by(HighScore.score.desc()).limit(10).all()
    return jsonify([
        {"player_name": s.player_name, "score": s.score} for s in scores
    ])

@app.route('/api/submit_score', methods=['POST'])
def submit_score():
    """ Guarda un nuevo puntaje en la BBDD """
    data = request.json
    player_name = data.get('player_name', 'HackerAnónimo')
    score = data.get('score', 0)
    
    new_score = HighScore(player_name=player_name, score=score)
    db.session.add(new_score)
    db.session.commit()
    
    return jsonify({"success": True, "message": "Puntaje guardado"})

# --- Inicialización ---
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True)