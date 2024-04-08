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

let ultimaInformacion = {
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

// Establecer conexión con los clientes
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  // Manejar solicitud de filtrado de datos
  socket.on('filtrarDatos', (filtro) => {
    const { fechaInicio, horaInicio, fechaFin, horaFin } = filtro;
  
    // Combina la fecha y la hora de inicio en una marca de tiempo completa
    const marcaTiempoInicio = new Date(`${fechaInicio}T${horaInicio}`);
  
    // Combina la fecha y la hora de fin en una marca de tiempo completa
    const marcaTiempoFin = new Date(`${fechaFin}T${horaFin}`);
  
    // Construir la consulta SQL para seleccionar todos los registros entre las marcas de tiempo de inicio y fin
    const query = `
      SELECT latitud, longitud, fecha, hora 
      FROM coordenadas 
      WHERE TIMESTAMP(CONCAT(fecha, ' ', hora)) BETWEEN ? AND ?
      ORDER BY id
    `;
  
    // Ejecutar la consulta en la base de datos
    db.query(query, [marcaTiempoInicio, marcaTiempoFin], (err, results) => {
      if (err) {
        console.error('Error al filtrar las rutas:', err);
        return;
      }
  
      console.log('Se ha filtrado el historial correctamente.');
      console.log('Valores que cumplen con el filtro:', results);
  
      // Enviar la ruta filtrada al cliente
      socket.emit('rutaFiltrada', results);
    });
  });

  // Enviar los datos más recientes al cliente cuando se conecta
  const query = 'SELECT latitud, longitud, fecha, hora FROM coordenadas ORDER BY id DESC LIMIT 1';
  // Ejecutar la consulta en la base de datos
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos más recientes de la base de datos:', err);
    } else {
      // Verificar si se obtuvieron resultados
      if (results.length > 0) {
        // Asignar los datos más recientes al objeto ultimaInformacion
        ultimaInformacion = {
          latitud: results[0].latitud,
          longitud: results[0].longitud,
          fecha: results[0].fecha,
          hora: results[0].hora
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

module.exports = app;
