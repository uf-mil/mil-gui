import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import * as ROSLIB from 'roslib';

// Define types for context
interface RosContextType {
    ros: ROSLIB.Ros;
    connected: boolean;
}

// this is the one and only place EVER where new ROSLIB.Ros({}) should exist in the entire frontend
const ros = new ROSLIB.Ros({})

// Create context with default values
const RosContext = createContext<RosContextType>({ ros: ros, connected: false });

interface RosProviderProps {
    children: ReactNode;
}

export function RosProvider({ children }: RosProviderProps) {
    const [connected, setConnected] = useState<boolean>(false);

    const rosRef = useRef<ROSLIB.Ros>(ros);
    rosRef.current.on('connection', function() {
        console.log('Connected to ROS!');
        setConnected(true);
    });

    rosRef.current.on('error', function(error) {
        console.log('ROS connection error:', error);
        setConnected(false);
    });

    rosRef.current.on('close', function() {
        console.log('ROS connection closed');
        setConnected(false);
    });


    /**
     * resolve the ROS bridge websocket URL, made it ***Dynamic*** :)
     * priority (highest to lowest):
     * - URL query params: ?ros_host=HOST&ros_port=PORT or ?ros_ws=ws://host:port
     * - localStorage: ros.host, ros.port, ros.ws
     * - ENV (build-time): REACT_APP_ROSBRIDGE_HOST, REACT_APP_ROSBRIDGE_PORT
     * - if page host is not localhost/127.0.0.1, use window.location.hostname
     * - fallback default: localhost:9090 (works with WSL2)
     */
    function getRosBridgeUrl(): string {
        try {
            const params = new URLSearchParams(window.location.search);
            const qpWs = params.get('ros_ws');
            if (qpWs) return qpWs;

            const lsWs = localStorage.getItem('ros.ws');
            if (lsWs) return lsWs;

            const qpHost = params.get('ros_host') ?? localStorage.getItem('ros.host') ?? process.env.REACT_APP_ROSBRIDGE_HOST ?? '';
            const qpPort = params.get('ros_port') ?? localStorage.getItem('ros.port') ?? process.env.REACT_APP_ROSBRIDGE_PORT ?? '';

            const pageHost = window.location.hostname;
            // default to localhost (works with WSL2), or use page hostname if deployed remotely
            const defaultHost = (pageHost && pageHost !== 'localhost' && pageHost !== '127.0.0.1') ? pageHost : 'localhost';
            const host = qpHost || defaultHost;
            const port = qpPort || '9090';
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            return `${protocol}://${host}:${port}`;
        } catch {
            // safe fallback
            return 'ws://localhost:9090';
        }
    }

    function connect_to_ros() {
        const url = getRosBridgeUrl();
        console.log(`[ROS] connecting to ${url}`);
        rosRef.current.connect(url);
    }

    // on start up
    useEffect(() => {

        // Initialize ROS instance 
        if (!rosRef.current.isConnected){
            connect_to_ros()
        }

        // Cleanup on unmount
        return () => {
            if (rosRef.current.isConnected) {
                rosRef.current.close();
            }
        };
    }, []);

    // on connect or disconnect
    const reconnectTimerRef = useRef<NodeJS.Timer | null>(null);
    const reconnectInterval = 5000; // in ms
    useEffect(() => {
        // if connected, stop trying to connect and return
        const connected_but_still_trying_to_reconnect = (connected === true) && !(reconnectTimerRef.current === null)
        if (connected_but_still_trying_to_reconnect) {
            clearInterval(reconnectTimerRef.current!)
            reconnectTimerRef.current = null
            return
        }

        // if not connected and not trying to reconnect, start trying
        const not_connected_and_not_trying_to_reconnect = (connected === false) && (reconnectTimerRef.current === null)
        if (not_connected_and_not_trying_to_reconnect) {
            reconnectTimerRef.current = setInterval(connect_to_ros, reconnectInterval)
        }

        // Cleanup on unmount
        return () => {
            clearInterval(reconnectTimerRef.current!)
            reconnectTimerRef.current = null
        };
    }, [connected])

    return (
        <RosContext.Provider value={{ ros: rosRef.current, connected }}>
            {children}
        </RosContext.Provider>
    );
}

// super awesome custom hook
// useRos(); and then you have access to the websocket wrapper
export function useRos(): RosContextType {
    const context = useContext(RosContext);
    if (context === undefined) {
        throw new Error('useRos must be used within a RosProvider');
    }
    return context;
}
