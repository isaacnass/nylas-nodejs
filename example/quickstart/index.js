const express = require('express')

const nylasBase = require('nylas')
const { WebhookTriggers } = require('nylas/models/webhook')
const { Scope } = require('nylas/models/connect')

const port = 3001
const clientUri = 'http://localhost:3000'
const clientId = 'CLIENT_ID_GOES_HERE'
const clientSecret = 'CLIENT_SECRET_GOES_HERE'

const app = express()

const nylasClient = new nylasBase({
	clientId,
	clientSecret,
})

nylasClient.on('token-exchange', ({ accessTokenObj }) => {
	console.log(accessTokenObj.emailAddress + ' was connected')
})

nylasClient.on(WebhookTriggers.MessageCreated, (payload) => {
	console.log(payload.type, JSON.stringify(payload.object_data, undefined, 2))
})

nylasClient.mountExpress(app, {
	defaultScopes: [
		Scope.EmailModify,
		Scope.EmailSend,
		Scope.ContactsReadOnly,
		// Scope.Calendar,
	],
	clientUri,
})

// app.get('/', (req, res) => res.status(200).send('Ok'))

app.listen(port, () => console.log('App listening on port ' + port))
