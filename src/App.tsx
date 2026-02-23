import React from 'react';
import './App.css';

import Preflight from './components/preflight';
import ServiceExample from './components/ServiceExample';
import { RosProvider } from './components/RosContext';
import RosNodeStatus from './components/RosNodeList';
import { launchChecklistConfig } from './config/launchChecklistConfig';
import { useRosGraph } from './hooks/useRosGraph';

function AppContent() {
    const rosGraph = useRosGraph(launchChecklistConfig);

    return (
        <>
            <RosNodeStatus
                rosGraph={rosGraph}
                requiredNodes={launchChecklistConfig.requiredNodes}
                requiredServices={launchChecklistConfig.requiredServices}
                launchBlockReasons={rosGraph.dependencyBlockReasons}
            />
            <div className="App">
                <Preflight />
                <ServiceExample />
            </div>
        </>
    );
}

function App() {
    return (
        <RosProvider>
            <AppContent />
        </RosProvider>
    );
}

export default App;
