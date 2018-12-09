/*jshint esversion:6 */

const request = require('request-promise');

const baseRequest = request.defaults({
  "baseUrl": "http://mail-api:8000/API/",
  "resolveWithFullResponse": true,
  "json": true,
  "simple": false
});

// console.log("Hello!");

baseRequest({
  uri: '/account/',
  method: 'POST',
  body: {
    name: 'Tester McTesterson',
    email: 'test#@gmail.com'
  }
}).then(result => {
  // expect(result).to.have.property('statusCode').that.is.equal(201);
  // expect(result.body.apikey).to.be.a('string');
  console.log((result.body.details.apikey));
  //expect(result.body.apikey).to.have.property('apikey').that.is.a('string');
});
