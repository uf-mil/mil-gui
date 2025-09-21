import { useCallback, useState } from 'react';
import * as ROSLIB from 'roslib';
import { useRos } from '../components/RosContext';

type ServiceResponse<T> = {
    success: boolean;
    data: T | null;
    error: string | null;
    isLoading: boolean;
};

type ServiceHookReturn<TRequest, TResponse> = [
    (request: TRequest) => Promise<void>,
    ServiceResponse<TResponse>
];

export function useService<TRequest = any, TResponse = any>(
    serviceName: string,
    serviceType: string
): ServiceHookReturn<TRequest, TResponse> {
    const { ros } = useRos();
    const [response, setResponse] = useState<ServiceResponse<TResponse>>({
        success: false,
        data: null,
        error: null,
        isLoading: false,
    });

    const callService = useCallback(async (request: TRequest) => {
        if (!ros || !ros.isConnected) {
            setResponse({
                success: false,
                data: null,
                error: 'ROS is not connected',
                isLoading: false,
            });
            return;
        }

        setResponse(prev => ({ ...prev, isLoading: true }));

        try {
            const service = new ROSLIB.Service({
                ros: ros,
                name: serviceName,
                serviceType: serviceType,
            });

            const serviceRequest = new ROSLIB.ServiceRequest(request);

            return new Promise<void>((resolve, reject) => {
                service.callService(serviceRequest, (result: TResponse) => {
                    setResponse({
                        success: true,
                        data: result,
                        error: null,
                        isLoading: false,
                    });
                    resolve();
                }, (error: any) => {
                    setResponse({
                        success: false,
                        data: null,
                        error: error.message || 'Service call failed',
                        isLoading: false,
                    });
                    reject(error);
                });
            });
        } catch (error: any) {
            setResponse({
                success: false,
                data: null,
                error: error.message || 'Failed to create service',
                isLoading: false,
            });
        }
    }, [ros, serviceName, serviceType]);

    return [callService, response];
}