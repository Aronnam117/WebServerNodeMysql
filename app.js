const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config();

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  path: '/socket.io',
});

app.use(cors());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

const ultimaInformacion = {
  latitud: 0,
  longitud: 0,
  fecha: '',
  hora: '',
};

app.use(express.static(path.join(__dirname, 'public')));

// Escuchar mensajes UDP
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  const data = msg.toString();
  console.log('Datos recibidos:', data);

  const [latitud, longitud, fecha, hora] = data.split(' ');

  console.log('Latitud:', latitud);
  console.log('Longitud:', longitud);
  console.log('Fecha:', fecha);
  console.log('Hora:', hora);

  const query = 'INSERT INTO coordenadas (latitud, longitud, fecha, hora) VALUES (?, ?, ?, ?)';

  const values = [latitud, longitud, fecha, hora];
  console.log('Query:', query);

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error al insertar datos en la base de datos:', err);
    } else {
      console.log('Datos insertados en la base de datos');
    }
  });

  io.emit('datosActualizados', { latitud, longitud, fecha, hora });
});

udpServer.bind(10001, '0.0.0.0', () => {
  console.log('Servidor UDP escuchando en el puerto 10001');
});

// Manejo de la conexión del socket
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  const query = 'SELECT latitud, longitud, fecha, hora FROM coordenadas ORDER BY id DESC LIMIT 1';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos más recientes de la base de datos:', err);
    } else {
      if (results.length > 0) {
        ultimaInformacion.latitud = results[0].latitud;
        ultimaInformacion.longitud = results[0].longitud;
        ultimaInformacion.fecha = results[0].fecha;
        ultimaInformacion.hora = results[0].hora;

        socket.emit('datosActualizados', ultimaInformacion);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });

  // Manejo del evento de filtrado de datos
  socket.on('filtrarDatos', (filtro) => {
    const { fechaInicio, horaInicio, fechaFin, horaFin } = filtro;

    const query = `SELECT latitud, longitud FROM coordenadas WHERE fecha >= ? AND hora >= ? AND fecha <= ? AND hora <= ?`;
    const values = [fechaInicio, horaInicio, fechaFin, horaFin];

    db.query(query, values, (err, results) => {
      if (err) {
        console.error('Error al filtrar las rutas:', err);
        socket.emit('errorFiltrado', 'Error al filtrar las rutas');
      } else {
        const rutaFiltrada = results.map((row) => ({ lat: row.latitud, lng: row.longitud }));
        socket.emit('rutaFiltrada', rutaFiltrada);
      }
    });
  });
});

http.listen(80, '0.0.0.0', () => {
  console.log('Servidor web escuchando en el puerto 80');
});

module.exports = app;
