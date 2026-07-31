import { Colors } from "@/src/constants/theme";

export interface StampCardConfigs {
    bgColor: string;
    bgImage?: string | null;
    seed: number;
    title: string;
}

interface StampHistory {
    receipt_ID: string;
    time_stamped: Date;
    receipt_url: string;
}

export interface StampCardDetails {
    owner_ID: string;
    id?: number;
    stampCard_configs: StampCardConfigs;
    stamp_count: number;
    stamp_total: number;
    stamp_reward_index: number[];
    history?: StampHistory[];
    date_created: Date;
}

export const defaultStampCard: StampCardDetails = {
    owner_ID: '0',
    stampCard_configs: {
        bgColor: '#F3BDFF',
        seed: 1,
        title: 'Stamp Card'
    },
    stamp_count: 0,
    stamp_reward_index: [4, 9],
    stamp_total: 10,
    date_created: new Date()
}