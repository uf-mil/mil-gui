import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ROSLIB from 'roslib';
import { useRos } from './RosContext';
import { LaunchChecklistConfig, TopicSpec } from '../config/launchChecklistConfig';
import { useService } from '../hooks/useService';
import { useTopicActivity } from '../hooks/useTopicActivity';
import { RosTopicInfo } from '../hooks/useRosGraph';

interface ThrusterSpinPanelProps {
    config: LaunchChecklistConfig;
    availableTopics: RosTopicInfo[];
}

function createZeroWrenchMessage(): Record<string, Record<string, number>> {
    return {
        force: { x: 0, y: 0, z: 0 },
        torque: { x: 0, y: 0, z: 0 },
    };
}

function isValidRosMessageType(type: string): boolean {
    const value = type.trim();
    return value.length > 0 && value.includes('/');
}

function resolveTopicSpec(spec: TopicSpec, availableTopicsByName: Map<string, string>): TopicSpec | null {
    const discoveredType = availableTopicsByName.get(spec.name);
    const resolvedType = discoveredType ?? spec.type;

    if (!isValidRosMessageType(resolvedType)) {
        return null;
    }

    return {
        ...spec,
        type: resolvedType,
    };
}

function ThrusterSpinPanel({ config, availableTopics }: ThrusterSpinPanelProps) {
    const { ros, connected } = useRos();

    const [callKill, killService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.kill.name,
        config.actions.kill.type
    );

    const availableTopicsByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const topic of availableTopics) {
            map.set(topic.name, topic.type);
        }
        return map;
    }, [availableTopics]);

    const resolvedThrusterTopic = useMemo(
        () => resolveTopicSpec(config.thrusters.topic, availableTopicsByName),
        [availableTopicsByName, config.thrusters.topic]
    );
    const resolvedZeroWrenchTopic = useMemo(
        () => resolveTopicSpec(config.thrusters.zeroWrenchTopic, availableTopicsByName),
        [availableTopicsByName, config.thrusters.zeroWrenchTopic]
    );

    const thrusterActivity = useTopicActivity(
        resolvedThrusterTopic ? [resolvedThrusterTopic] : []
    )[0];

    const [selectedThrusters, setSelectedThrusters] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        for (const name of config.thrusters.names) {
            initial[name] = false;
        }
        return initial;
    });
    const [effort, setEffort] = useState<number>(0.15);
    const [durationSeconds, setDurationSeconds] = useState<number>(1.0);
    const [statusMessage, setStatusMessage] = useState<string>('Idle');
    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [timeRemainingSec, setTimeRemainingSec] = useState<number>(0);

    const thrusterTopicRef = useRef<ROSLIB.Topic | null>(null);
    const zeroWrenchTopicRef = useRef<ROSLIB.Topic | null>(null);
    const publishIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startedAtRef = useRef<number | null>(null);

    useEffect(() => {
        if (!connected || !ros || !ros.isConnected || !resolvedThrusterTopic || !resolvedZeroWrenchTopic) {
            return;
        }

        thrusterTopicRef.current = new ROSLIB.Topic({
            ros,
            name: resolvedThrusterTopic.name,
            messageType: resolvedThrusterTopic.type,
        });

        zeroWrenchTopicRef.current = new ROSLIB.Topic({
            ros,
            name: resolvedZeroWrenchTopic.name,
            messageType: resolvedZeroWrenchTopic.type,
        });

        return () => {
            if (thrusterTopicRef.current) {
                thrusterTopicRef.current.unadvertise();
                thrusterTopicRef.current = null;
            }

            if (zeroWrenchTopicRef.current) {
                zeroWrenchTopicRef.current.unadvertise();
                zeroWrenchTopicRef.current = null;
            }
        };
    }, [connected, resolvedThrusterTopic, resolvedZeroWrenchTopic, ros]);

    const selectedCount = useMemo(
        () => Object.values(selectedThrusters).filter(Boolean).length,
        [selectedThrusters]
    );

    const createEffortMessage = useCallback((effortValue: number): Record<string, number> => {
        const message: Record<string, number> = {};
        for (const name of config.thrusters.names) {
            message[name] = selectedThrusters[name] ? effortValue : 0;
        }
        return message;
    }, [config.thrusters.names, selectedThrusters]);

    const publishEfforts = useCallback((effortValue: number) => {
        if (!thrusterTopicRef.current || !connected) {
            return;
        }
        const message = new ROSLIB.Message(createEffortMessage(effortValue));
        thrusterTopicRef.current.publish(message);
    }, [connected, createEffortMessage]);

    const publishZeroWrench = useCallback(() => {
        if (!zeroWrenchTopicRef.current || !connected) {
            return;
        }
        zeroWrenchTopicRef.current.publish(new ROSLIB.Message(createZeroWrenchMessage()));
    }, [connected]);

    const clearSpinTimers = useCallback(() => {
        if (publishIntervalRef.current) {
            clearInterval(publishIntervalRef.current);
            publishIntervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        startedAtRef.current = null;
    }, []);

    const stopSpin = useCallback(() => {
        clearSpinTimers();
        publishEfforts(0);
        publishZeroWrench();
        setIsSpinning(false);
        setTimeRemainingSec(0);
        setStatusMessage('Spin stopped. Sent zero efforts and zero wrench.');
    }, [clearSpinTimers, publishEfforts, publishZeroWrench]);

    useEffect(() => {
        return () => {
            clearSpinTimers();
        };
    }, [clearSpinTimers]);

    const startSpin = () => {
        const boundedDuration = Math.min(config.thrusters.maxDurationSeconds, Math.max(0.1, durationSeconds));

        if (!connected || !thrusterTopicRef.current || !resolvedThrusterTopic || !resolvedZeroWrenchTopic) {
            setStatusMessage('Cannot start spin: thruster topic/type is unavailable');
            return;
        }

        if (selectedCount === 0) {
            setStatusMessage('Select at least one thruster before starting');
            return;
        }

        const selectedNames = config.thrusters.names.filter((name) => selectedThrusters[name]);
        const confirmed = window.confirm(
            `Spin ${selectedNames.join(', ')} at effort ${effort.toFixed(2)} for ${boundedDuration.toFixed(1)}s?`
        );

        if (!confirmed) {
            return;
        }

        clearSpinTimers();
        setIsSpinning(true);
        setTimeRemainingSec(boundedDuration);
        setStatusMessage('Thruster spin test active');
        startedAtRef.current = Date.now();

        publishEfforts(effort);

        publishIntervalRef.current = setInterval(() => {
            publishEfforts(effort);

            if (startedAtRef.current !== null) {
                const elapsedSec = (Date.now() - startedAtRef.current) / 1000;
                const remaining = Math.max(0, boundedDuration - elapsedSec);
                setTimeRemainingSec(Number(remaining.toFixed(2)));
            }
        }, 100);

        timeoutRef.current = setTimeout(() => {
            stopSpin();
            setStatusMessage('Spin duration elapsed. Sent zero commands.');
        }, boundedDuration * 1000);
    };

    const triggerKill = async () => {
        try {
            await callKill(config.actions.kill.request ?? {});
            setStatusMessage('Kill service called successfully');
            stopSpin();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Kill service failed';
            setStatusMessage(`Kill failed: ${message}`);
        }
    };

    return (
        <section className="thruster-panel">
            <h2>Thruster Spin Test</h2>
            <p className="checklist-subtext">
                Safety-gated test: select thrusters, set effort and duration, confirm, then spin.
            </p>

            <div className="thruster-controls">
                <label>
                    Effort (-1 to 1)
                    <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={effort}
                        onChange={(event) => setEffort(Number(event.target.value))}
                    />
                    <span>{effort.toFixed(2)}</span>
                </label>

                <label>
                    Duration (s, max {config.thrusters.maxDurationSeconds})
                    <input
                        type="number"
                        min={0.1}
                        max={config.thrusters.maxDurationSeconds}
                        step={0.1}
                        value={durationSeconds}
                        onChange={(event) => {
                            const value = Number(event.target.value);
                            setDurationSeconds(Number.isFinite(value) ? value : 0.1);
                        }}
                    />
                </label>
            </div>

            <div className="thruster-selection-grid">
                {config.thrusters.names.map((name) => (
                    <label key={name} className="thruster-checkbox">
                        <input
                            type="checkbox"
                            checked={selectedThrusters[name]}
                            onChange={(event) => {
                                setSelectedThrusters((previous) => ({
                                    ...previous,
                                    [name]: event.target.checked,
                                }));
                            }}
                        />
                        {name}
                    </label>
                ))}
            </div>

            <div className="thruster-actions">
                <button
                    onClick={startSpin}
                    disabled={isSpinning || !connected || !resolvedThrusterTopic || !resolvedZeroWrenchTopic}
                >
                    Start Spin
                </button>
                <button onClick={stopSpin} disabled={!isSpinning}>
                    STOP
                </button>
                <button className="kill-button" onClick={triggerKill} disabled={killService.isLoading}>
                    KILL
                </button>
            </div>

            <div className="thruster-feedback">
                <p>Status: {statusMessage}</p>
                <p>
                    Resolved thruster topic type: {resolvedThrusterTopic?.type ?? 'unresolved'}
                </p>
                {(!resolvedThrusterTopic || !resolvedZeroWrenchTopic) && (
                    <p className="step-error">
                        Thruster test disabled: could not resolve topic types from ROS graph.
                    </p>
                )}
                {isSpinning && <p>Time remaining: {timeRemainingSec.toFixed(2)}s</p>}
                <p>
                    Thruster topic activity: {thrusterActivity?.ageSec !== null && thrusterActivity?.ageSec !== undefined
                        ? `${thrusterActivity.ageSec.toFixed(2)}s ago`
                        : 'No recent message'}
                </p>
                <p>Thruster topic hz: {thrusterActivity?.hz?.toFixed(2) ?? '0.00'}</p>
                {killService.error && <p className="step-error">Kill error: {killService.error}</p>}
            </div>
        </section>
    );
}

export default ThrusterSpinPanel;
