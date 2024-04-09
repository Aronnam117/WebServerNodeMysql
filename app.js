const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  path: '/socket.io',
});
require('dotenv').config();

// Configuración del servidor
app.use(express.static(path.join(__dirname, 'public')));

// Crear el servidor UDP
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

// Creación de la conexión a la base de datos
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
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
      return;
    }
    
    // Asegúrate de que cada entrada tiene las propiedades esperadas
    const filtrado = results.map(entry => ({
      latitud: entry.latitud ?? '0',  // Proporciona valores predeterminados si es necesario
      longitud: entry.longitud ?? '0',
      fecha: entry.fecha ?? 'Fecha no disponible',
      hora: entry.hora ?? 'Hora no disponible',
    }));
  
    res.json(filtrado); // Envía los resultados filtrados
  });
});

io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
  
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

http.listen(80, '0.0.0.0', () => {
  console.log('Servidor web escuchando en el puerto 80');
});

module.exports = app;
