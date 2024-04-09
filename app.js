const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const dgram = require('dgram');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  path: '/socket.io',
});

// Configuración del servidor
app.use(express.static(path.join(__dirname, 'public')));

// Creación de la conexión a la base de datos
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

// Crear el servidor UDP
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  const data = msg.toString();
  const [latitud, longitud, fecha, hora] = data.split(' ');

  const query = 'INSERT INTO coordenadas (latitud, longitud, fecha, hora) VALUES (?, ?, ?, ?)';
  const values = [latitud, longitud, fecha, hora];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error al insertar datos en la base de datos:', err);
    } else {
      io.emit('datosActualizados', { latitud, longitud, fecha, hora });
    }
  });
});

udpServer.bind(10001, '0.0.0.0', () => {
  console.log('Servidor UDP escuchando en el puerto 10001');
});

// Rutas del servidor HTTP
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/historial', (req, res) => {
  const { fechaInicio, horaInicio, fechaFin, horaFin } = req.query;

  const query = `
    SELECT latitud, longitud, fecha, hora
    FROM coordenadas
    WHERE TIMESTAMP(CONCAT(fecha, ' ', hora)) BETWEEN ? AND ?
    ORDER BY id
  `;
  const values = [`${fechaInicio} ${horaInicio}`, `${fechaFin} ${horaFin}`];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error al obtener el historial:', err);
      res.status(500).send('Error al obtener el historial');
    } else {
      res.json(results);
    }
  });
});

io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  // Enviar la última ubicación al cliente que se acaba de conectar
  const queryUltimaUbicacion = 'SELECT latitud, longitud, fecha, hora FROM coordenadas ORDER BY id DESC LIMIT 1';
  db.query(queryUltimaUbicacion, (err, results) => {
    if (err) {
      console.error('Error al obtener la última ubicación:', err);
    } else if (results.length > 0) {
      socket.emit('datosActualizados', results[0]);
    }
  });

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

// Iniciar el servidor HTTP
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
  console.log(`Servidor web escuchando en el puerto ${PORT}`);
});
