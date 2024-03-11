# Usa la imagen de Node.js como base
FROM node:latest

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia el archivo package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos del proyecto
COPY . .

# Agrega este comando para listar archivos en el contenedor
RUN ls -al

# Expone el puerto en el que la aplicación escucha
EXPOSE 4000

# Comando para iniciar la aplicación
CMD ["node", "app.js"]
