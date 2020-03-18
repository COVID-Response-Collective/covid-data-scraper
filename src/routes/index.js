const fs = require('fs');
const express = require('express');
const download = require('../utils/download');

const router = express.Router();

/* GET download COVID-19 data. */
router.get('/', async (req, res) => {
  let data;

  try {
    data = fs.readFileSync('./cachedData.json');
  } catch (err) {
    console.error(err);
    data = await download();
  }
  const jsonData = JSON.parse(data);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(jsonData, null, 2));
});

module.exports = router;
