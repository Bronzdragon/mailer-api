/*jslint esversion:6, asi: true */
const request = require('request-promise')

class Client {

  constructor(mainElement) {
    this.account = null
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
      this._promptToken()
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
      this._promptLogin()
    }
  }

  async _showFrontPage(){
    this.element.innerHTML = "<h1>Loading...</h1>"

    let accountDetails, mailinglists
    try {
      accountDetails = await this._getAccountRequest()
    } catch (error) {
      console.error(error)
      throw new Error(error)
    }
    this.account = accountDetails

    try {
      mailinglists = await this._getAllMailingLists()
    } catch (error) {
      console.error(error)
      throw new Error(error)
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

    let mailingList = await this._getMailingList(listId)
    let isOdd = false
    let subscribersHtml = mailingList.subscribers.map(entry => {
      let fieldsHtml = entry.fields.map(field => {
        return `<tr><td>${field.name}</td><td>${field.value}</td></tr>`
      }).join('\n')
      isOdd = !isOdd
      return `<div id="subscriber-list-${entry.id}" class="${isOdd?"odd":"even"}"><span class="subscriber-prop">ID:</span> ${entry.id}<br><span class="subscriber-prop">Name:</span> ${entry.name}<br><span class="subscriber-prop">Email:</span> ${entry.email}<br><span class="subscriber-prop">State:</span> ${entry.state}<br><span class="subscriber-prop">Fields:</span> <table>${fieldsHtml}</table></div>`
    }).join('\n')

    this.element.innerHTML = `
    <div id="back-button">↩</div>
    <div class="mailingList-heading">Details for<br>
    <div class="list-name">${mailingList.id}. ${mailingList.name}</div></div>
    <div class="subscriber-list">${subscribersHtml}</div>`

    document.getElementById("back-button").onclick = () => {
      this._showFrontPage()
    }

    for (let subscriber of mailingList.subscribers) {
      document.getElementById(`subscriber-list-${subscriber.id}`).onclick = () => {this._showSubscriberEditingPage(listId, subscriber.id)}
    }
  }

  async _showSubscriberEditingPage(listId, subscriberId){
    this.element.innerHTML = '<h1>Loading list details...</h1>'

    function createElement(type, text = null, id = null, classList = [], event = null, callback = null) {
      const element = document.createElement(type)
      if (text) {
        element.textContent = text
      }
      if (id) {
        element.id = id
      }
      if (classList.lenght > 0) {
        element.classList.add(...classList)
      }
      if (event && callback) { element.addEventListener(event, callback) }
      return element
    }

    const subscriber = await this._getSubscriber(listId, subscriberId)
    const fragment = document.createDocumentFragment()

    fragment.appendChild(createElement('div', '↩', 'back-button', [], 'click', () => {
      this._showMailingListPage(listId)
    }))
    const form = createElement('form')
    fragment.appendChild(form)

    const nameParagraph = createElement('p', 'name:')
    nameParagraph.appendChild(createElement('br'))
    const nameInput = createElement('input')
    nameInput.type = 'text'; nameInput.value = subscriber.name; nameInput.placeholder="Please enter a name"
    nameParagraph.appendChild(nameInput)

    form.appendChild(nameParagraph)

    const emailParagraph = createElement('p', 'email:')
    emailParagraph.appendChild(createElement('br'))
    const emailInput = createElement('input')
    emailInput.type = 'text'; emailInput.value = subscriber.email; emailInput.placeholder="Please enter an email address"
    emailParagraph.appendChild(emailInput)

    form.appendChild(emailParagraph)

    const stateParagraph = createElement('p', 'state:')
    stateParagraph.appendChild(createElement('br'))
    const stateSelect = createElement('select')
    for (let state of ['active', 'unsubscribed', 'junk', 'bounced', 'unconfirmed']) {
      let option = createElement('option', state)
      option.value = state
      stateSelect.appendChild(option)
    }
    stateParagraph.appendChild(stateSelect)

    form.appendChild(stateParagraph)

    const fieldList = createElement('div', null, 'field-list')
    form.appendChild(fieldList)

    const newFieldButton = createElement('button', '+ new field')
    newFieldButton.addEventListener('click', event => {
      subscriber.fields.push({name: '', value:''})
      buildFieldList(subscriber.fields)
      event.preventDefault()
    })
    form.appendChild(newFieldButton)


    buildFieldList(subscriber.fields)

    this.element.innerHTML = ''
    this.element.appendChild(fragment);

    function buildFieldList(fields) {
      function isDate(value = '') { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value) }

      function getType(value) {
        switch (typeof value) {
          case 'boolean':
            return 'true/false'
          case 'number':
            return 'number'
          case 'string': // falls through intentionally
          default:
            return isDate(value) ? 'date' : 'text'
        }
      }

      function getValueElement(value) {
        let element = createElement('input')
        switch (getType(value)) {
          case 'text': // falls through intentionally
            element.type = 'text'; element.value = value; element.placeholder="Please provide a value"
            break
          case 'true/false':
            element.type = 'checkbox'; element.value = value
            break
          case 'number':
            element.type = 'number'; element.value = value
            break
          case 'date': // falls through intentionally
            element.type = 'date'; element.value = value
            break
        }
        return element
      }

      function getTypeDropdown(selectedType) {
        let element = createElement('select')
        for (let type of ['text', 'true/false', 'number', 'date']) {
          let option = createElement('option', type)
          option.value = type
          if (type === selectedType){ option.selected = "selected" }
          element.appendChild(option)
        }
        return element
      }

      function getFieldParagraph(field, index) {
        const fieldParagraph = createElement("p", null, `field-p-${index}`)
        const valueInput = getValueElement(field.value)
        valueInput.id = `field-value-input-${index}`
        const nameInput = createElement('input', null, `field-name-${index}`)
        nameInput.type = "text"; nameInput.value = field.name
        const typeDropdown = getTypeDropdown(getType(field.value))
        typeDropdown.id = `field-type-select-${index}`

        fieldParagraph.appendChild(typeDropdown)
        fieldParagraph.appendChild(nameInput)
        fieldParagraph.appendChild(valueInput)

        typeDropdown.addEventListener('change', event => {
          switch (event.target.value) {
            case 'text':
              field.value = ''
              break;
            case 'true/false':
              field.value = false
              break;
            case 'number':
              field.value = 0
              break;
            case 'date':
              field.value = new Date().toJSON()
              break;
            default:
          }
          // console.log(event);
          fieldParagraph.replaceWith(getFieldParagraph(field, index))
        })

        return fieldParagraph
      }

      fieldList.innerHTML = ''

      let index = 0
      for (let field of fields) {
        fieldList.appendChild(getFieldParagraph(field, index))
        index++
      }
    }

  }

  async _submitLoginDetails(name, email){
    let errorBanner = document.getElementById('error-banner')
    let errorMessage = ""

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
    this.account = result
    this.config.email = this.account.email
    this.config.secret = this.account.secret
  }

  _submitTokenDetails(email, token){
    console.log("Submitting token and email", {token: token, email: email})
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

  _getSubscriber(listId, subscriberId){
    return request({
      url: `/mailinglists/${listId}/subscribers/${subscriberId}`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'get',
      json: true
    })
  }
}

module.exports = Client
