/*jshint esversion:6 */

const expect = require('chai').expect;
const request = require('request-promise');

const baseRequest = request.defaults({
  "baseUrl": "http://mail-api:8000/API/",
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
          'Api-Key': account.key.secret
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
      it('Creates an account.', function () {
        return accountRequest.post({ body: randomAccount() })
        .then(result => {
          let details = result.body.details;
          expect(result).to.have.property('statusCode').that.is.equal(201);

          expect(details).to.have.property('id').that.is.a('number');
          expect(details).to.have.property('name').that.is.a('string');
          expect(details).to.have.property('key').that.is.an('object');

          expect(details.key).to.have.property('id').that.is.an('number');
          expect(details.key).to.have.property('secret').that.is.a('string');

          createdAccounts.push(result.body.details);
        });
      });
      it('Reject a request for an identical account.', async function () {
        let payload = randomAccount();

        firstResult = await accountRequest.post({ body: payload });
        secondResult = await accountRequest.post({ body: payload });

        expect(firstResult).to.have.property('statusCode').that.is.equal(201);
        expect(secondResult).to.have.property('statusCode').that.is.equal(409);

        // for cleanup later.
        createdAccounts.push(firstResult.body.details);
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
          account = result.body.details;
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
            'Api-Key': account.key.secret
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
      // Currently, no account editing (of name or email) is implemented.
      let account, authenticatedRequest;
      before(function(){ // Fill vars we'll need for these tests
        return accountRequest.post({ body: {
          name: randomString(8),
          email: `${randomString(8)}@gmail.com`
        }})
        .then(result => {
          account = result.body.details;
          authenticatedRequest = accountRequest.defaults({
            headers: {
              'Email': account.email,
              'Api-Key': account.apikey
            }
          });
          createdAccounts.push(account);
        });
      });
      it('Rejects requests that are not authenticated.', function () {
        return accountRequest.post(`account/${account.email}`).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(401);
        });
      });
      it('Allows updating of account name and email.', function() {
        expect.fail("Not yet implemented.");
      });
      it('Rejects requests that are missing parameters.', function() {
        expect.fail("Not yet implemented.");
      });
    });
    describe('Account Deletion', function() {
      it('Rejects requests that are not authenticated.', function (){
        return accountRequest.post({ body: randomAccount() })
        .then(result => {
          createdAccounts.push(result.body.details);
          return accountRequest.delete({body: { confirmDelete: true }});
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(401);
        });
      });
      it("Rejects requests without the 'confirmDelete' flag set.", function(){
        return accountRequest.post({ body: randomAccount() })
        .then(result => {
          account = result.body.details;
          createdAccounts.push(account);

          return accountRequest.delete({
            headers: {
              'Email': account.email,
              'Api-Key': account.key.secret
            },
            body: {}
          });
        }).then(result => {
          expect(result).to.have.property('statusCode').that.is.equal(400);
        });
      });
      it('Deletes accounts.', function(){
        let account;
        // Setup
        return accountRequest.post({
          body: randomAccount()
        }).then(result => {
          account = result.body.details;
          // Actual deletion.
          return accountRequest.delete({
            headers: {
              'Email': account.email,
              'Api-Key': account.key.secret
            },
            body: { confirmDelete: true }
          });
        }).then(result => {
          // Expect the server to send the OK on delete
          expect(result).to.have.property('statusCode').that.is.equal(200);

          // Expect the get request to fail, since the account no longer exists.
          accountRequest.get({headers: {
            'Email': account.email,
            'Api-Key': account.apikey
          }}).then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(401);
          });

        });
      });
    });

    describe('Account API key functionality', function() {
      let keyRequest;
      let testAccount;
      before(function() {
        return accountRequest.post({ body: randomAccount() })
        .then(result => {
          testAccount = result.body.details;
          createdAccounts.push(testAccount);

          keyRequest = baseRequest.defaults({
            uri:'/account/keys/',
            headers: {
              'Email': testAccount.email,
              'Api-Key': testAccount.key.secret
            }
          });
        });
      });

      describe('Key Creation', function() {
        it('Reject requests that are not authenticated.', function(){
            return keyRequest.post({headers:{'api-key': null}})
            .then(result => {
              expect(result).to.have.property('statusCode').that.is.equal(401);
            });
        });
        it('Creates a new key', function() {
          return keyRequest.post({})
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(201);

            expect(result.body).to.be.an('object');
            expect(result.body).have.a.property('id').that.is.an('number');
            expect(result.body).have.a.property('name').that.is.an('string');
            expect(result.body).have.a.property('secret').that.is.an('string');
          });
        });
        it('Allows specifying a key name', function() {
          randomName = randomString();
          return keyRequest.post({ body: {name: randomName} })
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(201);
            expect(result.body).to.be.an('object');
            expect(result.body).have.a.property('id').that.is.an('number');
            expect(result.body).have.a.property('name').that.is.an('string');
            expect(result.body).have.a.property('secret').that.is.an('string');

            keyRequest.get({})
            .then(result => {
              let containskey = result.body.keys.some(key => key.name === randomName);
              expect(containskey).to.be.true;
            });
          });
        });
      });
      describe('Key Viewing', function() {
        it('Reject requests that are not authenticated.', function() {
          return keyRequest.get({headers:{'api-key': null}})
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(401);
          });
        });
        it('Allows viewing of single keys', function() {
          return keyRequest.get({})
          .then(result => {
            let randomKey = result.body.keys[Math.floor(Math.random() * result.body.keys.length)];

            keyRequest.get({uri: `account/keys/${randomKey.id}`})
            .then(result => {
              expect(result.body.key).to.deep.equal(randomKey);
            });
          });
        });
        it('Allows viewing of all keys', function() {
          return keyRequest.get({})
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(200);
            expect(result.body).to.have.a.property('keys').that.is.an('array');
            expect(result.body.keys).to.have.lengthOf.at.least(1);

            let validKey = key => key.hasOwnProperty('id') && key.hasOwnProperty('name');
            expect(result.body.keys.every(validKey)).to.be.true;
          });
        });
      });
      describe('Key Editing', function() {
        it('Reject requests that are not authenticated.', async function () {
          let oldName = randomString();
          let newName = randomString();
          // Generate a new key to test.
          let testkey = await keyRequest.post({ body: { name: oldName } })
            .then(result => result.body);

          let updateRequest = await keyRequest.put({
            uri:`/account/keys/${testkey.id}`,
            headers: null,
            body: {name: newName}
          });
          expect(updateRequest).to.have.property('statusCode').that.is.equal(401);

          let result = await keyRequest.get({uri:`/account/keys/${testkey.id}`})
          expect(result.body.key).to.have.property('name').that.is.equal(oldName);
        });
        it('Edits the name of a single key by ID', async function () {
          expect.fail("Not yet implemented");

          // Generate a new key to test.
          let oldName = randomString();
          let newName = randomString();
          let testkey = await keyRequest.post({ body: { name: oldName } }).body;
          let editRequest = await keyRequest.put({
            uri:`/account/keys/${testkey.id}/`,
            body: { name: newName }
          });
          expect(editRequest).to.have.property('statusCode').that.is.equal(200, editRequest.body.error);
          return keyRequest.get({
            uri:`/account/keys/${testkey.id}`,
          }).then(result => {
            let newkey = result.body.key;
            expect(newkey.name).to.be.equal(newName);
          });
        });
        it('Edits the names of keys in bulk by IDs', function() {
          expect.fail("Not yet implemented");
        });
      });
      describe('Key Deletion', function() {
        it('Reject requests that are not authenticated.', async function() {
          let testKey = await keyRequest.post({});
          return keyRequest.delete({uri: `account/keys/${testKey.id}`, headers:null})
          .then(result => {
            expect(result).to.have.property('statusCode').that.is.equal(401);
          });
        });
        it('Deletes single keys by ID', async function() {
          let testKey = (await keyRequest.post({})).body;
          let deleteRequest = await keyRequest.delete({
            uri: `account/keys/${testKey.id}/`
          });

          expect(deleteRequest).have.property('statusCode').that.is.equal(200);

          let getRequest = await keyRequest.get({uri: `account/keys/${testKey.id}`});
          expect(getRequest).have.property('statusCode').that.is.equal(404);
        });
        it('Deletes a list of keys by IDs', async function() {
          expect.fail("Not yet implemented");
          // Not yet implemented.
          let testKeys = (await Promise.all([
            keyRequest.post({}),
            keyRequest.post({}),
            keyRequest.post({})
          ])).map(res => res.body);

          let deleteRequest = await keyRequest.delete({
            uri: 'account/keys/',
            body: ''
          });
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
            'Api-Key': testAccount.key.secret
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
