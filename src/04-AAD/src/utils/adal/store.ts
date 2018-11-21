import { CONSTANTS } from './const';
import { Logger } from './logger';

export interface IStoreOptions {
  cacheLocation: 'localStorage' | 'sessionStorage';
  logger: Logger;
}

export enum STORAGE {
  TOKEN_KEYS = 'adal.token.keys',
  ACCESS_TOKEN_KEY = 'adal.access.token.key',
  EXPIRATION_KEY = 'adal.expiration.key',
  STATE_LOGIN = 'adal.state.login',
  STATE_RENEW = 'adal.state.renew',
  NONCE_IDTOKEN = 'adal.nonce.idtoken',
  SESSION_STATE = 'adal.session.state',
  USERNAME = 'adal.username',
  IDTOKEN = 'adal.idtoken',
  ERROR = 'adal.error',
  ERROR_DESCRIPTION = 'adal.error.description',
  LOGIN_REQUEST = 'adal.login.request',
  LOGIN_ERROR = 'adal.login.error',
  RENEW_STATUS = 'adal.token.renew.status',
  RENEW_STATES = 'adal.token.renew.states',
}

export class Store {

  constructor(private options: IStoreOptions) { /**/ }

  // new Array(localStorage.length).fill(0).reduce((res, _, index) => {
  //   res[localStorage.key(index)] = localStorage.getItem(localStorage.key(index));
  //   return res;
  // }, {})

  /**
   * Saves the key-value pair in the cache
   * @ignore
   */
  public saveItem(key: string, obj: string, preserve: boolean = false): boolean {
    if (this.options.cacheLocation && this.options.cacheLocation === 'localStorage') {
      if (!this.supportsLocalStorage()) {
        this.options.logger.info('Local storage is not supported');
        return false;
      }
      if (preserve) {
        const value = this.getItem(key) || '';
        localStorage.setItem(key, value + obj + CONSTANTS.CACHE_DELIMETER);
      } else {
        localStorage.setItem(key, obj);
      }
      return true;
    }
    // Default as session storage
    if (!this.supportsSessionStorage()) {
      this.options.logger.info('Session storage is not supported');
      return false;
    }
    sessionStorage.setItem(key, obj);
    return true;
  }

  /**
   * Searches the value for the given key in the cache
   * @ignore
   */
  public getItem(key: string): string | null {
    if (this.options.cacheLocation && this.options.cacheLocation === 'localStorage') {
      if (!this.supportsLocalStorage()) {
        this.options.logger.info('Local storage is not supported');
        return null;
      }
      return localStorage.getItem(key);
    }
    // Default as session storage
    if (!this.supportsSessionStorage()) {
      this.options.logger.info('Session storage is not supported');
      return null;
    }
    return sessionStorage.getItem(key);
  }

  /**
   * Returns true if browser supports localStorage, false otherwise.
   * @ignore
   */
  private supportsLocalStorage(): boolean {
    try {
      if (!window.localStorage) {
        return false; // Test availability
      }
      window.localStorage.setItem('storageTest', 'A'); // Try write
      if (window.localStorage.getItem('storageTest') !== 'A') {
        return false; // Test read/write
      }
      window.localStorage.removeItem('storageTest'); // Try delete
      if (window.localStorage.getItem('storageTest')) {
        return false; // Test delete
      }
      return true; // Success
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns true if browser supports sessionStorage, false otherwise.
   * @ignore
   */
  private supportsSessionStorage(): boolean {
    try {
      if (!window.sessionStorage) {
        return false; // Test availability
      }
      window.sessionStorage.setItem('storageTest', 'A'); // Try write
      if (window.sessionStorage.getItem('storageTest') !== 'A') {
        return false; // Test read/write
      }
      window.sessionStorage.removeItem('storageTest'); // Try delete
      if (window.sessionStorage.getItem('storageTest')) {
        return false; // Test delete
      }
      return true; // Success
    } catch (e) {
      return false;
    }
  }

}