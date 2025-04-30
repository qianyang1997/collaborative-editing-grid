# Use official Node.js base image
FROM node:slim

# Create app directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the source code
COPY src ./src

# Expose the port your app runs on
EXPOSE 5001

# Start the app
CMD ["node", "src/server.js"]
