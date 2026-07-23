interface StampCardConfigs {
    bgColor: string;
    bgImage?: string | null;
    seed: number;
    title: string;
}

interface StampHistory {
    receipt_ID: string;
    time_stamped: Date;
}

export interface StampCardDetails {
    owner_ID: string;
    stamp_ID: number;
    stampCard_configs: StampCardConfigs;
    stamp_count: number;
    stamp_total: number;
    stamp_reward_index: number[];
    history?: StampHistory[];
}