import { Logger } from './logger';
import { Store, STORAGE } from './store';
import { REQUEST_TYPE, RESPONSE_TYPE, LOGGING_LEVEL, CONSTANTS, TOKEN_STATUS } from './const';
import { IAuthenticationOptions, IUser, IRequestInfo, AcquireCallback } from './interface';

export class AuthenticationContext {

  public instance = 'https://login.microsoftonline.com/';
  public callback: AcquireCallback;
  public popUp = false;
  public inIframe = false;
  public renewStates: string[] = [];

  private store: Store;
  private logger: Logger;
  private user: IUser | null = null;
  private activeRenewals: { [state: string]: string | null; } = {};
  private loginInProgress = false;
  private acquireTokenInProgress = false;
  private callBackMappedToRenewStates: any = {};
  private callBacksMappedToRenewStates: any = {};
  private openedWindows: any[] = [];
  private requestType = REQUEST_TYPE.LOGIN;
  private idTokenNonce: string = '';
  private expectedState: string = '';
  private CONSTANTS = CONSTANTS;

  constructor(public config: IAuthenticationOptions) {

    // tslint:disable-next-line:no-string-literal
    window['_adalInstance'] = this;

    // validate before constructor assignments
    if (this.config.displayCall && typeof this.config.displayCall !== 'function') {
      throw new Error('displayCall is not a function');
    }

    if (!this.config.clientId) {
      throw new Error('clientId is required');
    }

    if (this.config.navigateToLoginRequestUrl === undefined) {
      this.config.navigateToLoginRequestUrl = true;
    }

    if (this.config.popUp) {
      this.popUp = true;
    }

    if (this.config.inIframe) {
      this.inIframe = true;
    }

    if (this.config.callback && typeof this.config.callback === 'function') {
      this.callback = this.config.callback;
    } else {
      this.callback = () => { /**/ };
    }

    if (this.config.instance) {
      this.instance = this.config.instance;
    }

    // App can request idtoken for itself using clientid as resource
    if (!this.config.loginResource) {
      this.config.loginResource = this.config.clientId;
    }

    // redirect and logout_redirect are set to current location by default
    if (!this.config.redirectUri) {
      // strip off query parameters or hashes from the redirect uri as AAD does not allow those.
      this.config.redirectUri = window.location.href.split('?')[0].split('#')[0];
    }

    if (!this.config.postLogoutRedirectUri) {
      // strip off query parameters or hashes from the post logout redirect uri as AAD does not allow those.
      this.config.postLogoutRedirectUri = window.location.href.split('?')[0].split('#')[0];
    }

    if (!this.config.anonymousEndpoints) {
      this.config.anonymousEndpoints = [];
    }

    if (this.config.loadFrameTimeout) {
      this.CONSTANTS.LOADFRAME_TIMEOUT = this.config.loadFrameTimeout;
    }

    this.logger = new Logger({
      correlationId: this.guid(),
      libVersion: this.libVersion(),
      piiLoggingEnabled: false,
      level: LOGGING_LEVEL.VERBOSE,
      log: (message: string) => {
        if (console) {
          // tslint:disable-next-line:no-console
          console.log(message);
        }
      }
    });

    this.store = new Store({
      cacheLocation: this.config.cacheLocation || 'sessionStorage',
      logger: this.logger
    });
  }

  /**
   * Returns the library version.
   * @ignore
   */
  public libVersion() {
    return '1.0.17-typescript';
  }

  /**
   * Initiates the login process by redirecting the user to Azure AD authorization endpoint.
   */
  public login() {
    if (this.loginInProgress) {
      this.logger.info('Login in progress');
      return;
    }

    this.loginInProgress = true;

    // Token is not present and user needs to login
    this.expectedState = this.guid();
    this.idTokenNonce = this.guid();
    let loginStartPage = this.store.getItem(STORAGE.LOGIN_REQUEST);

    if (!loginStartPage || loginStartPage === '') {
      loginStartPage = window.location.href;
    } else {
      this.store.saveItem(STORAGE.LOGIN_REQUEST, '');
    }

    this.logger.verbose('Expected state: ' + this.expectedState + ' startPage:' + loginStartPage);
    this.store.saveItem(STORAGE.LOGIN_REQUEST, loginStartPage);
    this.store.saveItem(STORAGE.LOGIN_ERROR, '');
    this.store.saveItem(STORAGE.STATE_LOGIN, this.expectedState, true);
    this.store.saveItem(STORAGE.NONCE_IDTOKEN, this.idTokenNonce, true);
    this.store.saveItem(STORAGE.ERROR, '');
    this.store.saveItem(STORAGE.ERROR_DESCRIPTION, '');
    const urlNavigate = `${this.getNavigateUrl('id_token', null)}&nonce=${encodeURIComponent(this.idTokenNonce)}`;

    if (this.config.displayCall) {
      // User defined way of handling the navigation
      this.config.displayCall(urlNavigate);
    } else if (this.popUp) {
      this.store.saveItem(STORAGE.STATE_LOGIN, ''); // so requestInfo does not match redirect case

      this.renewStates.push(this.expectedState);
      this.store.saveItem(STORAGE.RENEW_STATES, JSON.stringify(this.renewStates));

      this.registerCallback(this.expectedState, this.config.clientId, this.callback);
      this.loginPopup(urlNavigate);
    } else {
      if (this.inIframe) {
        this.promptUserForIframe(urlNavigate, this.config.popUpDisabledCallback);
      } else {
        this.promptUser(urlNavigate);
      }
    }
  }

  public isLoginInProgress() {
    return this.loginInProgress;
  }

  /**
   * Gets token for the specified resource from the cache.
   * @param {string}   resource A URI that identifies the resource for which the token is requested.
   * @returns {string} token if if it exists and not expired, otherwise null.
   */
  public getCachedToken(resource: string): string | null {
    if (!this.hasResource(resource)) {
      return null;
    }

    const token = this.store.getItem(STORAGE.ACCESS_TOKEN_KEY + resource);
    const expiry = this.store.getItem(STORAGE.EXPIRATION_KEY + resource);

    // If expiration is within offset, it will force renew
    const offset = this.config.expireOffsetSeconds || 300;

    if (expiry && (parseInt(expiry, 10) > this.now() + offset)) {
      return token;
    } else {
      this.store.saveItem(STORAGE.ACCESS_TOKEN_KEY + resource, '');
      this.store.saveItem(STORAGE.EXPIRATION_KEY + resource, `${0}`);
      return null;
    }
  }

  /**
   * User information from idtoken.
   * @class User
   *  @property {string} userName - username assigned from upn or email.
   *  @property {object} profile - properties parsed from idtoken.
   */

  /**
   * If user object exists, returns it. Else creates a new user object by decoding id_token from the cache.
   * @returns {User} user object
   */
  public getCachedUser(): IUser | null {
    if (this.user) {
      return this.user;
    }
    const idtoken = this.store.getItem(STORAGE.IDTOKEN);
    if (idtoken) {
      this.user = this.createUser(idtoken);
      return this.user;
    } else {
      return null;
    }
  }

