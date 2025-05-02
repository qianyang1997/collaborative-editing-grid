# Step 1: Build the React app
FROM node:slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN npm run build

# Step 2: Serve with Nginx
FROM nginx:alpine

# Copy built files to Nginx's public folder
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
