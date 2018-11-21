import React, { Component } from 'react';

import VoteButton from '../components/VoteButton';
import VoteAPI from './Operations';
import { newGuid } from '../utils';
import { IAppProps, IAppState, IVote } from './IApp';

import './App.scss';

class App extends Component<IAppProps, IAppState> {

  private api: VoteAPI;

  constructor(props: IAppProps) {
    super(props);
    this.state = {
      loading: false,
      vote: localStorage.getItem('vote') as IVote
    };
    const guid = localStorage.getItem('clientId') || newGuid();
    localStorage.setItem('clientId', guid);
    this.api = new VoteAPI({ ...props, guid });
  }

  public render() {
    return (
      <div className='app'>
        <div className='table'>
          <div className='row'>
            <div className='cell'>
              <VoteButton
                type='up'
                onclick={() => this.vote('up')}
                active={this.state.vote !== 'up' && !this.state.loading}
                selected={this.state.vote === 'up'}
              />
            </div>
          </div>
          <div className='row'>
            <div className='cell'>
              <VoteButton
                type='down'
                onclick={() => this.vote('down')}
                active={this.state.vote !== 'down' && !this.state.loading}
                selected={this.state.vote === 'down'}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  private vote(vote: IVote): void {
    this.setState({ loading: true, error: undefined });
    this.api.vote(vote)
      .then(_ => {
        if (vote) {
          localStorage.setItem('vote', vote);
        } else {
          localStorage.removeItem('vote');
        }
        this.setState({
          loading: false,
          vote
        });
      })
      .catch(error => {
        this.setState({
          loading: false,
          error: error.message
        });
      });
  }

}

export default App;
