import React from 'react';
import './App.css';
import Preflight from './components/preflight';
import MakeSubLive from './components/MakeSubLive';

import { RosProvider } from './components/RosContext'

function App() {
  return (
    <RosProvider>
        <div className="App">
            <Preflight/>
            <MakeSubLive/>
        </div>
    </RosProvider> 
  );
}

export default App;
