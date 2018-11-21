import * as React from 'react';

import { Doughnut } from 'react-chartjs-2';
import { ChartAPI } from './Operations';
import { IProps, IState } from './interfaces';

import './styles.scss';
const styles = {
  spDay2018: 'spDay2018',
  title: 'title'
};

export default class Chart extends React.Component<IProps, IState> {

  private api: ChartAPI;
  private refreshTimeout: number;
  private refreshTimer: any;

  constructor(props: IProps) {
    super(props);
    this.api = new ChartAPI({ webAbsUrl: props.webAbsUrl });
    this.refreshTimeout = (typeof props.refreshInSeconds !== 'undefined' ? props.refreshInSeconds : 30) * 1000;
    this.state = {
      up: 0,
      down: 0,
      loadedAt: new Date()
    };
  }

  public render() {
    const chartData = {
      datasets: [{
        data: [ this.state.up, this.state.down ],
        backgroundColor: [ '#46BFBD', '#F7464A' ],
        hoverBackgroundColor: [ '#5AD3D1', '#FF5A5E' ]
      }],
      labels: [ 'Up', 'Down' ]
    };
    return (
      <div className={styles.spDay2018}>
        {this.props.title && <h2 className={styles.title}>{this.props.title}</h2>}
        <Doughnut data={chartData} />
      </div>
    );
  }

  public componentDidMount() {
    this.refreshData();
  }

  public UNSAFE_componentWillReceiveProps(props: IProps) {
    let refresh = false;
    if (props.webAbsUrl !== this.props.webAbsUrl) {
      this.api = new ChartAPI({ webAbsUrl: props.webAbsUrl });
      refresh = true;
    }
    if (props.refreshInSeconds !== this.props.refreshInSeconds) {
      this.refreshTimeout = (typeof props.refreshInSeconds !== 'undefined' ? props.refreshInSeconds : 30) * 1000;
      refresh = true;
    }
    if (refresh) {
      this.refreshData();
    }
  }

  private getData(): void {
    this.api.getChartData().then(data => {
      this.setState(prevState => {
        return {
          ...prevState,
          ...(prevState.loadedAt < data.loadedAt ? data : {})
        };
      });
    });
  }

  private refreshData(): void {
    this.getData();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    if (this.refreshTimeout > 0) {
      this.refreshTimer = setTimeout(() => this.refreshData(), this.refreshTimeout);
    }
  }

}
