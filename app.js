const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
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

// Función para obtener todas las coordenadas almacenadas
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

// Establecer conexión con los clientes
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  // Enviar los datos más recientes al cliente cuando se conecta
  const query = 'SELECT latitud, longitud, fecha, hora FROM coordenadas ORDER BY id DESC LIMIT 1';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos más recientes de la base de datos:', err);
    } else {
      if (results.length > 0) {
        const ultimaInformacion = {
          latitud: results[0].latitud,
          longitud: results[0].longitud,
          fecha: results[0].fecha,
          hora: results[0].hora,
        };
        socket.emit('datosActualizados', ultimaInformacion);
      }
    }
  });

  // Manejar desconexión de clientes
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});

// Iniciar el servidor HTTP
http.listen(80, '0.0.0.0', () => {
  console.log('Servidor web escuchando en el puerto 80');
});

// Filtrado de rutas por intervalo de tiempo
app.get('/filtrarRutas', (req, res) => {
  const { fechaInicio, horaInicio, fechaFin, horaFin } = req.query;

  const query = `SELECT latitud, longitud FROM coordenadas WHERE (fecha = ? AND hora >= ?) OR (fecha > ? AND fecha < ?)`;
  const values = [fechaInicio, horaInicio, fechaFin, horaFin];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error al filtrar las rutas:', err);
      res.status(500).send('Error al filtrar las rutas');
      return;
    }

    // Enviar la ruta filtrada al cliente
    res.json(results);
  });
});

module.exports = app;
