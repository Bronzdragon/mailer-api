/*jshint esversion:6 */

const request = require('request-promise');

const baseRequest = request.defaults({
  "baseUrl": "http://mail-api:8000/API/",
  "resolveWithFullResponse": true,
  "json": true
});

// console.log("Hello!");

baseRequest("account/")
.then((response) => {
  console.log(response);
});
