



const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logger = require('../middleware/logger');

let db;

const connectDb = () => {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(config.databasePath, (err) => {
            if (err) {
                logger.error('Could not connect to database', err);
                reject(err);
            } else {
                logger.info('Connected to SQLite database.');
                resolve();
            }
        });
    });
};

const initDb = async () => {
    if (!db) {
        await connectDb();
    }
    
    // Execute base schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    await new Promise((resolve, reject) => {
        db.exec(schema, (err) => {
            if (err) {
                logger.error('Error executing DB schema', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
    
    
    await runMigrations();
};

const runMigrations = async () => {
    try {
        
        const tableInfo = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(packages)", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const hasRegistryColumn = tableInfo.some(col => col.name === 'registry');
        
        if (!hasRegistryColumn) {
            logger.info('Adding registry column to packages table...');
            
            
            await new Promise((resolve, reject) => {
                db.run("ALTER TABLE packages ADD COLUMN registry TEXT DEFAULT 'npm'", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            
            await new Promise((resolve, reject) => {
                db.run("UPDATE packages SET registry = 'npm' WHERE registry IS NULL", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            
            await new Promise((resolve, reject) => {
                db.run("CREATE INDEX IF NOT EXISTS idx_packages_registry ON packages (registry)", (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            
            await new Promise((resolve, reject) => {
                db.run("DROP INDEX IF EXISTS unq_package_version", (err) => {
                    if (err && !err.message.includes('no such index')) reject(err);
                    else resolve();
                });
            });
            
            logger.info('Registry column migration completed successfully.');
        } else {
            logger.info('Registry column already exists, skipping migration.');
        }
        
    } catch (error) {
        logger.error('Migration failed:', error);
        throw error;
    }
};

const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                logger.error(`Error running sql: ${sql} with params: ${params}`, err);
                reject(err);
            } else {
                resolve({ lastID: this.lastID, changes: this.changes });
            }
        });
    });
};

const get = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, result) => {
            if (err) {
                logger.error(`Error running sql: ${sql} with params: ${params}`, err);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                logger.error(`Error running sql: ${sql} with params: ${params}`, err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const closeDb = () => {
    db.close((err) => {
        if (err) {
            logger.error('Error closing the database connection', err);
        } else {
            logger.info('Database connection closed.');
        }
    });
};


const serializedRun = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(sql, params, function(err) {
                if (err) {
                    logger.error(`Error in serialized run: ${sql}`, err);
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    });
};


module.exports = { initDb, run, get, all, closeDb, serializedRun };