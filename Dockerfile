FROM node:23-bullseye-slim

# Update apt package list and install Python3 and pip
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*  # Clean up to reduce image size

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

CMD ["sh", "-c", "npm run deploy-commands && npm start"]