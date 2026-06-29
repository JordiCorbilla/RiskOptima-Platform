FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV VITE_PROXY_TARGET=http://backend:8080
EXPOSE 5177
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5177"]
