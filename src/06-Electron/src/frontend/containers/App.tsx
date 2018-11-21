import * as React from 'react';

import Chart from './Chart';
import './App.scss';

export default class App extends React.Component {

  public render() {
    return (
      <div className='app'>
        <div className='app-container'>
          <Chart refreshInSeconds={3} />
        </div>
      </div>
    );
  }

}
