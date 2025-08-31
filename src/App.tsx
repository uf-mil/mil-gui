import React from 'react';
import './App.css';
import Preflight from './components/preflight';

import { RosProvider } from './components/RosContext'

function App() {
  return (
    <RosProvider>
        <div className="App">
            <Preflight/>
        </div>
    </RosProvider> 
  );
}

export default App;
