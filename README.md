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

## Available Scripts

### Run locally

- Start mysql
- Start Redis
- Start backend
- Start frontend

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.
