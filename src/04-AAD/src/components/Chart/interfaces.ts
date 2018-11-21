export interface IProps {
  webAbsUrl: string;
  refreshInSeconds?: number;
  title?: string;
}

export interface IChartData {
  up: number;
  down: number;
  loadedAt: Date;
}

export interface IState extends IChartData {}

export interface IChartApiProps {
  webAbsUrl: string;
}
