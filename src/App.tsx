import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

import Preflight from './components/preflight';
import ServiceExample from './components/ServiceExample';
import CameraFeed from './components/CameraFeed';
import LaunchChecklistPanel from './components/LaunchChecklistPanel';
import { RosProvider } from './components/RosContext';
import RosNodeStatus from './components/RosNodeList';
import RosNodeOverview from './components/RosNodeOverview';
import HeaderBanner from './components/HeaderBanner';
import SimControlBar from './components/SimControlBar';
import ThrusterSpinPanel from './components/ThrusterSpinPanel';
import { launchChecklistConfig } from './config/launchChecklistConfig';
import { useChecklistState } from './hooks/useChecklistState';
import { useRosGraph } from './hooks/useRosGraph';

function AppContent() {
    const [showLegacyPanels, setShowLegacyPanels] = useState<boolean>(false);
    const [uiError, setUiError] = useState<string | null>(null);
    const [noHardwareMode, setNoHardwareMode] = useState<boolean>(() => {
        try {
            return localStorage.getItem('sim.noHardware') === '1';
        } catch {
            return false;
        }
    });
    const [simCameraEnabled, setSimCameraEnabled] = useState<boolean>(() => {
        try {
            return localStorage.getItem('sim.camera') === '1';
        } catch {
            return false;
        }
    });
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        try {
            return (localStorage.getItem('ui.theme') as 'light' | 'dark') ?? 'light';
        } catch {
            return 'light';
        }
    });

    const effectiveConfig = useMemo(() => {
        if (!noHardwareMode) {
            return launchChecklistConfig;
        }

        const normalizeName = (name: string) => (name.startsWith('/') ? name.slice(1) : name);
        const hardwareNodeSet = new Set((launchChecklistConfig.hardwareNodes ?? []).map(normalizeName));
        const hardwareServiceSet = new Set((launchChecklistConfig.hardwareServices ?? []).map(normalizeName));

        const filteredRequiredNodes = launchChecklistConfig.requiredNodes
            .filter((node) => !hardwareNodeSet.has(normalizeName(node)));
        const filteredExpectedNodes = launchChecklistConfig.expectedNodes
            .filter((node) => !hardwareNodeSet.has(normalizeName(node)));
        const filteredRequiredServices = launchChecklistConfig.requiredServices
            .filter((service) => !hardwareServiceSet.has(normalizeName(service.name)));

        return {
            ...launchChecklistConfig,
            requiredNodes: filteredRequiredNodes,
            expectedNodes: filteredExpectedNodes,
            requiredServices: filteredRequiredServices,
            ignoreKillGate: true,
        };
    }, [noHardwareMode]);

    const rosGraph = useRosGraph(effectiveConfig);
    const checklist = useChecklistState(effectiveConfig, rosGraph);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('ui.theme', theme);
        } catch {
            setUiError('Theme preference could not be saved.');
        }
    }, [theme]);

    const handleToggleNoHardware = (next: boolean) => {
        setNoHardwareMode(next);
        if (!next) {
            setSimCameraEnabled(false);
        }
        try {
            localStorage.setItem('sim.noHardware', next ? '1' : '0');
            if (!next) {
                localStorage.setItem('sim.camera', '0');
            }
        } catch {
            setUiError('No-hardware toggle failed to persist. Check browser storage settings.');
        }
    };

    const handleToggleSimCamera = (next: boolean) => {
        if (!noHardwareMode) {
            setUiError('Enable No Hardware Mode before using Simulated Camera.');
            return;
        }
        setSimCameraEnabled(next);
        try {
            localStorage.setItem('sim.camera', next ? '1' : '0');
        } catch {
            setUiError('Simulated camera toggle failed to persist. Check browser storage settings.');
        }
    };

    return (
        <div className="app-shell">
            <HeaderBanner
                title="MIL SubjuGator"
                subtitle="Operations Console"
                logoLightSrc="/branding/mil-logo-light.svg"
                logoDarkSrc="/branding/mil-logo-dark.svg"
                theme={theme}
                onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            />
            <SimControlBar
                noHardwareMode={noHardwareMode}
                simCameraEnabled={simCameraEnabled}
                onToggleNoHardware={handleToggleNoHardware}
                onToggleSimCamera={handleToggleSimCamera}
                errorMessage={uiError}
                onClearError={() => setUiError(null)}
            />
            <main className="app-main-grid">
                <LaunchChecklistPanel config={effectiveConfig} checklist={checklist} />
                <RosNodeStatus
                    rosGraph={rosGraph}
                    requiredNodes={effectiveConfig.requiredNodes}
                    requiredServices={effectiveConfig.requiredServices}
                    launchBlockReasons={checklist.launchBlockReasons}
                />
                <RosNodeOverview
                    rosGraph={rosGraph}
                    expectedNodes={effectiveConfig.expectedNodes}
                />
                <CameraFeed
                    config={launchChecklistConfig.camera}
                    availableTopics={rosGraph.runningTopics}
                    forceTestPattern={noHardwareMode && simCameraEnabled}
                />
                <ThrusterSpinPanel
                    config={effectiveConfig}
                    availableTopics={rosGraph.runningTopics}
                    availableServices={rosGraph.runningServices}
                />
            </main>
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
        </div>
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
