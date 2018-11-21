import React from 'react';
import ReactDOM from 'react-dom';
import './index.scss';
import App from './containers/App';

import { apiUri, apiKey } from './utils/env';

ReactDOM.render(<App {...{ apiUri, apiKey }} />, document.getElementById('root'));
