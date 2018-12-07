/*jshint esversion:6 */

const expect = require('chai').expect;
const request = require('request-promise');

describe('API', function (){
  const baseRequest = request.defaults({
    "baseUrl": "http://mail-api:8000/API/",
    "resolveWithFullResponse": true,
    "json": true
  });
  let urlParams = {
    listName: 'xmas',
    subscriberEmail: 'dave@gmail.com',
    fieldId: 1,
    keyId: 1
  };
  const endpoints = [
    {
      uri: '/',
      methods: [
        {name:'GET', auth: false},
      ]
    }, {
      uri: '/account/',
      methods: [
        {name:'GET', auth: true},
        {name:'POST', auth: false},
        {name:'DELETE', auth: true}
      ]
    }, {
      uri: '/account/keys/',
      methods: [
        {name:'GET', auth: true},
        {name:'POST', auth: true},
      ]
    }, {
      uri: `/account/keys/${urlParams.keyId}/`,
      methods: [
        {name:'GET', auth: true},
        {name:'DELETE', auth: true},
      ]
    }, {
      uri: '/lists/',
      methods: [
        {name:'GET', auth: true},
      ]
    }, {
      uri: `/lists/${urlParams.listName}/`,
      methods: [
        {name:'GET', auth: true},
        {name:'POST', auth: true},
        {name:'PUT', auth: true},
        {name:'PATCH', auth: true},
        {name:'DELETE', auth: true},
      ]
    }, {
      uri: `/lists/${urlParams.listName}/${urlParams.subscriberEmail}/`,
      methods: [
        {name:'GET', auth: true},
        {name:'PUT', auth: true},
        {name:'PATCH', auth: true},
        {name:'DELETE', auth: true},
      ]
    }, {
      uri: `/lists/${urlParams.listName}/${urlParams.subscriberEmail}/fields/`,
      methods: [
        {name:'GET', auth: true},
        {name:'PUT', auth: true},
        {name:'DELETE', auth: true},
      ]
    }, {
      uri: `/lists/${urlParams.listName}/${urlParams.subscriberEmail}/fields/${urlParams.fieldId}`,
      methods: [
        {name:'GET', auth: true},
        {name:'PUT', auth: true},
        {name:'DELETE', auth: true},
      ]
    }
  ];

  describe('Basic functionality', function() {
    it('Should exist and respond', async function (){
      let response = await baseRequest.get("");
      expect(response.statusCode).to.equal(200);
    });

    it('Rejects API calls without the right authentication headers', async function() {
      // Reduce all the endpoints to a flat array.
      let flatEndPoints = endpoints.reduce((acc, val)=>{
        return acc.concat(val.methods.map((element) => {
          return {uri: val.uri, method: element.name, auth: element.auth};
        }));
      }, []).filter(element => element.auth);

      return Promise.all(
        flatEndPoints.map(
          endPoint => baseRequest({method: endPoint.method, uri: endPoint.uri, simple: false })
        )
      ).then((results) => {
        for (let result of results) {
          expect(result.statusCode).to.equal(401);
        }
      });
    });
  });

  describe('Account functionality', function() {
    describe('Account API key functionality', function() {
    });
  });

  describe('Mailing List functionality', function() {
    describe('Subscriber functionality', function() {
      describe('Field functionality', function() {
      });
    });
  });
});
