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
var historialRouter = require('./routes/historial');
require('dotenv').config();

// Configuración del servidor
app.use(express.static(path.join(__dirname, 'public')));
app.use('/historial', historialRouter);
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

// Nueva ruta para manejar la solicitud de historial con filtros de fecha y hora
app.get('/historial', (req, res) => {
  const { fechaInicio, horaInicio, fechaFin, horaFin } = req.query;

  // Verificar si se proporcionaron los parámetros necesarios
  if (!fechaInicio || !horaInicio || !fechaFin || !horaFin) {
    // Si no se proporcionan parámetros, simplemente sirve la página historial.html
    // Asegúrate de que 'historial.html' esté ubicado en el directorio 'public'
    return res.sendFile(path.join(__dirname, 'public', 'historial.html'));
  }

  // Si se proporcionan parámetros, realiza la consulta a la base de datos
  const query = `
    SELECT latitud, longitud, fecha, hora
    FROM coordenadas
    WHERE TIMESTAMP(CONCAT(fecha, ' ', hora)) BETWEEN ? AND ?
    ORDER BY id
  `;

  // Preparar los valores de los parámetros para evitar 'undefined undefined'
  const fechaHoraInicio = `${fechaInicio} ${horaInicio}`;
  const fechaHoraFin = `${fechaFin} ${horaFin}`;

  const values = [fechaHoraInicio, fechaHoraFin];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error al obtener el historial:', err);
      return res.status(500).send('Error al obtener el historial');
    }
    // Devuelve los resultados filtrados como JSON
    res.json(results);
  });
});
// Establecer conexión con los clientes
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');

  socket.on('filtrarDatos', (filtro) => {
    const { fechaInicio, horaInicio, fechaFin, horaFin } = filtro;
    // Asegúrate de que estas variables no sean undefined
    if (fechaInicio && horaInicio && fechaFin && horaFin) {
      const query = `
        SELECT latitud, longitud, fecha, hora
        FROM coordenadas
        WHERE TIMESTAMP(CONCAT(fecha, ' ', hora)) BETWEEN ? AND ?
        ORDER BY id
      `;
      db.query(query, [`${fechaInicio} ${horaInicio}`, `${fechaFin} ${horaFin}`], (err, results) => {
        if (err) {
          console.error('Error al filtrar las rutas:', err);
          socket.emit('errorEnFiltrado', 'Error al filtrar las rutas');
        } else {
          console.log('Se ha filtrado el historial correctamente.');
          console.log('Valores que cumplen con el filtro:', results);
          socket.emit('rutaFiltrada', results);
        }
      });
    }
  });

  function dibujarRuta(historial) {
    if (!mapa) {
      mapa = new google.maps.Map(document.getElementById('mapa'), {
        zoom: 12,
        center: historial.length > 0 ? { lat: parseFloat(historial[0].latitud), lng: parseFloat(historial[0].longitud) } : { lat: 0, lng: 0 }
      });
    }
  
    ruta = new google.maps.Polyline({
      path: historial.map(punto => ({
        lat: parseFloat(punto.latitud),
        lng: parseFloat(punto.longitud)
      })),
      geodesic: true,
      strokeColor: '#FF0000',
      strokeOpacity: 1.0,
      strokeWeight: 2,
      map: mapa
    });
  }

  // Enviar los datos más recientes al cliente cuando se conecta
  const query = 'SELECT latitud, longitud, fecha, hora FROM coordenadas ORDER BY id DESC LIMIT 1';

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener los datos más recientes de la base de datos:', err);
    } else {
      if (results.length > 0) {
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

function toggleSidebar() {
  var sidebar = document.getElementById("sidebar");
  var mapa = document.getElementById("mapa");
  
  if (sidebar.style.width === '250px') {
    sidebar.style.width = '0';
    mapa.style.width = '100%'; // El mapa ahora ocupa el 100% del ancho
  } else {
    sidebar.style.width = '250px';
    mapa.style.width = 'calc(100% - 250px)'; // Reducir el ancho del mapa para hacer espacio al sidebar
  }
}
// Exportar la aplicación Express
module.exports = app;
