export interface IProps {
  refreshInSeconds?: number;
  title?: string;
}

export interface IChartData {
  up: number;
  down: number;
  loadedAt: Date;
}

export interface IState extends IChartData {}
