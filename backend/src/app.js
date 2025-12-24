



const express = require('express');
const routes = require('./api/routes');
const { httpLogger } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// A simple CORS middleware to allow the frontend to connect
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());
app.use(httpLogger);
app.use('/', routes);
app.use(errorHandler);

module.exports = app;