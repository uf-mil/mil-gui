import React from 'react';
import './App.css';
import Preflight from './components/preflight';
import ServiceExample from './components/ServiceExample';

import { RosProvider } from './components/RosContext'

function App() {
  return (
    <RosProvider>
        <div className="App">
            <Preflight/>
            <ServiceExample/>
        </div>
    </RosProvider> 
  );
}

export default App;
