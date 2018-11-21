import * as React from 'react';

import './App.scss';
import { IAppProps, IAppState } from './IApp';

import Auth, { IRenderProps } from './Auth';
import Loading from '../components/Loading';
import Login from '../components/Login';
import Chart from '../components/Chart';

export default class App extends React.Component<IAppProps, IAppState> {

  constructor(props: IAppProps) {
    super(props);
    this.state = { loading: true, error: '' };
    this.renderApp = this.renderApp.bind(this);
    this.onAuthSuccess = this.onAuthSuccess.bind(this);
    this.onAuthFailure = this.onAuthFailure.bind(this);
  }

  public render() {
    return (
      <div className='app'>
        <div className='app-container'>
          <p>SPDay 2018 - CRA2 + AAD sample</p>
          {this.state.loading && !this.state.popUpDisabledUrl && <Loading />}
          {this.state.loading && this.state.popUpDisabledUrl && (
            <Login
              url={this.state.popUpDisabledUrl}
              onClick={() => this.setState({ popUpDisabledUrl: '' })}
            />
          )}
          {this.state.error && <div>{this.state.error}</div>}
          <Auth
            authResource={this.props.aadAuthResource}
            azureClientId={this.props.aadClientId}
            postLogoutRedirectUri={window.location.href}
            render={this.renderApp}
            onAuthSuccess={this.onAuthSuccess}
            onAuthFailure={this.onAuthFailure}
            popUpDisabledCallback={url => this.popUpDisabledCallback(url)}
          />
        </div>
      </div>
    );
  }

  private renderApp(_props: IRenderProps) {
    return (
      <Chart webAbsUrl={this.props.spoSiteUrl} refreshInSeconds={5} />
    );
  }

  private onAuthFailure(error: string) {
    this.setState({ loading: false, error });
  }

  private onAuthSuccess() {
    this.setState({ loading: false, error: '' });
  }

  private popUpDisabledCallback(popUpDisabledUrl: string): void {
    this.setState({ popUpDisabledUrl });
  }

}
