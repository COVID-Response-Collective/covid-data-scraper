/*
 * Copyright (C) 2020 HERE Europe B.V.
 * Licensed under MIT, see full license in LICENSE
 * SPDX-License-Identifier: MIT
 */


const fetch = require('node-fetch');
const dayjs = require('dayjs');
const express = require('express');

const router = express.Router();

const parseCsv = require('../utils/parseCsv');
const getSupplement = require('../utils/getSupplement');
const mergeData = require('../utils/mergeData');
const prepareScrapedData = require('../utils/prepareScrapedData');

async function download() {
  const sheets = ['Confirmed', 'Recovered', 'Deaths'];

  const sheetQueries = sheets.map((sheetName) => fetch(`https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-${sheetName}.csv`).then((d) => d.text()));

  const values = await Promise.all([
    ...sheetQueries,
    fetch('https://ncov.dxy.cn/ncovh5/view/pneumonia').then((d) => d.text()),
  ]);

  const [confirmedRaw, recoveredRaw, deathRaw] = values.slice(0, 3).map((d) => parseCsv(d));
  const dxyData = prepareScrapedData(values[3]);

  const [dateHeadersRaw, otherHeaders] = confirmedRaw.columns.reduce((acc, cur, i) => {
    let newAcc = acc;

    if (!i) {
      newAcc = [[], []];
    }

    const d = dayjs(cur).format('M/D/YYYY h:mm a');

    if (d === 'Invalid Date') {
      newAcc[1].push(cur);
    } else {
      newAcc[0].push(cur);
    }

    return newAcc;
  }, []);

  const dateHeaders = dateHeadersRaw.map((d) => dayjs(d).format('M/D/YYYY h:mm a'));

  const confirmed = confirmedRaw.map((d) => Object.keys(d).reduce((acc, cur) => {
    const isOtherHeader = otherHeaders.includes(cur);
    const asDate = dayjs(cur).format('M/D/YYYY h:mm a');
    const isDate = asDate !== 'Invalid Date';
    if (isDate && dateHeaders.includes(asDate)) {
      acc[asDate] = parseInt(d[cur], 10);
    } else if (isOtherHeader) {
      acc[cur] = d[cur];
    } else {
      return acc;
    }
    return acc;
  }, {}));

  const recovered = recoveredRaw.map((d) => Object.keys(d).reduce((acc, cur) => {
    const isOtherHeader = otherHeaders.includes(cur);
    const asDate = dayjs(cur).format('M/D/YYYY h:mm a');
    const isDate = asDate !== 'Invalid Date';
    if (isDate && dateHeaders.includes(asDate)) {
      acc[asDate] = parseInt(d[cur], 10);
    } else if (isOtherHeader) {
      acc[cur] = d[cur];
    } else {
      return acc;
    }
    return acc;
  }, {}));

  const death = deathRaw.map((d) => Object.keys(d).reduce((acc, cur) => {
    const isOtherHeader = otherHeaders.includes(cur);
    const asDate = dayjs(cur).format('M/D/YYYY h:mm a');
    const isDate = asDate !== 'Invalid Date';
    if (isDate && dateHeaders.includes(asDate)) {
      acc[asDate] = parseInt(d[cur], 10);
    } else if (isOtherHeader) {
      acc[cur] = d[cur];
    } else {
      return acc;
    }
    return acc;
  }, {}));

  const jhuData = confirmed.map((d) => {
    const supplementConfirmed = getSupplement('', d, null, dateHeaders);
    const supplementRecovered = getSupplement('recoveries_', d, recovered, dateHeaders);
    const supplementDeath = getSupplement('deaths_', d, death, dateHeaders);
    return {
      provincestate: d['Province/State'],
      countryregion: d['Country/Region'],
      // Fix column mismatch in the dataset
      lat: d.first_recorded,
      long: d.lat,
      headers: dateHeaders.join(';;'),
      ...supplementConfirmed,
      ...supplementRecovered,
      ...supplementDeath,
    };
  });

  const mergedData = mergeData(dateHeaders, jhuData, dxyData);
  const sortedData = mergedData.reduce((acc, val) => {
    const { countryregion, provincestate } = val;

    if (provincestate === '') {
      return {
        ...acc,
        [countryregion]: val,
      };
    }

    if (!acc[countryregion]) {
      return {
        ...acc,
        [countryregion]: {
          [provincestate]: val,
        },
      };
    }

    return {
      ...acc,
      [countryregion]: {
        ...acc[countryregion],
        [provincestate]: val,
      },
    };
  }, {});

  return sortedData;
}

/* GET download COVID-19 data. */
router.get('/', async (req, res) => {
  const data = await download();

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data, null, 2));
});

module.exports = router;
