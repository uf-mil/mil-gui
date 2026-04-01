import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRos } from '../components/RosContext';
import { LaunchChecklistConfig, ServiceSpec } from '../config/launchChecklistConfig';
import { useControllerState } from './useControllerState';
import { RosGraphState } from './useRosGraph';
import { useService } from './useService';
import { useTopic } from './useTopic';
import { useTopicActivity } from './useTopicActivity';

export type KillState = 'KILLED' | 'UNKILLED' | 'UNKNOWN';

interface ActionUiState {
    isLoading: boolean;
    error: string | null;
}

export interface ChecklistStepState {
    killState: KillState;
    localizationRunning: boolean;
    localizationHz: number;
    resetDoneForCurrentCycle: boolean;
    stabilizationElapsedSec: number;
    stabilizationRequiredSec: number;
    stabilizationReady: boolean;
}

export interface ChecklistHandlers {
    unkill: () => Promise<void>;
    startLocalization: () => Promise<void>;
    resetLocalization: () => Promise<void>;
    startController: () => Promise<void>;
    launchSub: () => Promise<void>;
    kill: () => Promise<void>;
}

export interface ChecklistButtonStates {
    unkillDisabled: boolean;
    startLocalizationDisabled: boolean;
    resetLocalizationDisabled: boolean;
    startControllerDisabled: boolean;
    launchSubDisabled: boolean;
    killDisabled: boolean;
}

export interface ChecklistState {
    connected: boolean;
    controllerState: ReturnType<typeof useControllerState>;
    stepState: ChecklistStepState;
    handlers: ChecklistHandlers;
    buttonStates: ChecklistButtonStates;
    launchBlockReasons: string[];
    dependencyBlockReasons: string[];
    actionStates: {
        unkill: ActionUiState;
        startLocalization: ActionUiState;
        resetLocalization: ActionUiState;
        startController: ActionUiState;
        launchSub: ActionUiState;
        kill: ActionUiState;
    };
}

type SetBoolResponse = {
    success?: boolean;
    message?: string;
};

function isActionConfigured(action: ServiceSpec): boolean {
    return (action.enabled ?? true) && action.name.trim().length > 0 && action.type.trim().length > 0;
}

function parseServiceSuccess(result: Record<string, unknown>): { ok: boolean; message?: string } {
    const success = result.success;
    if (typeof success === 'boolean') {
        const message = typeof result.message === 'string' ? result.message : undefined;
        return { ok: success, message };
    }
    return { ok: true };
}

function parseKillStateFromMessage(message: Record<string, unknown> | null): KillState {
    if (!message) {
        return 'UNKNOWN';
    }

    if (typeof message.data === 'boolean') {
        return message.data ? 'KILLED' : 'UNKILLED';
    }

    if (typeof message.killed === 'boolean') {
        return message.killed ? 'KILLED' : 'UNKILLED';
    }

    if (typeof message.data === 'string') {
        const normalized = message.data.trim().toLowerCase();
        if (['killed', 'kill', 'true', 'on'].includes(normalized)) {
            return 'KILLED';
        }
        if (['unkilled', 'alive', 'false', 'off'].includes(normalized)) {
            return 'UNKILLED';
        }
    }

    return 'UNKNOWN';
}

function normalizeName(name: string): string {
    return name.startsWith('/') ? name.slice(1) : name;
}

