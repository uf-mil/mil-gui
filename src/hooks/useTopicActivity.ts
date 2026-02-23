import { useEffect, useMemo, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { useRos } from '../components/RosContext';
import { TopicSpec } from '../config/launchChecklistConfig';

export interface TopicActivity {
    name: string;
    type: string;
    label?: string;
    hz: number;
    lastMessageMs: number | null;
    ageSec: number | null;
    lastMessage: Record<string, unknown> | null;
}

type TopicActivityMap = Record<string, TopicActivity>;

const HZ_WINDOW_SIZE = 10;

function emptyActivity(spec: TopicSpec): TopicActivity {
    return {
        name: spec.name,
        type: spec.type,
        label: spec.label,
        hz: 0,
        lastMessageMs: null,
        ageSec: null,
        lastMessage: null,
    };
}

export function useTopicActivity(specs: TopicSpec[]): TopicActivity[] {
    const { ros, connected } = useRos();

    const [activityMap, setActivityMap] = useState<TopicActivityMap>({});
    const [nowMs, setNowMs] = useState<number>(Date.now());
    const timeWindowsRef = useRef<Record<string, number[]>>({});

    useEffect(() => {
        const intervalRef: ReturnType<typeof setInterval> = setInterval(() => {
            setNowMs(Date.now());
        }, 250);

        return () => {
            clearInterval(intervalRef);
        };
    }, []);

    useEffect(() => {
        const nextMap: TopicActivityMap = {};
        for (const spec of specs) {
            nextMap[spec.name] = emptyActivity(spec);
        }
        setActivityMap(nextMap);
        timeWindowsRef.current = {};
    }, [specs]);

    useEffect(() => {
        if (!connected || !ros || !ros.isConnected || specs.length === 0) {
            return;
        }

        const topics: ROSLIB.Topic[] = specs.map((spec) => new ROSLIB.Topic({
            ros,
            name: spec.name,
            messageType: spec.type,
        }));

        topics.forEach((topic, index) => {
            const spec = specs[index];

            topic.subscribe((message: ROSLIB.Message) => {
                const now = Date.now();

                const windows = timeWindowsRef.current[spec.name] ?? [];
                windows.push(now);
                while (windows.length > HZ_WINDOW_SIZE) {
                    windows.shift();
                }
                timeWindowsRef.current[spec.name] = windows;

                let hz = 0;
                if (windows.length >= 2) {
                    const deltas: number[] = [];
                    for (let i = 1; i < windows.length; i += 1) {
                        deltas.push(windows[i] - windows[i - 1]);
                    }

                    const totalDelta = deltas.reduce((total, delta) => total + delta, 0);
                    const avgDeltaSeconds = (totalDelta / deltas.length) / 1000;
                    const rawHz = avgDeltaSeconds > 0 ? 1 / avgDeltaSeconds : 0;
                    hz = Number.isFinite(rawHz) ? Number(rawHz.toFixed(2)) : 0;
                }

                setActivityMap((previous) => ({
                    ...previous,
                    [spec.name]: {
                        name: spec.name,
                        type: spec.type,
                        label: spec.label,
                        hz,
                        lastMessageMs: now,
                        ageSec: 0,
                        lastMessage: message as unknown as Record<string, unknown>,
                    },
                }));
            });
        });

        return () => {
            topics.forEach((topic) => {
                topic.unsubscribe();
                topic.unadvertise();
            });
        };
    }, [connected, ros, specs]);

    return useMemo(
        () => specs.map((spec) => {
            const activity = activityMap[spec.name] ?? emptyActivity(spec);
            if (activity.lastMessageMs === null) {
                return {
                    ...activity,
                    ageSec: null,
                };
            }

            return {
                ...activity,
                ageSec: Number(((nowMs - activity.lastMessageMs) / 1000).toFixed(2)),
            };
        }),
        [activityMap, nowMs, specs]
    );
}
