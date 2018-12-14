# mailer-api
*An api for managing mailing lists.*

## Setting up the server
Prerequisite: [Vagrant](http://vagrantup.com/).
1. Clone the repository to your local harddrive.
2. Edit your hostfile, and add the line `127.0.0.1 mail-api`.
3. run `vagrant up` in the repository directory.
4. Done! You can now access the API by visiting [http://mail-api:8000/api/](http://mail-api:8000/api/).

## Interacting with the server
Start by making a POST request to `http://mail-api:8000/api/account/`. This request will have to include a JSON object with a `name` and `email` field. You will get a response with details for your token. Save this token.

In subsequent requests, you will have to include two headers to authenticate. `email` with the email address you registered with, and `apikey`, which will be the key you received.

From here, you can make requests to the following endpoints:
 * http://mail-api:8000/api/account/
 * http://mail-api:8000/api/account/keys/[key_id]/
 * http://mail-api:8000/api/mailinglists/[list_id]/
 * http://mail-api:8000/api/mailinglists/[list_id]/subscribers/[subscriber_id]/

Account requests should include a `name` and `email` field. Key requests should include a `name` field. Mailing list requests should include a `name` field, and optionally an array of `subscriber` objects Subscriber requests include a `name`, `email` and `state` field, and an array of field objects (`name` and `value` for those).

You cannot delete your account without the right key or setting the `confirmDelete` flag in your request's body to true. Keep in mind that when you use PATCH on subscribers, their state will not update unless you include a `forceState` flag.

## Running tests
Prerequisite: [Node](https://nodejs.org/).

1. Ensure the server is up and running.
