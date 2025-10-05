import React, { useState, useEffect } from 'react';
import ROSLIB from 'roslib'; 

function RosNodeStatus() {
    const expectedNodes = ['a', 'b', 'c'];
    const actualNodes = ['a', 'b', 'd']; // Using the example from the issue

    const [runningNodes] = useState<string[]>(actualNodes);

    const greenNodes = runningNodes.filter(node => expectedNodes.includes(node));
    const redNodes = expectedNodes.filter(node => !runningNodes.includes(node));
    const yellowNodes = runningNodes.filter(node => !expectedNodes.includes(node));

    return (
        <div style={{ fontFamily: 'sans-serif', display: 'flex', justifyContent: 'space-around' }}>
        {/* Green Box */}
        <div style={{ border: '1px solid #2e7d32', borderRadius: '8px', padding: '10px', backgroundColor: '#e8f5e9', width: '30%' }}>
            <h2 style={{ color: '#2e7d32' }}>Running</h2>
            <ul>
                {greenNodes.length > 0 ? (
                greenNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>

      {/* Red Box */}
        <div style={{ border: '1px solid #c62828', borderRadius: '8px', padding: '10px', backgroundColor: '#ffebee', width: '30%' }}>
            <h2 style={{ color: '#c62828' }}>Missing</h2>
            <ul>
                {redNodes.length > 0 ? (
                redNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>

      {/* Yellow Box */}
        <div style={{ border: '1px solid #f9a825', borderRadius: '8px', padding: '10px', backgroundColor: '#fffde7', width: '30%' }}>
            <h2 style={{ color: '#f9a825' }}>Unexpected</h2>
            <ul>
                {yellowNodes.length > 0 ? (
                yellowNodes.map(node => <li key={node}>{node}</li>)
                ) : (
                <li>None</li>
                )}
            </ul>
        </div>
    </div>
  );
}

export default RosNodeStatus;