const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const logger = require('morgan');

const downloadRouter = require('./routes/download');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', downloadRouter);

module.exports = app;
