/* eslint-disable */
// Runs the round 1 arithmetic checks against the model block of round-2.html. Run: node prototypes/replay/checks/verify2.js
const fs = require('fs');
const real = fs.readFileSync;
fs.readFileSync = (p, ...a) => real(String(p).replace('replay/index.html', 'replay/round-2.html'), ...a);
require('./verify.js');
