import { BearerTokenFetchClient, FetchOptions } from '@pnp/common';
import { AuthenticationContext } from '../adal';

export interface ISPTokenFetchClientConfig {
  authResource: string;
  authContext: AuthenticationContext;
}

export class SPTokenFetchClient extends BearerTokenFetchClient {

  constructor(private config: ISPTokenFetchClientConfig) {
    super('');
  }

  public fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    return this.acquireToken()
      .then((accessToken: string) => {
        this.token = accessToken;
        return super.fetch(url, options);
      });
  }

  private acquireToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.config.authContext.acquireToken(this.config.authResource, (authError, token) => {
        if (authError || !token) {
          return reject(authError);
        }
        resolve(token);
      });
    });
  }

}
