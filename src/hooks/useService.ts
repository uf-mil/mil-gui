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
    (request: TRequest) => Promise<TResponse>,
    ServiceResponse<TResponse>
];

export function useService<TRequest = Record<string, unknown>, TResponse = Record<string, unknown>>(
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

    const callService = useCallback(async (request: TRequest): Promise<TResponse> => {
        if (!serviceName || !serviceType) {
            const errorMessage = 'Service is not configured';
            setResponse({
                success: false,
                data: null,
                error: errorMessage,
                isLoading: false,
            });
            throw new Error(errorMessage);
        }

        if (!ros || !ros.isConnected) {
            const errorMessage = 'ROS is not connected';
            setResponse({
                success: false,
                data: null,
                error: errorMessage,
                isLoading: false,
            });
            throw new Error(errorMessage);
        }

        setResponse((previous) => ({ ...previous, isLoading: true, error: null }));

        try {
            const service = new ROSLIB.Service({
                ros,
                name: serviceName,
                serviceType,
            });

            const serviceRequest = new ROSLIB.ServiceRequest(request as Record<string, unknown>);

            return await new Promise<TResponse>((resolve, reject) => {
                service.callService(
                    serviceRequest,
                    (result: TResponse) => {
                        setResponse({
                            success: true,
                            data: result,
                            error: null,
                            isLoading: false,
                        });
                        resolve(result);
                    },
                    (error: unknown) => {
                        const errorMessage = error instanceof Error
                            ? error.message
                            : 'Service call failed';
                        setResponse({
                            success: false,
                            data: null,
                            error: errorMessage,
                            isLoading: false,
                        });
                        reject(new Error(errorMessage));
                    }
                );
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to create service';
            setResponse({
                success: false,
                data: null,
                error: errorMessage,
                isLoading: false,
            });
            throw new Error(errorMessage);
        }
    }, [ros, serviceName, serviceType]);

    return [callService, response];
}
