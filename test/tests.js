/*jshint esversion:6 */

const expect = require('chai').expect;
const request = require('request-promise');

const APIENDPOINT = "http://mail-api:8000/API/";

const beverages = { tea: [ 'chai', 'matcha', 'oolong' ] };
const foo = 'baz';

describe('API', function (){
  describe('Basic functionality', function() {
    it('Should exist and respond', async function (){
      let result = await request.get({"uri": "http://mail-api:8000/API/account/", "json": true});
      expect(result).to.have.own.property('name');
      expect(result).to.have.own.property('email');
    });
  });
});
