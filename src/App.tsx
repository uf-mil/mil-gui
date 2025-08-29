import React from 'react';
import './App.css';
import Publisher from './components/publisher';

import { RosProvider } from './components/RosContext'

function App() {
  return (
    <RosProvider>
        <div className="App">
            <Publisher/>
        </div>
    </RosProvider> 
  );
}

export default App;