export function useChecklistState(config: LaunchChecklistConfig, rosGraph: RosGraphState): ChecklistState {
    const { connected } = useRos();

    const controllerState = useControllerState(config.controller, rosGraph.runningTopics);
    const [, localizationHz] = useTopic<Record<string, unknown>>(
        config.localization.odomTopic.name,
        config.localization.odomTopic.type
    );

    const killSpecs = useMemo(
        () => (config.killStateTopic ? [config.killStateTopic] : []),
        [config.killStateTopic]
    );
    const killActivity = useTopicActivity(killSpecs)[0];

    const [callUnkill, unkillService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.unkill.name,
        config.actions.unkill.type
    );
    const [callStartLocalization, startLocalizationService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.startLocalization.name,
        config.actions.startLocalization.type
    );
    const [callResetLocalization, resetLocalizationService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.resetLocalization.name,
        config.actions.resetLocalization.type
    );
    const [callStartController, startControllerService] = useService<Record<string, unknown>, SetBoolResponse>(
        config.actions.startController.name,
        config.actions.startController.type
    );
    const [callLaunchSub, launchSubService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.launchSub.name,
        config.actions.launchSub.type
    );
    const [callKill, killService] = useService<Record<string, unknown>, Record<string, unknown>>(
        config.actions.kill.name,
        config.actions.kill.type
    );

    const [manualUnkillConfirmed, setManualUnkillConfirmed] = useState<boolean>(false);
    const [localizationCycle, setLocalizationCycle] = useState<number>(0);
    const [resetDoneCycle, setResetDoneCycle] = useState<number | null>(null);
    const [stabilizationStartMs, setStabilizationStartMs] = useState<number | null>(null);
    const [nowMs, setNowMs] = useState<number>(Date.now());

    const prevLocalizationRunningRef = useRef<boolean>(false);

    const localizationRunning = localizationHz > 0;

    useEffect(() => {
        if (!connected) {
            setManualUnkillConfirmed(false);
        }
    }, [connected]);

    useEffect(() => {
        const intervalRef: ReturnType<typeof setInterval> = setInterval(() => {
            setNowMs(Date.now());
        }, 250);

        return () => {
            clearInterval(intervalRef);
        };
    }, []);

    useEffect(() => {
        const prevRunning = prevLocalizationRunningRef.current;
        if (localizationRunning && !prevRunning) {
            setLocalizationCycle((previous) => previous + 1);
            setResetDoneCycle(null);
            setStabilizationStartMs(null);
        }

        if (!localizationRunning && prevRunning) {
            setStabilizationStartMs(null);
        }

        prevLocalizationRunningRef.current = localizationRunning;
    }, [localizationRunning]);

    const resetDoneForCurrentCycle = resetDoneCycle !== null && resetDoneCycle === localizationCycle;

    const stabilizationElapsedSec = useMemo(() => {
        if (!resetDoneForCurrentCycle || stabilizationStartMs === null || !localizationRunning) {
            return 0;
        }
        return Number(((nowMs - stabilizationStartMs) / 1000).toFixed(2));
    }, [localizationRunning, nowMs, resetDoneForCurrentCycle, stabilizationStartMs]);

    const stabilizationReady =
        resetDoneForCurrentCycle
        && localizationRunning
        && stabilizationElapsedSec >= config.localization.stableSeconds;

    const telemetryKillState = parseKillStateFromMessage(killActivity?.lastMessage ?? null);
    const killState: KillState = telemetryKillState !== 'UNKNOWN'
        ? telemetryKillState
        : (manualUnkillConfirmed ? 'UNKILLED' : 'UNKNOWN');

    const dependencyBlockReasons = connected
        ? rosGraph.dependencyBlockReasons
        : ['ROS comms disconnected'];

    const launchSubConfigured = isActionConfigured(config.actions.launchSub);

    const runningServiceSet = useMemo(
        () => new Set(rosGraph.runningServices.map(normalizeName)),
        [rosGraph.runningServices]
    );

    const actionServiceAvailability = useMemo(() => {
        const isAvailable = (serviceName: string): boolean => runningServiceSet.has(normalizeName(serviceName));
        return {
            unkill: isAvailable(config.actions.unkill.name),
            startLocalization: isAvailable(config.actions.startLocalization.name),
            resetLocalization: isAvailable(config.actions.resetLocalization.name),
            startController: isAvailable(config.actions.startController.name),
            launchSub: config.actions.launchSub.name.trim().length > 0
                ? isAvailable(config.actions.launchSub.name)
                : false,
            kill: isAvailable(config.actions.kill.name),
        };
    }, [
        config.actions.kill.name,
        config.actions.launchSub.name,
        config.actions.resetLocalization.name,
        config.actions.startController.name,
        config.actions.startLocalization.name,
        config.actions.unkill.name,
        runningServiceSet,
    ]);

    const launchBlockReasons = useMemo(() => {
        const reasons: string[] = [...dependencyBlockReasons];

        if (!connected) {
            reasons.push('ROS bridge is disconnected');
        }

        if (killState !== 'UNKILLED') {
            reasons.push(`Kill state is ${killState}; run Unkill first`);
        }

        if (!actionServiceAvailability.unkill) {
            reasons.push(`Missing service: ${config.actions.unkill.name}`);
        }
        if (!actionServiceAvailability.startLocalization) {
            reasons.push(`Missing service: ${config.actions.startLocalization.name}`);
        }
        if (!actionServiceAvailability.resetLocalization) {
            reasons.push(`Missing service: ${config.actions.resetLocalization.name}`);
        }
        if (!actionServiceAvailability.startController) {
            reasons.push(`Missing service: ${config.actions.startController.name}`);
        }

        if (!localizationRunning) {
            reasons.push('Localization is not running');
        }

        if (!resetDoneForCurrentCycle) {
            reasons.push('Localization reset is required once per start cycle');
        }

        if (resetDoneForCurrentCycle && !stabilizationReady) {
            reasons.push(
                `Localization must remain stable for ${config.localization.stableSeconds}s after reset (currently ${stabilizationElapsedSec.toFixed(2)}s)`
            );
        }

        if (!controllerState.isOn) {
            reasons.push(`Controller is OFF (${controllerState.detail})`);
        }

        if (!launchSubConfigured) {
            reasons.push('Launch Sub action is not configured (set name/type in launchChecklistConfig)');
        }

        return reasons;
    }, [
        connected,
        actionServiceAvailability.resetLocalization,
        actionServiceAvailability.startController,
        actionServiceAvailability.startLocalization,
        actionServiceAvailability.unkill,
        config.actions.resetLocalization.name,
        config.actions.startController.name,
        config.actions.startLocalization.name,
        config.actions.unkill.name,
        controllerState.detail,
        controllerState.isOn,
        dependencyBlockReasons,
        killState,
        launchSubConfigured,
        localizationRunning,
        resetDoneForCurrentCycle,
        stabilizationElapsedSec,
        stabilizationReady,
        config.localization.stableSeconds,
    ]);

    const callAction = useCallback(async (
        action: ServiceSpec,
        callback: (request: Record<string, unknown>) => Promise<Record<string, unknown>>,
        onSuccess?: () => void
    ) => {
        if (!isActionConfigured(action)) {
            throw new Error(`${action.label} action is not configured`);
        }

        const result = await callback(action.request ?? {});
        const parsed = parseServiceSuccess(result);
        if (!parsed.ok) {
            throw new Error(parsed.message ?? `${action.label} service returned success=false`);
        }

        if (onSuccess) {
            onSuccess();
        }
    }, []);

    const handlers: ChecklistHandlers = {
        unkill: async () => {
            await callAction(config.actions.unkill, callUnkill, () => {
                setManualUnkillConfirmed(true);
            });
        },
        startLocalization: async () => {
            await callAction(config.actions.startLocalization, callStartLocalization);
        },
        resetLocalization: async () => {
            await callAction(config.actions.resetLocalization, callResetLocalization, () => {
                setResetDoneCycle(localizationCycle);
                setStabilizationStartMs(localizationRunning ? Date.now() : null);
            });
        },
        startController: async () => {
            if (!isActionConfigured(config.actions.startController)) {
                throw new Error('Start Controller action is not configured');
            }
            const result = await callStartController(config.actions.startController.request ?? {});
            const parsed = parseServiceSuccess(result as unknown as Record<string, unknown>);
            if (!parsed.ok) {
                throw new Error(parsed.message ?? 'Start Controller service returned success=false');
            }
        },
        launchSub: async () => {
            await callAction(config.actions.launchSub, callLaunchSub);
        },
        kill: async () => {
            if (!actionServiceAvailability.kill) {
                throw new Error(`Missing service: ${config.actions.kill.name}`);
            }
            await callAction(config.actions.kill, callKill, () => {
                setManualUnkillConfirmed(false);
            });
        },
    };

    const buttonStates: ChecklistButtonStates = {
        unkillDisabled:
            !connected
            || killState === 'UNKILLED'
            || !actionServiceAvailability.unkill
            || !isActionConfigured(config.actions.unkill)
            || unkillService.isLoading,
        startLocalizationDisabled:
            !connected
            || !actionServiceAvailability.startLocalization
            || !isActionConfigured(config.actions.startLocalization)
            || localizationRunning
            || killState !== 'UNKILLED'
            || startLocalizationService.isLoading,
        resetLocalizationDisabled:
            !connected
            || !actionServiceAvailability.resetLocalization
            || !isActionConfigured(config.actions.resetLocalization)
            || !localizationRunning
            || resetDoneForCurrentCycle
            || resetLocalizationService.isLoading,
        startControllerDisabled:
            !connected
            || !actionServiceAvailability.startController
            || !isActionConfigured(config.actions.startController)
            || controllerState.isOn
            || !localizationRunning
            || !resetDoneForCurrentCycle
            || !stabilizationReady
            || startControllerService.isLoading,
        launchSubDisabled:
            launchBlockReasons.length > 0
            || launchSubService.isLoading,
        killDisabled:
            !connected
            || !actionServiceAvailability.kill
            || !isActionConfigured(config.actions.kill)
            || killService.isLoading,
    };

    return {
        connected,
        controllerState,
        stepState: {
            killState,
            localizationRunning,
            localizationHz,
            resetDoneForCurrentCycle,
            stabilizationElapsedSec,
            stabilizationRequiredSec: config.localization.stableSeconds,
            stabilizationReady,
        },
        handlers,
        buttonStates,
        launchBlockReasons,
        dependencyBlockReasons,
        actionStates: {
            unkill: {
                isLoading: unkillService.isLoading,
                error: unkillService.error,
            },
            startLocalization: {
                isLoading: startLocalizationService.isLoading,
                error: startLocalizationService.error,
            },
            resetLocalization: {
                isLoading: resetLocalizationService.isLoading,
                error: resetLocalizationService.error,
            },
            startController: {
                isLoading: startControllerService.isLoading,
                error: startControllerService.error,
            },
            launchSub: {
                isLoading: launchSubService.isLoading,
                error: launchSubService.error,
            },
            kill: {
                isLoading: killService.isLoading,
                error: actionServiceAvailability.kill
                    ? killService.error
                    : `Missing service: ${config.actions.kill.name}`,
            },
        },
    };
}
