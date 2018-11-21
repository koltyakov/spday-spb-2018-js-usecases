import * as React from 'react';

import { IProps } from './interfaces';

import './styles.scss';

export default class Login extends React.Component<IProps> {

  constructor(props: IProps) {
    super(props);
    this.login = this.login.bind(this);
  }

  public render() {
    return (
      <div className='loginDialog'>
        <div className='tableRow'>
          <div className='tableCell'>
            <a onClick={this.login}>
              Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  private login() {
    const win = window.open(this.props.url, '_blank');
    if (win) {
      win.focus();
    }
    this.props.onClick();
  }

}
