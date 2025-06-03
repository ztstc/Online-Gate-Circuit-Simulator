from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('circuit_update')
def handle_circuit_update(data):
    # 处理电路更新
    emit('circuit_state', data, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, debug=True)
