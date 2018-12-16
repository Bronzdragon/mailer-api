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

    const getMailingListTable = (mailingLists) => {
      const container = document.createElement('table')
      container.innerHTML = `<th>ID</th><th>Name</th><th>Subscriber count</th>`

      for (let list of mailinglists) {
        const row = document.createElement('tr')
        row.id = `mailing-list-${list.id}`
        row.innerHTML += `<td>${list.id}</td><td>${list.name}</td><td>${list.subscribers}</td>`
        row.addEventListener('click', () => {
          this._showMailingListPage(list.id)
        })
        container.appendChild(row)
      }
      return container
    }
    this.element.innerHTML = `
      <h1>Welcome, ${this.account.name}!</h1>
      <h3>Your account details:</h3>
      <table>
        <tr><td>ID:</td><td>${this.account.id}</td></tr>
        <tr><td>name:</td><td>${this.account.name}</td></tr>
        <tr><td>email:</td><td>${this.account.email}</td></tr>
      </table>

      <h3>Your lists:</h3>
      <button id="new-list-button">New list</button>`

    const mailingListTable = getMailingListTable(mailinglists)
    this.element.appendChild(mailingListTable)
    // this.element.appendChild(mailingListTable)

    document.getElementById('new-list-button').addEventListener('click', async event => {
      event.preventDefault()
      let newListName = `new list ${mailinglists.length+1}`
      console.log("Creating new list: ", newListName);
      await this._addNewList(newListName)
      mailinglists = await this._getAllMailingLists()

      console.log("Replacing list!" , mailinglists);
      mailingListTable.replaceWith(getMailingListTable(mailinglists))
    })

  }

  async _showMailingListPage(listId){
    this.element.innerHTML = '<h1>Loading list details...</h1>'

    const getSubscriberListElement = subscribers => {
      const container = document.createElement('div')
      this.isOdd = true
      for (const subscriber of subscribers) {
        let subElement = getSubscriberElement(subscriber)
        subElement.classList.add(this.isOdd ? 'odd':'even')
        container.appendChild(subElement)
        this.isOdd = !this.isOdd
      }
      return container;
    }

    const getSubscriberElement = subscriber => {
      const container = document.createElement('div')
      const subTable = document.createElement('table')
      subTable.innerHTML = `
      <tr><td class="subscriber-prop">ID:   </td><td>${subscriber.id}   </td></tr>
      <tr><td class="subscriber-prop">Name: </td><td>${subscriber.name} </td></tr>
      <tr><td class="subscriber-prop">Email:</td><td>${subscriber.email}</td></tr>
      <tr><td class="subscriber-prop">State:</td><td>${subscriber.state}</td></tr>`

      const fieldTable = document.createElement('table')

      for (const field of subscriber.fields) {
        fieldTable.innerHTML += `<tr><td>${field.name}:</td><td>${field.value}</td></tr>`
      }

      container.appendChild(subTable); container.appendChild(fieldTable)
      container.addEventListener('click', () => {this._showSubscriberEditingPage(listId, subscriber.id)})

      return container;
    }

    let mailingList = await this._getMailingList(listId)

    const fragment = document.createDocumentFragment()
    const backButton = document.createElement('div'); backButton.textContent='↩'; backButton.id = 'back-button'
    const mailListHeading = document.createElement('div'); mailListHeading.classList.add('mailing-list-heading'); mailListHeading.textContent = 'Details for'
    mailListHeading.appendChild(document.createElement('br'))
    mailListHeading.appendChild(getNonEditableListName(mailingList))
    const newButton = document.createElement('button'); newButton.textContent = "New subscriber"
    const subscriberList = getSubscriberListElement(mailingList.subscribers)

    fragment.appendChild(backButton); fragment.appendChild(mailListHeading); fragment.appendChild(newButton); fragment.appendChild(subscriberList)
    this.element.innerHTML = ''
    this.element.appendChild(fragment)

    backButton.addEventListener('click', () => {
      this._showFrontPage()
    })

    newButton.addEventListener('click', event => {
      console.log("Adding subscriber to ", mailingList);
      this._showSubscriberEditingPage(listId);
    })

    const getEditableListName = (mailingList) => {
      let element = document.createElement('input')
      element.classList.add('list-name')
      element.type = 'text'
      element.value = mailingList.name
      element.addEventListener('keyup', event => {
        if (event.keyCode === 13) {
          mailingList.name = event.target.value

          console.log("This arg: ", this);

          this._saveMailinglistName(mailingList.name, mailingList.id)
          element.replaceWith(getNonEditableListName(mailingList))
          event.preventDefault()
        }
      })
      return element
    }
    function getNonEditableListName(mailingList) {
      let element = document.createElement('div')
      element.classList.add('list-name')

      element.textContent = `${mailingList.id}. ${mailingList.name} ✎`
      // element.appendChild(editButton)
      element.addEventListener('click', event => {
        element.replaceWith(getEditableListName(mailingList))
      })
      return element
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

    let subscriber;
    if (subscriberId) {
      subscriber = await this._getSubscriber(listId, subscriberId)
    } else {
      subscriber = {name: '', email: '', state:'unconfirmed', fields: []}
    }
    const fragment = document.createDocumentFragment()

    fragment.appendChild(createElement('div', '↩', 'back-button', [], 'click', () => {
      this._showMailingListPage(listId)
    }))
    const form = createElement('form')
    fragment.appendChild(form)

    const nameParagraph = createElement('p', 'name:')
    nameParagraph.appendChild(createElement('br'))
    const nameInput = createElement('input')
    nameInput.type = 'text'; nameInput.value = subscriber.name; nameInput.placeholder="Please enter a name"; nameInput.id = 'subscriber-form-name'
    nameParagraph.appendChild(nameInput)

    form.appendChild(nameParagraph)

    const emailParagraph = createElement('p', 'email:')
    emailParagraph.appendChild(createElement('br'))
    const emailInput = createElement('input')
    emailInput.type = 'text'; emailInput.value = subscriber.email; emailInput.placeholder="Please enter an email address"; emailInput.id = 'subscriber-form-email'
    emailParagraph.appendChild(emailInput)

    form.appendChild(emailParagraph)

    const stateParagraph = createElement('p', 'state:')
    stateParagraph.appendChild(createElement('br'))
    const stateSelect = createElement('select')
    stateSelect.id = 'subscriber-form-state'
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

    const saveButton = document.createElement('button')
    saveButton.type = 'button'
    saveButton.textContent = 'Save'
    saveButton.addEventListener('click', async (event) => {
      let fieldList = []
      for (var i = 0; i < subscriber.fields.length; i++) {
        let name = document.getElementById(`field-name-${i}`).value
        let value = document.getElementById(`field-value-${i}`)
        if (name && value) {
          fieldList.push({
            name: name,
            value: value
          })
        }
      }

      let newSubscriber = {
        name: document.getElementById('subscriber-form-name').value,
        email: document.getElementById('subscriber-form-email').value,
        state: document.getElementById('subscriber-form-state').value,
        fields: subscriber.fields
      }
      if(subscriberId){
        this._saveSubscriber(subscriberId, listId, newSubscriber);
      } else {
        await this._saveNewSubscriber(listId, newSubscriber)
        this._showMailingListPage(listId)
      }


    })
    form.appendChild(saveButton)

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
        const valueInput = getValueElement(field.value, null, `field-value-${index}`)
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
        nameInput.addEventListener('change', event => {
          field.name = event.target.value
        })
        valueInput.addEventListener('change', event => {
          if(typeDropdown.value === 'date'){
            field.value = new Date(event.target.value).toJSON()
          } else if (typeDropdown.value === 'true/false') {
            field.value = event.target.checked
          } else {
            field.value = event.target.value
          }
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

  _saveSubscriber(subscriberId, listId, subscriber) {
    return request({
      url: `/mailinglists/${listId}/subscribers/${subscriberId}/`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'put',
      body: subscriber,
      json: true
    })
  }

  _saveNewSubscriber(listId, subscriber){
    return request({
      url: `/mailinglists/${listId}/subscribers/`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      method: 'post',
      body: subscriber,
      json: true
    })
  }

  _saveMailinglistName(name, listId){
    return request({
      method: 'patch',
      url: `/mailinglists/${listId}/`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      body: {name: name},
      json: true
    })
  }

  _addNewList(name) {
    return request({
      method: 'post',
      url: `/mailinglists/`,
      baseUrl: this.config.api_endpoint,
      headers: {apikey : this.config.secret, Email: this.config.email},
      body: {name: name},
      json: true
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
