# React Collaborative Editing Grid

This project is a sample design for a grid with collaborative editing capabilities on a distributed system.

Assuming client <> server are many-to-many, and all client activities need to be communicated to all other clients across servers.

The current codebase is run locally. You can modify the env variables to deploy it online through any cloud / on-prem platform. The architecture uses a react frontend, node.js backend, Redis stream, and mysql database (you can also swap out these components with any other language / framework that achieves the same outcome).

## Behaviors
- Real-time collaborative editing through WebSockets that can be hosted on multiple backend servers
- Messages from different clients and servers synced through Redis stream
- Messages from Redis stream are backed up in a mysql database
- Upon login, users can see all active users, all historical messages, and subscribe to real-time updates
- Real-time conflict resolution if multiple users are editing the same cells

### If system fails, behaviors
- If backend server fails:
  - if client connects, client frontend shows error message + alerts; nothing gets logged in the backend or communicated to any client
  - if active client, client frontend shows error message + alerts; need to manually error out client session in DB before server goes back on
- If only DB fails:
  - when client connects, should immediately see error message as they can't get all historical; client session closes immediately; redis logs error status
  - if client is already connected, they can still continue to edit as if nothing happens
  - accumulated messages will auto-save when DB is back on
- If only Redis fails:
  - All in-memory data not persisted to DB get lost
  - client connects: see error message, client session immediately closes, error status gets logged to DB
  - client already active: session closed, see error message; immediately marks all active client sessions in DB as error in DB
  - Edge case: client opened but not yet persisted to DB; client session shutdown error persisted to DB - error status is logged to DB, and open status may be logged to DB if Redis did not lose all in-memory cache (DB would see some clients as open + error, some as only error)
  - when Redis comes back up, automate reconnect; items in in-memory cache would sync to DB
- If both DB and Redis fails:
  - when client connects, error out, error gets logged somewhere to be persisted to DB when back up
  - active clients get errored out, error gets logged somewhere to be persisted to DB when back up
  - when Redis and DB comes back up, automatic reconnect; items in in-memory cache would sync to DB

## Run the application

You may deploy and run the application anywhere (Kubernetes, EKS, RDS, etc.). For the sake of simplicity, this section outlines how to run the application locally.

1. Start mysql



2. Start Redis



3. Run backend & frontend

Run `docker-compose build` to build the images. You may change the env variables in `docker-compose.yml`.

Run `docker-compose up` to run the images. Then, access web page through `http://localhost:3000`.

Alternatively, instead of building the docker image, you may run the frontend & backend locally in dev mode simply with `npm start`. Make sure to install all the dependencies and export all the environment variables first.
