const { NtripClient } = require('../index');


const options = {
  host: 'rtk2go.com',
  port: 2101,
  mountpoint: 'ACACU',
  username: 'test@test.com',
  password: 'test',
  xyz: [-1983430.2365, -4937492.4088, 3505683.7925],
  // the interval of send nmea, unit is millisecond
  interval: 2000,
};

const client = new NtripClient(options);

client.on('data', (data) => {
  console.log(data);
});

client.on('close', () => {
  console.log('client close');
});

client.on('error', (err) => {
  console.log(err);
});

client.run();
