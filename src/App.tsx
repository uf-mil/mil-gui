import React from 'react';
import './App.css';
import Preflight from './components/preflight';
import ServiceExample from './components/ServiceExample';

import { RosProvider } from './components/RosContext'
import RosNodeStatus from './components/RosNodeList';


function App() {
  return (
    <RosProvider>
      <RosNodeStatus></RosNodeStatus>
        <div className="App">
            <Preflight/>
            <ServiceExample/>
        </div>
    </RosProvider> 
  );
}

export default App;
