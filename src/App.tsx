import React from 'react';
import './App.css';
import Preflight from './components/preflight';
import ThrusterControl from './components/thruster_control';
import { RosProvider } from './components/RosContext';

function App() {
  return (
    <RosProvider>
      <div className="App">
        <Preflight />
        <hr style={{ margin: "20px 0" }} />
        <ThrusterControl />
      </div>
    </RosProvider> 
  );
}

export default App;
