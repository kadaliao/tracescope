import type { TraceHop, TraceProvider, TraceResult } from './types'
export const demoPhysicalOrigin = { latitude: 31.2304, longitude: 121.4737, city: '上海', country: '中国' }
const hop = (ttl: number, ip: string, asn: string, provider: string, city: string, country: string, latitude: number, longitude: number, latencyMs: number): TraceHop => ({ id: `${ttl}-${ip}`, ttl, ip, asn, provider, geo: { city, country, latitude, longitude }, latencyMs })
const routes: Record<string, Omit<TraceResult, 'id' | 'target' | 'measuredAt' | 'isDemo' | 'physicalOrigin' | 'destination'>> = {
  google: { targetLabel: 'Google Public DNS', sourceLabel: '上海，本地网络', hops: [hop(1,'192.168.1.1','AS-PRIVATE','本地网关','上海','中国',31.2304,121.4737,1),hop(2,'101.95.219.1','AS4812','中国电信','上海','中国',31.2304,121.4737,5),hop(3,'202.97.50.161','AS4134','China Telecom Backbone','上海','中国',31.2304,121.4737,9),hop(4,'202.97.33.98','AS4134','China Telecom Backbone','香港','中国香港',22.3193,114.1694,31),hop(5,'72.14.202.170','AS15169','Google','东京','日本',35.6762,139.6503,68),hop(6,'108.170.243.193','AS15169','Google','圣何塞','美国',37.3382,-121.8863,143),hop(7,'8.8.8.8','AS15169','Google Public DNS','山景城','美国',37.3861,-122.0839,149)] },
  bilibili: { targetLabel: 'Bilibili', sourceLabel: '上海，本地网络', hops: [hop(1,'192.168.1.1','AS-PRIVATE','本地网关','上海','中国',31.2304,121.4737,1),hop(2,'101.95.219.1','AS4812','中国电信','上海','中国',31.2304,121.4737,4),hop(3,'202.97.65.114','AS4134','China Telecom Backbone','杭州','中国',30.2741,120.1551,10),hop(4,'120.92.13.111','AS45062','Bilibili','上海','中国',31.2304,121.4737,16),hop(5,'120.92.13.114','AS45062','Bilibili Edge','上海','中国',31.2304,121.4737,18)] },
  singapore: { targetLabel: 'Singapore Edge', sourceLabel: '上海，本地网络', hops: [hop(1,'192.168.1.1','AS-PRIVATE','本地网关','上海','中国',31.2304,121.4737,1),hop(2,'101.95.219.1','AS4812','中国电信','上海','中国',31.2304,121.4737,5),hop(3,'202.97.33.98','AS4134','China Telecom Backbone','香港','中国香港',22.3193,114.1694,28),hop(4,'63.217.19.37','AS3491','PCCW Global','新加坡','新加坡',1.3521,103.8198,52),hop(5,'139.99.1.14','AS16276','OVHcloud','新加坡','新加坡',1.3521,103.8198,55)] },
}
const destinations = [
  ['tokyo-edge','Tokyo Edge','东京','日本',35.6762,139.6503,'AS2516',61], ['seoul-edge','Seoul Edge','首尔','韩国',37.5665,126.978,'AS4766',48], ['taipei-edge','Taipei Edge','台北','中国台湾',25.033,121.5654,'AS3462',39], ['hongkong-edge','Hong Kong Edge','香港','中国香港',22.3193,114.1694,'AS9304',31], ['bangkok-edge','Bangkok Edge','曼谷','泰国',13.7563,100.5018,'AS7470',66], ['jakarta-edge','Jakarta Edge','雅加达','印度尼西亚',-6.2088,106.8456,'AS7713',83], ['manila-edge','Manila Edge','马尼拉','菲律宾',14.5995,120.9842,'AS4775',75], ['mumbai-edge','Mumbai Edge','孟买','印度',19.076,72.8777,'AS4755',112], ['dubai-edge','Dubai Edge','迪拜','阿联酋',25.2048,55.2708,'AS15802',143], ['frankfurt-edge','Frankfurt Edge','法兰克福','德国',50.1109,8.6821,'AS3320',186], ['london-edge','London Edge','伦敦','英国',51.5072,-0.1276,'AS3356',205], ['paris-edge','Paris Edge','巴黎','法国',48.8566,2.3522,'AS3215',198], ['amsterdam-edge','Amsterdam Edge','阿姆斯特丹','荷兰',52.3676,4.9041,'AS1103',193], ['sydney-edge','Sydney Edge','悉尼','澳大利亚',-33.8688,151.2093,'AS1221',132], ['melbourne-edge','Melbourne Edge','墨尔本','澳大利亚',-37.8136,144.9631,'AS7545',138], ['losangeles-edge','Los Angeles Edge','洛杉矶','美国',34.0522,-118.2437,'AS7922',152], ['seattle-edge','Seattle Edge','西雅图','美国',47.6062,-122.3321,'AS16509',157],
] as const
for (const [id, label, city, country, latitude, longitude, asn, latency] of destinations) {
  const viaHongKong = longitude < 80 || longitude > 130
  routes[id] = { targetLabel: label, sourceLabel: '上海，本地网络', hops: [hop(1, `10.0.${routes[id]?.hops.length ?? 1}.1`, 'AS-PRIVATE', '本地网关', '上海', '中国', 31.2304, 121.4737, 1), hop(2, `101.95.${latency}.1`, 'AS4812', '中国电信', '上海', '中国', 31.2304, 121.4737, 6), ...(viaHongKong ? [hop(3, `202.97.${latency}.9`, 'AS4134', 'China Telecom Backbone', '香港', '中国香港', 22.3193, 114.1694, Math.round(latency * .3))] : [hop(3, `202.97.${latency}.7`, 'AS4134', 'China Telecom Backbone', '北京', '中国', 39.9042, 116.4074, Math.round(latency * .25))]), hop(4, `203.0.113.${latency % 250}`, asn, label, city, country, latitude, longitude, latency)] }
}
export const initialDemoTargets = ['google', 'bilibili', 'singapore', ...destinations.map(([id]) => id)]
function demoResult(target: string): TraceResult {
  const route = routes[target] ?? routes.google
  return { ...route, physicalOrigin: { ...demoPhysicalOrigin }, destination: { ...route.hops.at(-1)!.geo }, hops: route.hops.map((item, index) => ({ ...item, role: index === route.hops.length - 1 ? 'destination' : 'trace', geo: { ...item.geo } })), id: `demo-${target}`, target, measuredAt: new Date().toISOString(), isDemo: true }
}
export function createStressDemoResults(count = 100): TraceResult[] {
  return Array.from({ length: count }, (_, index) => {
    const result = demoResult(initialDemoTargets[index % initialDemoTargets.length])
    const destination = result.hops.at(-1)!
    const geo = { ...destination.geo, city: `${destination.geo.city} ${index + 1}`, latitude: destination.geo.latitude + ((index % 7) - 3) * .18, longitude: destination.geo.longitude + ((index % 9) - 4) * .18 }
    return { ...result, id: `stress-${index + 1}`, target: `stress-${index + 1}.example`, targetLabel: `压力目标 ${index + 1}`, destination: geo, hops: [...result.hops.slice(0, -1), { ...destination, id: `stress-destination-${index + 1}`, geo }] }
  })
}
export class DeterministicDemoProvider implements TraceProvider { async trace(target: string): Promise<TraceResult> { await new Promise((resolve) => window.setTimeout(resolve, 260)); return demoResult(target) } }
