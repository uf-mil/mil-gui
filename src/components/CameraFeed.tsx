import React, { useEffect, useMemo, useState } from 'react';
import ROSLIB from 'roslib';
import { useRos } from './RosContext';
import { LaunchChecklistConfig, launchChecklistConfig } from '../config/launchChecklistConfig';
import { RosTopicInfo } from '../hooks/useRosGraph';

interface CameraFeedProps {
    config?: LaunchChecklistConfig['camera'];
    availableTopics?: RosTopicInfo[];
}

function getStampMs(message: Record<string, unknown>): number | null {
    const header = message.header;
    if (!header || typeof header !== 'object') {
        return null;
    }

    const stamp = (header as { stamp?: unknown }).stamp;
    if (!stamp || typeof stamp !== 'object') {
        return null;
    }

    const secCandidate = (stamp as { sec?: unknown; secs?: unknown }).sec
        ?? (stamp as { sec?: unknown; secs?: unknown }).secs;
    const nsecCandidate = (stamp as { nanosec?: unknown; nsecs?: unknown }).nanosec
        ?? (stamp as { nanosec?: unknown; nsecs?: unknown }).nsecs;

    if (typeof secCandidate !== 'number' || typeof nsecCandidate !== 'number') {
        return null;
    }

    return (secCandidate * 1000) + (nsecCandidate / 1_000_000);
}

function guessImageSource(message: Record<string, unknown>, messageType: string): string | null {
    const data = message.data;
    if (typeof data !== 'string') {
        return null;
    }

    const normalizedType = messageType.toLowerCase();
    if (normalizedType.includes('compressedimage') || normalizedType.includes('compressed')) {
        const format = typeof message.format === 'string' ? message.format.toLowerCase() : 'jpeg';
        const mime = format.includes('png') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${data}`;
    }

    return null;
}

function CameraFeed({
    config = launchChecklistConfig.camera,
    availableTopics = [],
}: CameraFeedProps) {
    const { ros, connected } = useRos();

    const [selectedTopicName, setSelectedTopicName] = useState<string>(config.defaultTopicName);
    const [manualTopicName, setManualTopicName] = useState<string>(config.defaultTopicName);
    const [manualTopicType, setManualTopicType] = useState<string>(config.defaultTopicType);
    const [streamEnabled, setStreamEnabled] = useState<boolean>(false);

    const [imageData, setImageData] = useState<string | null>(null);
    const [fps, setFps] = useState<number>(0);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [streamMessage, setStreamMessage] = useState<string>('Stream stopped');

    const topicTypesByName = useMemo(() => {
        const map = new Map<string, string>();
        for (const topic of availableTopics) {
            map.set(topic.name, topic.type);
        }
        return map;
    }, [availableTopics]);

    const cameraTopics = useMemo(
        () => availableTopics.filter((topic) => {
            const lower = topic.type.toLowerCase();
            return lower.includes('compressedimage') || lower.includes('image');
        }),
        [availableTopics]
    );

    const activeTopicName = manualTopicName.trim().length > 0 ? manualTopicName.trim() : selectedTopicName;
    const activeTopicType = manualTopicType.trim().length > 0
        ? manualTopicType.trim()
        : (topicTypesByName.get(activeTopicName) ?? config.defaultTopicType);

    useEffect(() => {
        if (!connected || !ros || !ros.isConnected || !streamEnabled) {
            setStreamMessage(connected ? 'Stream stopped' : 'ROS disconnected');
            setFps(0);
            setLatencyMs(null);
            if (!streamEnabled) {
                setImageData(null);
            }
            return;
        }

        if (!activeTopicName || !activeTopicType) {
            setStreamMessage('Topic name/type is required');
            return;
        }

        const topic = new ROSLIB.Topic({
            ros,
            name: activeTopicName,
            messageType: activeTopicType,
        });

        let lastFrameAtMs: number | null = null;

        setStreamMessage('Waiting for camera frames...');

        topic.subscribe((rawMessage: ROSLIB.Message) => {
            const nowMs = Date.now();
            const message = rawMessage as unknown as Record<string, unknown>;

            if (lastFrameAtMs !== null) {
                const deltaSeconds = (nowMs - lastFrameAtMs) / 1000;
                if (deltaSeconds > 0) {
                    setFps(Number((1 / deltaSeconds).toFixed(2)));
                }
            }
            lastFrameAtMs = nowMs;

            const inferredImage = guessImageSource(message, activeTopicType);
            if (inferredImage) {
                setImageData(inferredImage);
                setStreamMessage('Streaming');
            } else {
                setStreamMessage('Unsupported image encoding. Use a compressed image topic.');
            }

            const stampMs = getStampMs(message);
            if (stampMs !== null) {
                setLatencyMs(Number((nowMs - stampMs).toFixed(1)));
            } else {
                setLatencyMs(null);
            }
        });

        return () => {
            topic.unsubscribe();
            topic.unadvertise();
        };
    }, [activeTopicName, activeTopicType, connected, ros, streamEnabled]);

    return (
        <section className="camera-panel">
            <h2>Camera Viewer</h2>

            <div className="camera-controls">
                <label>
                    Discovered camera topic
                    <select
                        value={selectedTopicName}
                        onChange={(event) => {
                            const nextTopic = event.target.value;
                            setSelectedTopicName(nextTopic);
                            setManualTopicName(nextTopic);
                            setManualTopicType(topicTypesByName.get(nextTopic) ?? config.defaultTopicType);
                        }}
                    >
                        {cameraTopics.length === 0 && <option value={config.defaultTopicName}>{config.defaultTopicName}</option>}
                        {cameraTopics.map((topic) => (
                            <option key={topic.name} value={topic.name}>
                                {topic.name} ({topic.type})
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Topic name
                    <input
                        value={manualTopicName}
                        onChange={(event) => setManualTopicName(event.target.value)}
                        placeholder={config.defaultTopicName}
                    />
                </label>

                <label>
                    Topic type
                    <input
                        value={manualTopicType}
                        onChange={(event) => setManualTopicType(event.target.value)}
                        placeholder={config.defaultTopicType}
                    />
                </label>

                <button onClick={() => setStreamEnabled((previous) => !previous)} disabled={!connected}>
                    {streamEnabled ? 'Disable Stream' : 'Enable Stream'}
                </button>
            </div>

            <div className="camera-status-row">
                <span className={`status-pill ${streamEnabled && connected ? 'ok' : 'warn'}`}>
                    Stream: {streamEnabled && connected ? 'RUNNING' : 'STOPPED'}
                </span>
                <span className="status-pill neutral">FPS: {fps.toFixed(2)}</span>
                <span className="status-pill neutral">Latency: {latencyMs !== null ? `${latencyMs}ms` : 'N/A'}</span>
            </div>

            <p className="camera-status-text">{streamMessage}</p>

            <div className="camera-frame-wrap">
                {imageData ? (
                    <img src={imageData} alt="Camera stream" className="camera-frame" />
                ) : (
                    <div className="camera-placeholder">No camera frame yet</div>
                )}
            </div>
        </section>
    );
}

export default CameraFeed;
