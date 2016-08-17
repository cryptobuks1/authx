
if (!global._babelPolyfill)
	require('babel-polyfill');

import * as errors from './errors';
import * as scopes from './util/scopes';
import Router from 'koa-router';
import { can } from './util/protect';
import Pool from './util/pool';
import x from './namespace';



// strategies
import EmailStrategy from './strategies/email';
import GoogleStrategy from './strategies/google';
import PasswordStrategy from './strategies/password';
import SecretStrategy from './strategies/secret';
import InContactStrategy from './strategies/incontact';
export { EmailStrategy, GoogleStrategy, PasswordStrategy, SecretStrategy, InContactStrategy };



// models
import Authority from './models/Authority';
import Client from './models/Client';
import Credential from './models/Credential';
import Grant from './models/Grant';
import Role from './models/Role';
import User from './models/User';
export { Authority, Client, Credential, Grant, Role, User };



// middleware
import bearerMiddleware from './middleware/bearer';
import corsMiddleware from './middleware/cors';
import dbMiddleware from './middleware/db';
import errorMiddleware from './middleware/error';
import userMiddleware from './middleware/user';



// controllers
import * as authorityController from './controllers/authorities';
import * as clientController from './controllers/clients';
import * as credentialController from './controllers/credentials';
import * as grantController from './controllers/grants';
import * as roleController from './controllers/roles';
import * as userController from './controllers/users';
import sessionController from './controllers/session';
import tokensController from './controllers/tokens';



export default class AuthX extends Router {

	constructor(config, strategies) {
		super(config);


		// set the config
		this.config = config;


		// create a database pool
		this.pool = new Pool(config.db, config.db.pool.max, config.db.pool.min, config.db.pool.timeout);


		// attach the strategies
		this.strategies = strategies;





		// Generic Middleware
		// ------------------

		// add authx namespace context
		this.use((ctx, next) => {
			ctx[x] = { authx: this };
			return next();
		});

		// error handling
		this.use(errorMiddleware);


		// get a database connection
		this.use(dbMiddleware);


		// add CORS header if necessary
		this.use(corsMiddleware);


		// get the current bearer token
		this.use(bearerMiddleware);


		// get the current user
		this.use(userMiddleware);






		// Session
		// =======
		// These endpoints manage the user's active session, including logging in,
		// logging out, and associating credentials.

		this.get('/session/:authority_id', sessionController);
		this.post('/session/:authority_id', sessionController);
		this.del('/session', async (ctx) => {
			ctx.cookies.set('session');
			ctx.status = 204;
		});






		// Tokens
		// ======
		// These endpoints are used by clients wishing to authenticate/authorize
		// a user with AuthX. They implement the OAuth 2.0 flow for "authorization
		// code" grant types.

		this.get('/tokens', tokensController);
		this.post('/tokens', tokensController);






		// Can
		// ===
		// This is a convenience endpoint for clients. It validates credentials and
		// asserts that the token can access to the provided scope.

		this.get('/can/:scope', async (ctx) => {

			if (!ctx.params.scope || !scopes.validate(ctx.params.scope))
				throw new errors.ValidationError();

			if (!ctx.user)
				throw new errors.AuthenticationError();

			if (!await can(ctx, ctx.params.scope, ctx.query.strict !== 'false'))
				throw new errors.ForbiddenError();

			ctx.status = 204;
		});






		// Keys
		// ====
		// This outputs valid public keys and algorithms that can be used to verify
		// access tokens by resource servers. The first key is always the most recent.

		this.get('/keys', async (ctx) => {
			ctx.body = this.config.access_token.public;
		});






		// Resources
		// =========



		// Authorities
		// -----------

		this.post('/authorities', authorityController.post);
		this.get('/authorities', authorityController.query);
		this.get('/authorities/:authority_id', authorityController.get);
		this.patch('/authorities/:authority_id', authorityController.patch);
		this.del('/authorities/:authority_id', authorityController.del);



		// Clients
		// -------

		this.post('/clients', clientController.post);
		this.get('/clients', clientController.query);
		this.get('/clients/:client_id', clientController.get);
		this.patch('/clients/:client_id', clientController.patch);
		this.del('/clients/:client_id', clientController.del);



		// Credentials
		// ------------

		this.post('/credentials', credentialController.post);
		this.get('/credentials', credentialController.query);
		this.get('/credentials/:credential_id_0/:credential_id_1', credentialController.get);
		this.patch('/credentials/:credential_id_0/:credential_id_1', credentialController.patch);
		this.del('/credentials/:credential_id_0/:credential_id_1', credentialController.del);



		// Grants
		// ------

		this.post('/grants', grantController.post);
		this.get('/grants', grantController.query);
		this.get('/grants/:module_id', grantController.get);
		this.patch('/grants/:module_id', grantController.patch);
		this.del('/grants/:module_id', grantController.del);



		// Roles
		// -----

		this.post('/roles', roleController.post);
		this.get('/roles', roleController.query);
		this.get('/roles/:role_id', roleController.get);
		this.patch('/roles/:role_id', roleController.patch);
		this.del('/roles/:role_id', roleController.del);



		// Users
		// -----

		this.post('/users', userController.post);
		this.get('/users', userController.query);
		this.get('/users/:user_id', userController.get);
		this.patch('/users/:user_id', userController.patch);
		this.del('/users/:user_id', userController.del);
		this.get('/me', userController.get);
		this.patch('/me', userController.patch);
		this.del('/me', userController.del);

	}
}

