/*jslint esversion:6, asi: true */
const request = require('request-promise');

class Client {

  constructor(mainElement) {
    this.account = null;
    this.element = mainElement
    this.config = require('./config.json')
    if (!this.config.api_endpoint) { throw new Error("No endpoint defined!") }

    if (!this.config.email || !this.config.secret) {
      this._promptLogin()
    } else {
      this._showFrontPage()
    }

  }

  _promptLogin() {
    this.element.innerHTML = `
    <div id="error-banner" style="display:none;"></div>

    <div class="both">
      <form class="login">
        <div class="instructions">Log in with existing account</div>
        <div>
          <label for="email">Registered email:</label>
          <input type="text" id="email" name="user_email">
        </div>
        <div>
          <label for="token">Your token:</label>
          <input type="text" id="token" name="user_token">
        </div>
        <div>
          <button type="button" id="accept-button" onclick="client.submitLoginDetails(this.form)">Login</button>
        </div>
      </form>
      <div class="or"></div>
      <form class="creation">
       <div class="instructions">Create a new account</div>
        <div>
            <label for="name">Prefered name:</label>
            <input type="text" id="name" name="user_name">
        </div>
        <div>
            <label for="email">Email address:</label>
            <input type="text" id="email" name="user_email">
        </div>
        <div>
            <button type="button" id="accept-button" onclick="client.submitLoginDetails(this.form)">Submit</button>
        </div>
      </form>
    </div>
    `
    document.getElementById('accept-button').onclick = (form) => {
      this._submitLoginDetails(document.getElementById('name').value, document.getElementById('email').value)
    }
    document.getElementById('show-token-form').onclick = () => {
      this._promptToken();
    }
  }

  _promptToken() {
    this.element.innerHTML = `
    <div id="error-banner" style="display:none;"></div>
    <form>
      <div>
        <label for="email">Registered email:</label>
        <input type="text" id="email" name="user_email">
      </div>
      <div>
        <label for="token">Your token:</label>
        <input type="text" id="token" name="user_token">
      </div>
      <div>
        <button type="button" id="accept-button" onclick="client.submitLoginDetails(this.form)">ok</button>
      </div>

    </form>
    <a id="show-login-form" href="#">I have to create a new token.</a>
    `
    document.getElementById('accept-button').onclick = (form) => {
      this._submitTokenDetails(document.getElementById('email').value, document.getElementById('token').value)
    }
    document.getElementById('show-login-form').onclick = () => {
      this._promptLogin();
    }
  }

  async _showFrontPage(){
    this.element.innerHTML = "<h1>Loading...</h1>"

    let accountDetails, mailinglists
    try {
      accountDetails = await this._getAccountRequest()
    } catch (error) {
      console.error(error);
      throw new Error(error);
    }
    this.account = accountDetails;

    try {
      mailinglists = await this._getAllMailingLists()
    } catch (error) {
      console.error(error);
      throw new Error(error);
    }

    let mailinglistRows = mailinglists.map(entry => {
      return `<tr id="mailing-list-${entry.id}"><td>${entry.id}</td><td>${entry.name}</td><td>${entry.subscribers}</td></tr>`
    })

    this.element.innerHTML = `
      <h1>Welcome, ${this.account.name}!</h1>
      <h3>Your account details:</h3>
      <table>
        <tr><td>ID:</td><td>${this.account.id}</td></tr>
        <tr><td>name:</td><td>${this.account.name}</td></tr>
        <tr><td>email:</td><td>${this.account.email}</td></tr>
      </table>

      <h3>Your lists:</h3>
      <table>
        <th>ID</th><th>Name</th><th>Subscriber count</th>
        ${mailinglistRows.join('\n')}
      </table>
    `
    for (let list of mailinglists) {
      document.getElementById(`mailing-list-${list.id}`).onclick = () => {this._showMailingListPage(list.id)}
    }

  }

  async _showMailingListPage(listId){
    this.element.innerHTML = '<h1>Loading list details...</h1>'

    let mailingList = await this._getMailingList(listId);
    console.log(mailingList);
    let isOdd = false;
    let subscribersHtml = mailingList.subscribers.map(entry => {
      let fieldsHtml = entry.fields.map(field => {
        return `<tr><td>${field.name}</td><td>${field.value}</td></tr>`
      }).join('\n');
      isOdd = !isOdd
      return `<div class="${isOdd?"odd":"even"}"><span class="subscriber-prop">Name:</span> ${entry.name}<br><span class="subscriber-prop">Email:</span> ${entry.email}<br><span class="subscriber-prop">State:</span>${entry.state}Fields: <table>${fieldsHtml}</table></div>`
    }).join('\n');

    this.element.innerHTML = `
    <div class="mailingList-heading">Details for<br>
    <div class="list-name">${mailingList.id}. ${mailingList.name}</div></div>
    <div class="subscriber-list">${subscribersHtml}</div>
    `
  }

  async _submitLoginDetails(name, email){
    let errorBanner = document.getElementById('error-banner')
    let errorMessage = "";

    if (!name) { errorMessage += "Please enter a name.<br>" }
    if (!email) { errorMessage += "Please enter an email address.<br>" }

    if (errorBanner.innerHTML) {
      errorBanner.style.display = 'block'
      errorBanner.innerHTML = errorMessage
      return
    } else {
      errorBanner.style.display = 'none'
    }

    let result = await this._makeNewAccountRequest(name, email)

    if (result.error) {
      errorBanner.style.display = 'block'
      errorBanner.innerHTML += result.error
      return
    }
    this.account = result;
    this.config.email = this.account.email
    this.config.secret = this.account.secret
  }

  _submitTokenDetails(email, token){
    console.log("Submitting token and email", {token: token, email: email});
    this.config.email = email
    this.config.secret = token
  }

  _makeNewAccountRequest(name, email){
    return request({
      url: '/account/',
      baseUrl: this.config.api_endpoint,
      method: 'post',
      body: {name: name, email:email},
      json: true
    }).then(result => {
      return {
        id: result.id,
        name: result.name,
        email: result.email,
        secret: result.key.secret
      }
    }).catch(error => {
      return {
        code: error.statusCode,
        error: error.error.error
      }
    })
  }

  _getAccountRequest(){
    return request({
      url: '/account/',
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'get',
      json: true
    }).then(result => {
      return {
        id: result.id,
        name: result.name,
        email: result.email,
      }
    })
  }

  _saveConfigFile(config = this.config){
    require('fs').writeFile("./config", config)
  }

  _getAllMailingLists(){
    return request({
      url: '/mailinglists/',
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'get',
      json: true
    }).then( result => {return result.mailinglists} )
  }

  _getMailingList(listId){
    return request({
      url: `/mailinglists/${listId}/`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'get',
      json: true
    })
  }
}

module.exports = Client
