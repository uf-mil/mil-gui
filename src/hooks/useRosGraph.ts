import { useEffect, useMemo, useState } from 'react';
import { useRos } from '../components/RosContext';
import { LaunchChecklistConfig } from '../config/launchChecklistConfig';

export interface RosTopicInfo {
    name: string;
    type: string;
}

export interface RosGraphState {
    runningNodes: string[];
    runningServices: string[];
    runningTopics: RosTopicInfo[];
    missingRequiredNodes: string[];
    missingRequiredServices: string[];
    missingRequiredTopics: string[];
    unexpectedNodes: string[];
    dependencyBlockReasons: string[];
    lastUpdatedMs: number | null;
}

interface UseRosGraphOptions {
    mockMil2Mode?: boolean;
}

function sortUnique(items: string[]): string[] {
    return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
}

function normalizeName(name: string): string {
    return name.startsWith('/') ? name.slice(1) : name;
}

function equalStringArrays(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i += 1) {
        if (left[i] !== right[i]) {
            return false;
        }
    }
    return true;
}

function equalTopicArrays(left: RosTopicInfo[], right: RosTopicInfo[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    for (let i = 0; i < left.length; i += 1) {
        if (left[i].name !== right[i].name || left[i].type !== right[i].type) {
            return false;
        }
    }
    return true;
}

function parseTopicsResult(result: unknown): RosTopicInfo[] {
    if (!result || typeof result !== 'object') {
        return [];
    }

    const candidate = result as {
        topics?: unknown;
        types?: unknown;
    };

    const topics = Array.isArray(candidate.topics) ? candidate.topics : [];
    const types = Array.isArray(candidate.types) ? candidate.types : [];

    return topics
        .map((topicName, index) => {
            if (typeof topicName !== 'string') {
                return null;
            }
            const rawType = types[index];
            const type = typeof rawType === 'string' ? rawType : 'unknown';
            return {
                name: topicName,
                type,
            };
        })
        .filter((topic): topic is RosTopicInfo => topic !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
}

function isValidTopicType(type: string): boolean {
    const candidate = type.trim();
    return candidate.length > 0 && candidate.includes('/');
}

function getMockTopicType(name: string, type: string): string {
    if (isValidTopicType(type)) {
        return type;
    }

    switch (name) {
        case '/odometry/filtered':
            return 'nav_msgs/msg/Odometry';
        case '/cmd_wrench':
            return 'geometry_msgs/msg/Wrench';
        case '/thruster_efforts':
            return 'std_msgs/msg/Float64MultiArray';
        default:
            return 'std_msgs/msg/String';
    }
}

export function useRosGraph(config: LaunchChecklistConfig, options: UseRosGraphOptions = {}): RosGraphState {
    const { ros, connected } = useRos();
    const { mockMil2Mode = false } = options;

    const [runningNodes, setRunningNodes] = useState<string[]>([]);
    const [runningServices, setRunningServices] = useState<string[]>([]);
    const [runningTopics, setRunningTopics] = useState<RosTopicInfo[]>([]);
    const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);

    useEffect(() => {
        if (!connected || !ros || !ros.isConnected) {
            setRunningNodes([]);
            setRunningServices([]);
            setRunningTopics([]);
            setLastUpdatedMs(null);
            return;
        }

        let mounted = true;

        const poll = () => {
            ros.getNodes(
                (nodes: string[]) => {
                    if (!mounted) {
                        return;
                    }
                    const nextNodes = sortUnique(nodes);
                    setRunningNodes((previous) => equalStringArrays(previous, nextNodes) ? previous : nextNodes);
                    setLastUpdatedMs(Date.now());
                },
                (error: unknown) => {
                    console.error('[RosGraph] Failed to get nodes:', error);
                }
            );

            ros.getServices(
                (services: string[]) => {
                    if (!mounted) {
                        return;
                    }
                    const nextServices = sortUnique(services);
                    setRunningServices((previous) => equalStringArrays(previous, nextServices) ? previous : nextServices);
                    setLastUpdatedMs(Date.now());
                },
                (error: unknown) => {
                    console.error('[RosGraph] Failed to get services:', error);
                }
            );

            ros.getTopics(
                (topicsResult: unknown) => {
                    if (!mounted) {
                        return;
                    }
                    const nextTopics = parseTopicsResult(topicsResult);
                    setRunningTopics((previous) => equalTopicArrays(previous, nextTopics) ? previous : nextTopics);
                    setLastUpdatedMs(Date.now());
                },
                (error: unknown) => {
                    console.error('[RosGraph] Failed to get topics:', error);
                }
            );
        };

        poll();
        const intervalRef: ReturnType<typeof setInterval> = setInterval(poll, config.pollIntervalMs);

        return () => {
            mounted = false;
            clearInterval(intervalRef);
        };
    }, [connected, config.pollIntervalMs, ros]);

    const effectiveRunningNodes = useMemo(
        () => {
            if (!mockMil2Mode || !connected) {
                return runningNodes;
            }

            return sortUnique([
                ...runningNodes,
                ...config.requiredNodes,
                ...config.expectedNodes,
            ]);
        },
        [connected, config.expectedNodes, config.requiredNodes, mockMil2Mode, runningNodes]
    );

    const requiredServiceNames = useMemo(
        () => config.requiredServices.filter((service) => service.requiredForLaunch !== false).map((service) => service.name),
        [config.requiredServices]
    );

    const configuredActionServiceNames = useMemo(
        () => [
            config.actions.kill.name,
            config.actions.unkill.name,
            config.actions.startLocalization.name,
            config.actions.resetLocalization.name,
            config.actions.startController.name,
            config.actions.launchSub.name,
        ].filter((serviceName) => serviceName.trim().length > 0),
        [
            config.actions.kill.name,
            config.actions.launchSub.name,
            config.actions.resetLocalization.name,
            config.actions.startController.name,
            config.actions.startLocalization.name,
            config.actions.unkill.name,
        ]
    );

    const effectiveRunningServices = useMemo(
        () => {
            if (!mockMil2Mode || !connected) {
                return runningServices;
            }

            return sortUnique([
                ...runningServices,
                ...requiredServiceNames,
                ...configuredActionServiceNames,
            ]);
        },
        [configuredActionServiceNames, connected, mockMil2Mode, requiredServiceNames, runningServices]
    );

    const effectiveRunningTopics = useMemo(
        () => {
            if (!mockMil2Mode || !connected) {
                return runningTopics;
            }

            const topicMap = new Map<string, string>();
            for (const topic of runningTopics) {
                topicMap.set(topic.name, topic.type);
            }

            const addMockTopic = (name: string, type: string) => {
                if (topicMap.has(name)) {
                    return;
                }
                topicMap.set(name, getMockTopicType(name, type));
            };

            for (const topic of config.requiredTopics) {
                addMockTopic(topic.name, topic.type);
            }
            addMockTopic(config.localization.odomTopic.name, config.localization.odomTopic.type);

            for (const topic of config.controller.commandTopics) {
                addMockTopic(topic.name, topic.type);
            }

            addMockTopic(config.thrusters.topic.name, config.thrusters.topic.type);
            addMockTopic(config.thrusters.zeroWrenchTopic.name, config.thrusters.zeroWrenchTopic.type);

            return Array.from(topicMap.entries())
                .map(([name, type]) => ({ name, type }))
                .sort((a, b) => a.name.localeCompare(b.name));
        },
        [
            config.controller.commandTopics,
            config.localization.odomTopic.name,
            config.localization.odomTopic.type,
            config.requiredTopics,
            config.thrusters.topic.name,
            config.thrusters.topic.type,
            config.thrusters.zeroWrenchTopic.name,
            config.thrusters.zeroWrenchTopic.type,
            connected,
            mockMil2Mode,
            runningTopics,
        ]
    );

    const missingRequiredNodes = useMemo(
        () => {
            const runningNodeSet = new Set(effectiveRunningNodes.map(normalizeName));
            return config.requiredNodes.filter((nodeName) => !runningNodeSet.has(normalizeName(nodeName)));
        },
        [config.requiredNodes, effectiveRunningNodes]
    );

    const missingRequiredServices = useMemo(
        () => {
            const runningServiceSet = new Set(effectiveRunningServices.map(normalizeName));
            return requiredServiceNames.filter((serviceName) => !runningServiceSet.has(normalizeName(serviceName)));
        },
        [requiredServiceNames, effectiveRunningServices]
    );

    const topicNameSet = useMemo(
        () => new Set(effectiveRunningTopics.map((topic) => normalizeName(topic.name))),
        [effectiveRunningTopics]
    );

    const missingRequiredTopics = useMemo(
        () => config.requiredTopics
            .filter((topic) => !topicNameSet.has(normalizeName(topic.name)))
            .map((topic) => topic.name),
        [config.requiredTopics, topicNameSet]
    );

    const unexpectedNodes = useMemo(
        () => {
            const expectedSet = new Set(config.requiredNodes.map(normalizeName));
            return effectiveRunningNodes.filter((nodeName) => !expectedSet.has(normalizeName(nodeName)));
        },
        [config.requiredNodes, effectiveRunningNodes]
    );

    const dependencyBlockReasons = useMemo(() => {
        const reasons: string[] = [];

        for (const missingNode of missingRequiredNodes) {
            reasons.push(`Missing node: ${missingNode}`);
        }

        for (const missingService of missingRequiredServices) {
            reasons.push(`Missing service: ${missingService}`);
        }

        for (const missingTopic of missingRequiredTopics) {
            reasons.push(`Missing topic: ${missingTopic}`);
        }

        return reasons;
    }, [missingRequiredNodes, missingRequiredServices, missingRequiredTopics]);

    return {
        runningNodes: effectiveRunningNodes,
        runningServices: effectiveRunningServices,
        runningTopics: effectiveRunningTopics,
        missingRequiredNodes,
        missingRequiredServices,
        missingRequiredTopics,
        unexpectedNodes,
        dependencyBlockReasons,
        lastUpdatedMs,
    };
}
