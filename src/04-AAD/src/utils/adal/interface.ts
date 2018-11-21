import { REQUEST_TYPE } from './const';

/**
 * Configuration options for Authentication Context.
 * @class config
 *  @property {string} tenant - Your target tenant.
 *  @property {string} clientId - Client ID assigned to your app by Azure Active Directory.
 *  @property {string} redirectUri - Endpoint at which you expect to receive tokens.Defaults to `window.location.href`.
 *  @property {string} instance - Azure Active Directory Instance.Defaults to `https://login.microsoftonline.com/`.
 *  @property {Array} endpoints - Collection of {Endpoint-ResourceId} used for automatically attaching tokens in webApi calls.
 *  @property {Boolean} popUp - Set this to true to enable login in a popup winodow instead of a full redirect.Defaults to `false`.
 *  @property {string} localLoginUrl - Set this to redirect the user to a custom login page.
 *  @property {function} displayCall - User defined function of handling the navigation to Azure AD authorization endpoint in case of login. Defaults to 'null'.
 *  @property {string} postLogoutRedirectUri - Redirects the user to postLogoutRedirectUri after logout. Defaults is 'redirectUri'.
 *  @property {string} cacheLocation - Sets browser storage to either 'localStorage' or sessionStorage'. Defaults to 'sessionStorage'.
 *  @property {Array.<string>} anonymousEndpoints Array of keywords or URI's. Adal will not attach a token to outgoing requests that have these keywords or uri. Defaults to 'null'.
 *  @property {number} expireOffsetSeconds If the cached token is about to be expired in the expireOffsetSeconds (in seconds), Adal will renew the token instead of using the cached token. Defaults to 300 seconds.
 *  @property {string} correlationId Unique identifier used to map the request with the response. Defaults to RFC4122 version 4 guid (128 bits).
 *  @property {number} loadFrameTimeout The number of milliseconds of inactivity before a token renewal response from AAD should be considered timed out.
 */

/**
 * Creates a new AuthenticationContext object.
 * @constructor
 * @param {config} config Configuration options for AuthenticationContext
 */

export interface IAuthenticationOptions {
  tenant?: string;
  clientId: string;
  callback?: () => void;
  loginResource?: string;
  redirectUri?: string;
  logOutUri?: string;
  instance?: string;
  endpoints?: string[];
  popUp?: boolean;
  inIframe?: boolean;
  popUpDisabledCallback?: (url: string) => void;
  localLoginUrl?: string;
  displayCall?: (urlNavigate: string) => void;
  postLogoutRedirectUri?: string;
  cacheLocation?: 'localStorage' | 'sessionStorage';
  anonymousEndpoints?: string[];
  expireOffsetSeconds?: number;
  correlationId?: string;
  loadFrameTimeout?: number;
  navigateToLoginRequestUrl?: boolean;
  extraQueryParameter?: string[];
}

/**
 * User information from idtoken.
 * @class User
 *  @property {string} userName - username assigned from upn or email.
 *  @property {object} profile - properties parsed from idtoken.
 */

export interface IUser {
  userName: string;
  profile: any;
}

export type AcquireCallback = (errorDesc: string | null, token: string | null, error: Error | null) => void;

export interface IRequestInfo {
  requestType: REQUEST_TYPE;
  stateResponse: string;
  stateMatch?: boolean;
  parameters: {
    access_token: string;
    expires_in: string;
    id_token: string;
    error_description: string;
    session_state: string;
    error: string;
  };
  valid?: boolean;
}
