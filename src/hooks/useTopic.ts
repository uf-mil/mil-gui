import { useEffect, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { useRos } from '../components/RosContext';

type ROSMessageObject = Record<string, any>;

// Generic type for the hook to handle different message types
export function useTopic<T extends ROSMessageObject>(topicName: string, messageType: string) {
  const { ros, connected } = useRos();
  const topicRef = useRef<ROSLIB.Topic | null>(null);
  const [message, setMessage] = useState<T | null>(null);

  // Set up topic when ROS connection changes
  useEffect(() => {
    if (!ros || !ros.isConnected) return;
    
    topicRef.current = new ROSLIB.Topic({
      ros: ros,
      name: topicName,
      messageType: messageType
    });

    // Subscribe to the topic
    topicRef.current.subscribe((msg: ROSLIB.Message) => {
      setMessage(msg as T); // I hate ts
    });

    // Cleanup on unmount or when dependencies change
    return () => {
      if (topicRef.current) {
        topicRef.current.unsubscribe();
        topicRef.current.unadvertise();
      }
    };
  }, [ros, topicName, messageType, connected]);

  // Function to publish messages to the topic
  const publish = (msg: T) => {
    if (topicRef.current && connected) {
      topicRef.current.publish(new ROSLIB.Message(msg));
    } else {
      console.error('Cannot publish: topic not initialized or ROS not connected');
    }
  };

  // Return current message and the topic reference with publish method
  return [message, { topic: topicRef.current, publish }] as const;
}
