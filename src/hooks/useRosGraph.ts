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

export function useRosGraph(config: LaunchChecklistConfig): RosGraphState {
    const { ros, connected } = useRos();

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

    const missingRequiredNodes = useMemo(
        () => {
            const runningNodeSet = new Set(runningNodes.map(normalizeName));
            return config.requiredNodes.filter((nodeName) => !runningNodeSet.has(normalizeName(nodeName)));
        },
        [config.requiredNodes, runningNodes]
    );

    const requiredServiceNames = useMemo(
        () => config.requiredServices.filter((service) => service.requiredForLaunch !== false).map((service) => service.name),
        [config.requiredServices]
    );

    const missingRequiredServices = useMemo(
        () => {
            const runningServiceSet = new Set(runningServices.map(normalizeName));
            return requiredServiceNames.filter((serviceName) => !runningServiceSet.has(normalizeName(serviceName)));
        },
        [requiredServiceNames, runningServices]
    );

    const topicNameSet = useMemo(
        () => new Set(runningTopics.map((topic) => normalizeName(topic.name))),
        [runningTopics]
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
            return runningNodes.filter((nodeName) => !expectedSet.has(normalizeName(nodeName)));
        },
        [config.requiredNodes, runningNodes]
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
        runningNodes,
        runningServices,
        runningTopics,
        missingRequiredNodes,
        missingRequiredServices,
        missingRequiredTopics,
        unexpectedNodes,
        dependencyBlockReasons,
        lastUpdatedMs,
    };
}
