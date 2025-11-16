import React, { useState } from 'react';
import { useRos } from './RosContext';

interface CameraFeedProps {
    topicName?: string;
    cameraLabel?: string;
}

function CameraFeed({ 
    topicName = '/front_cam/image_compressed', 
    cameraLabel = 'Front Camera' 
}: CameraFeedProps) {
    const { ros, connected } = useRos();
    const [imageData, setImageData] = useState<string | null>(null);

    // TODO: Subscribe to the camera topic

    return (
        <div>
            <h3>{cameraLabel}</h3>
            
            {!connected && (
                <p style={{ color: 'gray' }}>📹 Waiting for camera feed...</p>
            )}
            
            {connected && !imageData && (
                <p style={{ color: 'gray' }}>📹 Waiting for camera feed...</p>
            )}
            
            {imageData && (
                <img 
                    src={imageData} 
                    alt={cameraLabel}
                    style={{ 
                        maxWidth: '100%', 
                        border: '1px solid #333',
                        borderRadius: '4px'
                    }} 
                />
            )}
            
            <div style={{ 
                backgroundColor: '#f0f0f0', 
                padding: '20px', 
                textAlign: 'center',
                color: '#666'
            }}>
                <p>🚧 Camera feed component placeholder</p>
                <p style={{ fontSize: '12px' }}>
                    This is where the camera feed will appear!
                    <br />
                    Next step: Implement topic subscription
                </p>
            </div>
        </div>
    );
}

export default CameraFeed;
