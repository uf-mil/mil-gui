import React, { useState } from 'react';
import './App.css';

import Preflight from './components/preflight';
import ServiceExample from './components/ServiceExample';
import CameraFeed from './components/CameraFeed';
import LaunchChecklistPanel from './components/LaunchChecklistPanel';
import { RosProvider } from './components/RosContext';
import RosNodeStatus from './components/RosNodeList';
import ThrusterSpinPanel from './components/ThrusterSpinPanel';
import { launchChecklistConfig } from './config/launchChecklistConfig';
import { useChecklistState } from './hooks/useChecklistState';
import { useRosGraph } from './hooks/useRosGraph';

function AppContent() {
    const [showLegacyPanels, setShowLegacyPanels] = useState<boolean>(false);
    const rosGraph = useRosGraph(launchChecklistConfig);
    const checklist = useChecklistState(launchChecklistConfig, rosGraph);

    return (
        <>
            <LaunchChecklistPanel config={launchChecklistConfig} checklist={checklist} />
            <RosNodeStatus
                rosGraph={rosGraph}
                requiredNodes={launchChecklistConfig.requiredNodes}
                requiredServices={launchChecklistConfig.requiredServices}
                launchBlockReasons={checklist.launchBlockReasons}
            />
            <CameraFeed
                config={launchChecklistConfig.camera}
                availableTopics={rosGraph.runningTopics}
            />
            <ThrusterSpinPanel
                config={launchChecklistConfig}
                availableTopics={rosGraph.runningTopics}
                availableServices={rosGraph.runningServices}
            />
            <section className="legacy-controls">
                <button
                    className={showLegacyPanels ? 'secondary-button active' : 'secondary-button'}
                    onClick={() => setShowLegacyPanels((previous) => !previous)}
                >
                    {showLegacyPanels ? 'Hide Legacy Panels' : 'Show Legacy Panels'}
                </button>
            </section>
            {showLegacyPanels && (
                <div className="App legacy-panels">
                    <Preflight />
                    <ServiceExample />
                </div>
            )}
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
