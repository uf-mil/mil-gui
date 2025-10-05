import React, { useState, useEffect } from 'react';
import { useService } from '../hooks/useService';
import { useTopic } from '../hooks/useTopic';
import { Odometry } from '../ros_msg_types/nav_msgs';

// Service request/response types for std_srvs
interface EmptyRequest {}
interface EmptyResponse {}

interface SetBoolRequest {
    data: boolean;
}

interface SetBoolResponse {
    success: boolean;
    message: string;
}

type SubLiveState = 'idle' | 'enabling_localization' | 'waiting_for_odometry' | 'resetting_localization' | 'enabling_controller' | 'complete' | 'error';

function MakeSubLive() {
    const [state, setState] = useState<SubLiveState>('idle');
    const [statusMessage, setStatusMessage] = useState<string>('');

    // Monitor odometry topic to check if localization is running
    const [odometryMsg, odometryHz, _] = useTopic<Odometry>('/odometry/filtered', 'nav_msgs/Odometry');

    // Service hooks
    const [enableLocalization, enableLocalizationResult] = useService<EmptyRequest, EmptyResponse>( '/subjugator_localization/enable', 'std_srvs/srv/Empty' );
    const [resetLocalization, resetLocalizationResult] = useService<EmptyRequest, EmptyResponse>( '/subjugator_localization/reset', 'std_srvs/srv/Empty' );
    const [enableController, enableControllerResult] = useService<SetBoolRequest, SetBoolResponse>( '/pid_controller/enable', 'std_srvs/srv/SetBool' );

    // Check if localization is already running
    const isLocalizationRunning = odometryHz > 0;
    // Reset state when localization starts running
    useEffect(() => { 
        if (isLocalizationRunning && state === 'idle') {
             setStatusMessage('Localization is already running'); 
        } 
    }, [isLocalizationRunning, state]);

    const handleMakeSubLive = async () => {
        if (isLocalizationRunning) {
            setStatusMessage('Cannot start - localization is already running'); 
            return;
        }
        try {
            // Step 1: Enable localization
            setState('enabling_localization');
            setStatusMessage('Enabling localization...');
            await enableLocalization({});
            if (enableLocalizationResult.error) {
                throw new Error(`Failed to enable localization: ${enableLocalizationResult.error}`);
            }

            // Step 2: Wait for odometry to start publishing
            setState('waiting_for_odometry');
            setStatusMessage('Waiting for localization to start...');
            await waitForOdometry();

            // Step 3: Reset localization
            setState('resetting_localization');
            setStatusMessage('Resetting localization...');
            await resetLocalization({});
            if (resetLocalizationResult.error) {
                throw new Error(`Failed to reset localization: ${resetLocalizationResult.error}`);
            }
            
            //Wait ~1 second for reset to complete
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Step 4: Enable controller
            setState('enabling_controller');
            setStatusMessage('Enabling controller...');
            await enableController({ data: true });
            if (enableControllerResult.error || !enableControllerResult.data?.success) {
                throw new Error(`Failed to enable controller: ${enableControllerResult.error || enableControllerResult.data?.message}`);
            }

            setState('complete');
            setStatusMessage('Sub is live!');

            // Reset to idle after 3 seconds
            setTimeout(() => {
                setState('idle');
                setStatusMessage('');
            }, 3000);
        }
        catch (error: any) {
            setState('error');
            setStatusMessage(`Error: ${error.message}`);

            // Reset to idle after 5 seconds
            setTimeout(() => {
                setState('idle');
                setStatusMessage('');
            }, 5000);
        }
    };

    const waitForOdometry = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (odometryHz > 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 500); //check every 500ms

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Timeout waiting for localization to start'));
            }, 30000);
        });
    };

    const isButtonDisabled = isLocalizationRunning || state !== 'idle';
    const isProcessing = state !== 'idle' && state !== 'error' && state !== 'complete';

    return <div>Make Sub Live Component - TODO: Add styling</div>;
}

export default MakeSubLive;