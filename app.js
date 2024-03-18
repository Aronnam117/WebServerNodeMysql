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

// Crear el servidor UDP
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

const db = mysql.createPool({
  host: "database-1.cdomg4642kmq.us-east-1.rds.amazonaws.com",
  user: "mrmatt",
  password: "Aronna117",
  database: "mrmatt",
 
});

const ultimaInformacion = {
  latitud: 0,
  longitud: 0,
  fecha: '',
  hora: '',
};

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

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/coordenadas', (req, res) => {
  const query = 'SELECT * FROM coordenadas'; // Consulta SQL 
  // Ejecutar la consulta en la base de datos
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos de la base de datos:', err);
      res.status(500).send('Error al obtener los datos de la base de datos');
      return;
    }

    // Enviar los datos obtenidos como respuesta en formato JSON
    res.json(results);
  });
});


// Declarar iniciarMap como global
function iniciarMap() {
  // ...
}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  socket.emit('datosActualizados', ultimaInformacion);

  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

http.listen(80, '0.0.0.0', () => {
  console.log('Servidor web escuchando en el puerto 4000');
});

module.exports = app;
