FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build:prod

FROM nginx:alpine
COPY --from=builder /app/dist/tesoreria/browser /usr/share/nginx/html
RUN if [ -f /usr/share/nginx/html/index.csr.html ]; then \
      cp -f /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html; \
    fi
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location = /index.html {\n    add_header Cache-Control "no-cache, no-store, must-revalidate" always;\n    add_header Pragma "no-cache" always;\n    expires 0;\n  }\n  location ~* \\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {\n    expires 1y;\n    add_header Cache-Control "public, immutable" always;\n    try_files $uri =404;\n  }\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
