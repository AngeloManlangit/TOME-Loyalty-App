export const brands: Brand[] = [
    {
        brand_id: 0,
        name: 'Crocs',
        logo: require('@/assets/images/brandLogos/crocs-logo.png')
    },
    {
        brand_id: 1,
        name: 'New Era',
        logo: require('@/assets/images/brandLogos/new-era-logo.png')
    },
    {
        brand_id: 2,
        name: 'Nike',
        logo: require('@/assets/images/brandLogos/nike-logo.png')
    },
    {
        brand_id: 3,
        name: 'Adidas',
        logo: require('@/assets/images/brandLogos/adidas-logo.png')
    },
    {
        brand_id: 4,
        name: 'Levi\'s',
        logo: require('@/assets/images/brandLogos/levis-logo.webp')
    },
    {
        brand_id: 5,
        name: 'Casio',
        logo: require('@/assets/images/brandLogos/casio-logo.webp')
    }
] as const;

export interface Brand {
    brand_id: number;
    name: string;
    logo: any;
    promos?: string | null;
    display_images?: string;
}