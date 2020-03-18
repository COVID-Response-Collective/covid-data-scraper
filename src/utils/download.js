/*
 * Copyright (C) 2020 HERE Europe B.V.
 * Licensed under MIT, see full license in LICENSE
 * SPDX-License-Identifier: MIT
 */


const fetch = require('node-fetch');
const dayjs = require('dayjs');

const parseCsv = require('./parseCsv');
const getSupplement = require('./getSupplement');
const mergeData = require('./mergeData');
const prepareScrapedData = require('./prepareScrapedData');

async function getJHUSheet(sheetName) {
  const urlPrefix = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid';
  const url = `${urlPrefix}-${sheetName}.csv`;
  const result = await fetch(url);

  return result.text();
}

async function getDXYSheet() {
  const url = 'https://ncov.dxy.cn/ncovh5/view/pneumonia';
  const result = await fetch(url);

  return result.text();
}

function formatRawCases(rawCases, dateHeaders, otherHeaders) {
  return rawCases.map((d) => Object.keys(d).reduce((acc, cur) => {
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
}

async function download() {
  const sheets = ['Confirmed', 'Recovered', 'Deaths'];
  const sheetsJHU = await Promise.all(sheets.map((sheetName) => getJHUSheet(sheetName)));
  const sheetDXY = await getDXYSheet();

  const [confirmedRaw, recoveredRaw, deathRaw] = sheetsJHU.map(parseCsv);
  const dxyData = prepareScrapedData(sheetDXY);

  const [dateHeadersRaw, otherHeaders] = confirmedRaw.columns.reduce((acc, cur) => {
    const d = dayjs(cur).format('M/D/YYYY h:mm a');

    return d === 'Invalid Date' ? [acc[0], [...acc[1], cur]] : [[...acc[0], cur], acc[1]];
  }, [[], []]);

  const dateHeaders = dateHeadersRaw.map((d) => dayjs(d).format('M/D/YYYY h:mm a'));

  const [confirmed, recovered, death] = [confirmedRaw, recoveredRaw, deathRaw]
    .map((rawCases) => formatRawCases(rawCases, dateHeaders, otherHeaders));

  const jhuData = confirmed.map((d) => {
    const supplementConfirmed = getSupplement(d, null, dateHeaders);
    const supplementRecovered = getSupplement(d, recovered, dateHeaders);
    const supplementDeath = getSupplement(d, death, dateHeaders);
    return {
      provincestate: d['Province/State'],
      countryregion: d['Country/Region'],
      // Fix column mismatch in the dataset
      lat: d.first_recorded,
      long: d.lat,
      headers: dateHeaders.join(';;'),
      confirmedData: supplementConfirmed,
      recoveriesData: supplementRecovered,
      deathsData: supplementDeath,
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

module.exports = download;
