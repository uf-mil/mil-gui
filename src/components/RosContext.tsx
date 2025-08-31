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


    function connect_to_ros() {
        rosRef.current.connect('ws://localhost:9090');
    }

    // on start up
    useEffect(() => {

        // Initialize ROS instance TODO maybe only connect if not connected??
        connect_to_ros()

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
