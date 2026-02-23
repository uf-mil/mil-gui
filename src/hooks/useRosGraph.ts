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
                    setRunningNodes(sortUnique(nodes));
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
                    setRunningServices(sortUnique(services));
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
                    setRunningTopics(parseTopicsResult(topicsResult));
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
        () => config.requiredNodes.filter((nodeName) => !runningNodes.includes(nodeName)),
        [config.requiredNodes, runningNodes]
    );

    const requiredServiceNames = useMemo(
        () => config.requiredServices.filter((service) => service.requiredForLaunch !== false).map((service) => service.name),
        [config.requiredServices]
    );

    const missingRequiredServices = useMemo(
        () => requiredServiceNames.filter((serviceName) => !runningServices.includes(serviceName)),
        [requiredServiceNames, runningServices]
    );

    const topicNameSet = useMemo(
        () => new Set(runningTopics.map((topic) => topic.name)),
        [runningTopics]
    );

    const missingRequiredTopics = useMemo(
        () => config.requiredTopics.filter((topic) => !topicNameSet.has(topic.name)).map((topic) => topic.name),
        [config.requiredTopics, topicNameSet]
    );

    const unexpectedNodes = useMemo(
        () => runningNodes.filter((nodeName) => !config.requiredNodes.includes(nodeName)),
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
