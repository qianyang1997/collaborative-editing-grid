# React Collaborative Editing Grid

This project demonstrates a real-time collaborative editing grid designed for distributed systems. It features a scalable architecture using a React frontend, Node.js backend, Redis stream for message synchronization, and MySQL for persistent storage.

The system assumes a many-to-many client-server relationship, where all user activity is broadcast to all other users across servers in real time.

You can deploy this system on any cloud / on-prem platform. The architecture uses a react frontend, node.js backend, Redis stream for inter-server messaging, and mysql for persistent logs. You can swap these components with any other language / framework / tool that achieves the same outcome.

## Features

- Real-time collaborative editing through WebSockets that can be hosted on multiple backend servers
- On login, users see:
  - All currently active users
  - All past messages
  - Real-time updates as they occur
- Messages from clients are distributed through Redis stream
- Messages from Redis stream are backed up in a mysql database
- Real-time conflict resolution if multiple users edit the same cell
- Automated system recovery (more details below)

### System Failure Scenarios

**Backend server fails:**
- **If client establishes a new connection:** Frontend shows error; session is not created.
- **If client is in an active session:** User session terminates immediately.
- **Recovery:** Active user sessions must be manually marked as errored in the DB before recovery.

**Database (MySQL) fails:**
- **If client establishes a new connection:** Fails immediately with error; session is not established; Redis logs failed connection attempt
- **If client is in an active session:** Can continue editing. Changes queue in Redis until DB is back online.
- **Recovery:** When DB recovers, queued changes auto-sync from Redis to DB.

**Redis fails:**
- **If client establishes a new connection:** Fails with error; session rejected and failed connection attempt logged to DB.
- **If client is in an active session:** Client session errors out; error gets logged to DB.
- **Edge case:** Client started a session, but session open status is not yet persisted to DB. Meanwhile, Redis loses connection and client session errors out. The error is persisted to DB. In this case, some active clients may only have 'error' status in the DB.
- **Recovery**: On reconnection, all items in Redis stream would be persisted to DB.
  
**Both mysql and Redis fail:**
- **If client establishes a new connection:** Fails with error; session rejected and failed connection attempt logged to the backend server's in-memory store.
- **If client is in an active session:** Client session errors out; error gets logged to the backend server's in-memory store.
- **Recovery:** Once both Redis and DB are restored, reconnection and data sync are attempted automatically. Logs in in-memory store would persist to DB.

## Running the application

This system is designed for distributed deployment (e.g., Kubernetes, AWS ECS/EKS, GCP, RDS). However, it can also run locally using Docker.

To run the application locally, build and start the app with:
```bash
docker-compose up --build
```
Then, access the app by visiting `http://localhost:3000`.

To tear down the Docker containers and volumes, run:
```bash
docker-compose down -v
```

### Environment Variable Configuration

- All environment variables (MySQL, Redis, backend settings) are defined in docker-compose.yml.
- Update values as needed for your cloud or local setup.
- Inline comments in the Docker Compose file explain each variable.

### Run in Development Mode (No Docker)

You may also run the app manually:

1. Ensure local instances of Redis and mysql are running.

2. Install dependencies:
```bash
cd frontend && npm install
cd backend && npm install
```

3. Export required environment variables:
```bash
export SQL_HOST=...
export REDIS_HOST=...
```

4. Start frontend and backend separately:
```bash
cd frontend && npm start
cd backend && npm start
```
