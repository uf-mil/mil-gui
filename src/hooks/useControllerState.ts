import { useMemo } from 'react';
import { LaunchChecklistConfig, TopicSpec } from '../config/launchChecklistConfig';
import { RosTopicInfo } from './useRosGraph';
import { useTopicActivity } from './useTopicActivity';

export type ControllerSource = 'heartbeat' | 'command' | 'unknown';

export interface ControllerState {
    isOn: boolean;
    source: ControllerSource;
    mode: string | null;
    lastHeartbeatAgeSec: number | null;
    lastCommandAgeSec: number | null;
    detail: string;
    diagnostics: string[];
}

function extractBoolean(message: Record<string, unknown> | null): boolean | null {
    if (!message) {
        return null;
    }

    const data = message.data;
    if (typeof data === 'boolean') {
        return data;
    }

    if (typeof data === 'number') {
        return data !== 0;
    }

    if (typeof data === 'string') {
        const normalized = data.trim().toLowerCase();
        if (['true', 'on', 'enabled', 'running', 'armed', 'mission'].includes(normalized)) {
            return true;
        }
        if (['false', 'off', 'disabled', 'stopped', 'killed', 'idle'].includes(normalized)) {
            return false;
        }
    }

    if (typeof message.enabled === 'boolean') {
        return message.enabled;
    }

    if (typeof message.active === 'boolean') {
        return message.active;
    }

    return null;
}

function extractMode(message: Record<string, unknown> | null): string | null {
    if (!message) {
        return null;
    }

    if (typeof message.data === 'string') {
        return message.data;
    }

    if (typeof message.mode === 'string') {
        return message.mode;
    }

    return null;
}

function isValidRosMessageType(type: string): boolean {
    const value = type.trim();
    return value.length > 0 && value.includes('/');
}

function resolveTopicSpec(spec: TopicSpec | undefined, runningTopicsByName: Map<string, string>): TopicSpec | undefined {
    if (!spec) {
        return undefined;
    }

    const discoveredType = runningTopicsByName.get(spec.name);
    // Only subscribe to topics currently present in graph to avoid noisy subscribe churn.
    if (!discoveredType) {
        return undefined;
    }

    const resolvedType = discoveredType || spec.type;

    if (!isValidRosMessageType(resolvedType)) {
        return undefined;
    }

    return {
        ...spec,
        type: resolvedType,
    };
}

export function useControllerState(
    config: LaunchChecklistConfig['controller'],
    runningTopics: RosTopicInfo[]
): ControllerState {
    const runningTopicsByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const topic of runningTopics) {
            map.set(topic.name, topic.type);
        }
        return map;
    }, [runningTopics]);

    const resolvedHeartbeatTopic = useMemo(
        () => resolveTopicSpec(config.heartbeatTopic, runningTopicsByName),
        [config.heartbeatTopic, runningTopicsByName]
    );
    const resolvedModeTopic = useMemo(
        () => resolveTopicSpec(config.modeTopic, runningTopicsByName),
        [config.modeTopic, runningTopicsByName]
    );
    const resolvedCommandTopics = useMemo(
        () => config.commandTopics
            .map((topic) => resolveTopicSpec(topic, runningTopicsByName))
            .filter((topic): topic is TopicSpec => topic !== undefined),
        [config.commandTopics, runningTopicsByName]
    );

    const heartbeatSpecs = useMemo(
        () => (resolvedHeartbeatTopic ? [resolvedHeartbeatTopic] : []),
        [resolvedHeartbeatTopic]
    );
    const modeSpecs = useMemo(
        () => (resolvedModeTopic ? [resolvedModeTopic] : []),
        [resolvedModeTopic]
    );

    const heartbeatActivity = useTopicActivity(heartbeatSpecs)[0];
    const modeActivity = useTopicActivity(modeSpecs)[0];
    const commandActivities = useTopicActivity(resolvedCommandTopics);

    return useMemo(() => {
        const latestCommandAgeSec = commandActivities
            .map((activity) => activity.ageSec)
            .filter((age): age is number => age !== null)
            .sort((a, b) => a - b)[0] ?? null;

        const heartbeatAgeSec = heartbeatActivity?.ageSec ?? null;
        const heartbeatMessage = heartbeatActivity?.lastMessage ?? null;

        const heartbeatFresh = heartbeatAgeSec !== null && heartbeatAgeSec <= config.onAgeThresholdSec * 2;
        const heartbeatAvailable = heartbeatActivity !== undefined && heartbeatActivity.lastMessageMs !== null;

        const commandInferenceOn = latestCommandAgeSec !== null && latestCommandAgeSec <= config.onAgeThresholdSec;

        const mode = extractMode(modeActivity?.lastMessage ?? null);
        const diagnostics: string[] = [];

        const unresolvedCommandTopics = config.commandTopics.filter((topic) => {
            const discovered = runningTopicsByName.get(topic.name);
            const type = discovered ?? topic.type;
            return !isValidRosMessageType(type);
        });

        if (resolvedCommandTopics.length === 0) {
            diagnostics.push('Controller fallback command topics are not available yet.');
        }
        if (unresolvedCommandTopics.length > 0) {
            diagnostics.push(`Unresolved command topic type: ${unresolvedCommandTopics.map((topic) => topic.name).join(', ')}`);
        }

        if (heartbeatAvailable && heartbeatFresh) {
            const heartbeatValue = extractBoolean(heartbeatMessage);
            const isOn = heartbeatValue ?? true;
            const detail = heartbeatValue === null
                ? `Heartbeat active (${heartbeatAgeSec?.toFixed(2)}s ago)`
                : `Heartbeat ${isOn ? 'ON' : 'OFF'} (${heartbeatAgeSec?.toFixed(2)}s ago)`;

            return {
                isOn,
                source: 'heartbeat' as const,
                mode,
                lastHeartbeatAgeSec: heartbeatAgeSec,
                lastCommandAgeSec: latestCommandAgeSec,
                detail,
                diagnostics,
            };
        }

        if (latestCommandAgeSec !== null) {
            return {
                isOn: commandInferenceOn,
                source: 'command' as const,
                mode,
                lastHeartbeatAgeSec: heartbeatAgeSec,
                lastCommandAgeSec: latestCommandAgeSec,
                detail: `Command age ${latestCommandAgeSec.toFixed(2)}s`,
                diagnostics,
            };
        }

        return {
            isOn: false,
            source: 'unknown' as const,
            mode,
            lastHeartbeatAgeSec: heartbeatAgeSec,
            lastCommandAgeSec: null,
            detail: 'No heartbeat/mode or command activity available',
            diagnostics,
        };
    }, [
        commandActivities,
        config.commandTopics,
        config.onAgeThresholdSec,
        heartbeatActivity,
        modeActivity,
        resolvedCommandTopics.length,
        runningTopicsByName,
    ]);
}
