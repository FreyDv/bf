// Runs once on first start (docker-entrypoint-initdb.d), already authenticated as root.
// Creates the application user with readWrite on MONGO_DB.
const dbName = process.env.MONGO_DB || 'bf';
const user = process.env.MONGO_USER || 'bf';
const pwd = process.env.MONGO_PASSWORD || 'bf';

const appDb = db.getSiblingDB(dbName);

if (!appDb.getUser(user)) {
  appDb.createUser({
    user,
    pwd,
    roles: [{ role: 'readWrite', db: dbName }],
  });
}
