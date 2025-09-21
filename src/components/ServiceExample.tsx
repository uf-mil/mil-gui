import React, { useState } from 'react';
import { useService } from '../hooks/useService';

// Example ROS service request/response types
interface TriggerRequest {
    // Empty request type
}

interface TriggerResponse {
    success: boolean;
    message: string;
}

function ServiceExample() {
    const [callService, { data, error, isLoading }] = useService<TriggerRequest, TriggerResponse>(
        '/example_service',  // Replace with your actual service name
        'std_srvs/Trigger'  // Replace with your actual service type
    );

    const handleServiceCall = async () => {
        try {
            await callService({});  // Empty request for Trigger service
            console.log('Service call successful:', data);
        } catch (err) {
            console.error('Service call failed:', err);
        }
    };

    return (
        <div>
            <h2>ROS Service Example</h2>
            <button 
                onClick={handleServiceCall}
                disabled={isLoading}
            >
                {isLoading ? 'Calling Service...' : 'Call Service'}
            </button>

            {error && (
                <div style={{ color: 'red', marginTop: '1rem' }}>
                    Error: {error}
                </div>
            )}

            {data && (
                <div style={{ marginTop: '1rem' }}>
                    <h3>Response:</h3>
                    <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

export default ServiceExample;