import * as React from 'react';
import { sp } from '@pnp/sp';

// import * as AuthenticationContext from 'adal-angular';
import { AuthenticationContext } from '../../utils/adal';
import { SPTokenFetchClient } from '../../utils/auth/SPTokenFetchClient';

import { getUrlKeyValue, detectIE } from '../../utils';
import { IProps, IState, IUserProfile } from './Interfaces';

export default class App extends React.Component<IProps, IState> {

  private authContext: AuthenticationContext;
  private token: string = '';
  private authTries = 1;

  private ieWatcher = false;
  private isIE: number | boolean;

  constructor(props: IProps) {
    super(props);
    const popUp = false;
    this.isIE = detectIE();
    this.authContext = new AuthenticationContext({
      clientId: this.props.azureClientId,
      postLogoutRedirectUri: this.props.postLogoutRedirectUri.replace('logout=true', 'logged-out=true'),
      popUp,
      inIframe: true,
      popUpDisabledCallback: this.props.popUpDisabledCallback,
      cacheLocation: 'localStorage',
      callback: () => {
        if (this.isIE) {
          if (!this.ieWatcher) {
            this.ieWatcher = true;
            this.runWatcher();
          }
        } else {
          this.authFlow();
        }
      }
    });
    this.state = {
      authenticated: false,
      authError: null,
      debug: getUrlKeyValue('debug') === 'true'
    };
  }

  public render() {
    return (
      <div>
        {this.state.debug && (
          <div>
            {this.state.authenticated ?
              <div>Logged in as <b>{(this.state.userProfile as IUserProfile).fullName}</b></div> :
              'Not Authenticated'}
          </div>
        )}
        {this.state.authenticated && this.state.debug && (
          <div style={{
            marginBottom: 20
          }}>
            <a
              className='log-out-button'
              href='#'
              onClick={() => {
                this.authContext.logOut();
                return false;
              }}
            >Log Out</a>
            <div>
              <span>Auth token:</span>&nbsp;
              <small>{this.token.substring(0, 60)}...</small>
            </div>
          </div>
        )}
        {this.state.authError && <div className='error'>{this.state.authError}</div>}
        {this.state.authenticated && this.props.render && this.props.render({ token: this.token })}
      </div>
    );
  }

  public componentDidMount() {
    if (getUrlKeyValue('logout') === 'true') {
      return this.authContext.logOut();
    }
    if (getUrlKeyValue('logged-out') === 'true') {
      if (this.props.onAuthFailure) {
        this.props.onAuthFailure('Logged out');
      }
      return;
    }
    this.authFlow();
    if (this.authContext.inIframe) {
      this.runWatcher();
    }
  }

  private runWatcher() {
    const token = localStorage.getItem('adal.idtoken');
    if (token) {
      setTimeout(() => {
        this.authFlow();
      }, 1000);
    } else {
      setTimeout(() => {
        this.runWatcher();
      }, 300);
    }
  }

  private authFlow() {
    if (this.authContext.isCallback(window.location.hash)) {
      // Handle redirect after token requests
      this.authContext.handleWindowCallback();
      if (this.isIE) {
        if (window.innerHeight < 610 && window.innerWidth < 500) {
          (window.open('', '_self', '') as Window).close();
        }
      }
      // Close window after redirect, when using new tab opening
      if (this.authContext.inIframe) {
        (window.open('', '_self', '') as Window).close();
      }
      const authError = this.authContext.getLoginError();
      this.setState({
        authError,
        authenticated: false
      });
      if (authError && this.props.onAuthFailure && typeof this.props.onAuthFailure === 'function') {
        this.props.onAuthFailure(authError);
      }
    } else {
      // If logged in, get access token and make an API request
      const user = this.authContext.getCachedUser();
      if (user) {
        // Get an access token to the SharePoint API
        this.authContext.acquireToken(this.props.authResource, (authError, token) => {
          if (authError || !token) {
            this.setState({ authError });
            return;
          }
          // Use the access token
          this.token = token;
          this.setState({
            authenticated: true,
            authError: null,
            userLogin: user.userName,
            userProfile: {
              firstName: user.profile.given_name,
              lastName: user.profile.family_name,
              fullName: user.profile.name
            }
          });

          // Configuring PnPjs REST auth in SharePoint with renewable tokens
          sp.setup({
            sp: {
              fetchClientFactory: () => new SPTokenFetchClient({
                authContext: this.authContext,
                authResource: this.props.authResource
              })
            }
          });

          if (this.props.onAuthSuccess && typeof this.props.onAuthSuccess === 'function') {
            this.props.onAuthSuccess(token);
          }
        });
      } else {
        this.setState({
          authenticated: false,
          authError: null
        });
        if (this.authTries > 0) {
          this.authContext.login();
          this.authTries -= 1;
          setTimeout(() => this.authTries += 1, 1000 * 60);
        }
      }
    }
  }

}