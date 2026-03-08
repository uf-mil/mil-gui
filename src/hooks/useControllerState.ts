import { useMemo } from 'react';
import { LaunchChecklistConfig } from '../config/launchChecklistConfig';
import { useTopicActivity } from './useTopicActivity';

export type ControllerSource = 'heartbeat' | 'command' | 'unknown';

export interface ControllerState {
    isOn: boolean;
    source: ControllerSource;
    mode: string | null;
    lastHeartbeatAgeSec: number | null;
    lastCommandAgeSec: number | null;
    detail: string;
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

export function useControllerState(config: LaunchChecklistConfig['controller']): ControllerState {
    const heartbeatSpecs = useMemo(
        () => (config.heartbeatTopic ? [config.heartbeatTopic] : []),
        [config.heartbeatTopic]
    );
    const modeSpecs = useMemo(
        () => (config.modeTopic ? [config.modeTopic] : []),
        [config.modeTopic]
    );

    const heartbeatActivity = useTopicActivity(heartbeatSpecs)[0];
    const modeActivity = useTopicActivity(modeSpecs)[0];
    const commandActivities = useTopicActivity(config.commandTopics);

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
            };
        }

        return {
            isOn: false,
            source: 'unknown' as const,
            mode,
            lastHeartbeatAgeSec: heartbeatAgeSec,
            lastCommandAgeSec: null,
            detail: 'No heartbeat/mode or command activity available',
        };
    }, [commandActivities, config.onAgeThresholdSec, heartbeatActivity, modeActivity]);
}
