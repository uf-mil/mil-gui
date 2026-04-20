import React, { useMemo } from 'react';
import { RequiredServiceSpec } from '../config/launchChecklistConfig';
import { RosGraphState } from '../hooks/useRosGraph';

interface RosDependencyPanelProps {
    rosGraph: RosGraphState;
    requiredNodes: string[];
    requiredServices: RequiredServiceSpec[];
    launchBlockReasons: string[];
}

function renderList(items: string[], emptyText: string): React.ReactNode {
    if (items.length === 0) {
        return <li>{emptyText}</li>;
    }

    return (
        <>
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </>
    );
}

function RosNodeStatus({
    rosGraph,
    requiredNodes,
    requiredServices,
    launchBlockReasons,
}: RosDependencyPanelProps) {
    const runningRequiredNodes = useMemo(
        () => requiredNodes.filter((node) => !rosGraph.missingRequiredNodes.includes(node)),
        [requiredNodes, rosGraph.missingRequiredNodes]
    );

    const missingRequiredServiceLabels = useMemo(
        () => requiredServices
            .filter((service) => rosGraph.missingRequiredServices.includes(service.name))
            .map((service) => `${service.label} (${service.name})`),
        [requiredServices, rosGraph.missingRequiredServices]
    );

    const graphRefreshLabel = rosGraph.lastUpdatedMs === null
        ? 'Not yet refreshed'
        : new Date(rosGraph.lastUpdatedMs).toLocaleString();

    return (
        <div className="dependency-panel">
            <div className="panel-header-row">
                <h2>Node and Dependency Status</h2>
                <span className="status-pill neutral">Graph Refresh: {graphRefreshLabel}</span>
            </div>

            <div className="dependency-grid">
                <div className="dependency-card running">
                    <h3>Required Nodes Running</h3>
                    <ul>
                        {renderList(runningRequiredNodes, 'No required nodes are running')}
                    </ul>
                </div>

                <div className="dependency-card missing">
                    <h3>Missing Required Nodes</h3>
                    <ul>
                        {renderList(rosGraph.missingRequiredNodes, 'All required nodes are running')}
                    </ul>
                </div>

                <div className="dependency-card missing-service">
                    <h3>Missing Required Services</h3>
                    <ul>
                        {renderList(missingRequiredServiceLabels, 'All required services are available')}
                    </ul>
                </div>

                <div className="dependency-card unexpected">
                    <h3>Unexpected Nodes</h3>
                    <ul>
                        {renderList(rosGraph.unexpectedNodes, 'No unexpected nodes')}
                    </ul>
                </div>
            </div>

            <div className="dependency-blockers">
                <h3>Why Launch Sub is Blocked</h3>
                <ul>
                    {renderList(launchBlockReasons, 'No blockers detected. Launch Sub can proceed.')}
                </ul>
            </div>
        </div>
    );
}

export default RosNodeStatus;
