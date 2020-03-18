/*
 * Copyright (C) 2020 HERE Europe B.V.
 * Licensed under MIT, see full license in LICENSE
 * SPDX-License-Identifier: MIT
 */

function getSupplement(referenceSheet, sheet, dateHeaders) {
  const relevant = sheet
    ? sheet.find((s) => (s['Province/State'] === referenceSheet['Province/State']) && (s['Country/Region'] === referenceSheet['Country/Region']))
    : referenceSheet;

  return dateHeaders.reduce((acc, cur) => (!relevant[cur] ? acc : {
    ...acc,
    [cur]: parseInt(relevant[cur], 10),
  }), {});
}

module.exports = getSupplement;
