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
      console.log('Datos insertados en la base de datos');
      io.emit('datosActualizados', { latitud, longitud, fecha, hora });
    }
  });
});

udpServer.bind(10001, () => {
  console.log('Servidor UDP escuchando en el puerto 10001');
});

// Rutas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/coordenadas', (req, res) => {
  const query = 'SELECT * FROM coordenadas';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos de la base de datos:', err);
      res.status(500).send('Error al obtener los datos de la base de datos');
    } else {
      res.json(results);
    }
  });
});

app.get('/historial', (req, res) => {
  const { fechaInicio, horaInicio, fechaFin, horaFin } = req.query;

  if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) {
    // Si no se proporcionan parámetros, simplemente sirve la página historial.html
    return res.sendFile(path.join(__dirname, 'public', 'historial.html'));
  }

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

// Iniciar el servidor HTTP en el puerto 80
http.listen(80, '0.0.0.0', () => {
  console.log('Servidor web escuchando en el puerto 80');
});

// Esto es redundante si estás usando http.listen arriba para iniciar tu servidor con Socket.io
// app.listen(3000, () => {
//   console.log('Servidor escuchando en el puerto 3000');
// });

// Exportar la aplicación Express
module.exports = app;