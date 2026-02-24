import React, { useState } from 'react';
import { LaunchChecklistConfig } from '../config/launchChecklistConfig';
import { ChecklistState } from '../hooks/useChecklistState';

interface LaunchChecklistPanelProps {
    config: LaunchChecklistConfig;
    checklist: ChecklistState;
}

function LaunchChecklistPanel({ config, checklist }: LaunchChecklistPanelProps) {
    const [actionMessage, setActionMessage] = useState<string>('');

    const runAction = async (label: string, fn: () => Promise<void>) => {
        try {
            await fn();
            setActionMessage(`${label} succeeded`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : `${label} failed`;
            setActionMessage(`${label} failed: ${message}`);
        }
    };

    const { stepState, controllerState, buttonStates, actionStates } = checklist;

    return (
        <section className="launch-checklist-panel">
            <div className="launch-status-row">
                <div className={`status-pill ${checklist.connected ? 'ok' : 'bad'}`}>
                    Comms: {checklist.connected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
                <div className={`status-pill ${stepState.killState === 'UNKILLED' ? 'ok' : 'warn'}`}>
                    Kill: {stepState.killState}
                </div>
                <div className={`status-pill ${controllerState.isOn ? 'ok' : 'bad'}`}>
                    Controller: {controllerState.isOn ? 'ON' : 'OFF'}
                </div>
                <div className="status-pill neutral">
                    Fault Summary: {checklist.launchBlockReasons.length}
                </div>
                <div className="status-pill neutral">
                    Source: {controllerState.source}
                </div>
                <div className="status-pill neutral">
                    Mode: {controllerState.mode ?? 'N/A'}
                </div>
                {controllerState.lastCommandAgeSec !== null && (
                    <div className="status-pill neutral">
                        Last Command Age: {controllerState.lastCommandAgeSec.toFixed(2)}s
                    </div>
                )}
            </div>
            {controllerState.diagnostics.length > 0 && (
                <ul className="info-list">
                    {controllerState.diagnostics.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            )}

            <h2>Launch the Sub Checklist</h2>
            <p className="checklist-subtext">
                Complete steps 1-4 manually. Launch Sub (step 5) is the final action and does not auto-run prerequisites.
            </p>

            <div className="checklist-steps">
                <div className="checklist-step">
                    <button
                        onClick={() => runAction('Unkill', checklist.handlers.unkill)}
                        disabled={buttonStates.unkillDisabled}
                    >
                        1. Unkill ({stepState.killState})
                    </button>
                    {actionStates.unkill.error && <span className="step-error">{actionStates.unkill.error}</span>}
                </div>

                <div className="checklist-step">
                    <button
                        onClick={() => runAction('Start Localization', checklist.handlers.startLocalization)}
                        disabled={buttonStates.startLocalizationDisabled}
                    >
                        2. Start Localization ({stepState.localizationRunning ? 'RUNNING' : 'STOPPED'})
                    </button>
                    <span className="step-meta">Localization Hz: {stepState.localizationHz.toFixed(2)}</span>
                    {actionStates.startLocalization.error && <span className="step-error">{actionStates.startLocalization.error}</span>}
                </div>

                <div className="checklist-step">
                    <button
                        onClick={() => {
                            const confirmed = window.confirm(
                                'Reset localization now? This action is safety-gated and can only be called once per localization start.'
                            );
                            if (!confirmed) {
                                return;
                            }
                            runAction('Reset Localization', checklist.handlers.resetLocalization);
                        }}
                        disabled={buttonStates.resetLocalizationDisabled}
                    >
                        3. Reset Localization ({stepState.resetDoneForCurrentCycle ? 'DONE' : 'PENDING'})
                    </button>
                    {stepState.resetDoneForCurrentCycle && !stepState.stabilizationReady && (
                        <span className="step-meta">
                            Stabilizing: {stepState.stabilizationElapsedSec.toFixed(2)} / {stepState.stabilizationRequiredSec}s
                        </span>
                    )}
                    {stepState.stabilizationReady && (
                        <span className="step-meta ok-text">
                            Localization stable for {config.localization.stableSeconds}s
                        </span>
                    )}
                    {actionStates.resetLocalization.error && <span className="step-error">{actionStates.resetLocalization.error}</span>}
                </div>

                <div className="checklist-step">
                    <button
                        onClick={() => runAction('Start Controller', checklist.handlers.startController)}
                        disabled={buttonStates.startControllerDisabled}
                    >
                        4. Start Controller ({controllerState.isOn ? 'RUNNING' : 'STOPPED'})
                    </button>
                    <span className="step-meta">{controllerState.detail}</span>
                    {actionStates.startController.error && <span className="step-error">{actionStates.startController.error}</span>}
                </div>

                <div className="checklist-step final">
                    <button
                        className="launch-button"
                        onClick={() => runAction('Launch Sub', checklist.handlers.launchSub)}
                        disabled={buttonStates.launchSubDisabled}
                    >
                        5. Launch Sub
                    </button>
                    {checklist.launchBlockReasons.length > 0 && (
                        <ul className="blocker-list">
                            {checklist.launchBlockReasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                            ))}
                        </ul>
                    )}
                    {actionStates.launchSub.error && <span className="step-error">{actionStates.launchSub.error}</span>}
                </div>
            </div>

            <div className="aux-actions">
                <button onClick={() => runAction('Kill', checklist.handlers.kill)} disabled={actionStates.kill.isLoading}>
                    Emergency Kill
                </button>
                {actionStates.kill.error && <span className="step-error">{actionStates.kill.error}</span>}
            </div>

            {actionMessage && <p className="action-message">{actionMessage}</p>}
        </section>
    );
}

export default LaunchChecklistPanel;