  /**
   * Adds the passed callback to the array of callbacks for the specified resource and puts the array on the window object.
   * @param {string}   resource A URI that identifies the resource for which the token is requested.
   * @param {string}   expectedState A unique identifier (guid).
   * @param {tokenCallback} callback - The callback provided by the caller. It will be called with token or error.
   */
  public registerCallback(expectedState: string, resource: string, callback: (errorDesc: string, token: string, error: Error |  null, tokenType: string) => void) {
    this.activeRenewals[resource] = expectedState;

    if (!this.callBacksMappedToRenewStates[expectedState]) {
      this.callBacksMappedToRenewStates[expectedState] = [];
    }

    this.callBacksMappedToRenewStates[expectedState].push(callback.bind(this));

    if (!this.callBackMappedToRenewStates[expectedState]) {
      this.callBackMappedToRenewStates[expectedState] = (errorDesc: string, token: string, error: Error | null, tokenType: string) => {
        this.activeRenewals[resource] = null;

        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < this.callBacksMappedToRenewStates[expectedState].length; ++i) {
          try {
            this.callBacksMappedToRenewStates[expectedState][i](errorDesc, token, error, tokenType);
          } catch (error) {
            this.logger.warn(error);
          }
        }

        this.callBacksMappedToRenewStates[expectedState] = null;
        this.callBackMappedToRenewStates[expectedState] = null;
      };
    }
  }

  /**
   * Acquires token from the cache if it is not expired. Otherwise sends request to AAD to obtain a new token.
   * @param {string}   resource  ResourceUri identifying the target resource
   * @param {tokenCallback} callback -  The callback provided by the caller. It will be called with token or error.
   */
  public acquireToken(resource: string, callback: AcquireCallback) {
    if (this.isEmpty(resource)) {
      this.logger.warn('resource is required');
      callback('resource is required', null, new Error('resource is required'));
      return;
    }

    const token = this.getCachedToken(resource);

    if (token) {
      this.logger.info('Token is already in cache for resource:' + resource);
      callback(null, token, null);
      return;
    }

    if (!this.user && !(this.config.extraQueryParameter && this.config.extraQueryParameter.indexOf('login_hint') !== -1)) {
      this.logger.warn('User login is required');
      callback('User login is required', null, new Error('login required'));
      return;
    }

    // renew attempt with iframe
    // Already renewing for this resource, callback when we get the token.
    if (this.activeRenewals[resource]) {
      // Active renewals contains the state for each renewal.
      this.registerCallback(this.activeRenewals[resource] as string, resource, callback);
    } else {
      this.requestType = REQUEST_TYPE.RENEW_TOKEN;
      if (resource === this.config.clientId) {
        // App uses idtoken to send to api endpoints
        // Default resource is tracked as clientid to store this token
        if (this.user) {
          this.logger.verbose('renewing idtoken');
          this.renewIdToken(callback);
        }
        else {
          this.logger.verbose('renewing idtoken and access_token');
          this.renewIdToken(callback, RESPONSE_TYPE.ID_TOKEN_TOKEN);
        }
      } else {
        if (this.user) {
          this.logger.verbose('renewing access_token');
          this.renewToken(resource, callback);
        }
        else {
          this.logger.verbose('renewing idtoken and access_token');
          this.renewToken(resource, callback, RESPONSE_TYPE.ID_TOKEN_TOKEN);
        }
      }
    }
  }

  /**
   * Acquires token (interactive flow using a popUp window) by sending request to AAD to obtain a new token.
   * @param {string}   resource  ResourceUri identifying the target resource
   * @param {string}   extraQueryParameters  extraQueryParameters to add to the authentication request
   * @param {tokenCallback} callback -  The callback provided by the caller. It will be called with token or error.
   */
  public acquireTokenPopup(resource: string, extraQueryParameters: string[], claims: string, callback: AcquireCallback) {
    if (this.isEmpty(resource)) {
      this.logger.warn('resource is required');
      callback('resource is required', null, new Error('resource is required'));
      return;
    }

    if (!this.user) {
      this.logger.warn('User login is required');
      callback('User login is required', null, new Error('login required'));
      return;
    }

    if (this.acquireTokenInProgress) {
      this.logger.warn('Acquire token interactive is already in progress');
      callback('Acquire token interactive is already in progress', null, new Error('Acquire token interactive is already in progress'));
      return;
    }

    this.expectedState = this.guid() + '|' + resource;

    this.renewStates.push(this.expectedState);
    this.store.saveItem(STORAGE.RENEW_STATES, JSON.stringify(this.renewStates));

    this.requestType = REQUEST_TYPE.RENEW_TOKEN;
    this.logger.verbose('Renew token Expected state: ' + this.expectedState);
    // remove the existing prompt=... query parameter and add prompt=select_account
    let urlNavigate = this.urlRemoveQueryStringParameter(this.getNavigateUrl('token', resource), 'prompt');
    urlNavigate = urlNavigate + '&prompt=select_account';

    if (extraQueryParameters) {
      urlNavigate += extraQueryParameters;
    }

    if (claims && (urlNavigate.indexOf('&claims') === -1)) {
      urlNavigate += '&claims=' + encodeURIComponent(claims);
    } else if (claims && (urlNavigate.indexOf('&claims') !== -1)) {
      throw new Error('Claims cannot be passed as an extraQueryParameter');
    }

    urlNavigate = this.addHintParameters(urlNavigate);
    this.acquireTokenInProgress = true;
    this.logger.info('acquireToken interactive is called for the resource ' + resource);
    this.registerCallback(this.expectedState, resource, callback);
    this.loginPopup(urlNavigate, resource, callback);
  }

  /**
   * Acquires token (interactive flow using a redirect) by sending request to AAD to obtain a new token. In this case the callback passed in the Authentication
   * request constructor will be called.
   * @param {string}   resource  ResourceUri identifying the target resource
   * @param {string}   extraQueryParameters  extraQueryParameters to add to the authentication request
   */
  public acquireTokenRedirect(resource: string, extraQueryParameters: string[], claims: string) {
    const callback = this.callback;

    if (this.isEmpty(resource)) {
      this.logger.warn('resource is required');
      callback('resource is required', null, new Error('resource is required'));
      return;
    }

    if (!this.user) {
      this.logger.warn('User login is required');
      callback('User login is required', null, new Error('login required'));
      return;
    }

    if (this.acquireTokenInProgress) {
      this.logger.warn('Acquire token interactive is already in progress');
      callback('Acquire token interactive is already in progress', null, new Error('Acquire token interactive is already in progress'));
      return;
    }

    this.expectedState = this.guid() + '|' + resource;
    this.logger.verbose('Renew token Expected state: ' + this.expectedState);

    // remove the existing prompt=... query parameter and add prompt=select_account
    let urlNavigate = this.urlRemoveQueryStringParameter(this.getNavigateUrl('token', resource), 'prompt');
    urlNavigate = urlNavigate + '&prompt=select_account';
    if (extraQueryParameters) {
      urlNavigate += extraQueryParameters;
    }

    if (claims && (urlNavigate.indexOf('&claims') === -1)) {
      urlNavigate += '&claims=' + encodeURIComponent(claims);
    } else if (claims && (urlNavigate.indexOf('&claims') !== -1)) {
      throw new Error('Claims cannot be passed as an extraQueryParameter');
    }

    urlNavigate = this.addHintParameters(urlNavigate);
    this.acquireTokenInProgress = true;
    this.logger.info('acquireToken interactive is called for the resource ' + resource);
    this.store.saveItem(STORAGE.LOGIN_REQUEST, window.location.href);
    this.store.saveItem(STORAGE.STATE_RENEW, this.expectedState, true);
    this.promptUser(urlNavigate);
  }

  /**
   * Redirects the browser to Azure AD authorization endpoint.
   * @param {string} urlNavigate  Url of the authorization endpoint.
   */
  public promptUser(urlNavigate: string): void {
    if (urlNavigate) {
      this.logger.infoPii('Navigate to:' + urlNavigate);
      window.location.replace(urlNavigate); // Standard behavior
    } else {
      this.logger.info('Navigate url is empty');
    }
  }

  /**
   * Redirects the browser to Azure AD authorization endpoint.
   * @param {string} urlNavigate  Url of the authorization endpoint.
   */
  public promptUserForIframe(urlNavigate: string, popUpDisabledCallback?: (url: string) => void): void {
    if (urlNavigate) {
      this.logger.infoPii('Navigate to:' + urlNavigate);
      const win = window.open(urlNavigate, '_blank');
      if (win) {
        win.focus();
      } else {
        this.logger.infoPii('PopUps are disabled');
        if (popUpDisabledCallback && typeof popUpDisabledCallback === 'function') {
          popUpDisabledCallback(urlNavigate);
        }
      }
    } else {
      this.logger.info('Navigate url is empty');
    }
  }

  /**
   * Clears cache items.
   */
  public clearCache() {
    this.store.saveItem(STORAGE.LOGIN_REQUEST, '');
    this.store.saveItem(STORAGE.SESSION_STATE, '');
    this.store.saveItem(STORAGE.STATE_LOGIN, '');
    this.store.saveItem(STORAGE.STATE_RENEW, '');
    // this.renewStates = [];
    this.store.saveItem(STORAGE.RENEW_STATES, '');
    this.store.saveItem(STORAGE.NONCE_IDTOKEN, '');
    this.store.saveItem(STORAGE.IDTOKEN, '');
    this.store.saveItem(STORAGE.ERROR, '');
    this.store.saveItem(STORAGE.ERROR_DESCRIPTION, '');
    this.store.saveItem(STORAGE.LOGIN_ERROR, '');
    this.store.saveItem(STORAGE.LOGIN_ERROR, '');
    const keys = this.store.getItem(STORAGE.TOKEN_KEYS);
    if (keys && !this.isEmpty(keys)) {
      const keysArr = keys.split(this.CONSTANTS.RESOURCE_DELIMETER);
      for (let i = 0; i < keysArr.length && keysArr[i] !== ''; i++) {
        this.store.saveItem(STORAGE.ACCESS_TOKEN_KEY + keys[i], '');
        this.store.saveItem(STORAGE.EXPIRATION_KEY + keys[i], `${0}`);
      }
    }
    this.store.saveItem(STORAGE.TOKEN_KEYS, '');
  }

  /**
   * Clears cache items for a given resource.
   * @param {string}  resource a URI that identifies the resource.
   */
  public clearCacheForResource(resource: string): void {
    this.store.saveItem(STORAGE.STATE_RENEW, '');
    this.store.saveItem(STORAGE.ERROR, '');
    this.store.saveItem(STORAGE.ERROR_DESCRIPTION, '');
    if (this.hasResource(resource)) {
      this.store.saveItem(STORAGE.ACCESS_TOKEN_KEY + resource, '');
      this.store.saveItem(STORAGE.EXPIRATION_KEY + resource, `${0}`);
    }
  }

  /**
   * Redirects user to logout endpoint.
   * After logout, it will redirect to postLogoutRedirectUri if added as a property on the config object.
   */
  public logOut() {
    this.clearCache();
    this.user = null;
    let urlNavigate;

    if (this.config.logOutUri) {
      urlNavigate = this.config.logOutUri;
    } else {
      let tenant = 'common';
      let logout = '';

      if (this.config.tenant) {
        tenant = this.config.tenant;
      }

      if (this.config.postLogoutRedirectUri) {
        logout = 'post_logout_redirect_uri=' + encodeURIComponent(this.config.postLogoutRedirectUri);
      }

      urlNavigate = this.instance + tenant + '/oauth2/logout?' + logout;
    }

    this.logger.infoPii('Logout navigate to: ' + urlNavigate);
    this.promptUser(urlNavigate);
  }

  /**
   * @callback userCallback
   * @param {string} error error message if user info is not available.
   * @param {User} user user object retrieved from the cache.
   */

  /**
   * Calls the passed in callback with the user object or error message related to the user.
   * @param {userCallback} callback - The callback provided by the caller. It will be called with user or error.
   */
  public getUser(callback: (error: string | null, user: IUser | null) => void) {
    // IDToken is first call
    if (typeof callback !== 'function') {
      throw new Error('callback is not a function');
    }

    // user in memory
    if (this.user) {
      callback(null, this.user);
      return;
    }

    // frame is used to get idtoken
    const idtoken = this.store.getItem(STORAGE.IDTOKEN);
    let noUser = false;

    if (idtoken && !this.isEmpty(idtoken)) {
      this.logger.info('User exists in cache: ');
      this.user = this.createUser(idtoken);
      if (this.user) {
        callback(null, this.user);
      } else {
        noUser = true;
      }
    } else {
      noUser = true;
    }

    if (noUser) {
      this.logger.warn('User information is not available');
      callback('User information is not available', null);
    }
  }

  /**
   * Checks if the URL fragment contains access token, id token or error_description.
   * @param {string} hash  -  Hash passed from redirect page
   * @returns {Boolean} true if response contains id_token, access_token or error, false otherwise.
   */
  public isCallback(hash: string): boolean {
    hash = this.getHash(hash);
    const parameters = this.deserialize(hash);
    return (
      parameters.hasOwnProperty('error_description') ||
      parameters.hasOwnProperty('access_token') ||
      parameters.hasOwnProperty('id_token')
    );
  }

  /**
   * Gets login error
   * @returns {string} error message related to login.
   */
  public getLoginError() {
    return this.store.getItem(STORAGE.LOGIN_ERROR);
  }

  /**
   * Request info object created from the response received from AAD.
   *  @class RequestInfo
   *  @property {object} parameters - object comprising of fields such as id_token/error, session_state, state, e.t.c.
   *  @property {REQUEST_TYPE} requestType - either LOGIN, RENEW_TOKEN or UNKNOWN.
   *  @property {boolean} stateMatch - true if state is valid, false otherwise.
   *  @property {string} stateResponse - unique guid used to match the response with the request.
   *  @property {boolean} valid - true if requestType contains id_token, access_token or error, false otherwise.
   */

  /**
   * Creates a requestInfo object from the URL fragment and returns it.
   * @returns {RequestInfo} an object created from the redirect response from AAD comprising of the keys - parameters, requestType, stateMatch, stateResponse and valid.
   */
  public getRequestInfo(hash: string): IRequestInfo {
    hash = this.getHash(hash);
    const parameters = this.deserialize(hash);
    const requestInfo: IRequestInfo = {
      valid: false,
      parameters: {} as any,
      stateMatch: false,
      stateResponse: '',
      requestType: REQUEST_TYPE.UNKNOWN,
    };

    if (parameters) {
      requestInfo.parameters = parameters;
      if (parameters.hasOwnProperty('error_description') ||
        parameters.hasOwnProperty('access_token') ||
        parameters.hasOwnProperty('id_token')) {

        requestInfo.valid = true;

        // which call
        let stateResponse = '';
        if (parameters.hasOwnProperty('state')) {
          this.logger.verbose('State: ' + parameters.state);
          stateResponse = parameters.state;
        } else {
          this.logger.warn('No state returned');
          return requestInfo;
        }

        requestInfo.stateResponse = stateResponse;

        // async calls can fire iframe and login request at the same time if developer does not use the API as expected
        // incoming callback needs to be looked up to find the request type
        if (this.matchState(requestInfo)) { // loginRedirect or acquireTokenRedirect
          return requestInfo;
        }

        // external api requests may have many renewtoken requests for different resource
        if (!requestInfo.stateMatch && window.parent) {
          requestInfo.requestType = this.requestType;
          // const statesInParentContext = this.renewStates;
          let statesInParentContext = [];
          const statesInParent = this.store.getItem(STORAGE.RENEW_STATES);
          if (statesInParent) {
            statesInParentContext = JSON.parse(statesInParent);
          }
          // tslint:disable-next-line:prefer-for-of
          for (let i = 0; i < statesInParentContext.length; i++) {
            if (statesInParentContext[i] === requestInfo.stateResponse) {
              requestInfo.stateMatch = true;
              break;
            }
          }
        }
      }
    }
    return requestInfo;
  }

  /**
   * Saves token or error received in the response from AAD in the cache. In case of id_token, it also creates the user object.
   */
  public saveTokenFromHash(requestInfo: IRequestInfo): void {
    this.logger.info('State status:' + requestInfo.stateMatch + '; Request type:' + requestInfo.requestType);
    this.store.saveItem(STORAGE.ERROR, '');
    this.store.saveItem(STORAGE.ERROR_DESCRIPTION, '');

    const resource = this.getResourceFromState(requestInfo.stateResponse);

    // Record error
    if (requestInfo.parameters.error_description) {
      this.logger.infoPii('Error :' + requestInfo.parameters.error + '; Error description:' + requestInfo.parameters.error_description);
      this.store.saveItem(STORAGE.ERROR, requestInfo.parameters.error);
      this.store.saveItem(STORAGE.ERROR_DESCRIPTION, requestInfo.parameters.error_description);
      if (requestInfo.requestType === REQUEST_TYPE.LOGIN) {
        this.loginInProgress = false;
        this.store.saveItem(STORAGE.LOGIN_ERROR, requestInfo.parameters.error_description);
      }
    } else {
      // It must verify the state from redirect
      if (requestInfo.stateMatch) {
        // record tokens to storage if exists
        this.logger.info('State is right');
        if (requestInfo.parameters.session_state) {
          this.store.saveItem(STORAGE.SESSION_STATE, requestInfo.parameters.session_state);
        }

        let keys;

        if (requestInfo.parameters.access_token) {
          this.logger.info('Fragment has access token');

          if (!this.hasResource(resource)) {
            keys = this.store.getItem(STORAGE.TOKEN_KEYS) || '';
            this.store.saveItem(STORAGE.TOKEN_KEYS, keys + resource + this.CONSTANTS.RESOURCE_DELIMETER);
          }

          // save token with related resource
          this.store.saveItem(STORAGE.ACCESS_TOKEN_KEY + resource, requestInfo.parameters.access_token);
          this.store.saveItem(STORAGE.EXPIRATION_KEY + resource, `${this.expiresIn(requestInfo.parameters.expires_in)}`);
        }

        if (requestInfo.parameters.id_token) {
          this.logger.info('Fragment has id token');
          this.loginInProgress = false;
          this.user = this.createUser(requestInfo.parameters.id_token);
          if (this.user && this.user.profile) {
            if (!this.matchNonce(this.user)) {
              this.store.saveItem(STORAGE.LOGIN_ERROR, `Nonce received: ${this.user.profile.nonce} is not same as requested: ${this.store.getItem(STORAGE.NONCE_IDTOKEN)}`);
              this.user = null;
            } else {
              this.store.saveItem(STORAGE.IDTOKEN, requestInfo.parameters.id_token);
              // Save idtoken as access token for app itself
              const idTokenResource = this.config.loginResource ? this.config.loginResource : this.config.clientId;

              if (!this.hasResource(idTokenResource)) {
                keys = this.store.getItem(STORAGE.TOKEN_KEYS) || '';
                this.store.saveItem(STORAGE.TOKEN_KEYS, keys + idTokenResource + this.CONSTANTS.RESOURCE_DELIMETER);
              }

              this.store.saveItem(STORAGE.ACCESS_TOKEN_KEY + idTokenResource, requestInfo.parameters.id_token);
              this.store.saveItem(STORAGE.EXPIRATION_KEY + idTokenResource, this.user.profile.exp);
            }
          } else {
            requestInfo.parameters.error = 'invalid id_token';
            requestInfo.parameters.error_description = 'Invalid id_token. id_token: ' + requestInfo.parameters.id_token;
            this.store.saveItem(STORAGE.ERROR, 'invalid id_token');
            this.store.saveItem(STORAGE.ERROR_DESCRIPTION, 'Invalid id_token. id_token: ' + requestInfo.parameters.id_token);
          }
        }
      } else {
        requestInfo.parameters.error = 'Invalid_state';
        requestInfo.parameters.error_description = 'Invalid_state. state: ' + requestInfo.stateResponse;
        this.store.saveItem(STORAGE.ERROR, 'Invalid_state');
        this.store.saveItem(STORAGE.ERROR_DESCRIPTION, 'Invalid_state. state: ' + requestInfo.stateResponse);
      }
    }
    this.store.saveItem(STORAGE.RENEW_STATUS + resource, TOKEN_STATUS.TOKEN_RENEW_STATUS_COMPLETED);
  }

  /**
   * Gets resource for given endpoint if mapping is provided with config.
   * @param {string} endpoint  -  The URI for which the resource Id is requested.
   * @returns {string} resource for this API endpoint.
   */
  public getResourceForEndpoint(endpoint: string): string | null {
    // if user specified list of anonymous endpoints, no need to send token to these endpoints, return null.
    if (this.config && this.config.anonymousEndpoints) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < this.config.anonymousEndpoints.length; i++) {
        if (endpoint.indexOf(this.config.anonymousEndpoints[i]) > -1) {
          return null;
        }
      }
    }

    if (this.config && this.config.endpoints) {
      for (const configEndpoint in this.config.endpoints) {
        // configEndpoint is like /api/Todo requested endpoint can be /api/Todo/1
        if (endpoint.indexOf(configEndpoint) > -1) {
          return this.config.endpoints[configEndpoint];
        }
      }
    }

    // default resource will be clientid if nothing specified
    // App will use idtoken for calls to itself
    // check if it's staring from http or https, needs to match with app host
    if (endpoint.indexOf('http://') > -1 || endpoint.indexOf('https://') > -1) {
      if (this.getHostFromUri(endpoint) === this.getHostFromUri(this.config.redirectUri as string)) {
        return this.config.loginResource as string;
      }
    } else {
      // in angular level, the url for $http interceptor call could be relative url,
      // if it's relative call, we'll treat it as app backend call.
      return this.config.loginResource as string;
    }

    // if not the app's own backend or not a domain listed in the endpoints structure
    return null;
  }

  /**
   * This method must be called for processing the response received from AAD. It extracts the hash, processes the token or error, saves it in the cache and calls the registered callbacks with the result.
   * @param {string} [hash=window.location.hash] - Hash fragment of Url.
   */
  public handleWindowCallback(hash?: string): void {
    // This is for regular javascript usage for redirect handling
    // need to make sure this is for callback
    if (hash == null) {
      hash = window.location.hash;
    }

    if (this.isCallback(hash)) {
      let authContext = null;
      let isPopup = false;

      if (this.openedWindows.length > 0 && this.openedWindows[this.openedWindows.length - 1].opener && this.openedWindows[this.openedWindows.length - 1].opener._adalInstance) {
        authContext = this.openedWindows[this.openedWindows.length - 1].opener._adalInstance;
        isPopup = true;
      // tslint:disable-next-line:no-string-literal
      } else if (window.parent && window.parent['_adalInstance']) {
        // tslint:disable-next-line:no-string-literal
        authContext = window.parent['_adalInstance'];
      }

      if (authContext) {
        const self: AuthenticationContext = authContext;
        const requestInfo = self.getRequestInfo(hash);
        let token = null;
        let tokenReceivedCallback = null;
        let tokenType = null;

        if (isPopup || window.parent !== window) {
          tokenReceivedCallback = self.callBackMappedToRenewStates[requestInfo.stateResponse];
        } else {
          tokenReceivedCallback = self.callback;
        }

        self.logger.info('Returned from redirect url');
        self.saveTokenFromHash(requestInfo);

        if ((requestInfo.requestType === REQUEST_TYPE.RENEW_TOKEN) && window.parent) {
          if (window.parent !== window) {
            self.logger.verbose('Window is in iframe, acquiring token silently');
          } else {
            self.logger.verbose('acquiring token interactive in progress');
          }
          token = requestInfo.parameters.access_token || requestInfo.parameters.id_token;
          tokenType = 'access_token';
        } else if (requestInfo.requestType === REQUEST_TYPE.LOGIN) {
          token = requestInfo.parameters.id_token;
          tokenType = 'id_token';
        }

        const errorDesc = requestInfo.parameters.error_description;
        const error = requestInfo.parameters.error;
        try {
          if (tokenReceivedCallback) {
            tokenReceivedCallback(errorDesc, token, error, tokenType);
          }
        } catch (err) {
          self.logger.error(`Error occurred in user defined callback function: ${err.message}`, err);
        }

        if (window.parent === window && !isPopup) {
          if (self.config.navigateToLoginRequestUrl) {
            window.location.href = self.store.getItem(STORAGE.LOGIN_REQUEST) as string;
          } else {
            window.location.hash = '';
          }
        }
      }
    }
  }

  /**
   * Configures popup window for login.
   * @ignore
   */
  private openPopup(urlNavigate: string, title: string, popUpWidth: number, popUpHeight: number) {
    try {
      /**
       * adding winLeft and winTop to account for dual monitor
       * using screenLeft and screenTop for IE8 and earlier
       */
      const winLeft = window.screenLeft ? window.screenLeft : window.screenX;
      const winTop = window.screenTop ? window.screenTop : window.screenY;
      /**
       * window.innerWidth displays browser window's height and width excluding toolbars
       * using document.documentElement.clientWidth for IE8 and earlier
       */
      const width = window.innerWidth || (document.documentElement || { clientWidth: 0 }).clientWidth || document.body.clientWidth;
      const height = window.innerHeight || (document.documentElement || { clientHeight: 0 }).clientHeight || document.body.clientHeight;
      const left = ((width / 2) - (popUpWidth / 2)) + winLeft;
      const top = ((height / 2) - (popUpHeight / 2)) + winTop;

      const popupWindow = window.open(urlNavigate, title, 'width=' + popUpWidth + ', height=' + popUpHeight + ', top=' + top + ', left=' + left) as Window;

      if (popupWindow.focus) {
        popupWindow.focus();
      }

      return popupWindow;
    } catch (e) {
      this.logger.warn('Error opening popup, ' + e.message);
      this.loginInProgress = false;
      this.acquireTokenInProgress = false;
      return null;
    }
  }

  private handlePopupError(loginCallback: AcquireCallback, resource: string = '', error: Error | string, errorDesc: string, loginError: string) {
    this.logger.warn(errorDesc);
    this.store.saveItem(STORAGE.ERROR, typeof error === 'string' ? error : error.stack || `${error}`);
    this.store.saveItem(STORAGE.ERROR_DESCRIPTION, errorDesc);
    this.store.saveItem(STORAGE.LOGIN_ERROR, loginError);

    if (resource && this.activeRenewals[resource]) {
      this.activeRenewals[resource] = null;
    }

    this.loginInProgress = false;
    this.acquireTokenInProgress = false;

    if (loginCallback) {
      loginCallback(errorDesc, null, typeof error === 'string' ? new Error(error) : error);
    }
  }

  /**
   * After authorization, the user will be sent to your specified redirect_uri with the user's bearer token
   * attached to the URI fragment as an id_token field. It closes popup window after redirection.
   * @ignore
   */
  private loginPopup(urlNavigate: string, resource?: string, callback?: AcquireCallback) {
    const popupWindow = this.openPopup(urlNavigate, 'login', this.CONSTANTS.POPUP_WIDTH, this.CONSTANTS.POPUP_HEIGHT);
    const loginCallback = callback || this.callback;

    if (popupWindow == null) {
      const error = 'Error opening popup';
      const errorDesc = 'Popup Window is null. This can happen if you are using IE';
      this.handlePopupError(loginCallback, resource, error, errorDesc, errorDesc);
      return;
    }

    this.openedWindows.push(popupWindow);

    let registeredRedirectUri: string;
    if (this.config.redirectUri && this.config.redirectUri.indexOf('#') !== -1) {
      registeredRedirectUri = this.config.redirectUri.split('#')[0];
    } else if (this.config.redirectUri) {
      registeredRedirectUri = this.config.redirectUri;
    }

    const pollTimer = () => {
      let poll = false;
      if (!popupWindow || popupWindow.closed || popupWindow.closed === undefined) {
        const error = 'Popup Window closed';
        const errorDesc = 'Popup Window closed by UI action/ Popup Window handle destroyed due to cross zone navigation in IE/Edge';
        this.handlePopupError(loginCallback, resource, error, errorDesc, errorDesc);
        return;
      }
      try {
        const popUpWindowLocation = popupWindow.location;
        const popUpWindowLocationHash = popupWindow.location.hash;
        if (encodeURI(popUpWindowLocation.href).indexOf(encodeURI(registeredRedirectUri)) !== -1) {
          this.loginInProgress = false;
          this.acquireTokenInProgress = false;
          this.logger.info('Closing popup window');
          this.openedWindows = [];
          popupWindow.close();
          // console.log('popUpWindowLocationHash', popUpWindowLocationHash);
          this.handleWindowCallback(popUpWindowLocationHash);
          return;
        } else {
          poll = true;
        }
      } catch (ex) {
        poll = true;
      }
      if (poll) {
        setTimeout(() => pollTimer(), 1);
      }
    };

    pollTimer();
  }

  /**
   * Checks for the resource in the cache. By default, cache location is Session Storage
   * @ignore
   * @returns {Boolean} 'true' if login is in progress, else returns 'false'.
   */
  private hasResource(key: string): boolean {
    const keys = this.store.getItem(STORAGE.TOKEN_KEYS);
    const isEmpty = this.isEmpty(keys);
    if (keys) {
      const keyPresence = keys.indexOf(key + this.CONSTANTS.RESOURCE_DELIMETER) > -1;
      return !isEmpty && keyPresence;
    } else {
      return false;
    }
  }

  // const errorResponse = {error:'', error_description:''};
  // const token = 'string token';
  // callback(errorResponse, token)
  // with callback
  /**
   * Acquires access token with hidden iframe
   * @ignore
   */
  private renewToken(resource: string, callback: AcquireCallback, responseType: string = 'token') {
    // use iframe to try to renew token
    // use given resource to create new authz url
    this.logger.info('renewToken is called for resource:' + resource);
    const frameHandle = this.addAdalFrame('adalRenewFrame' + resource);
    this.expectedState = this.guid() + '|' + resource;
    // renew happens in iframe, so it keeps javascript context

    this.renewStates.push(this.expectedState);
    this.store.saveItem(STORAGE.RENEW_STATES, JSON.stringify(this.renewStates));

    this.logger.verbose('Renew token Expected state: ' + this.expectedState);
    // remove the existing prompt=... query parameter and add prompt=none
    let urlNavigate = this.urlRemoveQueryStringParameter(this.getNavigateUrl(responseType, resource), 'prompt');

    if (responseType === RESPONSE_TYPE.ID_TOKEN_TOKEN) {
      this.idTokenNonce = this.guid();
      this.store.saveItem(STORAGE.NONCE_IDTOKEN, this.idTokenNonce, true);
      urlNavigate += '&nonce=' + encodeURIComponent(this.idTokenNonce);
    }

    urlNavigate = urlNavigate + '&prompt=none';
    urlNavigate = this.addHintParameters(urlNavigate);
    this.registerCallback(this.expectedState, resource, callback);
    this.logger.verbosePii('Navigate to:' + urlNavigate);
    if (frameHandle) {
      frameHandle.src = 'about:blank';
    }
    this.loadFrameTimeout(urlNavigate, 'adalRenewFrame' + resource, resource);
  }

  /**
   * Renews idtoken for app's own backend when resource is clientId and calls the callback with token/error
   * @ignore
   */
  private renewIdToken(callback: AcquireCallback, responseType: string = 'id_token') {
    // use iframe to try to renew token
    this.logger.info('renewIdToken is called');
    const frameHandle = this.addAdalFrame('adalIdTokenFrame');
    this.expectedState = this.guid() + '|' + this.config.clientId;
    this.idTokenNonce = this.guid();
    this.store.saveItem(STORAGE.NONCE_IDTOKEN, this.idTokenNonce, true);
    // renew happens in iframe, so it keeps javascript context

    this.renewStates.push(this.expectedState);
    this.store.saveItem(STORAGE.RENEW_STATES, JSON.stringify(this.renewStates));

    this.logger.verbose('Renew Idtoken Expected state: ' + this.expectedState);
    // remove the existing prompt=... query parameter and add prompt=none
    const resource = responseType === null || typeof (responseType) === 'undefined' ? null : this.config.clientId;
    let urlNavigate = this.urlRemoveQueryStringParameter(this.getNavigateUrl(responseType, resource), 'prompt');
    urlNavigate = urlNavigate + '&prompt=none';
    urlNavigate = this.addHintParameters(urlNavigate);
    urlNavigate += '&nonce=' + encodeURIComponent(this.idTokenNonce);
    this.registerCallback(this.expectedState, this.config.clientId, callback);
    this.logger.verbosePii('Navigate to:' + urlNavigate);
    if (frameHandle) {
      frameHandle.src = 'about:blank';
    }
    this.loadFrameTimeout(urlNavigate, 'adalIdTokenFrame', this.config.clientId);
  }

  /**
   * Checks if the authorization endpoint URL contains query string parameters
   * @ignore
   */
  private urlContainsQueryStringParameter(name: string, url: string): boolean {
    // regex to detect pattern of a ? or & followed by the name parameter and an equals character
    const regex = new RegExp('[\\?&]' + name + '=');
    return regex.test(url);
  }

  /**
   * Removes the query string parameter from the authorization endpoint URL if it exists
   * @ignore
   */
  private urlRemoveQueryStringParameter(url: string, name: string): string {
    // we remove &name=value, name=value& and name=value
    // &name=value
    let regex = new RegExp('(\\&' + name + '=)[^\&]+');
    url = url.replace(regex, '');
    // name=value&
    regex = new RegExp('(' + name + '=)[^\&]+&');
    url = url.replace(regex, '');
    // name=value
    regex = new RegExp('(' + name + '=)[^\&]+');
    url = url.replace(regex, '');
    return url;
  }

  // Calling _loadFrame but with a timeout to signal failure in loadframeStatus. Callbacks are left
  // registered when network errors occur and subsequent token requests for same resource are registered to the pending request
  /**
   * @ignore
   */
  private loadFrameTimeout(urlNavigation: string, frameName: string, resource: string): void {
    // set iframe session to pending
    this.logger.verbose('Set loading state to pending for: ' + resource);
    this.store.saveItem(STORAGE.RENEW_STATUS + resource, TOKEN_STATUS.TOKEN_RENEW_STATUS_IN_PROGRESS);
    this.loadFrame(urlNavigation, frameName);

    setTimeout(() => {
      if (this.store.getItem(STORAGE.RENEW_STATUS + resource) === TOKEN_STATUS.TOKEN_RENEW_STATUS_IN_PROGRESS) {
        // fail the iframe session if it's in pending state
        this.logger.verbose('Loading frame has timed out after: ' + (this.CONSTANTS.LOADFRAME_TIMEOUT / 1000) + ' seconds for resource ' + resource);
        const expectedState = this.activeRenewals[resource];

        if (expectedState && this.callBackMappedToRenewStates[expectedState]) {
          this.callBackMappedToRenewStates[expectedState]('Token renewal operation failed due to timeout', null, 'Token Renewal Failed');
        }

        this.store.saveItem(STORAGE.RENEW_STATUS + resource, TOKEN_STATUS.TOKEN_RENEW_STATUS_CANCELED);
      }
    }, this.CONSTANTS.LOADFRAME_TIMEOUT);
  }

  /**
   * Loads iframe with authorization endpoint URL
   * @ignore
   */
  private loadFrame(urlNavigate: string, frameName: string) {
    // This trick overcomes iframe navigation in IE
    // IE does not load the page consistently in iframe
    this.logger.info('LoadFrame: ' + frameName);
    const frameCheck = frameName;
    setTimeout(() => {
      const frameHandle = this.addAdalFrame(frameCheck);
      if (frameHandle) {
        if (frameHandle.src === '' || frameHandle.src === 'about:blank') {
          frameHandle.src = urlNavigate;
          this.loadFrame(urlNavigate, frameCheck);
        }
      }
    }, 500);
  }

  /**
   * @callback tokenCallback
   *  @param {string} error_description error description returned from AAD if token request fails.
   *  @param {string} token token returned from AAD if token request is successful.
   *  @param {string} error error message returned from AAD if token request fails.
   */
  private isEmpty(str: any): boolean {
    return (typeof str === 'undefined' || !str || 0 === str.length);
  }

  /**
   * Adds login_hint to authorization URL which is used to pre-fill the username field of sign in page for the user if known ahead of time.
   * domain_hint can be one of users/organisations which when added skips the email based discovery process of the user.
   * @ignore
   */
  private addHintParameters(urlNavigate: string) {
    // If you don't use prompt=none, then if the session does not exist, there will be a failure.
    // If sid is sent alongside domain or login hints, there will be a failure since request is ambiguous.
    // If sid is sent with a prompt value other than none or attempt_none, there will be a failure since the request is ambiguous.

    if (this.user && this.user.profile) {
      if (this.user.profile.sid && urlNavigate.indexOf('&prompt=none') !== -1) {
        // don't add sid twice if user provided it in the extraQueryParameter value
        if (!this.urlContainsQueryStringParameter('sid', urlNavigate)) {
          // add sid
          urlNavigate += '&sid=' + encodeURIComponent(this.user.profile.sid);
        }
      }
      else if (this.user.profile.upn) {
        // don't add login_hint twice if user provided it in the extraQueryParameter value
        if (!this.urlContainsQueryStringParameter('login_hint', urlNavigate)) {
          // add login_hint
          urlNavigate += '&login_hint=' + encodeURIComponent(this.user.profile.upn);
        }
        // don't add domain_hint twice if user provided it in the extraQueryParameter value
        if (!this.urlContainsQueryStringParameter('domain_hint', urlNavigate) && this.user.profile.upn.indexOf('@') > -1) {
          const parts = this.user.profile.upn.split('@');
          // local part can include @ in quotes. Sending last part handles that.
          urlNavigate += '&domain_hint=' + encodeURIComponent(parts[parts.length - 1]);
        }
      }
    }
    return urlNavigate;
  }

  /**
   * Creates a user object by decoding the id_token
   * @ignore
   */
  private createUser(idToken: string): IUser | null {
    let user: IUser | null = null;
    const parsedJson = this.extractIdToken(idToken) as any;
    if (parsedJson && parsedJson.hasOwnProperty('aud')) {
      if (parsedJson.aud.toLowerCase() === this.config.clientId.toLowerCase()) {
        user = {
          userName: '',
          profile: parsedJson
        };
        if (parsedJson.hasOwnProperty('upn')) {
          user.userName = parsedJson.upn;
        } else if (parsedJson.hasOwnProperty('email')) {
          user.userName = parsedJson.email;
        }
      } else {
        this.logger.warn('IdToken has invalid aud field');
      }
    }
    return user;
  }

  /**
   * Returns the anchor part(#) of the URL
   * @ignore
   */
  private getHash(hash: string): string {
    if (hash.indexOf('#/') > -1) {
      hash = hash.substring(hash.indexOf('#/') + 2);
    } else if (hash.indexOf('#') > -1) {
      hash = hash.substring(1);
    }
    return hash;
  }

  /**
   * Matches nonce from the request with the response.
   * @ignore
   */
  private matchNonce(user: IUser): boolean {
    const requestNonce = this.store.getItem(STORAGE.NONCE_IDTOKEN);
    if (requestNonce) {
      const requestNonceArr = requestNonce.split(this.CONSTANTS.CACHE_DELIMETER);
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < requestNonceArr.length; i++) {
        if (requestNonceArr[i] === user.profile.nonce) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Matches state from the request with the response.
   * @ignore
   */
  private matchState(requestInfo: IRequestInfo): boolean {
    const loginStatesStr = this.store.getItem(STORAGE.STATE_LOGIN);
    if (loginStatesStr) {
      const loginStates = loginStatesStr.split(this.CONSTANTS.CACHE_DELIMETER);
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < loginStates.length; i++) {
        if (loginStates[i] === requestInfo.stateResponse) {
          requestInfo.requestType = REQUEST_TYPE.LOGIN;
          requestInfo.stateMatch = true;
          return true;
        }
      }
    }
    const acquireTokenStateStr = this.store.getItem(STORAGE.STATE_RENEW);
    if (acquireTokenStateStr) {
      const acquireTokenStates = acquireTokenStateStr.split(this.CONSTANTS.CACHE_DELIMETER);
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < acquireTokenStates.length; i++) {
        if (acquireTokenStates[i] === requestInfo.stateResponse) {
          requestInfo.requestType = REQUEST_TYPE.RENEW_TOKEN;
          requestInfo.stateMatch = true;
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extracts resource value from state.
   * @ignore
   */
  private getResourceFromState(state: string): string {
    if (state) {
      const splitIndex = state.indexOf('|');
      if (splitIndex > -1 && splitIndex + 1 < state.length) {
        return state.substring(splitIndex + 1);
      }
    }
    return '';
  }

  /**
   * Strips the protocol part of the URL and returns it.
   * @ignore
   */
  private getHostFromUri(uri: string): string {
    // remove http:// or https:// from uri
    let extractedUri = String(uri).replace(/^(https?:)\/\//, '');
    extractedUri = extractedUri.split('/')[0];
    return extractedUri;
  }

  /**
   * Constructs the authorization endpoint URL and returns it.
   * @ignore
   */
  private getNavigateUrl(responseType: string, resource: string | null) {
    let tenant = 'common';
    if (this.config.tenant) {
      tenant = this.config.tenant;
    }
    const config = {
      ...this.config,
      state: this.expectedState
    };
    const urlNavigate = `${this.instance}${tenant}/oauth2/authorize` +
      `${this.serialize(responseType, config, resource)}${this.addLibMetadata()}`;
    this.logger.info('Navigate url:' + urlNavigate);
    return urlNavigate;
  }

  /**
   * Returns the decoded id_token.
   * @ignore
   */
  private extractIdToken(encodedIdToken: string): object | null {
    // id token will be decoded to get the username
    const decodedToken = this.decodeJwt(encodedIdToken);
    if (!decodedToken) {
      return null;
    }
    try {
      const base64IdToken = decodedToken.JWSPayload;
      const base64Decoded = this.base64DecodeStringUrlSafe(base64IdToken);
      if (!base64Decoded) {
        this.logger.info('The returned id_token could not be base64 url safe decoded.');
        return null;
      }
      // ECMA script has JSON built-in support
      return JSON.parse(base64Decoded);
    } catch (err) {
      this.logger.error('The returned id_token could not be decoded', err);
    }
    return null;
  }

  /**
   * Decodes a string of data which has been encoded using base-64 encoding.
   * @ignore
   */
  private base64DecodeStringUrlSafe(base64IdToken: string): string {
    // html5 should support atob function for decoding
    base64IdToken = base64IdToken.replace(/-/g, '+').replace(/_/g, '/');
    if (window.atob) {
      return decodeURIComponent(escape(window.atob(base64IdToken))); // jshint ignore:line
    } else {
      return decodeURIComponent(escape(this.decode(base64IdToken)));
    }
  }

  // Take https://cdnjs.cloudflare.com/ajax/libs/Base64/0.3.0/base64.js and https://en.wikipedia.org/wiki/Base64 as reference.
  private decode(base64IdToken: string): string {
    const codes = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    base64IdToken = String(base64IdToken).replace(/=+$/, '');
    const length = base64IdToken.length;
    if (length % 4 === 1) {
      throw new Error('The token to be decoded is not correctly encoded.');
    }
    // tslint:disable-next-line:one-variable-per-declaration
    let h1, h2, h3, h4, bits, c1, c2, c3, decoded = '';
    for (let i = 0; i < length; i += 4) {
      // Every 4 base64 encoded character will be converted to 3 byte string, which is 24 bits
      // then 6 bits per base64 encoded character
      h1 = codes.indexOf(base64IdToken.charAt(i));
      h2 = codes.indexOf(base64IdToken.charAt(i + 1));
      h3 = codes.indexOf(base64IdToken.charAt(i + 2));
      h4 = codes.indexOf(base64IdToken.charAt(i + 3));
      // For padding, if last two are '='
      if (i + 2 === length - 1) {
        // tslint:disable-next-line:no-bitwise
        bits = h1 << 18 | h2 << 12 | h3 << 6;
        // tslint:disable-next-line:no-bitwise
        c1 = bits >> 16 & 255;
        // tslint:disable-next-line:no-bitwise
        c2 = bits >> 8 & 255;
        decoded += String.fromCharCode(c1, c2);
        break;
      } else if (i + 1 === length - 1) {
        // if last one is '='
        // tslint:disable-next-line:no-bitwise
        bits = h1 << 18 | h2 << 12;
        // tslint:disable-next-line:no-bitwise
        c1 = bits >> 16 & 255;
        decoded += String.fromCharCode(c1);
        break;
      }
      // tslint:disable-next-line:no-bitwise
      bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;
      // then convert to 3 byte chars
      // tslint:disable-next-line:no-bitwise
      c1 = bits >> 16 & 255;
      // tslint:disable-next-line:no-bitwise
      c2 = bits >> 8 & 255;
      // tslint:disable-next-line:no-bitwise
      c3 = bits & 255;
      decoded += String.fromCharCode(c1, c2, c3);
    }
    return decoded;
  }

  /**
   * Decodes an id token into an object with header, payload and signature fields.
   * @ignore
   */
  // Adal.node js crack function
  private decodeJwt(jwtToken: string): { header: string; JWSPayload: string; JWSSig: string } | null {
    if (this.isEmpty(jwtToken)) {
      return null;
    }
    const idTokenPartsRegex = /^([^\.\s]*)\.([^\.\s]+)\.([^\.\s]*)$/;
    const matches = idTokenPartsRegex.exec(jwtToken);
    if (!matches || matches.length < 4) {
      this.logger.warn('The returned id_token is not parseable.');
      return null;
    }
    const crackedToken = {
      header: matches[1],
      JWSPayload: matches[2],
      JWSSig: matches[3]
    };
    return crackedToken;
  }

  // /**
  //  * Converts string to represent binary data in ASCII string format by translating it into a radix-64 representation and returns it
  //  * @ignore
  //  */
  // private convertUrlSafeToRegularBase64EncodedString(str) {
  //   return str.replace('-', '+').replace('_', '/');
  // }

  /**
   * Serializes the parameters for the authorization endpoint URL and returns the serialized uri string.
   * @ignore
   */
  private serialize(responseType: string, obj: any, resource: string | null): string {
    const str = [];
    if (obj !== null) {
      str.push('?response_type=' + responseType);
      str.push('client_id=' + encodeURIComponent(obj.clientId));
      if (resource) {
        str.push('resource=' + encodeURIComponent(resource));
      }
      str.push('redirect_uri=' + encodeURIComponent(obj.redirectUri));
      str.push('state=' + encodeURIComponent(obj.state));
      if (obj.hasOwnProperty('slice')) {
        str.push('slice=' + encodeURIComponent(obj.slice));
      }
      if (obj.hasOwnProperty('extraQueryParameter')) {
        str.push(obj.extraQueryParameter);
      }
      const correlationId = obj.correlationId ? obj.correlationId : this.guid();
      str.push('client-request-id=' + encodeURIComponent(correlationId));
    }
    return str.join('&');
  }

  /**
   * Parses the query string parameters into a key-value pair object.
   * @ignore
   */
  private deserialize(query: string): any {
    let match;
    const pl = /\+/g;  // Regex for replacing addition symbol with a space
    const search = /([^&=]+)=([^&]*)/g;
    const decode = (s: string) => {
      return decodeURIComponent(s.replace(pl, ' '));
    };
    const obj: any = {};
    match = search.exec(query);
    while (match) {
      obj[decode(match[1])] = decode(match[2]);
      match = search.exec(query);
    }
    return obj;
  }

  /**
   * Generates RFC4122 version 4 guid (128 bits)
   * @ignore
   */
  private guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      // tslint:disable-next-line:no-bitwise
      const r = Math.random() * 16 | 0;
      // tslint:disable-next-line:no-bitwise
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Calculates the expires in value in milliseconds for the acquired token
   * @ignore
   */
  private expiresIn(expires: number | string): number {
    // if AAD did not send 'expires_in' property, use default expiration of 3599 seconds, for some reason AAD sends 3599 as 'expires_in' value instead of 3600
    if (!expires) {
      expires = 3599;
    }
    return this.now() + parseInt(expires as string, 10);
  }

  /**
   * Return the number of milliseconds since 1970/01/01
   * @ignore
   */
  private now() {
    return Math.round(new Date().getTime() / 1000.0);
  }

  /**
   * Adds the hidden iframe for silent token renewal
   * @ignore
   */
  private addAdalFrame(iframeId: string): HTMLIFrameElement | undefined {
    if (typeof iframeId === 'undefined') {
      return;
    }

    this.logger.info('Add adal frame to document:' + iframeId);
    let adalFrame = document.getElementById(iframeId) as HTMLIFrameElement;

    if (!adalFrame) {
      if (document.createElement && document.documentElement &&
        // tslint:disable-next-line:no-string-literal
        (window['opera'] || window.navigator.userAgent.indexOf('MSIE 5.0') === -1)) {
        const ifr = document.createElement('iframe') as HTMLIFrameElement;
        ifr.setAttribute('id', iframeId);
        ifr.setAttribute('aria-hidden', 'true');
        ifr.style.visibility = 'hidden';
        ifr.style.position = 'absolute';
        // tslint:disable-next-line:no-string-literal
        ifr.style.width = ifr.style.height = ifr['borderWidth'] = '0px';

        adalFrame = document.getElementsByTagName('body')[0].appendChild(ifr);
      } else if (document.body && document.body.insertAdjacentHTML) {
        document.body.insertAdjacentHTML('beforeend', `<iframe name="${iframeId}" id="${iframeId}" style="display: none;'></iframe>`);
      }
      if (window.frames && window.frames[iframeId]) {
        adalFrame = window.frames[iframeId];
      }
    }

    return adalFrame;
  }

  /**
   * Adds the library version and returns it.
   * @ignore
   */
  private addLibMetadata(): string {
    // x-client-SKU
    // x-client-Ver
    return '&x-client-SKU=Js&x-client-Ver=' + this.libVersion();
  }

}
