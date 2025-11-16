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
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const enabledColors = {
        base: '#28a745',    // Green
        hover: '#218838'    // Darker Green
    };
    const disabledColors = {
        base: '#dc3545',    // Red
        hover: '#a72d3a'    // Darker Red (Maroon)
    };
    const baseButtonStyle: React.CSSProperties = {
        marginBottom: '15px',
        backgroundColor: isCameraEnabled ? disabledColors.base : enabledColors.base,
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '10px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '16px',
        boxShadow: 'none',
        transition: 'background-color 0.2s ease, box-shadow 0.2s ease', 
    };
    const hoverButtonStyle: React.CSSProperties = {
        backgroundColor: isCameraEnabled ? disabledColors.hover : enabledColors.hover,
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        transform: 'translateY(-3px)',
        transition: 'all 0.2s ease-in-out'
    };

    // TODO: Subscribe to the camera topic

    return (
        <div>
            <h3>{cameraLabel}</h3>
            <button 
                onClick={() => setIsCameraEnabled(!isCameraEnabled)} 
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                // 5. Conditionally merge the styles
                style={{ 
                    ...baseButtonStyle, 
                    ...(isHovering ? hoverButtonStyle : {}) 
                }}          >
                {isCameraEnabled ? 'Disable Camera' : 'Enable Camera'}
            </button>
            
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
