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
    before(async function() {
      const result = await baseRequest.post({
        uri: '/account/',
        body: randomAccount()
      });
      testAccount = result.body;
      createdAccounts.push(testAccount);

      mailingListRequest = baseRequest.defaults({
        uri:'/',
        baseUrl: BASEURL + '/api/mailinglists/',
        headers: {
          'Email': testAccount.email,
          'Apikey': testAccount.key.secret
        }
      });
    });

    describe('Mailing list Creation', function() {
      it('Reject requests that are not authenticated.', async function() {
        let listName = randomString();
        let postRequest = await mailingListRequest.post({
          headers: null
        });
        expect(postRequest).to.have.property('statusCode').that.is.equal(401);

        let getResult = await mailingListRequest.get();
        let containsMailinglist = getResult.body.mailinglists.some(list => list.name = listName);
        expect(containsMailinglist).to.be.false;
      });
      it('Creates new mailing lists.', async function(){
        // Without subscribers
        let listname = randomString();

        let postRequest = await mailingListRequest.post({ body: { name: listname } });
        expect(postRequest).to.have.property('statusCode').that.is.equal(201);

        let listnames = await mailingListRequest.get({})
          .then(result => result.body.mailinglists)
          .map(list => list.name);

        expect(listnames).to.include.members([listname]);
      });
      it('Creates new mailing lists with subscribers.', async function() {
        let listname = randomString();

        let postRequest = await mailingListRequest.post({
          body: {
            name: listname,
            subscribers: [ randomSubscriber(), randomSubscriber(), randomSubscriber() ]
          }
        });
        expect(postRequest).to.have.property('statusCode').that.is.equal(201);

        let listnames = await mailingListRequest.get({})
          .then(result => result.body.mailinglists)
          .map(list => list.name);

        expect(listnames).to.include.members([listname]);
      });
    });
    describe('Mailing list Viewing', function() {
      it('Reject requests that are not authenticated.', async function() {
        let listname = randomString();
        let tests = [];

        // Cannot get overview.
        const listRequest = await mailingListRequest.get({
          headers: null
        });
        expect(listRequest).to.have.property('statusCode').that.is.equal(401);

        // Cannot get specifc list.
        const specificRequest = await mailingListRequest.post({
          body: { name : listname }
        }).then(result => {
          return mailingListRequest.get({
            uri: `/${result.body.id}/`,
            headers: null
          });
        });
        expect(specificRequest).to.have.property('statusCode').that.is.equal(401);

      });
      it('Shows all mailing lists for the authenticated account.', async function () {
        let expectedListNames = [randomString(), randomString()];

        await Promise.all(expectedListNames.map(
          name => mailingListRequest.post({ body: { name: name }})
        ));
        const result = await mailingListRequest.get();

        expect(result).to.have.property('statusCode').that.is.equal(200);
        let actualListNames = result.body.mailinglists.map(entry => entry.name);
        expect(actualListNames).to.include.members(expectedListNames);
      });
      it('Shows the details for any specific mailing list.', async function() {
        let listname = randomString();
        const request = await mailingListRequest.post({ body: { name: listname}})
        const result  = await mailingListRequest.get({ uri: `/${request.body.id}/`});
        expect(result).to.have.property('statusCode').that.is.equal(200);
        expect(result.body).to.have.property('name').that.is.equal(listname);
        expect(result.body).to.have.property('subscribers').that.is.an('array');
      });
    });
    describe('Mailing list Editing', function() {
      it('Reject requests that are not authenticated.', async function() {
        let oldName = randomString();
        let newName = randomString();

        let listId = (await mailingListRequest.post({
          body: { name: oldName }
        })).body.id;

        let result = await mailingListRequest.put({
          uri: `/${listId}/`,
          headers: null,
          body: { name: newName }
        });

        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it('Changes the Mailing list name.', async function() {
        const oldPutName   = randomString();
        const oldPatchName   = randomString();
        const putName   = randomString();
        const patchName = randomString();

        const putRequest = mailingListRequest.post({
          body: { name: oldPutName }
        }).then(result =>
          mailingListRequest.put({
            uri: `/${result.body.id}/`,
            body: {
              name: putName,
              subscribers: []
            }
          }).then( () =>
            mailingListRequest.get({
              uri: `/${result.body.id}/`,
            })
          )
        );

        const patchRequest = mailingListRequest.post({
          body: { name: oldPatchName }
        }).then(result =>
          mailingListRequest.patch({
            uri: `/${result.body.id}/`,
            body: {
              name: patchName,
            }
          }).then( () =>
            mailingListRequest.get({
              uri: `/${result.body.id}/`,
            })
          )
        );
        let [putResult, patchResult] = await Promise.all([putRequest, patchRequest]);

        expect(putResult).to.have.property('statusCode').that.is.equal(200);
        expect(putResult.body).to.have.property('name').that.is.equal(putName);
        expect(patchResult).to.have.property('statusCode').that.is.equal(200);
        expect(patchResult.body).to.have.property('name').that.is.equal(patchName);
      });
    });
    describe('Mailing list Deletion', function() {
      it('Reject requests that are not authenticated.', async function() {
        let name = randomString();

        const listDetails = (await mailingListRequest.post({
          body: { name: name }
        })).body;

        let result = await mailingListRequest.delete({
          uri: `/${listDetails.id}/`,
          headers: null
        });

        expect(result).to.have.property('statusCode').that.is.equal(401);
      });
      it('Deletes mailing lists.', async function() {
        let name = randomString();

        const listDetails = (await mailingListRequest.post({
          body: { name: name }
        })).body;

        let result = await mailingListRequest.delete({
          uri: `/${listDetails.id}/`,
        });

        expect(result).to.have.property('statusCode').that.is.equal(200);
      });
    });

    describe('Subscriber functionality', function() {
      let mailingList;
      let subscriberRequest;
      before(async function() {
        postRequest = (await mailingListRequest.post({ body: { name: randomString() } })).body;

        subscriberRequest = baseRequest.defaults({
          uri: '/',
          baseUrl: BASEURL + `/api/mailinglists/${postRequest.id}/subscribers/`,
          headers: {
            'Email': testAccount.email,
            'Apikey': testAccount.key.secret
          }
        });
        let payload = randomSubscriber();

        subscriberRequest.post({ body: payload });
      });
      describe('Subscriber Adding', function() {
        it('Reject requests that are not authenticated.', async function() {
          let postSubscriber = randomSubscriber();

          const request = await mailingListRequest.post({
            body: postSubscriber,
            headers: null
          });
          expect(request).to.have.property('statusCode').that.is.equal(401);

          let getRequest = await subscriberRequest.get({uri: `/${request.body.id}/`});

          expect(getRequest).to.have.property('statusCode').that.is.equal(404);
        });
        it('Allows adding single subscribers.', async function() {
          let subscriber = randomSubscriber();

          const request = await subscriberRequest.post({
            body: subscriber
          });
          expect(request).to.have.property('statusCode').that.is.equal(201);

          let getRequest = await subscriberRequest.get({uri: `/${request.body.id}/`});
          expect(getRequest).to.have.property('statusCode').that.is.equal(200);

          expect(getRequest.body).to.have.property('name').that.is.equal(subscriber.name);
          expect(getRequest.body).to.have.property('email').that.is.equal(subscriber.email);
          expect(getRequest.body).to.have.property('state').that.is.equal(subscriber.state);
          expect(getRequest.body).to.have.property('fields').that.is.deep.equal(subscriber.fields);
        });
        it('Allows adding subscribers in bulk.', async function() {
          let postSubscribers = [randomSubscriber(), randomSubscriber(), randomSubscriber()];

          let postRequest = await subscriberRequest.post({
            body: postSubscribers,
          })
          return expect(postRequest).to.have.property('statusCode').that.is.equal(200);

          let actualSubscribers = (await mailingListRequest.get()).body.subscribers;
          expect(actualSubscribers).to.deep.contain.members(postSubscribers);
        });
      });
      describe('Subscriber Viewing', function() {
        it('Reject requests that are not authenticated.', async function() {
          let subscriber = randomSubscriber();

          let request = await subscriberRequest.post({
            body: subscriber
          });

          let result = await subscriberRequest.get({
            headers: null,
            uri: `/${request.body.id}/`
          });
          expect(result).have.property('statusCode').that.is.equal(401);
        });
        it('Shows the details for any specific subscriber.', async function() {
          let subscriber = randomSubscriber();

          let request = await subscriberRequest.post({
            body: subscriber
          });

          let result = await subscriberRequest.get({
            uri: `/${request.body.id}/`
          });

          expect(result.body).to.have.property('name').that.is.equal(subscriber.name);
          expect(result.body).to.have.property('email').that.is.equal(subscriber.email);
          expect(result.body).to.have.property('state').that.is.equal(subscriber.state);
          expect(result.body).to.have.property('fields').that.is.deep.equal(subscriber.fields);
        });
      });
      describe('Subscriber Editing', function() {
        it('Reject requests that are not authenticated.', async function() {
          let oldSubscriber   = randomSubscriber();
          let putSubscriber   = randomSubscriber();
          let patchSubscriber = randomSubscriber();

          const subscriberId = (await subscriberRequest.post({
            body: oldSubscriber
          })).body.id;

          const putResult = await subscriberRequest.put({
            uri: `/${subscriberId}/`,
            body: putSubscriber,
            headers: null
          });
          expect(putResult).have.property('statusCode').that.is.equal(401);

          const patchResult = await subscriberRequest.patch({
            uri: `/${subscriberId}/`,
            body: patchSubscriber,
            headers: null
          });
          expect(patchResult).have.property('statusCode').that.is.equal(401);

          const getResult = await subscriberRequest.get({uri: `/${subscriberId}/`});
          expect(getResult.body).to.have.property('name').that.is.equal(oldSubscriber.name);
          expect(getResult.body).to.have.property('email').that.is.equal(oldSubscriber.email);
          expect(getResult.body).to.have.property('state').that.is.equal(oldSubscriber.state);
          expect(getResult.body).to.have.property('fields').that.is.deep.equal(oldSubscriber.fields);

        });
        it('Updates name, email and state via put.', async function() {
          const oldSubscriber = randomSubscriber();
          const newSubscriber = randomSubscriber();

          const subscriberId = (await subscriberRequest.post({
            body: oldSubscriber
          })).body.id;

          await subscriberRequest.put({
            uri: `/${subscriberId}/`,
            body: newSubscriber,
          });

          const result = await subscriberRequest.get({uri: `/${subscriberId}/`});

          expect(result).to.have.property('statusCode').that.is.equal(200);
          expect(result.body).to.have.property('name').that.is.equal(newSubscriber.name);
          expect(result.body).to.have.property('email').that.is.equal(newSubscriber.email);
          expect(result.body).to.have.property('state').that.is.equal(newSubscriber.state);
        });
        it('Updates name, email and state via patch.', async function() {
          const oldSubscriber = randomSubscriber();
          const newSubscriber = randomSubscriber();
          const patchRequests = [];

          const subscriberId = (await subscriberRequest.post({
            body: oldSubscriber
          })).body.id;

          await subscriberRequest.patch({
            uri: `/${subscriberId}/`,
            body: {name: newSubscriber.name},
          });
          await subscriberRequest.patch({
            uri: `/${subscriberId}/`,
            body: {email: newSubscriber.email},
          });
          await subscriberRequest.patch({
            uri: `/${subscriberId}/`,
            body: {state: newSubscriber.state},
          });

          const result = await subscriberRequest.get({uri: `/${subscriberId}/`});

          expect(result).to.have.property('statusCode').that.is.equal(200);
          expect(result.body).to.have.property('name').that.is.equal(newSubscriber.name);
          expect(result.body).to.have.property('email').that.is.equal(newSubscriber.email);
          expect(result.body).to.have.property('state').that.is.equal(newSubscriber.state);

        });
        it('Can replace the field list (via post).', async function() {
          const subscriber = randomSubscriber();
          const subscriberId = (await subscriberRequest.post({
            body: subscriber
          })).body.id;

          let newFields = [];
          // Existing field
          newFields.push(sampleArray(subscriber.fields));
          // Existing field with new value
          newFields.push({
            name: sampleArray(subscriber.fields).name,
            value: randomField().value
          });
          // New field
          newFields.push(randomField());

          let newSubscriber = subscriber;
          newSubscriber.fields = newFields;

          await subscriberRequest.put({
            uri: `/${subscriberId}/`,
            body: newSubscriber,
          });

          const result = await subscriberRequest.get({uri: `/${subscriberId}/`});
          expect(result.body).to.have.property('fields').to.deep.have.members(newFields);
        });
        it('Can add/update fields without deleting (via patch).', async function() {
          const subscriber = randomSubscriber();
          const subscriberId = (await subscriberRequest.post({
            body: subscriber
          })).body.id;

          let newFields = [];
          // Existing field
          newFields.push(sampleArray(subscriber.fields));
          // Existing field with new value
          newFields.push({
            name: sampleArray(subscriber.fields).name,
            value: randomField().value
          });
          // New field
          newFields.push(randomField());

          let newSubscriber = subscriber;
          newSubscriber.fields = newFields;

          await subscriberRequest.patch({
            uri: `/${subscriberId}/`,
            body: newSubscriber,
          });

          const result = await subscriberRequest.get({uri: `/${subscriberId}/`});
          expect(result.body).to.have.property('fields').to.deep.include.members(newFields);
        });
      });
      describe('Subscriber Deletion', function() {
        it('Reject requests that are not authenticated.', async function () {
          let subscriber = randomSubscriber();
          const postRequest = await subscriberRequest.post({
            body: subscriber
          });
          expect(postRequest).have.property('statusCode').that.is.equal(201);

          const deleteRequest = await subscriberRequest.delete({
            uri: `${postRequest.body.id}`,
            headers: null
          });
          expect(deleteRequest).have.property('statusCode').that.is.equal(401);

          const getRequest = await subscriberRequest.get({uri: `${postRequest.body.id}`});
          expect(getRequest).have.property('statusCode').that.is.equal(200);
          expect(getRequest.body).have.property('name').that.is.equal(subscriber.name);
          expect(getRequest.body).have.property('email').that.is.equal(subscriber.email);
        });
        it('Deletes subscribers from mailing lists.', async function () {
          let subscriber = randomSubscriber();
          const postRequest = await subscriberRequest.post({
            body: subscriber
          });
          expect(postRequest).have.property('statusCode').that.is.equal(201);

          const deleteRequest = await subscriberRequest.delete({
            uri: `${postRequest.body.id}`,
          });
          expect(deleteRequest).have.property('statusCode').that.is.equal(200);

          const getRequest = await subscriberRequest.get({uri: `${postRequest.body.id}`});
          expect(getRequest).have.property('statusCode').that.is.equal(404);
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
  const account = randomAccount();
  const numFields = 5 + Math.ceil(Math.random() * 5);

  let fields = [];
  for (var i = 0; i < numFields; i++) {
    fields.push(randomField());
  }
  return {
    name: account.name,
    email: account.email,
    state: sampleArray(STATES),
    fields: fields
  };
}

function randomField(type){
  const TYPES = ['number', 'boolean', 'string', 'date'];
  type = TYPES.includes(type) ? type : 'random';
  if (type === 'random') {
    type = sampleArray(TYPES);
  }
  let name, value;
  let categories;
  switch (type) {
    case 'number':
      categories = ['letters-received', 'paintings', 'adverts-clicked', 'coffee-drank', 'cards-gotten'];
      name = sampleArray(categories);
      value = Math.floor(Math.random() * 10)
      break;
    case 'boolean':
      categories = ['is-adult', 'met', 'handsome', 'party-goer', 'smart'];
      name = sampleArray(categories);
      value = (Math.random() > 0.5)
      break;
    case 'string':
      categories = ['pincode', 'nuke-launce-codes', 'safe-word', 'favourite-book'];
      name = sampleArray(categories);
      value = randomString(22);
      break;
    case 'date':
      categories = ['Birthdate', 'wedding-anniversary', 'some-date', 'purchase-date', 'unbirthdate'];
      name = sampleArray(categories);
      value = randomDate().toString();
      break;
  }
  return {name: name, value: value};
}

function randomDate() {
  const startDate = new Date(1970, 0, 1).getTime();
  const endDate = new Date().getTime();
  return new Date(startDate + Math.random() * (endDate - startDate));
}

function sampleArray(array) {
  if (!Array.isArray(array) || array.length < 1) { return null; }
  return array[Math.floor(Math.random() * array.length)];
}

function randomString(length = 6) {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function randomDigit(length = 6) {
  Math.floor(Math.random()*Math.pow(10, length)).toString().padStart(length, '0');
}
