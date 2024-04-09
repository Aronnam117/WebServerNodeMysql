var express = require('express');
var router = express.Router();
var path = require('path');

// GET historial page
router.get('/historial', function(req, res, next) {
  // Asegúrate de que la ruta al archivo 'historial.html' sea correcta
  res.sendFile(path.join(__dirname, '..', 'public', 'historial.html'));
});

module.exports = router;
