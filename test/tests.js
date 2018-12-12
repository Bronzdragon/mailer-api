/*jshint esversion:6 */

const expect = require('chai').expect;
const request = require('request-promise');

const BASEURL = "http://mail-api:8000";

const baseRequest = request.defaults({
  "baseUrl": BASEURL + "/API/",
  "resolveWithFullResponse": true,
  "simple": false,
  "json": true
});

describe('API', function() {
  let createdAccounts = [];
  after(function() {
    let deleteRequests = [];
    for (let account of createdAccounts) {
      deleteRequests.push(baseRequest.delete({
        uri: '/account/',
        headers: {
          'Email': account.email,
          'Apikey': account.key
        },
        body: { confirmDelete: true }
      }));
    }
    return Promise.all(deleteRequests);
  });

  describe('Basic functionality', function() {
    it('Should exist and respond', function (){
      return baseRequest.get('/')
      .then(response => {
        expect(response).to.have.property('statusCode').that.is.equal(200);
      });
    });
  });

  describe('Account functionality', function() {
    const accountRequest = baseRequest.defaults({
      uri:'/account/'
    });

    describe('Account Creation', function() {
      it('Creates an account.', async function () {
        let account = randomAccount();
        let postResult = await accountRequest.post({ body: account });
        expect(postResult).to.have.property('statusCode').that.is.equal(201);

        expect(postResult.body).to.have.property('email').that.is.equal(account.email);
        expect(postResult.body.key).to.have.property('secret').that.is.a('string');

        createdAccounts.push(postResult.body);

        let getResult = await accountRequest.get({
          headers: {
            'Email': postResult.body.email,
            'Apikey': postResult.body.key.secret
          }
        });
        expect(getResult.body).to.have.property('name').that.is.equal(account.name);
        expect(getResult.body).to.have.property('email').that.is.equal(account.email);
      });
      it('Reject a request for an identical account.', async function () {
        let payload = randomAccount();

        firstResult = await accountRequest.post({ body: payload });
        secondResult = await accountRequest.post({ body: payload });

        expect(firstResult).to.have.property('statusCode').that.is.equal(201);
        expect(secondResult).to.have.property('statusCode').that.is.equal(400);
        expect(secondResult.body).to.not.property('Apikey');

        // for cleanup later.
        createdAccounts.push(firstResult.body);

        await accountRequest.get({
          headers: {
            'Email': firstResult.body.email,
            'Apikey': firstResult.body.key.secret
          }
        }).then(result => {
          expect(result.body).to.have.property('name').that.is.equal(payload.name);
          expect(result.body).to.have.property('email').that.is.equal(payload.email);
        });
      });
      it('Rejects requests if some or all properties are missing.', function(){
        return Promise.all([
          accountRequest.post({ body: {} })
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(400);
          }),

          accountRequest.post({ body: {name: randomString(8)} })
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(400);
          }),

          accountRequest.post({ body: { email: `${randomString(8)}@gmail.com` } })
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(400);
          })
        ]);
      });
    });

    describe('Account Viewing', function() {
      let account; // Account used in this section.
      before(function() {
        return accountRequest.post({ body: randomAccount() }).then(result => {
          account = result.body;
          createdAccounts.push(account);
        });
      });
      it('Rejects requests that are not authenticated.', function(){
        return accountRequest.get().then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(401);
        });
      });
      it('Allows us to look at our own account.', function () {
        return accountRequest.get({
          headers: {
            'Email': account.email,
            'Apikey': account.key.secret
          }
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(200);
          expect(result.body).to.have.property('id').that.is.equal(account.id);
          expect(result.body).to.have.property('name').that.is.equal(account.name);
          expect(result.body).to.have.property('email').that.is.equal(account.email);
        });
      });
    });

    describe('Account Editing', function() {
      let account, authenticatedRequest;
      beforeEach(async function(){ // Fill vars we'll need for these tests
        const name = randomString();

        const result = await accountRequest.post({ body: {
          name: name,
          email: `${name}@gmail.com`
        }});

        account = result.body;
        authenticatedRequest = accountRequest.defaults({
          headers: {
            'Email': account.email,
            'Apikey': account.key.secret
          }
        });

        createdAccounts.push(account);
      });
      it('Rejects requests that are not authenticated.', async function () {
        const result = await accountRequest.put();
        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it('Allows updating of account name and email via PUT.', async function() {
        const newDetails = randomAccount();
        const changeResult = await authenticatedRequest.put({body: newDetails});
        expect(changeResult).to.have.property('statusCode').that.is.equal(200);

        const getResult = await authenticatedRequest.get({headers: {
          'email' : newDetails.email,
          'apikey': account.key.secret
        }});

        expect(getResult).to.have.property('statusCode').that.is.equal(200);

        expect(getResult.body).to.have.property('name').that.is.equal(newDetails.name);
        expect(getResult.body).to.have.property('email').that.is.equal(newDetails.email);
      });
      it('Rejects PUT requests that are missing parameters.', async function() {
        const newDetails = randomAccount();
        const nameResult = await authenticatedRequest.put({body: {name: newDetails.name}});
        expect(nameResult).to.have.property('statusCode').that.is.equal(400);

        const emailResult = await authenticatedRequest.put({body: {email: newDetails.email}});
        expect(emailResult).to.have.property('statusCode').that.is.equal(400);

        const getResult = await authenticatedRequest.get();

        expect(getResult).to.have.property('statusCode').that.is.equal(200);

        expect(getResult.body).to.have.property('name').that.is.equal(account.name);
        expect(getResult.body).to.have.property('email').that.is.equal(account.email);
      });
      it('Allows updating of account name or email (or both) via PATCH.', async function() {
        const newDetails = randomAccount();

        const nameResult = await authenticatedRequest.patch({body: {name: newDetails.name}});
        expect(nameResult).to.have.property('statusCode').that.is.equal(200);

        const emailResult = await authenticatedRequest.patch({body: {email: newDetails.email}});
        expect(emailResult).to.have.property('statusCode').that.is.equal(200);

        const getResult = await authenticatedRequest.get({headers: {
          'email' : newDetails.email,
          'apikey': account.key.secret
        }});

        expect(getResult).to.have.property('statusCode').that.is.equal(200);

        expect(getResult.body).to.have.property('name').that.is.equal(newDetails.name);
        expect(getResult.body).to.have.property('email').that.is.equal(newDetails.email);
      });
    });

    describe('Account Deletion', function() {
      it('Rejects requests that are not authenticated.', async function (){
        const result = await accountRequest.delete({body: { confirmDelete: true }});
        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it("Rejects requests without the 'confirmDelete' flag set.", async function(){
        const account = (await accountRequest.post({ body: randomAccount() })).body;
        createdAccounts.push(account);

        const deleteResult = await accountRequest.delete({
          headers: {
            'Email': account.email,
            'Apikey': account.key.secret
          },
          body: null
        });
        expect(deleteResult).to.have.property('statusCode').that.is.equal(400);

        const getResult = await accountRequest.get({headers: {
          'email' : account.email,
          'apikey': account.key.secret
        }});

        expect(getResult).to.have.property('statusCode').that.is.equal(200);
        expect(getResult.body).to.have.property('name').that.is.equal(account.name);
        expect(getResult.body).to.have.property('email').that.is.equal(account.email);
      });
      it('Deletes accounts.', async function(){
        const account = (await accountRequest.post({ body: randomAccount() })).body;

        const deleteResult = await accountRequest.delete({
          headers: {
            'Email': account.email,
            'Apikey': account.key.secret
          },
          body: {confirmDelete: true}
        });
        expect(deleteResult).to.have.property('statusCode').that.is.equal(200);

        const getResult = await accountRequest.get({headers: {
          'email' : account.email,
          'apikey': account.key.secret
        }});

        expect(getResult).to.have.property('statusCode').that.is.equal(401);
      });
    });

    describe('Account API key functionality', function() {
      let keyRequest;
      let testAccount;
      before(function() {
        return accountRequest.post({ body: randomAccount() })
        .then(result => {
          testAccount = result.body;
          createdAccounts.push(testAccount);

          keyRequest = baseRequest.defaults({
            uri: '/',
            baseUrl: BASEURL + '/api/account/keys/',
            headers: {
              'Email': testAccount.email,
              'Apikey': testAccount.key.secret
            }
          });
        });
      });

      describe('Key Creation', function() {
        it('Reject requests that are not authenticated.', async function(){
            let result = await keyRequest.post({headers:null})
            expect(result).to.have.property('statusCode').that.is.equal(401);
        });
        it('Creates a new key', async function() {
          const result = await keyRequest.post();
          expect(result).to.have.property('statusCode').that.is.equal(201);

          expect(result.body.key).to.be.an('object');
          expect(result.body.key).have.a.property('id').that.is.a('number');
          expect(result.body.key).have.a.property('name').that.is.a('string');
          expect(result.body.key).have.a.property('secret').that.is.a('string');
        });
        it('Allows specifying a key name', async function() {
          randomName = randomString();
          const result = await keyRequest.post({ body: {name: randomName} });
          expect(result).to.have.property('statusCode').that.is.equal(201);
          expect(result.body.key).to.be.an('object');
          expect(result.body.key).have.a.property('id').that.is.a('number');
          expect(result.body.key).have.a.property('secret').that.is.a('string');
          expect(result.body.key).have.a.property('name').to.be.equal(randomName);

          const allKeys = (await keyRequest.get()).body.keys;
          const containskey = allKeys.some(key => key.name === randomName);
          expect(containskey).to.be.true;
        });
      });
      describe('Key Viewing', function() {
        it('Reject requests that are not authenticated.', async function() {
          const multiResult = await keyRequest.get({headers: null});
          expect(multiResult).to.have.property('statusCode').that.is.equal(401);

          const allKeys = (await keyRequest.get()).body.keys;
          const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];
          const singleResult = await keyRequest.get({
            headers: null,
            uri: `/${randomKey.id}/`
          });
          expect(singleResult).to.have.property('statusCode').that.is.equal(401);

        });
        it('Allows viewing of single keys', async function() {
          const allKeys = (await keyRequest.get()).body.keys;
          const randomKey = allKeys[Math.floor(Math.random() * allKeys.length)];

          const keyResult = await keyRequest.get(`/${randomKey.id}/`);
          expect(keyResult.body).to.deep.equal(randomKey);
        });
        it('Allows viewing of all keys', async function() {
          const keyResult = await keyRequest.get();
          expect(keyResult).to.have.property('statusCode').that.is.equal(200);
          expect(keyResult.body).to.have.a.property('keys').that.is.an('array');
          expect(keyResult.body.keys).to.have.lengthOf.at.least(1);

          let validKey = key => key.hasOwnProperty('id') && key.hasOwnProperty('name');
          expect(keyResult.body.keys.every(validKey)).to.be.true;
        });
      });
      describe('Key Editing', function() {
        it('Reject requests that are not authenticated.', async function () {
          let oldName = randomString();
          let newName = randomString();
          // Generate a new key to test.
          let testkey = await keyRequest.post({ body: { name: oldName } })
            .then(result => result.body.key);

          let updateRequest = await keyRequest.put({
            uri: `/${testkey.id}/`,
            headers: null,
            body: {name: newName}
          });
          expect(updateRequest).to.have.property('statusCode').that.is.equal(401);

          let result = await keyRequest.get(`/${testkey.id}/`)
          expect(result.body).to.have.property('name').that.is.equal(oldName);
        });
        it('Edits the name of a single key by ID', async function () {
          const oldName = randomString();
          const newName = randomString();

          const testkey = await keyRequest.post({ body: { name: oldName } }).then(result => result.body.key);

          const editRequest = await keyRequest.put({
            uri: `/${testkey.id}/`,
            body: { name: newName }
          });
          expect(editRequest).to.have.property('statusCode').that.is.equal(200);

          const newKey = await keyRequest.get({
            uri:`/${testkey.id}/`,
          }).then(result => result.body);
          expect(newKey.name).to.be.equal(newName);
        });
        it('Edits the names of keys in bulk by IDs', async function() {
          const CreateKey = (name => {
            return keyRequest.post({ body: { name: name } }).then(result => {
              returnVal = result.body.key;
              returnVal.newName = randomString();
              return returnVal;
            })
          });

          const testKeys = await Promise.all([
            CreateKey(randomString()),
            CreateKey(randomString()),
            CreateKey(randomString())
          ]);

          let editRequest = await keyRequest.patch({ body: [
            { id: testKeys[0].id, name: testKeys[0].newName },
            { id: testKeys[1].id, name: testKeys[1].newName },
            { id: testKeys[2].id, name: testKeys[2].newName }
          ]});

          expect(editRequest).to.have.property('statusCode').that.is.equal(200);

          const allKeys = (await keyRequest.get()).body.keys;

          for (let testKey of testKeys) {
            let keyExists = allKeys.some(key => key.id === testKey.id && key.name === testKey.newName);
            expect(keyExists).to.be.true;
          }

          // expect.fail("Not yet implemented");
        });
      });
      describe('Key Deletion', function() {
        it('Reject requests that are not authenticated.', async function() {
          const keyName = randomString();
          let testKey = (await keyRequest.post({body:{name: keyName}})).body.key;

          const deleteRequest = await keyRequest.delete({
            uri: `/${testKey.id}/`,
            headers:null
          });
          expect(deleteRequest).to.have.property('statusCode').that.is.equal(401);
        });
        it('Deletes single keys by ID', async function() {
          const keyName = randomString();
          let testKey = (await keyRequest.post({body:{name: keyName}})).body.key;

          const deleteRequest = await keyRequest.delete({
            uri: `/${testKey.id}/`
          });

          expect(deleteRequest).have.property('statusCode').that.is.equal(200);

          let getRequest = await keyRequest.get({uri: `/${testKey.id}/`});
          expect(getRequest).have.property('statusCode').that.is.equal(404);
        });
        it('Deletes a list of keys by IDs', async function() {
          let testKeys = (await Promise.all([
            keyRequest.post({body:{name: randomString()}}),
            keyRequest.post({body:{name: randomString()}}),
            keyRequest.post({body:{name: randomString()}})
          ])).map(res => res.body.key);

          let deleteRequest = await keyRequest.delete({
            body: [testKeys[0].id, testKeys[1].id, testKeys[2].id]
          });
          expect(deleteRequest).have.property('statusCode').that.is.equal(200);

        });
      });
    });
  });

  describe('Mailing List functionality', function() {
    let mailingListRequest;
    let testAccount;
    before(function() {
      return baseRequest.post({
        uri: '/account/',
        body: randomAccount()
      }).then(result => {
        testAccount = result.body.details;
        createdAccounts.push(testAccount);

        mailingListRequest = baseRequest.defaults({
          uri:'/lists/',
          headers: {
            'Email': testAccount.email,
            'Apikey': testAccount.key
          }
        });
      });
    });

    describe('Mailing list Creation', function() {
      it('Reject requests that are not authenticated.', async function() {
        let listName = randomString();
        let postRequest = await mailingListRequest.post({
          uri: mailingListRequest.uri + `/${listName}/`,
          headers: null
        });
        expect(postRequest).to.have.property('statusCode').that.is.equal(401);

        let putRequest = await mailingListRequest.put({
          uri: mailingListRequest.uri + `/${listName}/`,
          headers: null
        });
        expect(putRequest).to.have.property('statusCode').that.is.equal(401);

        return mailingListRequest.get()
        .then( result => {
          let containsMailinglist = result.body['mailing-lists'].some(list => list.name = listName);
          expect(containsMailinglist).to.be.false;
        });
      });
      it('Creates new mailing lists.', async function(){
        // Without subscribers
        let listName = {
          post: randomString(),
          put: randomString()
        }

        let postRequest = await mailingListRequest.post({ uri: `/lists/${listName.post}/` });
        expect(postRequest).to.have.property('statusCode').that.is.equal(201);

        let putRequest = await mailingListRequest.put({ uri: `/lists/${listName.put}/` });
        expect(putRequest).to.have.property('statusCode').that.is.equal(201);

        let listnames = await mailingListRequest.get({})
          .then(result => result.body['mailing-lists'])
          .map(list => list.name);

        expect(listnames).to.include.members([listName.post, listName.put]);
      });
      it('Creates new mailing lists with subscribers.', async function() {
        let listName = {
          post: randomString(),
          put: randomString()
        }
        let postRequest = await mailingListRequest.post({
          uri: `/lists/${listName.post}/`,
          body: { entries: [ randomSubscriber(), randomSubscriber(), randomSubscriber() ] }
        });
        expect(postRequest).to.have.property('statusCode').that.is.equal(201);

        let putRequest = await mailingListRequest.put({
          uri: `/lists/${listName.put}/`,
          body: { entries: [ randomSubscriber(), randomSubscriber(), randomSubscriber() ] }
        });
        expect(putRequest).to.have.property('statusCode').that.is.equal(201);

        let listnames = await mailingListRequest.get({})
          .then(result => result.body['mailing-lists'])
          .map(list => list.name);
        expect(listnames).to.include.members([listName.post, listName.put]);

        // TODO: Verify if the subscribers are saved properly?
      });
    });
    describe('Mailing list Viewing', function() {
      it('Reject requests that are not authenticated.', function() {
        let listName = randomString();
        let tests = [];

        // Cannot get overview.
        tests.push(mailingListRequest.get({
          headers: null
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(401);
        }));

        // Cannot get specifc list.
        tests.push(mailingListRequest.post({
          uri: `/lists/${listName.post}/`
        }).then(result => {
          return mailingListRequest.get({
            uri: `/lists/${listName.post}/`,
            headers: null
          });
        }).then (result => {
          expect(result).to.have.property('statusCode').that.is.equal(401);
        }));

        return Promise.all(tests);
      });
      it('Shows all mailing lists for the authenticated account.', function () {
        let expectedListNames = [randomString(), randomString(), randomString()];

        return Promise.all(expectedListNames.map(
          name => mailingListRequest.post({ uri: `/lists/${name}/`})
        )).then(() => {
          return mailingListRequest.get();
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(200);
          let actualListNames = result.body['mailing-lists'].map(entry => entry.name)
          expect(actualListNames).to.include.members(expectedListNames);
        });
      });
      it('Shows the details for any specific mailing list.', function() {
        let listName = randomString();
        return mailingListRequest.post({ uri: `/lists/${listName}/`})
        .then(result => {
          return mailingListRequest.get({ uri: `/lists/${listName}/`});
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(200);
          expect(result.body).to.have.property('name').that.is.equal(listName);
          expect(result.body).to.have.property('subscribers').that.is.an('array');
        });
      });
    });
    describe('Mailing list Editing', function() {
      it('Reject requests that are not authenticated.', async function() {
        let oldName = randomString();
        let newName = randomString();

        await mailingListRequest.post({
          uri: `/lists/${oldName}/`
        });

        let result = await mailingListRequest.put({
          uri: `/lists/${oldName}/`,
          headers: null,
          body: { name: newName }
        });

        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it('Changes the Mailing list name.', async function() {
        let oldName = randomString();
        let newName = randomString();

        await mailingListRequest.post({
          uri: `/lists/${oldName}/`
        });

        await mailingListRequest.put({
          uri: `/lists/${oldName}/`,
          body: { name: newName }
        });

        let result = await mailingListRequest.get({
            uri: `/lists/${newName}/`
        });

        expect(result).to.have.property('statusCode').that.is.equal(200);
        expect(result.body).to.have.property('name').that.is.equal(newName);
      });
    });
    describe('Mailing list Deletion', function() {
      it('Reject requests that are not authenticated.', async function() {
        let name = randomString();

        await mailingListRequest.post({
          uri: `/lists/${name}/`
        });

        let result = await mailingListRequest.delete({
          uri: `/lists/${name}/`,
          headers: null
        });

        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it('Deletes mailing lists by ID', function() {
        expect.fail("Not yet implemented");
      });
      it('Deletes mailing lists by name', async function() {
        let name = randomString();

        await mailingListRequest.post({
          uri: `/lists/${name}/`
        });

        await mailingListRequest.delete({
          uri: `/lists/${name}/`,
        });

        let result = await mailingListRequest.get({
          uri: `/lists/${name}/`,
        });

        expect(result).to.have.property('statusCode').that.is.equal(404);
      });
    });

    describe('Subscriber functionality', function() {
      let listname;
      let subscriberRequest;
      before(function() {
        listname = randomString();
        subscriberRequest = baseRequest.defaults({
          uri: '/',
          baseUrl: `http://mail-api:8000/API/lists/${listname}/`,
          headers: {
            'Email': testAccount.email,
            'Api-Key': testAccount.key.secret
          }
        });

        return subscriberRequest.post("/");
      });
      describe('Subscriber Adding', function() {
        it('Reject requests that are not authenticated.', async function() {
          let postSubscriber = randomSubscriber();
          let putSubscriber  = randomSubscriber();

          let postRequest = mailingListRequest.post({
            uri: postSubscriber.email,
            body: postSubscriber,
            headers: null
          }).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(401);
          });

          let putRequest = mailingListRequest.put({
            uri: putSubscriber.email,
            body: putSubscriber,
            headers: null
          }).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(401);
          });

          await Promise.all([postRequest, putRequest]);

          let postGetRequest = mailingListRequest.get({uri: `/${postSubscriber.email}/`});
          let putGetRequest  = mailingListRequest.get({uri: `/${putSubscriber.email}/` });

          return Promise.all([postGetRequest, putGetRequest])
          .then(([postResult, putResult]) => {
            expect(postResult).to.have.property('statusCode').that.is.equal(404);
            expect(putResult ).to.have.property('statusCode').that.is.equal(404);
          });
        });
        it('Allows adding single subscribers.', async function() {
          let postSubscriber = randomSubscriber();
          let putSubscriber  = randomSubscriber();

          let postRequest = mailingListRequest.post({
            uri: postSubscriber.email,
            body: postSubscriber
          }).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(201);
          });

          let putRequest = mailingListRequest.put({
            uri: putSubscriber.email,
            body: putSubscriber
          }).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(201);
          });

          await Promise.all([postRequest, putRequest]);

          let postGetRequest = mailingListRequest.get({uri: postSubscriber.email});
          let putGetRequest  = mailingListRequest.get({uri: putSubscriber.email });

          return Promise.all([postGetRequest, putGetRequest])
          .then(([postResult, putResult]) => {
            expect(postResult).to.have.property('statusCode').that.is.equal(200);
            expect(postResult.body).to.deep.equal(postSubscriber);
            expect(putResult).to.have.property('statusCode').that.is.equal(200);
            expect(putResult.body).to.deep.equal(putSubscriber);
          });
        });
        it('Allows adding subscribers in bulk.', async function() {
          let postSubscribers = [randomSubscriber(), randomSubscriber(), randomSubscriber()];
          let putSubscribers  = [randomSubscriber(), randomSubscriber(), randomSubscriber()];

          let postRequest = mailingListRequest.post({
            uri: postSubscribers.email,
            body: postSubscribers,
          }).then(result => {
            return expect(result).to.have.property('statusCode').that.is.equal(201);
          });

          let putRequest = mailingListRequest.put({
            uri: putSubscribers.email,
            body: putSubscribers,
          }).then(result => {
            return expect(result).to.have.property('statusCode').that.is.equal(201);
          });

          await Promise.all([postRequest, putRequest]);

          let actualSubscribers = (await mailingListRequest.get('/')).body.subscribers;
          expect(actualSubscribers).to.deep.contain.members(postSubscribers);
          expect(actualSubscribers).to.deep.contain.members(putSubscribers);
        });
      });
      describe('Subscriber Viewing', function() {
        it('Reject requests that are not authenticated.', async function() {
          let subscriber = randomSubscriber();

          await mailingListRequest.post({
            uri: subscriber.email,
            body: subscriber
          });

          return subscriberRequest.get({
            uri: subscriber.email,
            headers: null
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(401);
          });

        });
        it('Shows the details for any specific subscriber.', async function() {
          let subscriber = randomSubscriber();
          await mailingListRequest.post({
            uri: subscriber.email,
            body: subscriber
          });

          return subscriberRequest.get({
            uri: subscriber.email,
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(200);
            expect(body).to.deep.equal(subscriber);
          });
        });
      });
      describe('Subscriber Editing', function() {
        it('Reject requests that are not authenticated.', async function() {
          let oldSubscriber   = randomSubscriber();
          let putSubscriber   = randomSubscriber();
          let patchSubscriber = randomSubscriber();

          await mailingListRequest.post({
            uri: oldSubscriber.email,
            body: oldSubscriber
          });

          await subscriberRequest.put({
            uri: oldSubscriber.email,
            body: putSubscriber,
            headers: null
          }).then(() => {
            return subscriberRequest.get({uri: `/${putSubscriber.email}/`});
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(404);
          });

          await subscriberRequest.put({
            uri: oldSubscriber.email,
            body: patchSubscriber,
            headers: null
          }).then(() => {
            return subscriberRequest.get({uri: `/${patchSubscriber.email}/`});
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(404);
          });
        });
        it('Updates name, email and state.', async function() {
          let oldPutSubscriber = randomSubscriber();
          let newPutSubscriber = randomSubscriber();

          await mailingListRequest.post({
            uri: oldPutSubscriber.email,
            body: oldPutSubscriber
          }).then(() => {
            return subscriberRequest.put({
              uri: oldPutSubscriber.email,
              body: newPutSubscriber,
            });
          }).then(() => {
            return subscriberRequest.get({uri: `/${newPutSubscriber.email}/`});
          }).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(200);
            expect(result.body).to.have.property('name').that.is.equal(newPutSubscriber.name);
            expect(result.body).to.have.property('email').that.is.equal(newPutSubscriber.email);
            expect(result.body).to.have.property('state').that.is.equal(newPutSubscriber.state);
          });

          let oldPatchSubscriber = randomSubscriber();
          let newPatchSubscriber = randomSubscriber();

          await mailingListRequest.post({
            uri: oldPatchSubscriber.email,
            body: oldPatchSubscriber
          }).then(() => {
            return subscriberRequest.patch({
              uri: oldPatchSubscriber.email,
              body: newPatchSubscriber,
            });
          }).then(() => {
            return subscriberRequest.get({uri: `/${newPatchSubscriber.email}/`});
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(200);
            expect(result.body).to.have.property('name').that.is.equal(newPatchSubscriber.name);
            expect(result.body).to.have.property('email').that.is.equal(newPatchSubscriber.email);
            expect(result.body).to.have.property('state').that.is.equal(newPatchSubscriber.state);
          });
        });

        describe('Field Editing', function() {
          it('Reject requests that are not authenticated.');
          it('Allows adding fields in bulk.');
          it('Rejects requests missing a name, value or both.');

          it('Allows updating the name and value of single fields.');
          it('Allows updating the name and value of fields in bulk.');

          it('Allows partial updates by name or value of single fields.');
          it('Allows partial updates by name or value of fields in bulk.');
        });
      });
      describe('Subscriber Deletion', function() {
        it('Reject requests that are not authenticated.', async function () {
          let subscriber = randomSubscriber();
          await mailingListRequest.post({
            uri: subscriber.email,
            body: subscriber
          }).then((result) => {
            expect(result).have.property('statusCode').that.is.equal(201);
          });

          await subscriberRequest.delete({
            uri: subscriber.email,
            headers: null
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(401);
          });

          return subscriberRequest.get({uri: subscriber.email})
          .then(result => {
            expect(result).have.property('statusCode').that.is.equal(200);
            expect(result).have.property('body').that.is.deep.equal(subscriber);
          });
        });
        it('Deletes subscribers from mailing lists.', async function () {
          let subscriber = randomSubscriber();
          await mailingListRequest.post({
            uri: subscriber.email,
            body: subscriber
          });

          await subscriberRequest.delete({
            uri: subscriber.email
          }).then(result => {
            expect(result).have.property('statusCode').that.is.equal(200);
          });

          return subscriberRequest.get({uri: subscriber.email})
          .then(result => {
            expect(result).have.property('statusCode').that.is.equal(404);
          });
        });
      });
    });
  });
});

// Utility function
function randomAccount() {
  let name = randomString(8);
  return {
    name: name,
    email: name + '@gmail.com'
  };
}

function randomSubscriber() {
  const STATES = ['active', 'unsubscribed', 'junk', 'bounced', 'unconfirmed'];
  const name = randomString(8);
  return {
    name: name,
    email: name + '@gmail.com',
    state: STATES[Math.floor(Math.random() * STATES.length)],
    fields: [
      { name: 'Creation-date', value: new Date() },
      { name: 'letters-received', value: Math.floor(Math.random() * 20)},
      { name: 'isAdult', value: (Math.random() > 0.5) },
      { name: 'favourite food', value: 'Pizza' }
    ]
  };
}

function randomString(length = 6) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
