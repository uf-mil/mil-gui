import React, { useMemo } from 'react';
import { RosGraphState } from '../hooks/useRosGraph';

interface RosNodeOverviewProps {
    rosGraph: RosGraphState;
    expectedNodes: string[];
}

function normalizeName(name: string): string {
    return name.startsWith('/') ? name.slice(1) : name;
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

function RosNodeOverview({ rosGraph, expectedNodes }: RosNodeOverviewProps) {
    const expectedSet = useMemo(
        () => new Set(expectedNodes.map(normalizeName)),
        [expectedNodes]
    );

    const runningExpected = useMemo(
        () => expectedNodes.filter((name) => {
            const normalized = normalizeName(name);
            return rosGraph.runningNodes.some((node) => normalizeName(node) === normalized);
        }),
        [expectedNodes, rosGraph.runningNodes]
    );

    const missingExpected = useMemo(
        () => expectedNodes.filter((name) => {
            const normalized = normalizeName(name);
            return !rosGraph.runningNodes.some((node) => normalizeName(node) === normalized);
        }),
        [expectedNodes, rosGraph.runningNodes]
    );

    const unexpected = useMemo(
        () => rosGraph.runningNodes.filter((node) => !expectedSet.has(normalizeName(node))),
        [expectedSet, rosGraph.runningNodes]
    );

    return (
        <section className="node-overview">
            <h2>Running Nodes Overview</h2>
            <div className="node-overview-grid">
                <div className="node-card good">
                    <h3>Expected + Running</h3>
                    <ul>{renderList(runningExpected, 'No expected nodes are running')}</ul>
                </div>
                <div className="node-card bad">
                    <h3>Expected + Missing</h3>
                    <ul>{renderList(missingExpected, 'All expected nodes are running')}</ul>
                </div>
                <div className="node-card warn">
                    <h3>Unexpected Running</h3>
                    <ul>{renderList(unexpected, 'No unexpected nodes')}</ul>
                </div>
            </div>
        </section>
    );
}

export default RosNodeOverview;
