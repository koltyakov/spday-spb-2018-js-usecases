export interface IVoteButtonProps {
  type: 'up' | 'down';
  active: boolean;
  onclick: () => void;
  selected?: boolean;
}
