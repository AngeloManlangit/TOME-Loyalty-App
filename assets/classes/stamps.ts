export interface StampCardDetails {
    owner: string;
    stamp_ID: number;
    stampCard_bgImage?: string | null; // url to bg image
    stampCard_color: string;
    stampCard_title: string;
    stamp_count: number;
    stamp_total: number;
    stamp_reward_index: number[];
}