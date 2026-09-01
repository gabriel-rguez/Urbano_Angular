# Step 1: Build the Angular app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Step 2: Serve the app using Nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist/gestion_ecomovil/browser /usr/share/nginx/html
# Copiar configuración de nginx para manejar rutas de Angular
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
