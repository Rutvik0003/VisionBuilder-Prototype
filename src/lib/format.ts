import dayjs from 'dayjs';

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const fmtDate = (d: string) => dayjs(d).format('ddd, D MMM');
export const fmtTime = (d: string) => dayjs(d).format('h:mm A');
export const fmtDateTime = (d: string) => dayjs(d).format('ddd D MMM, h:mm A');
export const discountPct = (price: number, mrp: number) => Math.round((1 - price / mrp) * 100);
