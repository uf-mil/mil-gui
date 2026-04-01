export interface ServiceSpec {
    name: string;
    type: string;
    label: string;
    request?: Record<string, unknown>;
    enabled?: boolean;
}

export interface TopicSpec {
    name: string;
    type: string;
    label?: string;
}

export interface RequiredServiceSpec {
    name: string;
    label: string;
    type?: string;
    requiredForLaunch?: boolean;
}

export interface LaunchChecklistConfig {
    pollIntervalMs: number;
    requiredNodes: string[];
    requiredServices: RequiredServiceSpec[];
    requiredTopics: TopicSpec[];
    localization: {
        odomTopic: TopicSpec;
        stableSeconds: number;
    };
    controller: {
        heartbeatTopic?: TopicSpec;
        modeTopic?: TopicSpec;
        commandTopics: TopicSpec[];
        onAgeThresholdSec: number;
    };
    killStateTopic?: TopicSpec;
    actions: {
        kill: ServiceSpec;
        unkill: ServiceSpec;
        startLocalization: ServiceSpec;
        resetLocalization: ServiceSpec;
        startController: ServiceSpec;
        launchSub: ServiceSpec;
    };
    thrusters: {
        topic: TopicSpec;
        zeroWrenchTopic: TopicSpec;
        names: string[];
        maxDurationSeconds: number;
    };
    camera: {
        defaultTopicName: string;
        defaultTopicType: string;
        enableTestPattern: boolean;
    };
}

export const launchChecklistConfig: LaunchChecklistConfig = {
    pollIntervalMs: 2000,
    requiredNodes: [
        'subjugator_localization',
        'pid_controller',
        'thruster_manager',
        'thrust_and_kill_board',
        'front_cam',
        'depth_driver',
        'waterlinked_dvl_driver',
        'vectornav',
        '/rosapi',
        '/rosbridge_websocket',
    ],
    requiredServices: [
        {
            name: '/unkill',
            label: 'Unkill',
            type: 'std_srvs/srv/Empty',
            requiredForLaunch: true,
        },
        {
            name: '/subjugator_localization/enable',
            label: 'Start Localization',
            type: 'std_srvs/srv/Empty',
            requiredForLaunch: true,
        },
        {
            name: '/subjugator_localization/reset',
            label: 'Reset Localization',
            type: 'std_srvs/srv/Empty',
            requiredForLaunch: true,
        },
        {
            name: '/pid_controller/enable',
            label: 'Start Controller',
            type: 'std_srvs/srv/SetBool',
            requiredForLaunch: true,
        },
    ],
    requiredTopics: [
        {
            name: '/odometry/filtered',
            type: 'nav_msgs/msg/Odometry',
            label: 'Localization Odometry',
        },
    ],
    localization: {
        odomTopic: {
            name: '/odometry/filtered',
            type: 'nav_msgs/msg/Odometry',
            label: 'Localization Odometry',
        },
        stableSeconds: 5,
    },
    controller: {
        heartbeatTopic: undefined,
        modeTopic: undefined,
        commandTopics: [
            {
                name: '/thruster_efforts',
                // leave blank to auto-resolve from ROS graph at runtime.
                type: '',
                label: 'Thruster Efforts',
            },
            {
                name: '/cmd_wrench',
                type: 'geometry_msgs/msg/Wrench',
                label: 'Command Wrench',
            },
        ],
        onAgeThresholdSec: 1.0,
    },
    killStateTopic: undefined,
    actions: {
        kill: {
            name: '/kill',
            type: 'std_srvs/srv/Empty',
            label: 'Kill',
            request: {},
            enabled: true,
        },
        unkill: {
            name: '/unkill',
            type: 'std_srvs/srv/Empty',
            label: 'Unkill',
            request: {},
            enabled: true,
        },
        startLocalization: {
            name: '/subjugator_localization/enable',
            type: 'std_srvs/srv/Empty',
            label: 'Start Localization',
            request: {},
            enabled: true,
        },
        resetLocalization: {
            name: '/subjugator_localization/reset',
            type: 'std_srvs/srv/Empty',
            label: 'Reset Localization',
            request: {},
            enabled: true,
        },
        startController: {
            name: '/pid_controller/enable',
            type: 'std_srvs/srv/SetBool',
            label: 'Start Controller',
            request: { data: true },
            enabled: true,
        },
        launchSub: {
            // Configure this for your final mission/arm/operator transition action.
            name: '',
            type: '',
            label: 'Launch Sub',
            request: {},
            enabled: false,
        },
    },
    thrusters: {
        topic: {
            name: '/thruster_efforts',
            // leave blank to auto-resolve from ROS graph at runtime.
            type: '',
            label: 'Thruster Efforts',
        },
        zeroWrenchTopic: {
            name: '/cmd_wrench',
            type: 'geometry_msgs/msg/Wrench',
            label: 'Zero Wrench',
        },
        names: [
            'thrust_flh',
            'thrust_frh',
            'thrust_blh',
            'thrust_brh',
            'thrust_flv',
            'thrust_frv',
            'thrust_blv',
            'thrust_brv',
        ],
        maxDurationSeconds: 2,
    },
    camera: {
        defaultTopicName: '/front_cam/image_compressed',
        defaultTopicType: 'sensor_msgs/msg/CompressedImage',
        enableTestPattern: true,
    },
};
