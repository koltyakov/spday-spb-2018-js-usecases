import * as React from 'react';

import { IVoteButtonProps } from './IVoteButton';

import up from './up.svg';
import down from './down.svg';
import './VoteButton.scss';

const VoteButton = (props: IVoteButtonProps) => {
  return (
    <img
      className={`vote-button ${props.active ? '' : 'isDisabled'} ${props.selected ? 'isSelected' : '' }`}
      src={({ up, down })[props.type]}
      onClick={() => {
        if (props.active && props.onclick && typeof props.onclick === 'function') {
          props.onclick();
        }
      }}
    />
  );
};

export default VoteButton;
