import React, { useState } from "react";
import { useTopic } from "../hooks/useTopic";

export default function ThrusterControl() {
  // ROS Topics
  const [_, __, cmdWrench] = useTopic("/cmd_wrench", "geometry_msgs/msg/Wrench");
  const [___, ____, thrusterEfforts] = useTopic("/thruster_efforts", "ThrusterEfforts");

  // Thruster Names
  const thrusterNames = [
    "thrust_flh",
    "thrust_frh",
    "thrust_blh",
    "thrust_bruh",
    "thrust_flv",
    "thrust_frv",
    "thrust_blv",
    "thrust_brv",
  ];

  // State
  const [efforts, setEfforts] = useState<number[]>(Array(thrusterNames.length).fill(0));

  // Command: Send Zero Wrench
  const sendZeroWrench = () => {
    cmdWrench.publish({
      force: { x: 0.0, y: 0.0, z: 0.0 },
      torque: { x: 0.0, y: 0.0, z: 0.0 },
    });
    console.log("Published zero wrench for safety");
  };

  // Command: Send Thruster Efforts
  const sendThrusterEfforts = () => {
    thrusterEfforts.publish({ efforts });
    console.log("Sent thruster efforts:", efforts);
  };

  // UI
  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold">Thruster Control</h2>

      <div className="flex flex-col gap-2">
        {efforts.map((value, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="w-28 text-right">{thrusterNames[i]}</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={value}
              onChange={(e) => {
                const newEfforts = [...efforts];
                newEfforts[i] = parseFloat(e.target.value);
                setEfforts(newEfforts);
              }}
            />
            <span className="w-12 text-sm text-gray-600">{value.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-4">
        <button
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          onClick={sendThrusterEfforts}
        >
          Send Efforts
        </button>
        <button
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          onClick={sendZeroWrench}
        >
          Send Zero Wrench
        </button>
      </div>
    </div>
  );
}
