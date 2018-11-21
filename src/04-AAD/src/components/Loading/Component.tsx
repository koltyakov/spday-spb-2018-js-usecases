import * as React from 'react';

import './styles.scss';
import { IProps } from './interfaces';

export default class Loading extends React.Component<IProps> {

  constructor(props: IProps) {
    super(props);
  }

  public render() {
    return (
      <div>Loading...</div>
    );
  }

}