import React from 'react';

interface SimControlBarProps {
    noHardwareMode: boolean;
    simCameraEnabled: boolean;
    onToggleNoHardware: (next: boolean) => void;
    onToggleSimCamera: (next: boolean) => void;
    errorMessage: string | null;
    onClearError: () => void;
}

function SimControlBar({
    noHardwareMode,
    simCameraEnabled,
    onToggleNoHardware,
    onToggleSimCamera,
    errorMessage,
    onClearError,
}: SimControlBarProps) {
    return (
        <section className="sim-mode-toggle">
            <div className="sim-toggle-row">
                <label>
                    <input
                        type="checkbox"
                        checked={noHardwareMode}
                        onChange={(event) => onToggleNoHardware(event.target.checked)}
                    />
                    Sim / No Hardware Mode
                </label>
                <span>Hides hardware-only requirements and skips the kill gate.</span>
            </div>
            <div className="sim-toggle-row">
                <label className={noHardwareMode ? '' : 'disabled'}>
                    <input
                        type="checkbox"
                        checked={simCameraEnabled}
                        onChange={(event) => onToggleSimCamera(event.target.checked)}
                        disabled={!noHardwareMode}
                    />
                    Simulated Camera
                </label>
                <span>Forces the camera panel into test pattern mode.</span>
            </div>
            {errorMessage && (
                <div className="sim-error">
                    <span>{errorMessage}</span>
                    <button className="link-button" onClick={onClearError}>Dismiss</button>
                </div>
            )}
        </section>
    );
}

export default SimControlBar;
