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

function isValidRosMessageType(type: string): boolean {
    const value = type.trim();
    return value.length > 0 && value.includes('/');
}

function buildTestPatternDataUrl(): string {
    const now = new Date().toLocaleTimeString();
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d3b66" />
      <stop offset="100%" stop-color="#1f7a8c" />
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#g)" />
  <rect x="60" y="60" width="1160" height="600" fill="none" stroke="#d4f1f9" stroke-width="6" />
  <text x="640" y="330" text-anchor="middle" font-size="56" fill="#ffffff" font-family="Segoe UI">Camera Test Pattern</text>
  <text x="640" y="395" text-anchor="middle" font-size="34" fill="#d4f1f9" font-family="Segoe UI">${now}</text>
  <text x="640" y="455" text-anchor="middle" font-size="26" fill="#d4f1f9" font-family="Segoe UI">ROS camera topic is unavailable</text>
</svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
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
    const [testPatternEnabled, setTestPatternEnabled] = useState<boolean>(false);

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
        if (testPatternEnabled) {
            setStreamMessage('Displaying local test pattern');
            setImageData(buildTestPatternDataUrl());
            setFps(0);
            setLatencyMs(null);
            return;
        }

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
        if (!isValidRosMessageType(activeTopicType)) {
            setStreamMessage('Invalid ROS message type. Expected package/msg/Type');
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
    }, [activeTopicName, activeTopicType, connected, ros, streamEnabled, testPatternEnabled]);

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
                {config.enableTestPattern && (
                    <button
                        onClick={() => setTestPatternEnabled((previous) => !previous)}
                        className={testPatternEnabled ? 'secondary-button active' : 'secondary-button'}
                    >
                        {testPatternEnabled ? 'Disable Test Pattern' : 'Enable Test Pattern'}
                    </button>
                )}
            </div>

            <div className="camera-status-row">
                <span className={`status-pill ${streamEnabled && connected ? 'ok' : 'warn'}`}>
                    Stream: {streamEnabled && connected ? 'RUNNING' : 'STOPPED'}
                </span>
                <span className={`status-pill ${testPatternEnabled ? 'warn' : 'neutral'}`}>
                    Test Pattern: {testPatternEnabled ? 'ON' : 'OFF'}
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
