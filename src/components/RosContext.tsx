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
        clear_timer()
    });

    rosRef.current.on('error', function(error) {
        console.log('ROS connection error:', error);
        setConnected(false);
        set_timer() // for reconnect
    });

    rosRef.current.on('close', function() {
        console.log('ROS connection closed');
        setConnected(false);
        set_timer() // for reconnect
    });

    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectInterval = 1000; // in ms

    // set timer to null
    function clear_timer(){
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            console.log("Reconnect timer cleared");
        }
    }

    // sets a timeout before attempting to connect again
    function set_timer(){
        // if timer already set, do nothing
        if (!(reconnectTimerRef.current === null)) { return }

        console.log(`Scheduling reconnect attempt in ${reconnectInterval}ms`);
        reconnectTimerRef.current = setTimeout(connect_to_ros, reconnectInterval)
    }

    function connect_to_ros(){
        clear_timer()
        rosRef.current.connect('ws://localhost:9090');
    }

    // on start up
    useEffect(() => {

        // Initialize ROS instance TODO maybe only connect if not connected??
        connect_to_ros()

        // Cleanup on unmount
        return () => {
            clear_timer()
            if (rosRef.current.isConnected) {
                rosRef.current.close();
            }
        };
    }, []);

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
