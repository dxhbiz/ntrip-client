const STR_KEYS = ['type', 'mountpoint', 'identifier', 'format', 'formatDetails', 'carrier', 'navSystem', 'network', 'country', 'latitude',
  'longitude', 'nmea', 'solution', 'generator', 'comprEncryp', 'authentication', 'fee', 'bitrate'];
const CAS_KEYS = ['type', 'host', 'port', 'identifier', 'operator', 'nmea', 'country', 'latitude', 'longitude', 'fallbackHost', 'fallbackPort'];
const NET_KEYS = ['type', 'identifier', 'operator', 'authentication', 'fee', 'webNet', 'webStr', 'webReg'];

/**
 * parse source table data
 * @param {string} data sourtab table data
 * @param {Array} keys parse keys
 */
function parseTable(data, keys) {
  const arr = data.split(';');

  const rs = {};
  for (let i = 0; i < arr.length && i < keys.length; i++) {
    const key = keys[i];
    const value = arr[i];
    rs[key] = value;
  }
  return rs;
}

/**
 * convert buffer to source table list
 * @param {Buffer} data source table buffer
 * @returns
 */
function convertSource(data) {
  const tables = [];
  const dataArr = data.toString().split('\n').map(v => v.trim());
  for (const item of dataArr) {
    let table = null;
    if (item.startsWith('STR;')) {
      table = parseTable(item, STR_KEYS);
    }

    if (item.startsWith('CAS;')) {
      table = parseTable(item, CAS_KEYS);
    }

    if (item.startsWith('NET;')) {
      table = parseTable(item, NET_KEYS);
    }

    if (table) {
      tables.push(table);
    }
  }
  return tables;
}


module.exports = {
  convertSource
};